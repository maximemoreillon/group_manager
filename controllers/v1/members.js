const {
  drivers: { v1: driver },
} = require("../../db.js")
const { get_current_user_id } = require("../../utils.js")

exports.get_user = (req, res) => {
  // Route to retrieve a user's info

  let user_id =
    req.params.member_id ??
    req.params.user_id ??
    req.query.member_id ??
    req.query.user_id ??
    req.query.id

  if (user_id === "self") user_id = get_current_user_id(res)
  if (!user_id) return res.status(400).send("User ID not defined")

  const session = driver.session()

  const query = `
    MATCH (user:User {_id: $user_id})
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

exports.get_members_of_group = (req, res) => {
  // Route to retrieve a user's groups

  const group_id =
    req.query.id ?? req.query.group_id ?? req.params.id ?? req.params.group_id

  if (!group_id) return res.status(400).send("Group ID not defined")

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

exports.get_groups_of_user = (req, res) => {
  // Route to retrieve a user's groups

  let member_id =
    req.query.member_id ??
    req.query.user_id ??
    req.query.id ??
    req.params.member_id ??
    get_current_user_id(res)

  if (member_id === "self") member_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    MATCH (user:User {_id: $user_id})
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

exports.users_with_no_group = (req, res) => {
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
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

exports.add_member_to_group = (req, res) => {
  res.status(410).send("Deprecated")
}

exports.remove_user_from_group = (req, res) => {
  res.status(410).send("Deprecated")
}
