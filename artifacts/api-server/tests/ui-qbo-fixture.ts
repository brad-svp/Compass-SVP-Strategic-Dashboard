// Only for a bounded browser verification run. Never creates objectives in a
// real planning cycle, and cleanup refuses to remove unrelated records.
import { db, pool, cyclesTable, objectivesTable, keyResultsTable, checkInsTable, commentsTable, auditLogTable, scorecardMetricsTable, scorecardEntriesTable, scorecardRevisionsTable } from "@workspace/db";
import { eq, inArray, like } from "drizzle-orm";
const [mode, cycleId] = process.argv.slice(2);
try {
  if (!cycleId || !/^ui-qbo-[a-f0-9-]{36}$/.test(cycleId)) throw new Error("Provide a unique ui-qbo-UUID fixture identifier.");
  const prefix = cycleId;
  if (mode === "setup") {
    const name = `UI verification ${cycleId.slice(-8)}`;
    await db.insert(cyclesTable).values({ id: cycleId, name, startDate: "2026-01-01", endDate: "2026-12-31", status: "planning" });
    console.log(JSON.stringify({ cycleId, cycleName: name, titlePrefix: prefix }));
  } else if (mode === "cleanup") {
    await db.transaction(async tx => {
      const objectives = await tx.select().from(objectivesTable).where(eq(objectivesTable.cycleId, cycleId));
      if (objectives.some(o => !o.title.startsWith(prefix))) throw new Error("Unrelated objective in test cycle; cleanup stopped.");
      const objectiveIds = objectives.map(o => o.id);
      const krs = objectiveIds.length ? await tx.select().from(keyResultsTable).where(inArray(keyResultsTable.objectiveId, objectiveIds)) : [];
      const krIds = krs.map(k => k.id);
      const metrics = await tx.select().from(scorecardMetricsTable).where(like(scorecardMetricsTable.title, `${prefix}%`));
      const metricIds = metrics.map(m => m.id);
      const entries = metricIds.length ? await tx.select().from(scorecardEntriesTable).where(inArray(scorecardEntriesTable.metricId, metricIds)) : [];
      const entryIds = entries.map(e => e.id);
      const revisions = entryIds.length ? await tx.select().from(scorecardRevisionsTable).where(inArray(scorecardRevisionsTable.entryId, entryIds)) : [];
      const checks = krIds.length ? await tx.select().from(checkInsTable).where(inArray(checkInsTable.keyResultId, krIds)) : [];
      const allEntities = [...objectiveIds, ...krIds, ...metricIds, ...entryIds, ...revisions.map(r => r.id), ...checks.map(c => c.id)];
      if (allEntities.length) {
        const comments = await tx.select().from(commentsTable).where(inArray(commentsTable.entityId, allEntities));
        await tx.delete(commentsTable).where(inArray(commentsTable.entityId, allEntities));
        await tx.delete(auditLogTable).where(inArray(auditLogTable.entityId, [...allEntities, ...comments.map(c => c.id)]));
      }
      if (entryIds.length) await tx.delete(scorecardRevisionsTable).where(inArray(scorecardRevisionsTable.entryId, entryIds));
      if (metricIds.length) {
        await tx.delete(scorecardEntriesTable).where(inArray(scorecardEntriesTable.metricId, metricIds));
        await tx.delete(scorecardMetricsTable).where(inArray(scorecardMetricsTable.id, metricIds));
      }
      if (krIds.length) await tx.delete(checkInsTable).where(inArray(checkInsTable.keyResultId, krIds));
      if (objectiveIds.length) {
        await tx.delete(keyResultsTable).where(inArray(keyResultsTable.objectiveId, objectiveIds));
        await tx.delete(objectivesTable).where(inArray(objectivesTable.id, objectiveIds));
      }
      await tx.delete(cyclesTable).where(eq(cyclesTable.id, cycleId));
      console.log(`Removed only fixture cycle and its ${objectives.length} objectives, ${metrics.length} metrics, and ${entries.length} weekly entries.`);
    });
  } else throw new Error("Use setup or cleanup.");
} finally { await pool.end(); }
