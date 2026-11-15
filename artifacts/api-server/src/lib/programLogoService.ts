import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db, programLogoUploadsTable as uploads, calendarProgramsTable as programs, auditLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, type StaffActor } from "./permissions";
import { programAdmin, logoUrl } from "./calendarProgramsService";
import { ObjectNotFoundError, ObjectStorageService, objectStorageClient } from "./objectStorage";
const storage = new ObjectStorageService();
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const uploadInput = z.object({ name: z.string().trim().min(1).max(255), size: z.number().int().min(1).max(MAX_LOGO_BYTES), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]) }).strict();
type Upload = typeof uploads.$inferSelect;
export async function normalizeProgramLogo(bytes: Buffer, expectedMime: string) {
  if (!bytes.length || bytes.length > MAX_LOGO_BYTES) throw new AppError(400, "Choose a logo of 2 MB or less.");
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, animated: false });
    const metadata = await image.metadata();
    const mime = ({ png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as Record<string, string>)[metadata.format ?? ""];
    if (mime !== expectedMime || !metadata.width || !metadata.height) throw new Error("Unsupported logo");
    // Decoding and re-encoding validates the complete image and removes metadata,
    // SVG/script payloads and oversized dimensions before any staff can view it.
    return await image.rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  } catch { throw new AppError(400, "Upload a valid PNG, JPEG or WebP image, with dimensions under 16 megapixels."); }
}
export async function requestProgramLogoUpload(actor: StaffActor, raw: unknown) {
  const data = uploadInput.parse(raw);
  await db.transaction(tx => programAdmin(tx, actor));
  const uploadURL = await storage.getObjectEntityUploadURL();
  const pendingPath = storage.normalizeObjectEntityPath(uploadURL);
  if (!pendingPath.startsWith("/objects/uploads/")) throw new Error("Storage returned an unexpected upload path.");
  const id = randomUUID();
  await db.transaction(async tx => {
    await programAdmin(tx, actor);
    await tx.insert(uploads).values({ id, actorId: actor.id, pendingPath, contentType: data.contentType, size: data.size, expiresAt: new Date(Date.now() + 15 * 60_000) });
  });
  return { id, uploadURL };
}
async function finalizeStoredLogo(upload: Upload) {
  let source;
  try { source = await storage.getObjectEntityFile(upload.pendingPath); }
  catch (error) { if (error instanceof ObjectNotFoundError) throw new AppError(400, "The file has not finished uploading."); throw error; }
  const [meta] = await source.getMetadata();
  if (Number(meta.size) !== upload.size || Number(meta.size) > MAX_LOGO_BYTES || meta.contentType !== upload.contentType) throw new AppError(400, "The uploaded file does not match the requested size or image type.");
  // Pin the source generation: a replay of the pending signed PUT cannot swap
  // bytes between validation and decoding. The served result has a new,
  // server-only object key which was never granted a client upload URL.
  const pinned = source.bucket.file(source.name, { generation: meta.generation });
  const [bytes] = await pinned.download();
  const normalized = await normalizeProgramLogo(bytes, upload.contentType);
  const objectPath = `/objects/program-logos/${randomUUID()}`;
  const dir = storage.getPrivateObjectDir().replace(/^\/+|\/+$/g, "").split("/");
  const bucketName = dir.shift()!;
  const destination = objectStorageClient.bucket(bucketName).file(`${dir.join("/")}/${objectPath.slice("/objects/".length)}`);
  await destination.save(normalized, { resumable: false, contentType: "image/webp", metadata: { cacheControl: "private, max-age=300" }, preconditionOpts: { ifGenerationMatch: 0 } });
  return { objectPath, contentType: "image/webp", size: normalized.length };
}
export async function completeProgramLogoUpload(actor: StaffActor, id: string, finalize = finalizeStoredLogo) {
  z.string().uuid().parse(id);
  const upload = await db.transaction(async tx => {
    await programAdmin(tx, actor);
    const [row] = await tx.select().from(uploads).where(eq(uploads.id, id));
    if (!row || row.actorId !== actor.id) throw new AppError(404, "Logo upload not found.");
    if (!row.ready && row.expiresAt.getTime() < Date.now()) throw new AppError(400, "This upload expired. Choose the file again.");
    return row;
  });
  if (upload.ready) return { logoId: id, logoUrl: logoUrl(id) };
  const final = await finalize(upload);
  await db.transaction(async tx => {
    actor = await programAdmin(tx, actor);
    const [current] = await tx.select().from(uploads).where(eq(uploads.id, id));
    if (!current || current.actorId !== actor.id) throw new AppError(404, "Logo upload not found.");
    if (current.ready) return;
    await tx.update(uploads).set({ ready: true, ...final }).where(eq(uploads.id, id));
    await tx.insert(auditLogTable).values({ id: randomUUID(), actorId: actor.id, action: "upload_logo", entityType: "program_logo", entityId: id, before: null, after: { contentType: final.contentType, size: final.size }, via: "web" });
  });
  return { logoId: id, logoUrl: logoUrl(id) };
}
export async function getProgramLogo(actor: StaffActor, id: string) {
  z.string().uuid().parse(id);
  const [upload] = await db.select().from(uploads).where(eq(uploads.id, id));
  if (!upload?.ready || !upload.objectPath) throw new AppError(404, "Logo not found.");
  const [assigned] = await db.select({ id: programs.id }).from(programs).where(eq(programs.logoId, id)).limit(1);
  if (!assigned && !(actor.role === "admin" && upload.actorId === actor.id)) throw new AppError(404, "Logo not found.");
  return { file: await storage.getObjectEntityFile(upload.objectPath), contentType: upload.contentType };
}
