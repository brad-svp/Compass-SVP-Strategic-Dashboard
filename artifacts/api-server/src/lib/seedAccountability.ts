import { randomUUID } from "node:crypto";
import { db, accountabilitySeatsTable as seats, auditLogTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

// Transcribed from the user's SVP 2027 accountability chart. Keep the original
// full names here without silently renaming existing staff/login records.
export const initialAccountability = [
  { id: "board", title: "Board of Directors", kind: "board" as const, parentId: null, ownerId: null, personName: "", roleLabel: "", capacity: "", sharedSeat: false, responsibilities: [] },
  { id: "visionary", title: "Visionary", kind: "leadership" as const, parentId: "board", ownerId: "brad", personName: "Brad Squires", roleLabel: "CEO / Strategy", capacity: "Part time", sharedSeat: false,
    responsibilities: ["Vision and long-range strategy", "AI for Good direction and growth", "Major funder and partner relationships", "Board relations", "Culture and big ideas"] },
  { id: "integrator", title: "Integrator", kind: "leadership" as const, parentId: "board", ownerId: "drew", personName: "Drew Hayes", roleLabel: "COO / Operations", capacity: "Full time", sharedSeat: false,
    responsibilities: ["Lead, manage and hold the team accountable", "Run the weekly Level 10 and quarterly Rocks", "Deliver the 2027 plan and budget", "Keep partnerships, marketing and programs in sync", "Resolve issues and remove obstacles"] },
  { id: "community", title: "Community & Partnerships", kind: "function" as const, parentId: "integrator", ownerId: "jenny", personName: "Jenny Roberts", roleLabel: "", capacity: "Part time", sharedSeat: false,
    responsibilities: ["Recruit new SVP Partners", "Partner engagement and renewals", "Sponsorships and corporate partners", "Support AI for Good fundraising strategy"] },
  { id: "marketing", title: "Marketing & Communications", kind: "function" as const, parentId: "integrator", ownerId: "haylie", personName: "Haylie Runner", roleLabel: "", capacity: "Part time", sharedSeat: false,
    responsibilities: ["Comms strategy for SVP and AI for Good", "Newsletters, social media and collateral", "Run campaigns", "Generate and curate brand voice"] },
  { id: "ai-strategy", title: "AI for Good Programs & Strategy", kind: "function" as const, parentId: "integrator", ownerId: "dan", personName: "Dan Wu", roleLabel: "", capacity: "Part time", sharedSeat: false,
    responsibilities: ["Business model and strategy", "Business development and growth", "Support nonprofit operations"] },
  { id: "programs", title: "Programs", kind: "function" as const, parentId: "integrator", ownerId: "drew", personName: "Drew Hayes", roleLabel: "", capacity: "", sharedSeat: true,
    responsibilities: ["Think Tank (Scott Eggert + facilitators)", "100x Events (TBD Connects)", "Partner Impact Tours", "Fast Pitch (Dana Copeland, Jay Thomas, Diane Hurley + coaches)"] },
  { id: "operations-finance", title: "Operations & Finance", kind: "function" as const, parentId: "integrator", ownerId: "drew", personName: "Drew Hayes", roleLabel: "", capacity: "", sharedSeat: true,
    responsibilities: ["Finance and accounting", "Budgeting", "Payroll", "Legal and HR", "Admin systems"] },
  { id: "program-admin", title: "Program / Ops Admin", kind: "function" as const, parentId: "integrator", ownerId: "amber", personName: "Amber Garza", roleLabel: "", capacity: "Part time", sharedSeat: false,
    responsibilities: ["Admin support for all SVP Core programs", "Admin support for Operations functions"] },
];

export async function seedAccountability() {
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
    if ((await tx.select().from(auditLogTable).where(eq(auditLogTable.entityId, "accountability-initial-seed"))).length) return;
    // Seed once, never recreate deleted seats or overwrite admin edits.
    for (const [sortOrder, row] of initialAccountability.entries()) {
      const [created] = await tx.insert(seats).values({ ...row, id: `accountability-${row.id}`, parentId: row.parentId ? `accountability-${row.parentId}` : null, sortOrder }).onConflictDoNothing().returning();
      if (created) await tx.insert(auditLogTable).values({
        id: randomUUID(), action: "seed", entityType: "accountability_seat", entityId: created.id, after: created, via: "web",
      });
    }
    await tx.insert(auditLogTable).values({
      id: randomUUID(), action: "seed", entityType: "system", entityId: "accountability-initial-seed", after: { completed: true }, via: "web",
    });
  });
}
