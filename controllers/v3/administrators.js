const {drivers: {v2: driver}} = require('../../db.js')
const createHttpError = require('http-errors')

const {
  get_current_user_id,
  current_user_query,
  user_query,
  user_id_filter,
  group_query,
  return_batch,
  format_batched_response,
} = require('../../utils.js')

const {
  default_batch_size
} = require('../../config.js')

exports.get_administrators_of_group = (req, res, next) => {
  // Route to retrieve a user's groups

  const {group_id} = req.params
  if(!group_id || group_id === 'undefined') throw createHttpError(400, 'Group ID not defined')

  const {
    batch_size = default_batch_size,
    start_index = 0,
  } = req.query

  const session = driver.session()

  const query = `
    ${group_query}
    WITH group
    OPTIONAL MATCH (admin:User)<-[:ADMINISTRATED_BY]-(group:Group)
    WITH admin as item
    ${return_batch}
    `

  const params = { group_id, batch_size, start_index }


  session.run(query,params)
  .then(({records}) => {
    if(!records.length) throw createHttpError(400, `Group ${group_id} not found`)
    console.log(`Administrators of group ${group_id} queried`)
    const response = format_batched_response(records)
    res.send(response)
   })
   .catch(next)
   .finally( () => { session.close() })
}

exports.make_user_administrator_of_group = (req, res, next) => {
  // Route to leave a group

  const {group_id} = req.params
  if(!group_id || group_id === 'undefined') throw createHttpError(400, 'Group ID not defined')

  const user_id = req.body.member_id
    ?? req.body.user_id
    ?? req.body.administrator_id
    ?? req.params.administrator_id

  const current_user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    ${current_user_query}
    WITH current_user

    ${group_query}
    // Allow only group admin or super admin to delete a group
    AND ( (group)-[:ADMINISTRATED_BY]->(current_user) OR current_user.isAdmin )

    // Find the user
    WITH group
    ${user_query}

    // Merge relationship
    MERGE (group)-[:ADMINISTRATED_BY]->(user)

    // Return
    RETURN properties(group) as group
    `

  const params = {
    current_user_id,
    user_id,
    group_id,
  }

  session.run(query, params)
  .then(({records}) => {
    if(!records.length) throw createHttpError(400, `Error adding user to administrators`)
    console.log(`User ${user_id} added to administrators of group ${group_id}`)
    res.send(records[0].get('group'))
  })
  .catch(next)
  .finally( () => { session.close() })
}

exports.remove_user_from_administrators = (req, res, next) => {
  // Route to remove a user from the administrators of a group

  const {group_id} = req.params
  const {administrator_id: user_id} = req.params

  if(!group_id || group_id === 'undefined') throw createHttpError(400, 'Group ID not defined')
  if(!user_id || user_id === 'undefined') throw createHttpError(400, 'Administrator ID not defined')

  const session = driver.session()

  const current_user_id = get_current_user_id(res)

  const query = `
    ${current_user_query}

    // Find group
    WITH current_user
    ${group_query}
    AND ( (group)-[:ADMINISTRATED_BY]->(current_user) OR current_user.isAdmin )

    // Find the user
    WITH group
    MATCH (group)-[r:ADMINISTRATED_BY]->(user:User)
    ${user_id_filter}

    // Delete relationship
    DELETE r

    // Return
    RETURN properties(group) as group
    `

  const params = {
    current_user_id,
    user_id,
    group_id,
  }

  session.run(query, params)
  .then(({records}) => {
    if(!records.length) throw createHttpError(400, `Error removing from administrators`)
    console.log(`User ${user_id} removed from administrators of group ${group_id}`)
    res.send(records[0].get('group'))
  })
  .catch(next)
  .finally( () => { session.close() })
}


exports.get_groups_of_administrator = (req, res, next) => {
  // Route to retrieve a user's groups
  let {administrator_id: user_id} = req.params
  if(user_id === 'self') user_id = get_current_user_id(res)

  const {
    batch_size = default_batch_size,
    start_index = 0,
    shallow,
  } = req.query

  const shallow_query = 'WHERE NOT (group)-[:BELONGS_TO]->(:Group)'

  const query = `
    ${user_query}
    WITH user
    OPTIONAL MATCH (user)<-[:ADMINISTRATED_BY]-(group:Group)

    ${shallow ? shallow_query : ''}

    WITH group as item
    ${return_batch}
    `

  const params = { user_id, batch_size, start_index }

  const session = driver.session();
  session
  .run(query,params)
  .then( ({records}) => {
    if(!records.length) throw createHttpError(400, `User ${user_id} not found`)
    console.log(`Groups of administrator ${user_id} queried`)
    const response = format_batched_response(records)
    res.send(response)
  })
  .catch(next)
  .finally( () => { session.close() })
}
