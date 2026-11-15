import { Router, type IRouter } from "express";
import {
  GetSixBySixResponse, CreateSixPeriodBody, CreateSixPeriodResponse,
  UpdateSixPeriodParams, UpdateSixPeriodBody, UpdateSixPeriodResponse,
  UpdateSixMomentParams, UpdateSixMomentBody, UpdateSixMomentResponse,
  CreateSixItemBody, CreateSixItemResponse, UpdateSixItemParams, UpdateSixItemBody, UpdateSixItemResponse,
  DeleteSixItemParams, DeleteSixItemBody, DeleteSixItemResponse,
} from "@workspace/api-zod";
import { getSixBySix, saveSixPeriod, saveSixMoment, saveSixItem, deleteSixItem } from "../lib/sixBySixService";
const router: IRouter = Router();
router.get("/six-by-six", async (_req, res) => res.json(GetSixBySixResponse.parse(await getSixBySix(res.locals.actor))));
router.post("/six-by-six/periods", async (req, res) => {
  res.status(201).json(CreateSixPeriodResponse.parse(await saveSixPeriod(res.locals.actor, CreateSixPeriodBody.strict().parse(req.body))));
});
router.patch("/six-by-six/periods/:id", async (req, res) => {
  const { id } = UpdateSixPeriodParams.parse(req.params);
  res.json(UpdateSixPeriodResponse.parse(await saveSixPeriod(res.locals.actor, UpdateSixPeriodBody.strict().parse(req.body), id)));
});
router.patch("/six-by-six/moments/:id", async (req, res) => {
  const { id } = UpdateSixMomentParams.parse(req.params);
  res.json(UpdateSixMomentResponse.parse(await saveSixMoment(res.locals.actor, id, UpdateSixMomentBody.strict().parse(req.body))));
});
router.post("/six-by-six/items", async (req, res) => {
  res.status(201).json(CreateSixItemResponse.parse(await saveSixItem(res.locals.actor, CreateSixItemBody.strict().parse(req.body))));
});
router.patch("/six-by-six/items/:id", async (req, res) => {
  const { id } = UpdateSixItemParams.parse(req.params);
  res.json(UpdateSixItemResponse.parse(await saveSixItem(res.locals.actor, UpdateSixItemBody.strict().parse(req.body), id)));
});
router.delete("/six-by-six/items/:id", async (req, res) => {
  const { id } = DeleteSixItemParams.parse(req.params);
  res.json(DeleteSixItemResponse.parse(await deleteSixItem(res.locals.actor, id, DeleteSixItemBody.strict().parse(req.body))));
});
export default router;
