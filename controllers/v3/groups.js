const {drivers: {v2: driver}} = require('../../db.js')
const createHttpError = require('http-errors')
const {
  get_current_user_id,
  user_query,
  group_query,
  return_batch,
  format_batched_response
} = require('../../utils.js')

const {
  default_batch_size
} = require('../../config.js')


exports.create_group = (req, res, next) => {
  // Create a group
  // TODO: validation with joi

  const user_id = get_current_user_id(res)
  const {name} = req.body
  if(!name) throw createHttpError(400, `Missing group name`) 

  const session = driver.session()

  const query = `
    // Create the group
    CREATE (group:Group)
    SET group.name = $name
    SET group._id = randomUUID() // IMPORTANT

    // Create relationships
    WITH group
    ${user_query}
    CREATE (group)-[:ADMINISTRATED_BY]->(user)
    CREATE (group)-[creation:CREATED_BY]->(user)
    CREATE (group)<-[:BELONGS_TO]-(user)

    // Setting creation relationship properties
    SET creation.date = date()

    RETURN properties(group) as group
    `

  session.run(query, { user_id, name })
  .then(({records}) => {

    if(!records.length) throw createHttpError(500, `Error while creating group ${name}`)
    const group = records[0].get('group')
    res.send(group)
    console.log(`User ${get_current_user_id(res)} created group ${group._id}`)
  })
  .catch(next)
  .finally( () => { session.close() })
}

exports.get_groups = (req, res, next) => {

  // Queries: official vs non official, top level vs normal, type

  // WARNING: Querying top level official groups means groups whith no parent THAT ARE OFFICIAL

  // Is batching really all that important?
  // Probably yes

  // Shallow: only groups that are not part of another group

  const {
    batch_size = default_batch_size,
    start_index = 0,
    shallow = false,
    official = false,
    nonofficial = false
  } = req.query

  const shallow_query = 'AND NOT (group)-[:BELONGS_TO]->(:Group)'
  const official_query = 'AND group.official'
  const non_official_query = 'AND (NOT EXISTS(group.official) OR NOT group.official)'

  const query = `
    // OPTIONAL MATCH so as to allow for batching even when no match
    // WHERE used as dummy condition for chaining the next filters
    OPTIONAL MATCH (group:Group)
    WHERE EXISTS(group._id)
    ${shallow ? shallow_query : ''}
    ${official ? official_query : ''}
    ${nonofficial ? non_official_query : ''}
    WITH group as item
    ${return_batch}
    `


  const params = { batch_size, start_index }

  const session = driver.session()
  session.run(query,params)
    .then( ({records}) => {

      const response = format_batched_response(records)

      console.log(`Groups queried`)
      res.send(response)
    })
    .catch(next)
    .finally( () => { session.close() })
}



exports.get_group = (req, res, next) => {

  const {group_id} = req.params
  if(!group_id) throw createHttpError(400, 'Group ID not defined')

  const query = `${group_query} RETURN properties(group) as group`
  const params = { group_id }

  const session = driver.session()
  session.run(query, params)
    .then(({records}) => {
      if(!records.length) throw createHttpError(404, `Group ${group_id} not found`)
      res.send(records[0].get('group'))
      console.log(`Group ${group_id} queried`)
    })
    .catch(next)
    .finally( () => { session.close() })
}


exports.patch_group = (req, res, next) => {

  const {group_id} = req.params

  if(!group_id) throw createHttpError(400, 'Group ID not defined')
  const user_id = get_current_user_id(res)

  const properties = req.body

  let customizable_fields = [
    'avatar_src',
    'name',
    'restricted',
  ]

  const current_user = res.locals.user
  const current_user_is_admin = current_user.isAdmin
    || current_user.properties.isAdmin

  // Allow master admin to make groups officials
  if(current_user_is_admin){
    customizable_fields.push('official')
  }

  // prevent user from modifying disallowed properties
  for (let [key, value] of Object.entries(properties)) {
    if(!customizable_fields.includes(key)) {
      delete req.body[key]
      // TODO: forbid changes
      throw createHttpError(403, `Not allowed to modify property ${key}`)
    }
  }

  const session = driver.session()

  const query = `
    ${user_query}

    WITH user
    ${group_query}
    // Only allow group admin or super admin
    AND ( (group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    // Patch properties
    // += implies update of existing properties
    SET group += $properties

    RETURN properties(group) as group
    `

  const params = {
    user_id,
    group_id,
    properties,
  }

  session.run(query,params)
  .then( ({records}) => {
    if(!records.length) throw createHttpError(400, `Error patching group ${group_id}`)
    console.log(`User ${user_id} patched group ${group_id}`)
    const group = records[0].get('group')
    res.send(group)
  })
  .catch(next)
  .finally(() => session.close())

}

