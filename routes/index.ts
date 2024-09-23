import { Router } from "express"
import { version, author } from "../package.json"
import { NEO4J_URL, getConnected as neo4j_connected } from "../db"

import router_v1 from "./v1"
import router_v2 from "./v2"
import router_v3 from "./v3"

import {
  IDENTIFICATION_URL,
  OIDC_JWKS_URI,
  dbUserIdentifiers,
  authUseridentifiers,
} from "../config"
import { authMiddleware } from "../auth"

const router = Router({ mergeParams: true })

router.get("/", (req, res) => {
  res.send({
    application_name: "Group Manager",
    version,
    author,
    neo4j: {
      url: NEO4J_URL,
      connected: neo4j_connected(),
    },
    auth: {
      identification_url: IDENTIFICATION_URL,
      oidc_jwks_uri: OIDC_JWKS_URI,
      dbUserIdentifiers,
      authUseridentifiers,
    },
  })
})

router.use(authMiddleware)
router.use("/", router_v1)
router.use("/v1", router_v1) //alias
router.use("/v2", router_v2)
router.use("/v3", router_v3)

export default router
