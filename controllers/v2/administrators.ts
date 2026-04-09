import { drivers } from "../../db"
import createHttpError from "http-errors"
import { get_current_user_id, getCypherUserIdentifiers } from "../../utils"
import { Request, Response, NextFunction } from "express"
const driver = drivers.v2

export const get_administrators_of_group = async (
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

  try {
    const { records } = await session.run(query, { group_id })
    if (!records.length)
      throw createHttpError(400, `Group ${group_id} not found`)
    const admins = records[0].get("administrators")
    admins.forEach((admin: any) => {
      delete admin.properties.password_hashed
    })
    res.send(admins)
  } catch (e) {
    next(e)
  } finally {
    session.close()
  }
}

export const make_user_administrator_of_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("Deprecated")
}

export const remove_user_from_administrators = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("Deprecated")
}

export const get_groups_of_administrator = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve a user's groups
  let { administrator_id: user_id } = req.params
  if (user_id === "self") user_id = get_current_user_id(req, res)

  const session = driver.session()

  const query = `
    MATCH (user:User)<-[:ADMINISTRATED_BY]-(group:Group)
    WHERE $user_id IN ${getCypherUserIdentifiers("user")}
    RETURN collect(group) as groups
    `

  try {
    const { records } = await session.run(query, { user_id })
    if (!records.length)
      throw createHttpError(404, `User ${user_id} not found`)
    const groups = records[0].get("groups")
    console.log(`Groups of administrator ${user_id} queried`)
    res.send(groups)
  } catch (e) {
    next(e)
  } finally {
    session.close()
  }
}