exports.delete_group = (req, res, next) => {

  const {group_id} = req.params
  if(!group_id) throw createHttpError(400, 'Group ID not defined')

  const user_id = get_current_user_id(res)

  const query = `
    // Find the current user
    ${user_query}

    // Find group
    WITH user
    ${group_query}

    // Only allow group admin or super admin
    AND ( (group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    // Delete the group
    DETACH DELETE group

    RETURN $group_id as group_id
    `

  const session = driver.session()
  session.run(query, { user_id, group_id })
  .then( ({records}) => {
    if(!records.length) throw createHttpError(404, `Group ${group_id} not found`)
    console.log(`User ${user_id} deleted group ${group_id}`)
    res.send({group_id})
  })
  .catch(next)
  .finally( () => { session.close() })
}

exports.join_group = (req, res, next) => {
  // TODO: Could be combined with make user member of group
  // Route to join a group (only works if group is not private)

  const {group_id} = req.params
  if(!group_id) throw createHttpError(400, 'Group ID not defined')

  const user_id = get_current_user_id(res)


  const session = driver.session()

  const query = `
    ${user_query}
    WITH user
    ${group_query}

    // TODO: allow admin to join
    AND (NOT EXISTS(group.restricted) OR NOT group.restricted)

    MERGE (user)-[:BELONGS_TO]->(group)

    RETURN $group_id as group_id
    `

  const params = { user_id, group_id }

  session.run(query, params)
  .then( ({records}) => {

    if(!records.length) throw createHttpError(400, `Error during user ${user_id} joining of group ${group_id}`)
    console.log(`User ${user_id} joined group ${group_id}`)

    res.send({group_id})
  })
  .catch(next)
  .finally( () => { session.close() })
}


