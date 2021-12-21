const {drivers: {v2: driver}} = require('../../db.js')
const {
  get_current_user_id,
  error_handling,
  user_query,
  group_query,
  group_id_filter,
  current_user_query,
} = require('../../utils.js')



exports.create_group = (req, res) => {
  // Create a group
  // TODO: validation with joi

  const user_id = get_current_user_id(res)
  const {name} = req.body
  if(!name) return res.status(400).send(`Missing 'name'`)

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

    RETURN group
    `

  session.run(query, { user_id, name })
  .then(({records}) => {

    if(!records.length) throw {code: 500, message: `Error while creating group ${name}`}
    const group = records[0].get('group')
    console.log(`User ${get_current_user_id(res)} created group ${group._id}`)

    res.send(group)
  })
  .catch(error => {
    error_handling(error,res)
  })
  .finally( () => { session.close() })
}

exports.get_groups = async (req, res) => {

  // Queries: official vs non official, top level vs normal, type

  // NOTE: Querying top level official groups means groups whith no parent THAT ARE OFFICIAL

  const {
    batch_size = 100,
    start_index = 0,
  } = req.query

  const top_level_query = req.query.top == null ? '' : 'WITH group WHERE NOT (group)-[:BELONGS_TO]->(:Group)'
  const official_query = req.query.official == null ? '' : 'WITH group WHERE group.official'
  const non_official_query = req.query.nonofficial == null ? '' : 'WITH group WHERE (NOT EXISTS(group.official) OR NOT group.official)'


  const batching = batch_size ? `WITH group_count, groups[toInteger($start_index)..toInteger($start_index)+toInteger($batch_size)] AS groups` : ''

  const query = `
    MATCH (group:Group)
    ${top_level_query}
    ${official_query}
    ${non_official_query}

    WITH COLLECT(group) as groups, COUNT(group) as group_count
    ${batching}

    RETURN groups, group_count
    `

  const params = { batch_size, start_index }

  const session = driver.session()
  session.run(query,params)
  .then( ({records}) => {

    const record = records[0]

    const response = {
      batch_size,
      start_index,
      group_count: record.get('group_count'),
      groups: record.get('groups'),
    }


    res.send(response)
    console.log(`Groups queried`)
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}



exports.get_group = (req, res) => {

  const {group_id} = req.params


  const query = `
    ${group_query}
    RETURN group
    `

  const params = { group_id }

  const session = driver.session()
  session.run(query, params)
  .then(({records}) => {
    if(!records.length) throw {code: 404, message: `Group ${group_id} not found`}
    res.send(records[0].get('group'))
    console.log(`Group ${group_id} queried`)
  })
  .catch(error => { error_handling(error, res) })
  .finally( () => { session.close() })
}


exports.patch_group = (req, res) => {

  const {group_id} = req.params

  if(!group_id) return res.status(400).send('Group ID not defined')
  const user_id = get_current_user_id(res)

  const properties = req.body

  let customizable_fields = [
    'avatar_src',
    'name',
    'restricted',
  ]

  // Allow master admin to make groups officials
  if(res.locals.user.properties.isAdmin){
    customizable_fields.push('official')
  }

  // prevent user from modifying disallowed properties
  for (let [key, value] of Object.entries(properties)) {
    if(!customizable_fields.includes(key)) {
      delete req.body[key]
      // TODO: forbid changes
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

    RETURN group
    `

  const params = {
    user_id,
    group_id,
    properties,
  }

  session.run(query,params)
  .then( ({records}) => {
    if(!records[0]) throw {code: 404, message: `Error patching group ${group_id}`}
    console.log(`User ${user_id} patched group ${group_id}`)
    const group = records[0].get('group')
    res.send(group)
  })
  .catch(error => { error_handling(error, res) })
  .finally(() => session.close())

}

