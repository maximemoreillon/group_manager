import { drivers } from "../../db"
import createHttpError from "http-errors"
import { get_current_user_id, getCypherUserIdentifiers } from "../../utils"
import { Request, Response, NextFunction } from "express"

const driver = drivers.v2

export const get_user = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve a user's info
  // This should not be a feature of group manager
  // Used in front-end

  let user_id =
    req.params.member_id ??
    req.params.user_id ??
    req.query.member_id ??
    req.query.user_id ??
    req.query.id

  if (user_id === "self") user_id = get_current_user_id(req, res)

  if (!user_id) throw createHttpError(400, "User ID not defined")

  const session = driver.session()

  try {
    const { records } = await session.run(
      `
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}
    RETURN user
    `,
      { user_id }
    )
    if (!records.length) throw createHttpError(404, "User not found")

    const user = records[0].get("user")
    delete user.properties.password_hashed

    res.send(user)
  } catch (e) {
    next(e)
  } finally {
    session.close()
  }
}

export const get_members_of_group = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve a user's groups

  const group_id = req.params.group_id || req.query.group_id
  if (!group_id) throw createHttpError(400, "Group ID not defined")

  // Todo: allow user to pass what key tey want to query
  // IDEA: Could be done with GraphQL

  const session = driver.session()

  const query = `
    MATCH (group:Group {_id: $group_id})
    WITH group
    OPTIONAL MATCH (user:User)-[:BELONGS_TO]->(group)
    RETURN collect(user) as users, group
    `

  try {
    const { records } = await session.run(query, { group_id })
    if (!records.length) throw createHttpError(404, "Group not found")
    const users = records[0].get("users")
    users.forEach((user: any) => {
      delete user.properties.password_hashed
    })
    res.send(users)
  } catch (e) {
    next(e)
  } finally {
    session.close()
  }
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

export const get_groups_of_user = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve a user's groups

  let { member_id: user_id } = req.params
  if (user_id === "self") user_id = get_current_user_id(req, res)

  const session = driver.session()

  const query = `
    MATCH (user:User)
    WHERE $user_id IN ${getCypherUserIdentifiers("user")}
    WITH user
    MATCH (user)-[:BELONGS_TO]->(group:Group)
    RETURN collect(group) as groups
    `

  try {
    const { records } = await session.run(query, { user_id })
    if (!records.length)
      throw createHttpError(404, `User ${user_id} not found`)
    console.log(`Groups of user ${user_id} queried`)
    const groups = records[0].get("groups")
    res.send(groups)
  } catch (e) {
    next(e)
  } finally {
    session.close()
  }
}

export const users_with_no_group = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve users without a group

  const session = driver.session()

  try {
    const { records } = await session.run(
      `
    MATCH (user:User)
    WHERE NOT (user)-[:BELONGS_TO]->(:Group)
    RETURN user
    `,
      {}
    )
    const users = records.map((record) => record.get("user"))
    users.forEach((user) => {
      delete user.properties.password_hashed
    })

    res.send(users)
    console.log(`Queried users with no group`)
  } catch (e) {
    next(e)
  } finally {
    session.close()
  }
}

export const get_members_of_groups = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Retrieve a multiple groups' members
  // Still in beta

  const group_ids: any = req.query.group_ids || req.query.ids
  if (!group_ids) throw createHttpError(400, "group_ids undefined")

  const query = `
  UNWIND $group_ids AS group_id

  // CANNOT USE QUERY TEMPLATE BECAUSE NOT $group_id
  MATCH (group:Group)
  WHERE group._id = group_id

  WITH group
  MATCH (member:User)-[:BELONGS_TO]->(group)
  RETURN group, COLLECT(member) AS members
  `

  const params = { group_ids }

  const session = driver.session()

  try {
    const { records } = await session.run(query, params)
    const output = records.map((record) => {
      const group = record.get("group")
      group.members = record.get("members")
      return group
    })

    res.send(output)

    console.log(`Members of groups ${group_ids.join(", ")} queried`)
  } catch (e) {
    next(e)
  } finally {
    session.close()
  }
}

export const get_groups_of_users = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Retrieve a multiple users' groups
  // Still in beta

  const user_ids = req.query.user_ids || req.query.member_ids || req.query.ids

  const query = `
  UNWIND $user_ids AS user_id
  MATCH (user:User)
  WHERE user_id IN ${getCypherUserIdentifiers("user")}

  // CANNOT USE QUERY TEMPLATE BECAUSE NOT $group_id
  WITH user
  MATCH (user)-[:BELONGS_TO]->(group:Group)
  RETURN user, COLLECT(group) AS groups
  `

  const params = { user_ids }

  const session = driver.session()

  try {
    const { records } = await session.run(query, params)
    const output = records.map((record) => {
      const user = record.get("user")
      user.groups = record.get("groups")
      return user
    })

    res.send(output)
  } catch (e) {
    next(e)
  } finally {
    session.close()
  }
}
