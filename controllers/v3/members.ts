import createHttpError from "http-errors"
import { drivers } from "../../db"
import { Request, Response, NextFunction } from "express"

import { DEFAULT_BATCH_SIZE } from "../../config"
import {
  get_current_user_id,
  batch_items,
  format_batched_response,
} from "../../utils"

const driver = drivers.v2

export const add_member_to_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const current_user_id = get_current_user_id(res)

  const { group_id } = req.params
  let { user_id, user_ids } = req.body
  if (user_id === "self") user_id = current_user_id
  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined")
  if (!user_id && !user_ids)
    throw createHttpError(400, "User ID(s) not defined")

  const session = driver.session()

  const join_possible_check = `
    // Allow user to join unrestricted groups even if not admin
    OR (
      $user_id = $current_user_id 
      AND ( group.restricted IS NULL OR NOT group.restricted )
    )`

  const single_user_add_query = `
    
    WITH group
    MATCH (user:User {_id: $user_id})
    MERGE (user)-[:BELONGS_TO]->(group)
    `

  const multiple_user_add_query = `
    WITH group
    UNWIND
      CASE
        WHEN $user_ids = []
          THEN [null]
        ELSE $user_ids
      END AS user_id

    OPTIONAL MATCH (user:User)
    WHERE user._id = user_id
    WITH group, collect(user) as users
    FOREACH(user IN users | MERGE (user)-[:BELONGS_TO]->(group))
    `

  const query = `
    MATCH (current_user:User {_id: $current_user_id} )

    WITH current_user
    MATCH (group:Group {_id: $group_id})
    // Allow only group admin or super admin to manage group
    WHERE ( 
      (group)-[:ADMINISTRATED_BY]->(current_user) OR current_user.isAdmin
      // Allowing oneself to join if group is not restricted
      ${user_id ? join_possible_check : ""}
    )

    // Create relationship for single user
    ${user_id ? single_user_add_query : ""}

    // OR multiple users at once
    ${user_ids ? multiple_user_add_query : ""}

    // Return
    RETURN properties(group) as group
    `

  const params = { current_user_id, user_id, user_ids, group_id }

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(
          400,
          `Error adding adding user(s) ${
            user_id || user_ids.join(", ")
          } to group ${group_id}`
        )

      console.log(
        `User ${current_user_id} added user(s) ${
          user_id || user_ids.join(", ")
        } to group ${group_id}`
      )

      const group = records[0].get("group")
      res.send(group)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_user = (req: Request, res: Response, next: NextFunction) => {
  // This should not be a feature of group manager
  // but it is used in front-end

  let { member_id: user_id } = req.params
  if (user_id === "self") user_id = get_current_user_id(res)
  if (!user_id) throw createHttpError(400, "User ID not defined")

  const session = driver.session()

  const query = `
    MATCH (user:User {_id: $user_id}) 
    RETURN properties(user) as user
    `

  session
    .run(query, { user_id })
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(404, `User ${user_id} not found`)

      const user = records[0].get("user")
      delete user.password_hashed

      res.send(user)
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
  const { group_id } = req.params
  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined")

  const { batch_size = DEFAULT_BATCH_SIZE, start_index = 0 } = req.query

  const session = driver.session()

  const query = `
    MATCH (group:Group {_id: $group_id})
    WITH group

    // Optional match so groups with no users can still be queried
    OPTIONAL MATCH (user:User)-[:BELONGS_TO]->(group)

    WITH user as item
    ${batch_items(batch_size as number)}
    `

  const params = { group_id, batch_size, start_index }

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(404, `Member query: group ${group_id} not found`)
      const response = format_batched_response(records)
      res.send(response)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const remove_user_from_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const current_user_id = get_current_user_id(res)

  let { group_id, member_id: user_id } = req.params
  if (user_id === "self") user_id = current_user_id

  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined")
  if (!user_id) throw createHttpError(400, "User ID not defined")

  const session = driver.session()

  const query = `
    MATCH (current_user:User {_id: $current_user_id} )

    WITH current_user
    MATCH (group:Group {_id: $group_id})
    WHERE ( 
      (group)-[:ADMINISTRATED_BY]->(current_user) 
      OR current_user.isAdmin
      // Allow oneself to leave group
      OR $user_id = $current_user_id 
    )
    
    WITH group
    MATCH (user:User {_id: $user_id})-[r:BELONGS_TO]->(group)

    DELETE r

    RETURN properties(group) as group
    `

  const params = { current_user_id, user_id, group_id }
  session

    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(
          400,
          `Error removing using ${user_id} from group ${group_id}`
        )
      console.log(
        `User ${current_user_id} removed user ${user_id} from group ${group_id}`
      )

      const group = records[0].get("group")
      res.send(group)
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
  let { member_id: user_id } = req.params
  if (user_id === "self") user_id = get_current_user_id(res)
  if (!user_id) throw createHttpError(400, "User ID not defined")

  // TODO: add filters
  const {
    batch_size = DEFAULT_BATCH_SIZE,
    start_index = 0,
    shallow,
    official,
    nonofficial,
    ...filters
  } = req.query

  const session = driver.session()

  const filtering_query = `
    UNWIND KEYS($filters) as filterKey
    WITH filterKey, group
    WHERE group[filterKey] = $filters[filterKey]
    `

  const shallow_query =
    "AND NOT (group)-[:BELONGS_TO]->(:Group)<-[:BELONGS_TO]-(user)"
  const official_query = "AND group.official"
  const non_official_query =
    "AND (group.official IS NULL OR NOT group.official)"

  const query = `
    MATCH (user:User {_id: $user_id})
    WITH user
    OPTIONAL MATCH (user)-[:BELONGS_TO]->(group:Group)

    // using dummy WHERE here so as to use AND in other queryies
    WHERE group._id IS NOT NULL
    
    ${Object.keys(filters).length ? filtering_query : ""} 
    ${shallow ? shallow_query : ""}
    ${official ? official_query : ""}
    ${nonofficial ? non_official_query : ""}

    WITH group as item
    ${batch_items(batch_size as number)}
    `

  const params = { user_id, batch_size, start_index, filters }

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(404, `User ${user_id} not found`)
      const response = format_batched_response(records)
      res.send(response)
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

  const { batch_size = DEFAULT_BATCH_SIZE, start_index = 0 } = req.query

  const query = `
    OPTIONAL MATCH (user:User)
    WHERE NOT (user)-[:BELONGS_TO]->(:Group)
    WITH user as item
    ${batch_items(batch_size as number)}
    `

  const params = { batch_size, start_index }

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length) throw createHttpError(404, `No users with no groups`)
      const response = format_batched_response(records)
      res.send(response)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_groups_of_users = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = driver.session()

  const { batch_size = DEFAULT_BATCH_SIZE, start_index = 0 } = req.query

  const user_ids = req.query.user_ids || req.query.member_ids || req.query.ids

  const query = `
    UNWIND $user_ids AS user_id
    MATCH (user:User {_id: user_id})-[:BELONGS_TO]->(group:Group)
    WITH COLLECT(PROPERTIES(group)) as groupProperties, PROPERTIES(user) as userProperties
    WITH {user: userProperties, groups: groupProperties} as item
    ${batch_items(batch_size as number)}
    `

  const params = { user_ids, batch_size, start_index }

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length) throw createHttpError(404, `No users found`)
      const response = format_batched_response(records)
      res.send(response)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}
