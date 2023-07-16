import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import dotenv from "dotenv"
import apiMetrics from "prometheus-api-metrics"
import swaggerUi from "swagger-ui-express"
import swaggerDocument from "./swagger-output.json"
import router_v1 from "./routes/v1"
import router_v2 from "./routes/v2"
import router_v3 from "./routes/v3"
import { version, author } from "./package.json"
import auth from "@moreillon/express_identification_middleware"
import {
  NEO4J_URL,
  getConnected as neo4j_connected,
  init as db_init,
} from "./db"

dotenv.config()

console.log(`= Group manager v${version} =`)

db_init()

const { IDENTIFICATION_URL, APP_PORT = 80 } = process.env

const auth_options = { url: IDENTIFICATION_URL }

export const app = express()
app.use(express.json())
app.use(cors())
app.use(apiMetrics())
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.get("/", (req, res) => {
  res.send({
    application_name: "Group Manager",
    version,
    author,
    neo4j: {
      url: NEO4J_URL,
      connected: neo4j_connected(),
    },
    identification_url: IDENTIFICATION_URL,
  })
})

// From here on, all routes require authentication
app.use(auth(auth_options))
app.use("/", router_v1)
app.use("/v1", router_v1) //alias
app.use("/v2", router_v2)
app.use("/v3", router_v3)

// Express error handler
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error(error)
  let { statusCode = 500, message = error } = error
  if (isNaN(statusCode) || statusCode > 600) statusCode = 500
  res.status(statusCode).send(message)
})

app.listen(APP_PORT, () => {
  console.log(`[Express] listening on port ${APP_PORT}`)
})