exports.delete_group = (req, res) => {
  // Route to delete a group

  const {group_id} = req.params

  if(!group_id) return res.status(400).send('Group ID not defined')

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

  const session = driver.session();
  session.run(query, { user_id, group_id })
  .then( ({records}) => {
    if(!records.length) throw {code: 404, message: `Group ${group_id} not found`}
    res.send({group_id})
    console.log(`User ${user_id} deleted group ${group_id}`)
  })
  .catch(error => { error_handling(error, res) })
  .finally( () => { session.close() })
}

exports.join_group = (req, res) => {
  // TODO: Could be combined with make user member of group
  // Route to join a group (only works if group is not private)

  const {group_id} = req.params
  if(!group_id) return res.status(400).send('Group ID not defined')

  const user_id = get_current_user_id(res)


  const session = driver.session()

  const query = `
    ${user_query}
    WITH user
    ${group_query}

    // TODO: allow admin to join
    AND (NOT EXISTS(group.restricted) OR NOT group.restricted)

    MERGE (user)-[:BELONGS_TO]->(group)

    RETURN user
    `

  const params = { user_id, group_id }

  session.run(query, params)
  .then( ({records}) => {

    if(!records.length) throw {code: 400, message: `Error during user ${user_id} joining of group ${group_id}`}
    console.log(`User ${user_id} joined group ${group_id}`)

    res.send({group_id})
  })
  .catch(error => { error_handling(error, res) })
  .finally( () => { session.close() })
}


exports.leave_group = (req, res) => {
  // Route to leave a group

  const {group_id} = req.params
  if(!group_id) return res.status(400).send('Group ID not defined')

  const user_id = get_current_user_id(res)

  const session = driver.session()

  const query = `
    ${user_query}
    WITH user
    ${group_query}
    WITH user, group

    MATCH (user)-[r:BELONGS_TO]->(group)

    DELETE r

    RETURN user
    `

  const params = {user_id, group_id}
  session.run(query,params)
  .then( ({records}) => {

    if(!records.length) throw {code: 400, message: `Error during user ${user_id} leaving of group ${group_id}`}
    console.log(`User ${user_id} left group ${group_id}`)

    res.send({group_id})
  })
  .catch(error => { error_handling(error, res) })
  .finally( () => { session.close() })
}



exports.get_parent_groups_of_group = (req, res) => {
  // Route to retrieve groups inside a group

  const {group_id} = req.params

  if(!group_id) return res.status(400).send('Group ID not defined')

  const direct_only_query = `
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent)
    `
  const session = driver.session()

  const query = `
    ${group_query}
    WITH group
    OPTIONAL MATCH (group)-[:BELONGS_TO]->(parent:Group)
    ${req.query.direct ? direct_only_query : ''}
    RETURN collect(parent) as parents
    `

  session.run(query,{ group_id })
  .then( ({records}) => {

    if(!records.length) throw {code: 404, message: `Subgroup group ${group_id} not found`}
    const groups = records[0].get('parents')
    res.send(groups)
    console.log(`Parent groups of group ${group_id} queried`)

  })
  .catch(error => { error_handling(error, res) })
  .finally( () => { session.close() })
}



exports.get_groups_of_group = (req, res) => {
  // Route to retrieve groups inside a group

  const {group_id} = req.params


  const direct_only_query = `
    WHERE NOT (subgroup)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(group)
    `

  const session = driver.session()

  const query = `
    ${group_query}
    WITH group
    OPTIONAL MATCH (subgroup:Group)-[:BELONGS_TO]->(group:Group)
    ${req.query.direct === 'true' ? direct_only_query : ''}
    RETURN collect(subgroup) as subgroups
    `

  const params = { group_id }

  session.run(query,params)
  .then( ({records}) => {
    if(!records.length) throw {code: 404, message: `Parent group ${group_id} not found`}
    const groups = records[0].get('subgroups')
    res.send(groups)
    console.log(`Subgroups of group ${group_id} queried`)
  })
  .catch(error => { error_handling(error, res) })
  .finally( () => { session.close() })
}



