import { version } from "./package.json"
console.log(`= Group manager v${version} =`)

import express from "express"
import cors from "cors"
import promBundle from "express-prom-bundle"
import swaggerUi from "swagger-ui-express"
import swaggerDocument from "./swagger-output.json"
import { init as db_init } from "./db"
import { errorHandler } from "./utils"
import { APP_PORT } from "./config"
import router from "./routes/"

db_init()

const promOptions = { includeMethod: true, includePath: true }

export const app = express()
app.use(express.json())
app.use(cors())
app.use(promBundle(promOptions))
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))
app.use("/", router)
app.use(errorHandler)

app.listen(APP_PORT, () => {
  console.log(`[Express] listening on port ${APP_PORT}`)
})
