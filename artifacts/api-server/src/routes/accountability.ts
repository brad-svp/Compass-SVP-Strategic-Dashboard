import { Router, type IRouter } from "express";
import {
  GetAccountabilityResponse, CreateAccountabilitySeatBody, CreateAccountabilitySeatResponse,
  UpdateAccountabilitySeatBody, UpdateAccountabilitySeatParams, UpdateAccountabilitySeatResponse,
  DeleteAccountabilitySeatParams, DeleteAccountabilitySeatResponse,
} from "@workspace/api-zod";
import { getAccountability, saveAccountability, deleteAccountability } from "../lib/accountabilityService";

const router: IRouter = Router();
router.get("/accountability", async (_req, res) => {
  res.json(GetAccountabilityResponse.parse(await getAccountability()));
});
router.post("/accountability", async (req, res) => {
  const result = await saveAccountability(res.locals.actor, CreateAccountabilitySeatBody.strict().parse(req.body));
  res.status(201).json(CreateAccountabilitySeatResponse.parse(result));
});
router.patch("/accountability/:id", async (req, res) => {
  const { id } = UpdateAccountabilitySeatParams.parse(req.params);
  res.json(UpdateAccountabilitySeatResponse.parse(await saveAccountability(res.locals.actor, UpdateAccountabilitySeatBody.strict().parse(req.body), id)));
});
router.delete("/accountability/:id", async (req, res) => {
  const { id } = DeleteAccountabilitySeatParams.parse(req.params);
  res.json(DeleteAccountabilitySeatResponse.parse(await deleteAccountability(res.locals.actor, id)));
});
export default router;
