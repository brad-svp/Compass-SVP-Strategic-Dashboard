import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, brainOAuthGrants as grants, brainOAuthClients as clients, usersTable } from "@workspace/db";
import { and, eq, or, isNull } from "drizzle-orm";
import * as c from "@workspace/api-zod";
import { z } from "zod";
import { searchBrain } from "../lib/brain/search";
import { saveEntry, entryDetail, actEntry, freshActor } from "../lib/brain/core";
import { requestUpload, completeUpload, fileFor, removeFile } from "../lib/brain/files";
import { adminBrain, updateSettings, queueIndex } from "../lib/brain/admin";
import { SCOPES, consentFor, decideConsent } from "../lib/brain/oauth";
import { skillZip } from "../lib/brain/skill";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { AppError } from "../lib/permissions";
const r=Router();
r.get("/brain",async(req,res)=>res.json(c.GetBrainResponse.parse(await searchBrain(res.locals.actor,req.query))));
r.post("/brain/entries",async(req,res)=>res.status(201).json(await saveEntry(res.locals.actor,c.CreateBrainEntryBody.strict().parse(req.body))));
r.get("/brain/entries/:id",async(req,res)=>res.json(c.GetBrainEntryResponse.parse(await entryDetail(res.locals.actor,req.params.id!))));
r.patch("/brain/entries/:id",async(req,res)=>res.json(await saveEntry(res.locals.actor,c.UpdateBrainEntryBody.strict().parse(req.body),req.params.id!)));
r.post("/brain/entries/:id/action",async(req,res)=>res.json(await actEntry(res.locals.actor,req.params.id!,c.ActOnBrainEntryBody.strict().parse(req.body))));
r.post("/brain/uploads",async(req,res)=>res.status(201).json(await requestUpload(res.locals.actor,c.RequestBrainUploadBody.strict().parse(req.body))));
r.post("/brain/files/:id/complete",async(req,res)=>res.json(await completeUpload(res.locals.actor,req.params.id!)));
r.get("/brain/files/:id",async(req,res)=>{
  const {file,name}=await fileFor(res.locals.actor,req.params.id!);
  res.set({"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,"X-Content-Type-Options":"nosniff","Cache-Control":"no-store"});
  file.createReadStream().on("error",err=>{req.log.error({err},"Brain download failed");if(!res.headersSent)res.status(500).end();else res.destroy();}).pipe(res);
});
r.delete("/brain/files/:id",async(req,res)=>res.json(await removeFile(res.locals.actor,req.params.id!,c.RemoveBrainFileBody.parse(req.body).expectedVersion)));
r.get("/brain/admin",async(_req,res)=>res.json(c.GetBrainAdminResponse.parse(await adminBrain(res.locals.actor))));
r.patch("/brain/settings",async(req,res)=>res.json(await updateSettings(res.locals.actor,req.body)));
r.post("/brain/jobs/:id/retry",async(req,res)=>res.json(await queueIndex(res.locals.actor,req.params.id!)));
r.post("/brain/reindex",async(_req,res)=>res.json(await queueIndex(res.locals.actor)));
r.get("/brain/connections",async(req,res)=>{
  const a=await freshActor(res.locals.actor);
  const gs=await db.select({grant:grants,client:clients}).from(grants).leftJoin(clients,eq(grants.clientId,clients.id)).where(eq(grants.actorId,a.id));
  const published=!!process.env.REPLIT_DEPLOYMENT;
  const origin=published?process.env.SVP_PUBLIC_ORIGIN:(getClerkProxyHost(req)===process.env.REPLIT_DEV_DOMAIN?`https://${process.env.REPLIT_DEV_DOMAIN}`:null);
  res.json(c.GetBrainConnectionsResponse.parse({mcpUrl:origin?`${origin}/api/mcp`:"",published,clientId:"",scopes:SCOPES,skillUrl:"/api/svp/brain/skill.zip",
    grants:gs.map(({grant:g,client})=>({id:g.id,clientName:String(client?.metadata.client_name??"MCP client"),scopes:g.scopes,createdAt:g.createdAt.toISOString(),lastUsedAt:g.lastUsedAt?.toISOString()??null,revokedAt:g.revokedAt?.toISOString()??null})),
    message:published?"Use this published MCP URL in Claude Settings → Connectors. Each user must sign in with their real invited SVP Google account and approve the requested scopes.":"Development endpoint only. For a durable Claude connection publish this version first, then use the published connection URL. Quick-login identities cannot authorize MCP."}));
});
r.delete("/brain/connections/:id",async(req,res)=>{
  await db.update(grants).set({revokedAt:new Date()}).where(and(eq(grants.id,req.params.id!),eq(grants.actorId,res.locals.actor.id)));
  res.json({id:req.params.id});
});
// The existing staff middleware already checked verified Google identity and the staff email.
// Bind the real identity only here, never through dev-login or MCP bearer requests.
r.use("/brain/oauth/requests/:id",async(req,res,next)=>{
  const userId=getAuth(req).userId,a=res.locals.actor;
  if(!userId||!a.email?.endsWith("@svpsacramento.org")||a.id.startsWith("svp-dev-"))throw new AppError(403,"Use your real SVP Google staff sign-in to connect Claude.");
  await db.update(usersTable).set({clerkId:userId}).where(and(eq(usersTable.id,a.id),eq(usersTable.active,true),or(isNull(usersTable.clerkId),eq(usersTable.clerkId,userId))));
  res.locals.actor=await freshActor(a);next();
});
r.get("/brain/oauth/requests/:id",async(req,res)=>res.json(c.GetBrainConsentResponse.parse(await consentFor(res.locals.actor,req.params.id!))));
r.post("/brain/oauth/requests/:id",async(req,res)=>res.json(await decideConsent(res.locals.actor,req.params.id!,z.object({allow:z.boolean()}).strict().parse(req.body).allow)));
r.get("/brain/skill.zip",(_req,res)=>res.set({"Content-Type":"application/zip","Content-Disposition":"attachment; filename=svp-compass-brain.zip"}).send(skillZip()));
export default r;
