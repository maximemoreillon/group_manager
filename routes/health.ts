import { Router } from "express";
import { get_connection_status as neo4j_connected } from "../db";

const router = Router();

router.get("/live", (req, res) => {
  res.send({ status: "ok" });
});

router.get("/ready", async (req, res) => {
  const connected = await neo4j_connected();
  if (!connected) res.status(503).send({ status: "unavailable" });
  else res.send({ status: "ok" });
});

export default router;
