import { Router, type IRouter } from "express";
import {
  GetScorecardQueryParams, GetScorecardResponse,
  CreateScorecardMetricBody, CreateScorecardMetricResponse,
  UpdateScorecardMetricBody, UpdateScorecardMetricParams, UpdateScorecardMetricResponse,
  SaveScorecardEntryBody, SaveScorecardEntryParams, SaveScorecardEntryResponse,
} from "@workspace/api-zod";
import { getScorecard, saveScorecardMetric, saveScorecardEntry } from "../lib/scorecardService";

const router: IRouter = Router();
router.get("/scorecard", async (req, res) => {
  const query = GetScorecardQueryParams.parse(req.query);
  res.json(GetScorecardResponse.parse(await getScorecard(res.locals.actor, query.endWeek)));
});
router.post("/scorecard/metrics", async (req, res) => {
  res.status(201).json(CreateScorecardMetricResponse.parse(await saveScorecardMetric(res.locals.actor, CreateScorecardMetricBody.strict().parse(req.body))));
});
router.patch("/scorecard/metrics/:id", async (req, res) => {
  const { id } = UpdateScorecardMetricParams.parse(req.params);
  res.json(UpdateScorecardMetricResponse.parse(await saveScorecardMetric(res.locals.actor, UpdateScorecardMetricBody.strict().parse(req.body), id)));
});
router.put("/scorecard/metrics/:id/entries/:weekStart", async (req, res) => {
  const { id, weekStart } = SaveScorecardEntryParams.parse(req.params);
  res.json(SaveScorecardEntryResponse.parse(await saveScorecardEntry(res.locals.actor, id, weekStart, SaveScorecardEntryBody.strict().parse(req.body))));
});
export default router;
