import { Router, type IRouter } from "express";
import { GetSystemsOverviewResponse, CreateSvpSystemBody, CreateSvpSystemResponse, UpdateSvpSystemParams, UpdateSvpSystemBody, UpdateSvpSystemResponse, DeleteSvpSystemParams, DeleteSvpSystemBody, DeleteSvpSystemResponse } from "@workspace/api-zod";
import { getSystemsOverview, saveSvpSystem, deleteSvpSystem } from "../lib/systemsService";
const router: IRouter = Router();
router.get("/systems", async (_req, res) => { res.json(GetSystemsOverviewResponse.parse(await getSystemsOverview(res.locals.actor))); });
router.post("/systems", async (req, res) => {
  res.status(201).json(CreateSvpSystemResponse.parse(await saveSvpSystem(res.locals.actor, CreateSvpSystemBody.strict().parse(req.body))));
});
router.patch("/systems/:id", async (req, res) => {
  const { id } = UpdateSvpSystemParams.parse(req.params);
  res.json(UpdateSvpSystemResponse.parse(await saveSvpSystem(res.locals.actor, UpdateSvpSystemBody.strict().parse(req.body), id)));
});
router.delete("/systems/:id", async (req, res) => {
  const { id } = DeleteSvpSystemParams.parse(req.params);
  res.json(DeleteSvpSystemResponse.parse(await deleteSvpSystem(res.locals.actor, id, DeleteSvpSystemBody.strict().parse(req.body))));
});
export default router;
