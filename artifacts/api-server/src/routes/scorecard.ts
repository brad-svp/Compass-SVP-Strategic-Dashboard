import { Router, type IRouter } from "express";
import {
  GetScorecardQueryParams, GetScorecardResponse,
  CreateScorecardMetricBody, CreateScorecardMetricResponse,
  UpdateScorecardMetricBody, UpdateScorecardMetricParams, UpdateScorecardMetricResponse,
  GetScorecardTrackerResponse, GetScorecardTrendQueryParams, GetScorecardTrendResponse,
  AppendScorecardMeasurementParams, AppendScorecardMeasurementBody, AppendScorecardMeasurementResponse,
  DeleteScorecardMeasurementParams, DeleteScorecardMeasurementResponse,
} from "@workspace/api-zod";
import { getScorecard, saveScorecardMetric } from "../lib/scorecardService";
import {getScorecardTracker,getScorecardTrend,appendScorecardMeasurement,deleteScorecardMeasurement} from "../lib/scorecardTrackerService";
import { AppError } from "../lib/permissions";

const router: IRouter = Router();
router.get("/scorecard/tracker",async(_req,res)=>res.json(GetScorecardTrackerResponse.parse(await getScorecardTracker(res.locals.actor))));
router.get("/scorecard/trend",async(req,res)=>{
  const {metricId,...query}=GetScorecardTrendQueryParams.parse(req.query);
  res.json(GetScorecardTrendResponse.parse(await getScorecardTrend(res.locals.actor,metricId,query)));
});
router.post("/scorecard/metrics/:id/measurements",async(req,res)=>{
  const {id}=AppendScorecardMeasurementParams.parse(req.params);
  res.status(201).json(AppendScorecardMeasurementResponse.parse(await appendScorecardMeasurement(res.locals.actor,id,AppendScorecardMeasurementBody.strict().parse(req.body))));
});
router.delete("/scorecard/measurements/:id",async(req,res)=>{
  const {id}=DeleteScorecardMeasurementParams.parse(req.params);
  res.json(DeleteScorecardMeasurementResponse.parse(await deleteScorecardMeasurement(res.locals.actor,id)));
});
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
router.put("/scorecard/metrics/:id/entries/:weekStart", async () => {
  throw new AppError(410,"Weekly cells have been replaced by timestamped updates. Refresh the Scorecard before recording a value.");
});
export default router;
