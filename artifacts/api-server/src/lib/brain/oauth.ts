import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { db, brainOAuthClients as clients, brainOAuthRequests as requests, brainOAuthGrants as grants, brainOAuthTokens as tokens, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidGrantError, InvalidTokenError, InvalidScopeError, InvalidRequestError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { Response } from "express";
import { AppError, type StaffActor } from "../permissions";
import { freshActor } from "./core";
export const SCOPES=["brain:read","operations:read","brain:write"];
export const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const secret=()=>randomBytes(32).toString("base64url");
type Grant=typeof grants.$inferSelect;
const realStaff=(a:StaffActor)=>a.active&&!!a.clerkId&&!!a.email?.endsWith("@svpsacramento.org")&&!a.id.startsWith("svp-dev-");
export function validRedirect(uri:string) {
  try{const u=new URL(uri);return !u.hash&&!u.username&&!u.password&&(u.protocol==="https:"||u.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(u.hostname));}catch{return false;}
}
export class BrainOAuth implements OAuthServerProvider {
  constructor(readonly origin:string) {}
  get resource(){return `${this.origin}/api/mcp`;}
  clientsStore={
    getClient:async(id:string)=>{
      const [c]=await db.select().from(clients).where(eq(clients.id,id));
      return c?.metadata as OAuthClientInformationFull|undefined;
    },
    registerClient:async(raw:Omit<OAuthClientInformationFull,"client_id"|"client_id_issued_at">)=>{
      if(!raw.redirect_uris.length||raw.redirect_uris.length>10||raw.redirect_uris.some(s=>!validRedirect(s)))throw new InvalidRequestError("Exact HTTPS callback URLs are required.");
      // Public PKCE clients only: do not persist client secrets or permit weaker grants.
      if(raw.token_endpoint_auth_method&&raw.token_endpoint_auth_method!=="none")throw new InvalidRequestError("Register as a public PKCE client (none).");
      const c:OAuthClientInformationFull={...raw,client_id:randomUUID(),client_id_issued_at:Math.floor(Date.now()/1000),token_endpoint_auth_method:"none",grant_types:["authorization_code","refresh_token"],response_types:["code"]};
      await db.insert(clients).values({id:c.client_id,metadata:c});return c;
    },
  };
  async authorize(client:OAuthClientInformationFull,p:AuthorizationParams,res:Response) {
    const scopes=p.scopes?.length?p.scopes:["brain:read","operations:read"];
    if(scopes.some(s=>!SCOPES.includes(s)))throw new InvalidScopeError("Unknown scope.");
    if(p.resource?.href!==this.resource)throw new InvalidRequestError("Resource must be the exact SVP MCP URL.");
    if(!client.redirect_uris.includes(p.redirectUri)||!validRedirect(p.redirectUri))throw new InvalidRequestError("Unregistered redirect.");
    const id=secret();
    await db.insert(requests).values({id,clientId:client.client_id,redirectUri:p.redirectUri,challenge:p.codeChallenge,state:p.state,scopes,resource:this.resource,expiresAt:new Date(Date.now()+10*60000)});
    res.redirect(`${this.origin}/brain/consent?request=${encodeURIComponent(id)}`);
  }
  async challengeForAuthorizationCode(client:OAuthClientInformationFull,code:string) {
    const [r]=await db.select().from(requests).where(and(eq(requests.codeHash,hash(code)),eq(requests.clientId,client.client_id)));
    if(!r||r.consumedAt||r.expiresAt<new Date()||r.resource!==this.resource)throw new InvalidGrantError("Invalid or expired code.");
    return r.challenge;
  }
  async issue(tx:Parameters<Parameters<typeof db.transaction>[0]>[0],g:Grant):Promise<OAuthTokens> {
    const access=secret(),refresh=secret();
    await tx.insert(tokens).values([{hash:hash(access),grantId:g.id,kind:"access",expiresAt:new Date(Date.now()+3600000)},{hash:hash(refresh),grantId:g.id,kind:"refresh",expiresAt:new Date(Date.now()+30*86400000)}]);
    return {access_token:access,refresh_token:refresh,token_type:"Bearer",expires_in:3600,scope:g.scopes.join(" ")};
  }
  async exchangeAuthorizationCode(client:OAuthClientInformationFull,code:string,verifier?:string,redirectUri?:string,resource?:URL) {
    return db.transaction(async tx=>{
      const [r]=await tx.select().from(requests).where(eq(requests.codeHash,hash(code))).for("update");
      if(!r||r.clientId!==client.client_id||r.consumedAt||!r.actorId||r.expiresAt<new Date()||r.redirectUri!==redirectUri||resource?.href!==r.resource||r.resource!==this.resource)throw new InvalidGrantError("Invalid authorization grant.");
      // The SDK validates PKCE via challengeForAuthorizationCode and deliberately
      // passes undefined here after verification. Validate too for direct callers
      // that explicitly supply a verifier; never disable the SDK's PKCE check.
      if(verifier!==undefined) {
        const challenge=createHash("sha256").update(verifier).digest("base64url");
        if(verifier.length<43||verifier.length>128||challenge.length!==r.challenge.length||!timingSafeEqual(Buffer.from(challenge),Buffer.from(r.challenge)))throw new InvalidGrantError("Invalid PKCE verifier.");
      }
      const [actor]=await tx.select().from(usersTable).where(eq(usersTable.id,r.actorId));
      if(!actor||!realStaff(actor))throw new InvalidGrantError("Active Google staff identity required.");
      const [g]=await tx.insert(grants).values({id:randomUUID(),actorId:actor.id,clientId:client.client_id,scopes:r.scopes,resource:r.resource}).returning();
      await tx.update(requests).set({consumedAt:new Date()}).where(eq(requests.id,r.id));
      return this.issue(tx,g!);
    });
  }
  async exchangeRefreshToken(client:OAuthClientInformationFull,token:string,scopes?:string[],resource?:URL) {
    return db.transaction(async tx=>{
      const [t]=await tx.select().from(tokens).where(eq(tokens.hash,hash(token))).for("update");
      if(!t||t.kind!=="refresh"||t.expiresAt<new Date())throw new InvalidGrantError("Invalid refresh token.");
      const [g]=await tx.select().from(grants).where(eq(grants.id,t.grantId)).for("update");
      if(!g||g.clientId!==client.client_id)throw new InvalidGrantError("Invalid grant.");
      if(t.consumedAt){await tx.update(grants).set({revokedAt:new Date()}).where(eq(grants.id,g.id));return null;}
      const [a]=await tx.select().from(usersTable).where(eq(usersTable.id,g.actorId));
      if(g.revokedAt||!a||!realStaff(a)||resource?.href!==this.resource||g.resource!==this.resource)throw new InvalidGrantError("Grant revoked or wrong resource.");
      if(scopes?.some(s=>!g.scopes.includes(s)))throw new InvalidScopeError("Cannot expand scopes.");
      await tx.update(tokens).set({consumedAt:new Date()}).where(eq(tokens.hash,t.hash));
      if(scopes?.length){await tx.update(grants).set({scopes}).where(eq(grants.id,g.id));return this.issue(tx,{...g,scopes});}
      return this.issue(tx,g);
    }).then(r=>{if(!r)throw new InvalidGrantError("Refresh replay revoked the connection.");return r;});
  }
  async verifyAccessToken(token:string) {
    const [r]=await db.select({token:tokens,grant:grants,actor:usersTable}).from(tokens).innerJoin(grants,eq(tokens.grantId,grants.id)).innerJoin(usersTable,eq(grants.actorId,usersTable.id)).where(eq(tokens.hash,hash(token)));
    if(!r||r.token.kind!=="access"||r.token.expiresAt<new Date()||r.grant.revokedAt||!realStaff(r.actor)||r.grant.resource!==this.resource)throw new InvalidTokenError("Connection expired, revoked, or disabled.");
    await db.update(grants).set({lastUsedAt:new Date()}).where(eq(grants.id,r.grant.id));
    return {token,clientId:r.grant.clientId,scopes:r.grant.scopes,expiresAt:Math.floor(r.token.expiresAt.getTime()/1000),resource:new URL(this.resource),extra:{actorId:r.actor.id}};
  }
  async revokeToken(client:OAuthClientInformationFull,request:{token:string}) {
    const [t]=await db.select().from(tokens).where(eq(tokens.hash,hash(request.token)));
    if(t)await db.update(grants).set({revokedAt:new Date()}).where(and(eq(grants.id,t.grantId),eq(grants.clientId,client.client_id)));
  }
}
export async function consentFor(actor:StaffActor,id:string) {
  const a=await freshActor(actor);
  if(!realStaff(a))throw new AppError(403,"Connect using your real SVP Google staff sign-in. Development quick login cannot grant Claude access.");
  const [r]=await db.select().from(requests).where(eq(requests.id,id));
  if(!r||r.consumedAt||r.expiresAt<new Date()||r.codeHash)throw new AppError(410,"This authorization request expired or has already been decided.");
  const [c]=await db.select().from(clients).where(eq(clients.id,r.clientId));
  return {id:r.id,clientName:String(c?.metadata.client_name??"Claude MCP client").slice(0,200),scopes:r.scopes,resource:r.resource,redirectUri:r.redirectUri,expiresAt:r.expiresAt.toISOString()};
}
export async function decideConsent(actor:StaffActor,id:string,allow:boolean) {
  await consentFor(actor,id);
  return db.transaction(async tx=>{
    const [r]=await tx.select().from(requests).where(eq(requests.id,id)).for("update");
    if(!r||r.codeHash||r.consumedAt||r.expiresAt<new Date())throw new AppError(410,"This request has already expired or been decided.");
    const a=await freshActor(actor,tx);
    if(!realStaff(a))throw new AppError(403,"Use real staff sign-in.");
    const url=new URL(r.redirectUri);
    if(r.state)url.searchParams.set("state",r.state);
    if(allow){const code=secret();url.searchParams.set("code",code);await tx.update(requests).set({actorId:a.id,codeHash:hash(code),expiresAt:new Date(Date.now()+120000)}).where(eq(requests.id,id));}
    else{url.searchParams.set("error","access_denied");await tx.update(requests).set({consumedAt:new Date()}).where(eq(requests.id,id));}
    return {redirectUrl:url.href};
  });
}
