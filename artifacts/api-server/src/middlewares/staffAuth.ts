import { clerkClient, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import type { StaffActor } from "../lib/permissions";

declare global {
  namespace Express { interface Locals { actor: StaffActor } }
}
export const staffAuth: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Please sign in with your SVP Google account." }); return; }
  const identity = await clerkClient.users.getUser(userId);
  const primary = identity.emailAddresses.find((e) => e.id === identity.primaryEmailAddressId);
  const email = primary?.emailAddress.toLowerCase();
  const google = identity.externalAccounts.some((account) =>
    account.provider === "oauth_google" && account.emailAddress?.toLowerCase() === email &&
    account.verification?.status === "verified");
  if (!google || primary?.verification?.status !== "verified" || !email?.endsWith("@svpsacramento.org")) {
    res.status(403).json({ error: "SVP OS is for invited staff using their svpsacramento.org Google account. Please switch accounts." }); return;
  }
  const [staff] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!staff?.active || (staff.clerkId && staff.clerkId !== userId)) {
    res.status(403).json({ error: "Your account is not on the active SVP staff list. Ask an administrator to enable your email." }); return;
  }
  res.locals.actor = staff;
  next();
};
