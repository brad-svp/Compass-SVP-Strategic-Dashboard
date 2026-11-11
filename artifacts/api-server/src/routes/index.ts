import { Router, type IRouter } from "express";
import healthRouter from "./health";
import svpRouter from "./svp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(svpRouter);

export default router;