exports.add_group_to_group = (req, res) => {
  // Route to make a group join a group
  // Can only be done if user is admin of both groups

  const {group_id: parent_group_id} = req.params
  const {group_id: child_group_id} = req.body

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
    RETURN child_group
    `

  const params = {
    user_id,
    parent_group_id,
    child_group_id,
  }

  session.run(query, params)
  .then( ({records}) => {
    if(!records.length) throw { code: 400, message: `Failed to add group ${child_group_id} in ${parent_group_id}`}
    console.log(`User ${user_id} added group ${child_group_id} to group ${parent_group_id}`)
    const child_group = records[0].get('child_group')
    res.send(child_group)
  })
  .catch(error => { error_handling(error, res) })
  .finally( () => { session.close() })
}

exports.remove_group_from_group = (req, res) => {
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
    RETURN child_group, parent_group
  `

  const params = {
    user_id,
    parent_group_id,
    child_group_id,
  }

  session.run(query,params)
  .then( ({records}) => {
    if(!records.length) throw { code: 400, message: `Failed to remove group ${child_group_id} from group ${parent_group_id}`}
    console.log(`User ${user_id} removed group ${child_group_id} from group ${parent_group_id}`)
    const subgroup = records[0].get('child_group')
    res.send(subgroup)
  })
  .catch(error => {   error_handling(error, res) })
  .finally( () => { session.close() })
}


exports.get_groups_directly_belonging_to_group = (req, res) => {

  // THIS IS LEGACY

  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  // Note: Use get_groups_of_group with query filter

  const {group_id} = req.params

  if(!group_id) return res.status(400).send('Group ID not defined')

  const session = driver.session()

  const query = `
    ${group_query}
    WITH group as parent
    // Match children that only have a direct connection to parent
    OPTIONAL MATCH (parent)<-[:BELONGS_TO]-(group:Group)
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent)

    RETURN collect(group) as groups, parent
    `

  const params = { group_id }

  session.run(query,params)
   .then( ({records}) => {
     if(!records.length) throw {code: 404, message: `Parent group ${group_id} not found`}
     const groups = records[0].get('groups')
     res.send(groups)
     console.log(`Direct subgroups of group ${group_id} queried (LEGACY)`)
    })
  .catch(error => { error_handling(error, res) })
  .finally( () => { session.close() })
}



exports.get_top_level_groups = (req, res) => {

  // This is legacy

  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  // TODO; Should Top level should be a parameter of GET groups

  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)

    // That do not belong to any group
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)

    // NOT SURE WHY DISTINCT NEEDED
    RETURN DISTINCT(group)
    `, {})
  .then( ({records}) => {
    const groups = records.map(record => record.get('group'))
    res.send(groups)
    console.log(`Top level groups queried (LEGACY)`)
   })
  .catch(error => { error_handling(errr, res) })
  .finally( () => { session.close() })
}

exports.get_top_level_official_groups = (req, res) => {

  // This is legacy

  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)

    // That do not belong to any official group
    WHERE NOT (group)-[:BELONGS_TO *1..]->(:Group {official: true})
      AND group.official

    // USED TO BE DISTINCT
    RETURN group
    `, {})
  .then( ({records}) => {
    const groups = records.map(record => record.get('group'))
    res.send(groups)
    console.log(`Top level official groups queried (LEGACY)`)
   })
  .catch(error => { error_handling(errr, res) })
  .finally( () => { session.close() })
}

exports.get_top_level_non_official_groups = (req, res) => {

  // This is legacy

  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)

    // That do not belong to any group
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)
      AND ( NOT EXISTS(group.official) OR NOT group.official )

    // USED TO BE DISTINCT
    RETURN group
    `, {})
  .then( ({records}) => {
    const groups = records.map(record => record.get('group'))
    res.send(groups)
    console.log(`Top level nonofficial groups queried (LEGACY)`)
   })
  .catch(error => { error_handling(errr, res) })
  .finally( () => { session.close() })
}