exports.leave_group = (req, res, next) => {
  // Route to leave a group

  const {group_id} = req.params
  if(!group_id) throw createHttpError(400, 'Group ID not defined')

  const user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    ${user_query}
    WITH user
    ${group_query}
    WITH user, group

    MATCH (user)-[r:BELONGS_TO]->(group)

    DELETE r

    RETURN $group_id as group_id
    `

  const params = {user_id, group_id}
  session.run(query,params)
  .then( ({records}) => {

    if(!records.length) throw createHttpError(400, `Error while leacing group ${group_id}`)
    console.log(`User ${user_id} left group ${group_id}`)

    res.send({group_id})
  })
  .catch(next)
  .finally( () => { session.close() })
}

// From here, parent groups and subgroups
exports.get_parent_groups_of_group = (req, res, next) => {

  const {group_id} = req.params
  if(!group_id) throw createHttpError(400, 'Group ID not defined')

  const {
    direct,
    batch_size = default_batch_size,
    start_index = 0,
  } = req.query


  const session = driver.session()

  const direct_only_query = `WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent)`

  const query = `
    ${group_query}
    WITH group
    OPTIONAL MATCH (group)-[:BELONGS_TO]->(parent:Group)
    ${direct ? direct_only_query : ''}

    WITH parent as item
    ${return_batch}
    `

  const params = { group_id, batch_size, start_index }


  session.run(query, params)
  .then( ({records}) => {

    if(!records.length) throw createHttpError(400, `Subgroup group ${group_id} not found`)
    console.log(`Parent groups of group ${group_id} queried`)

    const response = format_batched_response(records)

    res.send(response)
  })
  .catch(next)
  .finally( () => { session.close() })
}



exports.get_groups_of_group = (req, res, next) => {
  // Route to retrieve groups inside a group

  const {group_id} = req.params

  const {
    direct,
    batch_size = default_batch_size,
    start_index = 0,
  } = req.query


  const direct_only_query = `WHERE NOT (subgroup)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(group)`

  const session = driver.session()

  const query = `
    ${group_query}
    WITH group
    OPTIONAL MATCH (subgroup:Group)-[:BELONGS_TO]->(group:Group)
    ${direct ? direct_only_query : ''}

    WITH subgroup as item
    ${return_batch}
    `

  const params = { group_id, batch_size, start_index }

  session.run(query,params)
  .then( ({records}) => {
    if(!records.length) throw createHttpError(400, `Parent group ${group_id} not found`)

    console.log(`Subgroups of group ${group_id} queried`)
    const response = format_batched_response(records)

    res.send(response)
  })
  .catch(next)
  .finally( () => { session.close() })
}



exports.add_group_to_group = (req, res, next) => {
  // Route to make a group join a group
  // Can only be done if user is admin of both groups

  const {group_id: parent_group_id} = req.params
  const {group_id: child_group_id} = req.body

  if(!child_group_id) return res.status(400).send('Child Group ID not defined')


  const user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    ${user_query}

    // Find child group
    WITH user
    MATCH (child_group:Group)

    // Allow only group admin or super admin to delete a group
    WHERE child_group._id = $child_group_id
      AND ( (child_group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    // Find the parent group
    WITH child_group, user
    MATCH (parent_group:Group)
    WHERE parent_group._id = $parent_group_id
      AND ( (parent_group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

      // Prevent cyclic graphs (NOT WORKING)
      AND NOT (parent_group)-[:BELONGS_TO]->(child_group)
      AND NOT (parent_group)-[:BELONGS_TO *1..]->(:Group)-[:BELONGS_TO]->(child_group)

      // Prevent self group
      AND NOT id(parent_group)=id(child_group)

    // MERGE relationship
    MERGE (child_group)-[:BELONGS_TO]->(parent_group)

    // Return
    RETURN properties(child_group) as child_group
    `

  const params = { user_id, parent_group_id, child_group_id }

  session.run(query, params)
  .then( ({records}) => {
    if(!records.length) throw createHttpError(400, `Failed to add group ${child_group_id} in ${parent_group_id}`)
    console.log(`User ${user_id} added group ${child_group_id} to group ${parent_group_id}`)
    const child_group = records[0].get('child_group')
    res.send(child_group)
  })
  .catch(next)
  .finally( () => { session.close() })
}

exports.remove_group_from_group = (req, res, next) => {
  // Route to make a user join a group

  // TODO: Should the user be admin of child group?

  const {group_id: parent_group_id} = req.params
  const {subgroup_id: child_group_id} = req.params
  const user_id = get_current_user_id(res)

  const session = driver.session()


  const query = `
    ${user_query}

    // Find the child group group
    WITH user
    MATCH (child_group:Group)

    // Allow only group admin or super admin to remove a group
    WHERE child_group._id = $child_group_id
      AND ( (child_group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    // Find the parent group
    WITH child_group, user
    MATCH (child_group)-[r:BELONGS_TO]->(parent_group:Group)
    WHERE parent_group._id = $parent_group_id
      AND ( (parent_group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    // delete relationship
    DELETE r

    // Return
    RETURN properties(child_group) as child_group
  `

  const params = {
    user_id,
    parent_group_id,
    child_group_id,
  }

  session.run(query,params)
  .then( ({records}) => {
    if(!records.length) throw createHttpError(400, `Failed to remove group ${child_group_id} from group ${parent_group_id}`) 
    console.log(`User ${user_id} removed group ${child_group_id} from group ${parent_group_id}`)
    const subgroup = records[0].get('child_group')
    res.send(subgroup)
  })
  .catch(next)
  .finally( () => { session.close() })
}
