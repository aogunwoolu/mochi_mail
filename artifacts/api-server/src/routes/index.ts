import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mochimailRouter from "./mochimail";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mochimailRouter);

export default router;
