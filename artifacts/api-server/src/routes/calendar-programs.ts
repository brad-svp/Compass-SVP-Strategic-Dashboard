import { Router, type IRouter } from "express";
import { CreateCalendarProgramBody, CreateCalendarProgramResponse, UpdateCalendarProgramBody, UpdateCalendarProgramParams, UpdateCalendarProgramResponse, RequestProgramLogoUploadBody, RequestProgramLogoUploadResponse, CompleteProgramLogoUploadParams, CompleteProgramLogoUploadResponse, GetProgramLogoParams } from "@workspace/api-zod";
import { saveCalendarProgram } from "../lib/calendarProgramsService";
import { requestProgramLogoUpload, completeProgramLogoUpload, getProgramLogo } from "../lib/programLogoService";
const router: IRouter = Router();
router.post("/calendar/programs", async (req, res) => {
  res.status(201).json(CreateCalendarProgramResponse.parse(await saveCalendarProgram(res.locals.actor, CreateCalendarProgramBody.strict().parse(req.body))));
});
router.patch("/calendar/programs/:id", async (req, res) => {
  const { id } = UpdateCalendarProgramParams.parse(req.params);
  res.json(UpdateCalendarProgramResponse.parse(await saveCalendarProgram(res.locals.actor, UpdateCalendarProgramBody.strict().parse(req.body), id)));
});
router.post("/calendar/program-logo-uploads", async (req, res) => {
  res.status(201).json(RequestProgramLogoUploadResponse.parse(await requestProgramLogoUpload(res.locals.actor, RequestProgramLogoUploadBody.strict().parse(req.body))));
});
router.post("/calendar/program-logo-uploads/:id/complete", async (req, res) => {
  const { id } = CompleteProgramLogoUploadParams.parse(req.params);
  res.json(CompleteProgramLogoUploadResponse.parse(await completeProgramLogoUpload(res.locals.actor, id)));
});
router.get("/program-logos/:id", async (req, res, next) => {
  const { id } = GetProgramLogoParams.parse(req.params);
  const { file, contentType } = await getProgramLogo(res.locals.actor, id);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  file.createReadStream().on("error", next).pipe(res);
});
export default router;
