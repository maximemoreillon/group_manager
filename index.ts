import { version } from "./package.json";
console.log(`= Group manager v${version} =`);

import express from "express";
import qs from "qs";
import cors from "cors";
import promBundle from "express-prom-bundle";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger-output.json";
import { init as db_init, close as db_close } from "./db";
import { errorHandler } from "./utils";
import { APP_PORT, CORS_ALLOWED_ORIGINS } from "./config";
import router from "./routes/";

const promOptions = { includeMethod: true, includePath: true };
const corsOptions = CORS_ALLOWED_ORIGINS
  ? { origin: CORS_ALLOWED_ORIGINS.split(",") }
  : {};

export const app = express();
app.set("query parser", (str: string) =>
  qs.parse(str, { arrayLimit: Infinity }),
);
app.use(express.json());
app.use(cors(corsOptions));
app.use(promBundle(promOptions));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/", router);
app.use(errorHandler);

db_init()
  .then(() => {
    const server = app.listen(APP_PORT, () => {
      console.log(`[Express] listening on port ${APP_PORT}`);
    });

    const shutdown = async () => {
      console.log("[Express] Shutting down...");
      server.close(async () => {
        await db_close();
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
