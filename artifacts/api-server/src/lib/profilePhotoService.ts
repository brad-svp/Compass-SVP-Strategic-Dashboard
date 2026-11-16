import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db, usersTable, auditLogTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, type StaffActor } from "./permissions";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";
import { logger } from "./logger";

const storage = new ObjectStorageService();
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const profilePhotoUrl = (id: string) => `/api/svp/profile-photos/${id}`;
async function authorize(tx: Tx, actor: StaffActor, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(742810)`);
  const [current] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id));
  if (!current?.active || (current.id !== userId && current.role !== "admin")) throw new AppError(403, "You can only manage your own profile photo.");
  const [target] = await tx.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target) throw new AppError(404, "Teammate not found.");
  return target;
}
export async function normalizeProfilePhoto(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new AppError(400, "Choose a photo of 5 MB or less.");
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "")) throw Error("Unsupported image");
    return await image.rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
  } catch { throw new AppError(400, "Choose a valid PNG, JPEG or WebP photo under 40 megapixels."); }
}
function photoFile(id: string) {
  z.string().uuid().parse(id);
  const dir = storage.getPrivateObjectDir().replace(/^\/+|\/+$/g, "").split("/");
  const bucket = dir.shift()!;
  return objectStorageClient.bucket(bucket).file(`${dir.join("/")}/profile-photos/${id}`);
}
async function storePhoto(bytes: Buffer) {
  const id = randomUUID();
  const file = photoFile(id);
  await file.save(bytes, { resumable: false, contentType: "image/webp", metadata: { cacheControl: "private, max-age=300" }, preconditionOpts: { ifGenerationMatch: 0 } });
  return { id, discard: () => file.delete({ ignoreNotFound: true }) };
}
async function retirePhoto(url: string | null) {
  const id = url?.match(/^\/api\/svp\/profile-photos\/([0-9a-f-]{36})$/i)?.[1];
  if (!id) return;
  try { await photoFile(id).delete({ ignoreNotFound: true }); }
  catch { logger.warn("An unassigned profile photo could not be cleaned up."); }
}
/** Storage is injectable only to isolate permission/image tests from real uploads. */
export async function saveProfilePhoto(actor: StaffActor, userId: string, bytes: Buffer, store = storePhoto, retire = retirePhoto) {
  await db.transaction(tx => authorize(tx, actor, userId));
  const normalized = await normalizeProfilePhoto(bytes);
  const stored = await store(normalized);
  try {
    const previous = await db.transaction(async tx => {
      const before = await authorize(tx, actor, userId);
      const avatarUrl = profilePhotoUrl(stored.id);
      await tx.update(usersTable).set({ avatarUrl, updatedAt: new Date() }).where(eq(usersTable.id, userId));
      await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, entityType: "staff_photo", entityId: userId,
        action: "update_photo", before: { avatarUrl: before.avatarUrl }, after: { avatarUrl }, via: "web" });
      return before.avatarUrl;
    });
    await retire(previous);
  } catch (error) { await stored.discard(); throw error; }
  return { id: userId };
}
export async function removeProfilePhoto(actor: StaffActor, userId: string, retire = retirePhoto) {
  const previous = await db.transaction(async tx => {
    const before = await authorize(tx, actor, userId);
    await tx.update(usersTable).set({ avatarUrl: null, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, entityType: "staff_photo", entityId: userId,
      action: "remove_photo", before: { avatarUrl: before.avatarUrl }, after: { avatarUrl: null }, via: "web" });
    return before.avatarUrl;
  });
  await retire(previous);
  return { id: userId };
}
export async function getProfilePhoto(id: string) {
  z.string().uuid().parse(id);
  const [assigned] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.avatarUrl, profilePhotoUrl(id))).limit(1);
  if (!assigned) throw new AppError(404, "Profile photo not found.");
  return photoFile(id);
}
