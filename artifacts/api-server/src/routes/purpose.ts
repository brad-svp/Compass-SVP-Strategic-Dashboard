import { Router, type IRouter } from "express";
import { GetSvpPurposeResponse, UpdateSvpPurposeBody, UpdateSvpPurposeResponse } from "@workspace/api-zod";
import { getSvpPurpose, updateSvpPurpose } from "../lib/purposeService";
const router: IRouter = Router();
router.get("/purpose", async (_req, res) => { res.json(GetSvpPurposeResponse.parse(await getSvpPurpose(res.locals.actor))); });
router.patch("/purpose", async (req, res) => { res.json(UpdateSvpPurposeResponse.parse(await updateSvpPurpose(res.locals.actor, UpdateSvpPurposeBody.strict().parse(req.body)))); });
export default router;
