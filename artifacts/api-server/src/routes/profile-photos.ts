import express, { Router, type IRouter } from "express";
import { z } from "zod";
import { UploadProfilePhotoResponse, RemoveProfilePhotoResponse } from "@workspace/api-zod";
import { AppError } from "../lib/permissions";
import { getProfilePhoto, MAX_PHOTO_BYTES, removeProfilePhoto, saveProfilePhoto } from "../lib/profilePhotoService";
const router: IRouter = Router();
const id = z.string().trim().min(1).max(200);
router.post("/staff/:id/photo", express.raw({ type: "application/octet-stream", limit: MAX_PHOTO_BYTES }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) throw new AppError(400, "Upload an image file.");
  res.json(UploadProfilePhotoResponse.parse(await saveProfilePhoto(res.locals.actor, id.parse(req.params.id), req.body)));
});
router.delete("/staff/:id/photo", async (req, res) => {
  res.json(RemoveProfilePhotoResponse.parse(await removeProfilePhoto(res.locals.actor, id.parse(req.params.id))));
});
router.get("/profile-photos/:id", async (req, res, next) => {
  const file = await getProfilePhoto(z.string().uuid().parse(req.params.id));
  res.setHeader("Content-Type", "image/webp");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  file.createReadStream().on("error", next).pipe(res);
});
router.use(((err, _req, res, next) => {
  if (err?.type === "entity.too.large") { res.status(413).json({ error: "Choose a photo of 5 MB or less." }); return; }
  next(err);
}) as express.ErrorRequestHandler);
export default router;
