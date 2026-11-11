import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import { AppError } from "./lib/permissions";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: false }));
app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
})));

app.use("/api", router);
app.use(((err, req, res, _next) => {
  if (err instanceof AppError) { res.status(err.status).json({ error: err.message }); return; }
  if (err?.name === "ZodError") { res.status(400).json({ error: "Please check the submitted fields." }); return; }
  if (err?.code === "23505") { res.status(409).json({ error: "That email or name is already in use." }); return; }
  req.log.error({ err }, "Request failed");
  res.status(500).json({ error: "Something went wrong. Please try again." });
}) as express.ErrorRequestHandler);

export default app;
