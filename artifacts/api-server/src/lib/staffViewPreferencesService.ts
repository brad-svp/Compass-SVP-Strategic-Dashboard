import { db, staffViewPreferencesTable as prefs, usersTable } from "@workspace/db";
import { eq,inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { AppError,type StaffActor } from "./permissions";

const input=z.object({mode:z.enum(["mine","all","custom"]),staffIds:z.array(z.string().min(1).max(200)).max(200)}).strict();
async function current(actor:StaffActor) {
  const [u]=await db.select({id:usersTable.id,active:usersTable.active}).from(usersTable).where(eq(usersTable.id,actor.id));
  if(!u?.active)throw new AppError(403,"An active staff account is required.");
  return u;
}
export async function getSixViewPreferences(actor:StaffActor) {
  const u=await current(actor);
  const [p]=await db.select().from(prefs).where(eq(prefs.userId,u.id));
  return {mode:p?.sixMode??"mine",staffIds:p?.sixStaffIds??[]};
}
export async function saveSixViewPreferences(actor:StaffActor,raw:unknown) {
  const u=await current(actor),d=input.parse(raw);
  const staffIds=d.mode==="custom"?[...new Set(d.staffIds)]:[];
  if(staffIds.length) {
    const ids=await db.select({id:usersTable.id}).from(usersTable).where(inArray(usersTable.id,staffIds));
    if(ids.length!==staffIds.length)throw new AppError(400,"One or more selected teammates no longer exist. Refresh and choose again.");
  }
  await db.insert(prefs).values({userId:u.id,sixMode:d.mode,sixStaffIds:staffIds})
    .onConflictDoUpdate({target:prefs.userId,set:{sixMode:d.mode,sixStaffIds:staffIds,updatedAt:new Date()}});
  return {mode:d.mode,staffIds};
}
