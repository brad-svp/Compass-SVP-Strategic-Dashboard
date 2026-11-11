import { Router, type IRouter } from "express";
import * as contract from "@workspace/api-zod";
import { addCheckIn, getOkrWorkspace, removeOkr, saveComment, saveKeyResult, saveObjective } from "../lib/okrService";

// Mounted inside the staff-authenticated, same-origin /svp router.
const router: IRouter = Router();
router.get("/okrs", async (_req, res): Promise<void> => {
  res.json(contract.GetOkrWorkspaceResponse.parse(await getOkrWorkspace(res.locals.actor)));
});
router.post("/objectives", async (req, res): Promise<void> => {
  contract.CreateObjectiveBody.parse(req.body);
  res.status(201).json(contract.CreateObjectiveResponse.parse(await saveObjective(res.locals.actor, req.body)));
});
router.patch("/objectives/:id", async (req, res): Promise<void> => {
  const { id } = contract.UpdateObjectiveParams.parse(req.params);
  contract.UpdateObjectiveBody.parse(req.body);
  res.json(contract.UpdateObjectiveResponse.parse(await saveObjective(res.locals.actor, req.body, id)));
});
router.delete("/objectives/:id", async (req, res): Promise<void> => {
  const { id } = contract.DeleteObjectiveParams.parse(req.params);
  res.json(contract.DeleteObjectiveResponse.parse(await removeOkr(res.locals.actor, "objective", id)));
});
router.post("/key-results", async (req, res): Promise<void> => {
  contract.CreateKeyResultBody.parse(req.body);
  res.status(201).json(contract.CreateKeyResultResponse.parse(await saveKeyResult(res.locals.actor, req.body)));
});
router.patch("/key-results/:id", async (req, res): Promise<void> => {
  const { id } = contract.UpdateKeyResultParams.parse(req.params);
  contract.UpdateKeyResultBody.parse(req.body);
  res.json(contract.UpdateKeyResultResponse.parse(await saveKeyResult(res.locals.actor, req.body, id)));
});
router.delete("/key-results/:id", async (req, res): Promise<void> => {
  const { id } = contract.DeleteKeyResultParams.parse(req.params);
  res.json(contract.DeleteKeyResultResponse.parse(await removeOkr(res.locals.actor, "key_result", id)));
});
router.post("/key-results/:id/check-ins", async (req, res): Promise<void> => {
  const { id } = contract.CreateCheckInParams.parse(req.params);
  contract.CreateCheckInBody.parse(req.body);
  res.status(201).json(contract.CreateCheckInResponse.parse(await addCheckIn(res.locals.actor, id, req.body)));
});
router.post("/comments", async (req, res): Promise<void> => {
  contract.CreateCommentBody.parse(req.body);
  res.status(201).json(contract.CreateCommentResponse.parse(await saveComment(res.locals.actor, req.body)));
});
router.patch("/comments/:id", async (req, res): Promise<void> => {
  const { id } = contract.UpdateCommentParams.parse(req.params);
  contract.UpdateCommentBody.parse(req.body);
  res.json(contract.UpdateCommentResponse.parse(await saveComment(res.locals.actor, req.body, id)));
});
router.delete("/comments/:id", async (req, res): Promise<void> => {
  const { id } = contract.DeleteCommentParams.parse(req.params);
  res.json(contract.DeleteCommentResponse.parse(await saveComment(res.locals.actor, {}, id, true)));
});
export default router;
