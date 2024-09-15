import { drivers } from "../../db"
import createHttpError from "http-errors"
import { get_current_user_id, getCypherUserIdentifiers } from "../../utils"
import { Request, Response, NextFunction } from "express"
const driver = drivers.v2

export const get_administrators_of_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve a user's groups

  const { group_id } = req.params
  if (!group_id) throw createHttpError(400, "Group ID not defined")

  const session = driver.session()

  const query = `
  MATCH (group:Group {_id: $group_id})
  WITH group
  OPTIONAL MATCH (admin:User)<-[:ADMINISTRATED_BY]-(group:Group)
  RETURN collect(admin) as administrators
  `

  session
    .run(query, { group_id })
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(400, `Group ${group_id} not found`)
      const admins = records[0].get("administrators")
      admins.forEach((admin: any) => {
        delete admin.properties.password_hashed
      })
      res.send(admins)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const make_user_administrator_of_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to leave a group

  const { group_id } = req.params
  if (!group_id) throw createHttpError(400, "Group ID not defined")

  const user_id =
    req.body.member_id ??
    req.body.user_id ??
    req.body.administrator_id ??
    req.params.administrator_id

  const current_user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    MATCH (current_user:User) WHERE $current_user_id IN ${getCypherUserIdentifiers(
      "current_user"
    )}
    WITH current_user

    MATCH (group:Group {_id: $group_id})
    // Allow only group admin or super admin to delete a group
    WHERE ( (group)-[:ADMINISTRATED_BY]->(current_user) OR current_user.isAdmin )

    // Find the user
    WITH group
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}

    // Merge relationship
    MERGE (group)-[:ADMINISTRATED_BY]->(user)

    // Return
    RETURN user, group
    `

  const params = {
    current_user_id,
    user_id,
    group_id,
  }

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(400, `Error adding user to administrators`)
      console.log(
        `User ${user_id} added to administrators of group ${group_id}`
      )
      res.send(records[0].get("user"))
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const remove_user_from_administrators = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to remove a user from the administrators of a group

  const { group_id } = req.params
  if (!group_id) throw createHttpError(400, "Group ID not defined")

  const { administrator_id: user_id } = req.params
  if (!user_id) throw createHttpError(400, "administrator_id ID not defined")

  const session = driver.session()

  const current_user_id = get_current_user_id(res)

  const query = `
    MATCH (current_user:User) WHERE $current_user_id IN ${getCypherUserIdentifiers(
      "current_user"
    )}

    WITH current_user
    MATCH (group:Group {_id: $group_id})
    WHERE ( (group)-[:ADMINISTRATED_BY]->(current_user) OR current_user.isAdmin )

    WITH group
    MATCH (group)-[r:ADMINISTRATED_BY]->(user:User {_id: $user_id})

    DELETE r

    RETURN user, group
    `

  const params = {
    current_user_id,
    user_id,
    group_id,
  }

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(400, `Error removing from administrators`)
      console.log(
        `User ${user_id} removed from administrators of group ${group_id}`
      )
      res.send(records[0].get("user"))
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_groups_of_administrator = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve a user's groups
  let { administrator_id: user_id } = req.params
  if (user_id === "self") user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers(
      "user"
    )}<-[:ADMINISTRATED_BY]-(group:Group)
    RETURN collect(group) as groups
    `
  session
    .run(query, { user_id })
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(404, `User ${user_id} not found`)
      const groups = records[0].get("groups")
      console.log(`Groups of administrator ${user_id} queried`)
      res.send(groups)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}
