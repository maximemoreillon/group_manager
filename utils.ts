import { Request, Response, NextFunction } from "express";
import { authUserIdentifiers, dbUserIdentifiers } from "./config";
import createHttpError, { isHttpError } from "http-errors";
import type { Record as Neo4jRecord } from "neo4j-driver";
import { z } from "zod";

export const GroupFilterSchema = z
  .object({
    name: z.string(),
    official: z.string(),
    hidden: z.string(),
    restricted: z.string(),
    avatar_src: z.string(),
  })
  .partial();

export const UserFilterSchema = z
  .object({
    username: z.string(),
  })
  .partial();

export const get_current_user_id = (req: Request, res: Response) => {
  const current_user = res.locals?.user?.properties ?? res.locals?.user;

  if (!current_user) return;

  const aui = authUserIdentifiers.find((aui) => current_user[aui]);
  if (!aui) return;

  return current_user[aui];
};

export const batch_items = (batch_size: number) => `
// Aggregation
WITH
  COLLECT(PROPERTIES(item)) as items,
  COUNT(item) as count,
  toInteger($start_index) as start_index,
  toInteger($batch_size) as batch_size,
  (toInteger($start_index) + toInteger($batch_size)) as end_index

// Batching
// Note: if end_index is -1, returns all except last
RETURN
  count,
  ${
    batch_size > 0 ? "items[start_index..end_index] AS batch" : "items AS batch"
  },
  start_index,
  batch_size
`;

export const format_batched_response = (records: Neo4jRecord[]) => {
  const record = records[0];

  if (!record) throw createHttpError(400, "Query did not yield any match");

  const items = record.get("batch");
  items.forEach((item: any) => {
    if (item.password_hashed) delete item.password_hashed;
  });

  return {
    batch_size: record.get("batch_size"),
    start_index: record.get("start_index"),
    count: record.get("count"),
    items,
  };
};

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(error);
  if (isHttpError(error)) {
    const { statusCode, message, expose } = error;
    res.status(statusCode).send(expose ? message : "Internal Server Error");
  } else {
    res.status(500).send("Internal Server Error");
  }
};

export const getCypherUserIdentifiers = (name: string = "user") =>
  `[${dbUserIdentifiers.map((i) => `${name}.${i}`).join(",")}]`;

export const filtering_query = `
WITH item
UNWIND KEYS($filters) as filterKey
WITH item, filterKey
WHERE item[filterKey] = $filters[filterKey]
`;
