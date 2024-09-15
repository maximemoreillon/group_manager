import { drivers } from "../../db"
import { get_current_user_id, getCypherUserIdentifiers } from "../../utils"
import createHttpError from "http-errors"
import { Request, Response, NextFunction } from "express"

const driver = drivers.v1

export const get_user = (req: Request, res: Response, next: NextFunction) => {
  // Route to retrieve a user's info

  let user_id =
    req.params.member_id ??
    req.params.user_id ??
    req.query.member_id ??
    req.query.user_id ??
    req.query.id

  if (user_id === "self") user_id = get_current_user_id(res)
  if (!user_id) throw createHttpError(400, "User ID not defined")

  const session = driver.session()

  const query = `
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}
    RETURN user
    `

  session
    .run(query, { user_id })
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_members_of_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve a user's groups

  const group_id =
    req.query.id ?? req.query.group_id ?? req.params.id ?? req.params.group_id

  if (!group_id) throw createHttpError(400, "Group ID not defined")

  // Todo: allow user to pass what key they want to query
  // IDEA: Could be done with GraphQL

  const session = driver.session()

  const query = `
    MATCH (user:User)-[:BELONGS_TO]->(group:Group {_id: $group_id})
    RETURN user
    `
  session
    .run(query, { group_id })
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_groups_of_user = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let member_id =
    req.query.member_id ??
    req.query.user_id ??
    req.query.id ??
    req.params.member_id ??
    get_current_user_id(res)

  if (member_id === "self") member_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}
    WITH user
    MATCH (user)-[:BELONGS_TO]->(group:Group)
    RETURN group
    `
  session
    .run(
      query,

      { user_id: member_id }
    )
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const users_with_no_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = driver.session()

  const query = `
    MATCH (user:User)
    WHERE NOT (user)-[:BELONGS_TO]->(:Group)
    RETURN user
    `
  session
    .run(query, {})
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const add_member_to_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("Deprecated")
}

export const remove_user_from_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("Deprecated")
}
