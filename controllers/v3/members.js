const createHttpError = require('http-errors')
const {drivers: {v2: driver}} = require('../../db.js')
const { default_batch_size } = require('../../config.js')
const {
  get_current_user_id,
  user_query,
  group_query,
  user_id_filter,
  current_user_query,
  batch_items,
  format_batched_response
} = require('../../utils.js')


exports.get_user = (req, res, next) => {
  // Route to retrieve a user's info
  // This should not be a feature of group manager
  // but Used in front-end

  let {member_id: user_id} = req.params
  if(user_id === 'self') user_id = get_current_user_id(res)
  if(!user_id) throw createHttpError(400, 'User ID not defined')

  const session = driver.session()

  const query = `${user_query} RETURN properties(user) as user`

  session.run(query, { user_id })
  .then( ({records}) => {

    if(!records.length) throw createHttpError(404, `User ${user_id} not found`)

    const user = records[0].get('user')
    delete user.password_hashed

    res.send(user)
    console.log(`User ${user_id} queried`)
   })
   .catch(next)
  .finally( () => { session.close() })
}

exports.get_members_of_group = (req, res, next) => {
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

    // Optional match so groups with no users can still be queried
    OPTIONAL MATCH (user:User)-[:BELONGS_TO]->(group)

    WITH user as item
    ${batch_items(batch_size)}
    `

  const params = { group_id, batch_size, start_index }

  session.run(query, params)
  .then(({records}) => {
    if(!records.length) throw createHttpError(404, `Member query: group ${group_id} not found`)
    console.log(`Users of group ${group_id} queried`)
    const response = format_batched_response(records)
    res.send(response)
   })
   .catch(next)
  .finally( () => { session.close() })
}



exports.add_member_to_group = (req, res, next) => {
  // Add a user to a group

  const {group_id} = req.params
  const {user_id, user_ids} = req.body

  if(!group_id || group_id === 'undefined') throw createHttpError(400, 'Group ID not defined')
  if(!user_id && !user_ids) throw createHttpError(400, 'User ID(s) not defined')

  const current_user_id = get_current_user_id(res)

  const session = driver.session()

  const single_user_add_query = `
    WITH group
    ${user_query}
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
    // Find the current user
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

  const params = { current_user_id, user_id, user_ids, group_id }

  session.run(query, params)
  .then( ({records}) => {
    if(!records.length) throw createHttpError(400, `Error adding adding user(s) ${user_id || user_ids.join(', ')} to group ${group_id}`)

    console.log(`User ${current_user_id} added user(s) ${user_id || user_ids.join(', ')} to group ${group_id}`)

    const group = records[0].get('group')
    res.send(group)
  })
  .catch(next)
  .finally( () => { session.close() })
}


exports.remove_user_from_group = (req, res, next) => {
  // Route to make a user leave a group

  const {group_id, member_id: user_id} = req.params

  if(!group_id || group_id === 'undefined') throw createHttpError(400, 'Group ID not defined')
  if(!user_id) throw createHttpError(400, 'User ID not defined')

  const current_user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    // Find the current user
    ${current_user_query}

    // Find group
    WITH current_user
    ${group_query}
    AND ( (group)-[:ADMINISTRATED_BY]->(current_user) OR current_user.isAdmin )

    // Find the user
    WITH group
    MATCH (user:User)-[r:BELONGS_TO]->(group)
    ${user_id_filter}

    // delete relationship
    DELETE r

    // Return
    RETURN properties(group) as group
    `

  const params = { current_user_id, user_id, group_id }
  session

  .run(query,params)
  .then( ({records}) => {

    if(!records.length) throw createHttpError(400, `Error removing using ${user_id} from group ${group_id}`)
    console.log(`User ${current_user_id} removed user ${user_id} from group ${group_id}`)

    const group = records[0].get('group')
    res.send(group)
  })
  .catch(next)
  .finally( () => { session.close() })
}


exports.get_groups_of_user = (req, res, next) => {
  // Route to retrieve a user's groups

  let {member_id: user_id} = req.params
  if(user_id === 'self') user_id = get_current_user_id(res)
  if(!user_id) throw createHttpError(400, 'User ID not defined')

  const {
    batch_size = default_batch_size,
    start_index = 0,
    shallow,
    official,
    nonofficial,
  } = req.query


  const session = driver.session()

  const shallow_query = 'AND NOT (group)-[:BELONGS_TO]->(:Group)<-[:BELONGS_TO]-(user)'
  const official_query = 'AND group.official'
  const non_official_query = 'AND (NOT EXISTS(group.official) OR NOT group.official)'

  const query = `
    ${user_query}
    WITH user
    // OPTIONAL because still want to perform query even if no groups
    OPTIONAL MATCH (user)-[:BELONGS_TO]->(group:Group)

    // using dummy WHERE here so as to use AND in other queryies
    WHERE EXISTS(group._id)
    ${shallow ? shallow_query : ''}
    ${official ? official_query : ''}
    ${nonofficial ? non_official_query : ''}

    WITH group as item
    ${batch_items(batch_size)}
    `

  const params = { user_id, batch_size, start_index }


  session.run(query, params)
  .then(({records}) => {
    if(!records.length) throw createHttpError(404, `User ${user_id} not found`)
    console.log(`Groups of user ${user_id} queried`)
    const response = format_batched_response(records)
    res.send(response)
   })
   .catch(next)
  .finally( () => { session.close() })
}

exports.users_with_no_group = (req, res, next) => {
  // Route to retrieve users without a group

  const session = driver.session()

  const {
    batch_size = default_batch_size,
    start_index = 0,
  } = req.query

  const query = `
    OPTIONAL MATCH (user:User)
    WHERE NOT (user)-[:BELONGS_TO]->(:Group)
    WITH user as item
    ${batch_items(batch_size)}
    `

  const params = { batch_size, start_index }

  session.run(query, params)
  .then(({records}) => {

    if(!records.length) throw createHttpError(404, `No users with no groups`)
    console.log(`Queried users with no group`)

    const response = format_batched_response(records)
    res.send(response)
  })
  .catch(next)
  .finally( () => { session.close() })
}
