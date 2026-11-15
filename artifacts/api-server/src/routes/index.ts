import { Router, type IRouter } from "express";
import healthRouter from "./health";
import svpRouter from "./svp";
import devAuthRouter from "./dev-auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(devAuthRouter);
router.use(svpRouter);

export default router;
