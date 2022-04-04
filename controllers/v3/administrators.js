const {drivers: {v2: driver}} = require('../../db.js')
const createHttpError = require('http-errors')

const {
  get_current_user_id,
  current_user_query,
  user_query,
  user_id_filter,
  group_query,
  batch_items,
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
    ${batch_items(batch_size)}
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
  const {user_id, user_ids} = req.body

  if(!group_id || group_id === 'undefined') throw createHttpError(400, 'Group ID not defined')
  if(!user_id && !user_ids) throw createHttpError(400, 'User ID(s) not defined')

  const current_user_id = get_current_user_id(res)

  const session = driver.session()

  const single_user_add_query = `
    WITH group
    ${user_query}
    MERGE (user)<-[:ADMINISTRATED_BY]-(group)
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
    FOREACH(user IN users | MERGE (user)<-[:ADMINISTRATED_BY]-(group))
    `

  const query = `
    // Find current user
    ${current_user_query}

    // Find group
    WITH current_user
    ${group_query}
    // Allow only group admin or super admin to delete a group
    AND ( (group)-[:ADMINISTRATED_BY]->(current_user) OR current_user.isAdmin )

    // Create relationship for single user
    ${user_id ? single_user_add_query : ''}

    // OR multiple users at once
    ${user_ids ? multiple_user_add_query : ''}

    // Return
    RETURN properties(group) as group
    `

  const params = { current_user_id, user_id, user_ids, group_id}

  session.run(query, params)
  .then(({records}) => {
    if(!records.length) throw createHttpError(400, `Error adding user to administrators`)
    console.log(`User ${user_id} added administrators to group ${group_id}`)
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
    official,
    nonofficial,
  } = req.query

  const shallow_query = 'AND NOT (group)-[:BELONGS_TO]->(:Group)<-[:ADMINISTRATED_BY]-(user)'
  const official_query = 'AND group.official'
  const non_official_query = 'AND (NOT EXISTS(group.official) OR NOT group.official)'
  const query = `
    ${user_query}
    WITH user
    OPTIONAL MATCH (user)<-[:ADMINISTRATED_BY]-(group:Group)

    // using dummy WHERE here so as to use AND in other queryies
    WHERE EXISTS(group._id)
    ${shallow ? shallow_query : ''}
    ${official ? official_query : ''}
    ${nonofficial ? non_official_query : ''}

    WITH group as item
    ${batch_items(batch_size)}
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
