import { Request, Response, NextFunction } from "express"
import { authUseridentifiers, dbUserIdentifiers } from "./config"
import createHttpError from "http-errors"

export const get_current_user_id = (req: Request, res: Response) => {
  const current_user = res.locals?.user ?? (req as any).user

  if (!current_user) return

  let userId = current_user._id ?? current_user.properties?._id

  if (userId) return userId

  const aui = authUseridentifiers.find(
    (aui) => current_user[aui] ?? current_user.properties?.[aui]
  )
  if (aui) return current_user[aui]

  return
}

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
`

export const format_batched_response = (records: any) => {
  const record = records[0]

  if (!record) throw createHttpError(400, "Query did not yield any match")

  const items = record.get("batch")
  items.forEach((item: any) => {
    if (item.password_hashed) delete item.password_hashed
  })

  return {
    batch_size: record.get("batch_size"),
    start_index: record.get("start_index"),
    count: record.get("count"),
    items,
  }
}

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(error)
  let { statusCode = 500, message = error } = error
  if (isNaN(statusCode) || statusCode > 600) statusCode = 500
  res.status(statusCode).send(message)
}

export const getCypherUserIdentifiers = (name: string = "user") =>
  `[${dbUserIdentifiers.map((i) => `${name}.${i}`).join(",")}]`
