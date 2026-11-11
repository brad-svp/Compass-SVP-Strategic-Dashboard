import { db, areasTable, usersTable, cyclesTable, periodsTable, majorMomentsTable, auditLogTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function seedFoundation() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(742811)`);
    const marker = await tx.select({ id: auditLogTable.id }).from(auditLogTable).where(sql`${auditLogTable.entityId} = 'foundation-initial-seed'`).limit(1);
    if (marker.length) return;
    const areas = [
      { id: "admin", name: "Admin", color: "#0A2540" }, { id: "operations", name: "Operations", color: "#1D8BC4" },
      { id: "programs", name: "Programs", color: "#49B949" }, { id: "revenue", name: "Revenue", color: "#B03E71" },
      { id: "comms", name: "Comms", color: "#ECA519" }, { id: "ai-for-good", name: "AI for Good", color: "#7061A8" },
    ];
    const staff = [
      { id: "brad", name: "Brad Squires", email: "brad@svpsacramento.org", role: "admin" as const, areaId: "admin" },
      { id: "drew", name: "Drew", role: "admin" as const, areaId: "operations" },
      { id: "haylie", name: "Haylie", role: "staff" as const, areaId: "comms" },
      { id: "jenny", name: "Jenny", role: "staff" as const, areaId: "revenue" },
      { id: "amber", name: "Amber", role: "staff" as const, areaId: "programs" },
      { id: "dan", name: "Dan", role: "staff" as const, areaId: "ai-for-good" },
    ];
    const audit = async (entityType: string, entityId: string, after: unknown) => {
      await tx.insert(auditLogTable).values({ id: crypto.randomUUID(), action: "seed", entityType, entityId, after, via: "web" });
    };
    for (const [sortOrder, area] of areas.entries()) {
      const [created] = await tx.insert(areasTable).values({ ...area, sortOrder }).onConflictDoNothing().returning();
      if (created) await audit("areas", created.id, created);
    }
    for (const person of staff) {
      const [created] = await tx.insert(usersTable).values(person).onConflictDoNothing().returning();
      if (created) await audit("staff", created.id, created);
    }
    const [cycle] = await tx.insert(cyclesTable).values({ id: "2027", name: "2027", startDate: "2027-01-01", endDate: "2027-12-31", status: "planning" }).onConflictDoNothing().returning();
    if (cycle) await audit("cycles", cycle.id, cycle);
    const periods = [
      { id: "nov-dec-2026", name: "Nov/Dec", startDate: "2026-11-09", endDate: "2026-12-20", status: "active" as const },
      { id: "dec-jan-2026", name: "Dec/Jan", startDate: "2026-12-21", endDate: "2027-01-31", status: "draft" as const },
    ];
    for (const period of periods) {
      const [created] = await tx.insert(periodsTable).values(period).onConflictDoNothing().returning();
      if (created) await audit("periods", created.id, created);
    }
    const titles = [
      ["11/9 — Fast Pitch Showcase", "12/3 — Partner Holiday Social", "2027 Program Calendar & Budgeting", "Celebrate 2026 and Plan Out 2027", "Developing New Team Rhythms", "Ramping up for Annual Partner + Sponsor Renewal Process"],
      ["1/28 — 100x Networking + Philanthropy Event", "2027 SVP Partner Renewals — Q1 focus", "", "", "", ""],
    ];
    for (const [index, period] of periods.entries()) {
      for (const [position, title] of titles[index]!.entries()) {
        const eventDate = index === 0 && position === 0 ? "2026-11-09" : index === 0 && position === 1 ? "2026-12-03" : index === 1 && position === 0 ? "2027-01-28" : null;
        const [created] = await tx.insert(majorMomentsTable).values({ id: `${period.id}-${position + 1}`, periodId: period.id, position: position + 1, title, eventDate }).onConflictDoNothing().returning();
        if (created) await audit("major_moments", created.id, created);
      }
    }
    await audit("system", "foundation-initial-seed", { completed: true });
  });
}
