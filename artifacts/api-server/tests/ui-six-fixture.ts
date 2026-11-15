// Bounded browser fixtures only. Never modifies real planning periods or staff.
import { db, pool, periodsTable, majorMomentsTable, sixItemsTable, auditLogTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
const [mode, prefix] = process.argv.slice(2);
try {
  if (!prefix || !/^ui-six-[a-f0-9-]{36}$/.test(prefix)) throw new Error("Provide a unique ui-six-UUID.");
  const ids = ["previous", "current", "next"].map(s => `${prefix}-${s}`);
  await db.transaction(async tx => {
    if (mode === "setup") {
      const dates = [["2088-01-01", "2088-02-11"], ["2088-02-12", "2088-03-24"], ["2088-03-25", "2088-05-05"]];
      const existing = await tx.select().from(periodsTable);
      if (existing.some(p => p.startDate <= dates[2][1] && p.endDate >= dates[0][0])) throw new Error("Fixture dates are occupied; no changes made.");
      for (let i = 0; i < 3; i++) {
        await tx.insert(periodsTable).values({
          id: ids[i], name: `${prefix} ${["Previous", "Current", "Next"][i]}`,
          startDate: dates[i][0], endDate: dates[i][1], status: i === 0 ? "closed" : i === 1 ? "active" : "draft",
        });
        for (let position = 1; position <= 6; position++) {
          await tx.insert(majorMomentsTable).values({
            id: `${ids[i]}-moment-${position}`, periodId: ids[i], position, title: `Fixture moment ${position}`,
          });
        }
      }
      console.log(JSON.stringify({ prefix, previous: ids[0], current: ids[1], next: ids[2] }));
    } else if (mode === "cleanup") {
      const periods = await tx.select().from(periodsTable).where(inArray(periodsTable.id, ids));
      if (periods.some(p => !p.name.startsWith(prefix))) throw new Error("Unexpected period name; refusing cleanup.");
      const moments = await tx.select().from(majorMomentsTable).where(inArray(majorMomentsTable.periodId, ids));
      const momentIds = moments.map(m => m.id);
      const items = momentIds.length ? await tx.select().from(sixItemsTable).where(inArray(sixItemsTable.momentId, momentIds)) : [];
      const allIds = [...ids, ...momentIds, ...items.map(i => i.id)];
      await tx.delete(auditLogTable).where(inArray(auditLogTable.entityId, allIds));
      if (momentIds.length) await tx.delete(sixItemsTable).where(inArray(sixItemsTable.momentId, momentIds));
      await tx.delete(majorMomentsTable).where(inArray(majorMomentsTable.periodId, ids));
      await tx.delete(periodsTable).where(inArray(periodsTable.id, ids));
      console.log(`Removed ${periods.length} fixture periods, ${moments.length} moments and ${items.length} items; real periods untouched.`);
    } else throw new Error("Use setup or cleanup.");
  });
} finally { await pool.end(); }
