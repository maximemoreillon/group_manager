const {
  drivers: { v2: driver },
} = require("../../db.js")
const createHttpError = require("http-errors")
const { get_current_user_id } = require("../../utils.js")

exports.get_user = (req, res, next) => {
  // Route to retrieve a user's info
  // This should not be a feature of group manager
  // Used in front-end

  let user_id =
    req.params.member_id ??
    req.params.user_id ??
    req.query.member_id ??
    req.query.user_id ??
    req.query.id

  if (user_id === "self") user_id = get_current_user_id(res)

  if (!user_id) throw createHttpError(400, "User ID not defined")

  const session = driver.session()
  session
    .run(
      `
    MATCH (user:User {_id: $user_id})
    RETURN user
    `,
      { user_id }
    )
    .then(({ records }) => {
      if (!records.length) throw createHttpError(404, "User not found")

      const user = records[0].get("user")
      delete user.properties.password_hashed

      res.send(user)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

exports.get_members_of_group = (req, res, next) => {
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

  session
    .run(query, { group_id })
    .then(({ records }) => {
      if (!records.length) throw createHttpError(404, "Group not found")
      const users = records[0].get("users")
      users.forEach((user) => {
        delete user.properties.password_hashed
      })
      res.send(users)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

exports.add_member_to_group = (req, res, next) => {
  // Route to make a user join a group

  const { group_id } = req.params
  const { user_id } = req.body

  if (!group_id) throw createHttpError(400, "User ID not defined")
  if (!user_id) throw createHttpError(400, "User ID not defined")

  const current_user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    // Find the current user
    MATCH (current_user:User {_id: $current_user_id} )

    // Find group
    WITH current_user
    MATCH (group:Group {_id: $group_id})
    // Allow only group admin or super admin to delete a group
    WHERE ( (group)-[:ADMINISTRATED_BY]->(current_user)
        OR current_user.isAdmin )

    // Find the user
    WITH group
    MATCH (user:User {_id: $user_id})

    // MERGE relationship
    MERGE (user)-[:BELONGS_TO]->(group)

    // Return
    RETURN user, group
    `

  const params = { current_user_id, user_id, group_id }

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(
          400,
          `Error adding using ${user_id} from group ${group_id}`
        )
      console.log(
        `User ${current_user_id} added user ${user_id} to group ${group_id}`
      )

      const user = records[0].get("user")
      res.send(user)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

exports.remove_user_from_group = (req, res, next) => {
  // Route to make a user leave a group

  const { group_id, member_id: user_id } = req.params

  if (!group_id) throw createHttpError(400, "Group ID not defined")
  if (!user_id) throw createHttpError(400, "User ID not defined")

  const current_user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    MATCH (current_user:User {_id: $current_user_id} )

    WITH current_user
    MATCH (group:Group {_id: $group_id})
    WHERE ( (group)-[:ADMINISTRATED_BY]->(current_user) OR current_user.isAdmin )

    WITH group
    MATCH (user:User {_id: $user_id})-[r:BELONGS_TO]->(group)

    DELETE r

    RETURN user, group
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
        `User ${current_user_id}  removed user ${user_id} from group ${group_id}`
      )

      const user = records[0].get("user")
      res.send(user)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

exports.get_groups_of_user = (req, res, next) => {
  // Route to retrieve a user's groups

  let { member_id: user_id } = req.params
  if (user_id === "self") user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    MATCH (user:User {_id: $user_id})
    WITH user
    MATCH (user)-[:BELONGS_TO]->(group:Group)
    RETURN collect(group) as groups
    `

  session
    .run(query, { user_id })
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(404, `User ${user_id} not found`)
      console.log(`Groups of user ${user_id} queried`)
      const groups = records[0].get("groups")
      res.send(groups)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

exports.users_with_no_group = (req, res, next) => {
  // Route to retrieve users without a group

  const session = driver.session()
  session
    .run(
      `
    MATCH (user:User)
    WHERE NOT (user)-[:BELONGS_TO]->(:Group)
    RETURN user
    `,
      {}
    )
    .then(({ records }) => {
      const users = records.map((record) => record.get("user"))
      users.forEach((user) => {
        delete user.properties.password_hashed
      })

      res.send(users)
      console.log(`Queried users with no group`)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

exports.get_members_of_groups = (req, res, next) => {
  // Retrieve a multiple groups' members
  // Still in beta

  const group_ids = req.query.group_ids || req.query.ids

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
  session
    .run(query, params)
    .then(({ records }) => {
      const output = records.map((record) => {
        const group = record.get("group")
        group.members = record.get("members")
        return group
      })

      res.send(output)

      console.log(`Members of groups ${group_ids.join(", ")} queried`)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

exports.get_groups_of_users = (req, res, next) => {
  // Retrieve a multiple users' groups
  // Still in beta

  const user_ids = req.query.user_ids || req.query.member_ids || req.query.ids

  const query = `
  UNWIND $user_ids AS user_id
  MATCH (user:User)
  // CANNOT USE QUERY TEMPLATE BECAUSE NOT $group_id
  WHERE user._id = user_id

  WITH user
  MATCH (user)-[:BELONGS_TO]->(group:Group)
  RETURN user, COLLECT(group) AS groups
  `

  const params = { user_ids }

  const session = driver.session()
  session
    .run(query, params)
    .then(({ records }) => {
      const output = records.map((record) => {
        const user = record.get("user")
        user.groups = record.get("groups")
        return user
      })

      res.send(output)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}
