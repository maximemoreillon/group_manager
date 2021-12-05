const {drivers: {v2: driver}} = require('../../db.js')
const {
  get_current_user_id,
  error_handling,
} = require('../../utils.js')


exports.get_group = (req, res) => {

  const group_id = req.params.group_id
    || req.query.id
    || req.query.group_id

  const query = `
    MATCH (group)
    WHERE id(group)=toInteger($group_id)
    RETURN group
    `

  const session = driver.session()
  session.run(query, { group_id })
  .then(({records}) => {
    if(!records.length) throw {code: 404, message: `Group ${group_id} not found`}
    res.send(records[0].get('group'))
    console.log(`User ${get_current_user_id(res)} requested group ${group_id}`)
  })
  .catch(error => { error_handling(error, res) })
  .finally( () => { session.close() })
}

exports.create_group = (req, res) => {
  // Create a group
  // TODO: validation with joy

  const user_id = get_current_user_id(res)
  const {name} = req.body
  if(!name) return res.status(400).send(`Missing 'name'`)

  const session = driver.session()

  const query = `
    // Create the group
    CREATE (group:Group)
    SET group.name = $name

    // Create creation relationship
    WITH group
    MATCH (creator:User)
    WHERE id(creator)=toInteger($user_id)
    CREATE (group)-[:ADMINISTRATED_BY]->(creator)
    CREATE (group)-[creation:CREATED_BY]->(creator)
    CREATE (group)<-[:BELONGS_TO]-(creator)

    // Setting creation date
    SET creation.date = date()

    // Could have a CREATED_BY relationship

    RETURN group
    `

  session.run(query, { user_id,name })
  .then(({records}) => {
    if(!records.length) return res.status(500).send('Error creating group')
    const group = records[0].get('group')
    res.send(group)
    console.log(`User ${get_current_user_id(res)} created group ${group.identity}`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })
  .finally( () => { session.close() })
}


exports.delete_group = (req, res) => {
  // Route to delete a group

  const group_id = req.params.group_id
    ?? req.query.id
    ?? req.query.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')

  const user_id = get_current_user_id(res)

  const query = `
    // Find the current user
    MATCH (current_user:User)
    WHERE id(current_user) = toInteger($user_id)

    // Find group
    WITH current_user
    MATCH (group:Group)

    // Allow only group admin or super admin to delete a group
    WHERE id(group)=toInteger($group_id)
      AND ( (group)-[:ADMINISTRATED_BY]->(current_user)
        OR current_user.isAdmin )

    // Delete the group
    DETACH DELETE group

    RETURN "success"
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

  const group_id = req.params.group_id
    || req.body.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')


  const session = driver.session();
  session
  .run(`
    // Find the user
    MATCH (user:User)
    WHERE id(user)=toInteger($current_user_id)

    // Find the group
    WITH user
    MATCH (group:Group)
    WHERE id(group)=toInteger($group_id)
      AND (NOT EXISTS(group.restricted) OR NOT group.restricted)

    // MERGE relationship
    MERGE (user)-[:BELONGS_TO]->(group)

    // Return
    RETURN user
    `,
    {
      current_user_id: get_current_user_id(res),
      group_id,
    })
  .then(result => {

    if(result.records.length < 1) return res.status(400).send(`Error joining group`)
    console.log(`User ${get_current_user_id(res)} joined group ${group_id}`)

    res.send({group_id})
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}


exports.leave_group = (req, res) => {
  // Route to leave a group

  const group_id = req.params.group_id
    || req.body.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')

  const session = driver.session();
  session
  .run(`
    // Find the user and the group
    MATCH (user:User)-[r:BELONGS_TO]->(group:Group)
    WHERE id(user)=toInteger($current_user_id)
      AND id(group)=toInteger($group_id)

    // delete relationship
    DELETE r

    // Return
    RETURN user
    `,
    {
      current_user_id: get_current_user_id(res),
      group_id,
    })
  .then(result => {
    if(result.records.length < 1) return res.status(400).send(`Error leaving group`)
    console.log(`User ${get_current_user_id(res)} left group ${group_id}`)

    res.send({group_id})
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}


exports.get_top_level_groups = (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  // TODO; Should Top level should be a parameter of GET groups

  const session = driver.session();
  session
  .run(`
    // Find groups
    MATCH (group:Group)

    // That do not belong to any group
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)

    // NOT SURE WHY DISTINCT NEEDED
    RETURN DISTINCT(group)
    `, {})
  .then( ({records}) => {
    const groups = records.map(record => record.get('group'))
    res.send(groups)
   })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.get_top_level_official_groups = (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  const session = driver.session();
  session
  .run(`
    // Find groups
    MATCH (group:Group)

    // That do not belong to any group
    // Not sure what *1.. is for anymore
    WHERE NOT (group)-[:BELONGS_TO *1..]->(:Group {official: true})
      AND group.official

    // NOT SURE WHY DISTINCT NEEDED
    RETURN DISTINCT(group)
    `, {})
  .then( ({records}) => {
    const groups = records.map(record => record.get('group'))
    res.send(groups)
   })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.get_top_level_non_official_groups = (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  const session = driver.session();
  session
  .run(`
    // Find groups
    MATCH (group:Group) // Final

    // That do not belong to any group
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)
      AND (NOT EXISTS(group.official) OR NOT group.official)

    // NOT SURE WHY DISTINCT NEEDED
    RETURN DISTINCT(group)
    `, {})
  .then( ({records}) => {
    const groups = records.map(record => record.get('group'))
    res.send(groups)
   })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}



exports.get_parent_groups_of_group = (req, res) => {
  // Route to retrieve groups inside a group

  const subgroup_id = req.params.group_id
    ?? req.query.id
    ?? req.query.group_id

  if(!subgroup_id) return res.status(400).send('Group ID not defined')

  const direct_only_query = `
    AND NOT (child)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(group)
    `


  const session = driver.session()
  session
  .run(`
    MATCH (child:Group)-[:BELONGS_TO]->(group:Group)
    WHERE id(child)=toInteger($subgroup_id)
    ${req.query.direct === 'true' ? direct_only_query : ''}

    RETURN group
    `,
    { subgroup_id, })
  .then( ({records}) => {
    const groups = records.map(record => record.get('group'))
    res.send(groups)
    console.log(`Parent groups of group ${subgroup_id} queried`)
   })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.patch_group = (req, res) => {

  const group_id = req.body.id
    ?? req.body.group_id
    ?? req.params.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')


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
  for (let [key, value] of Object.entries(req.body)) {
    if(!customizable_fields.includes(key)) {
      delete req.body[key]
      // TODO: forbid changes
    }
  }

  const session = driver.session()
  session
  .run(`
    // Find the current user
    MATCH (current_user:User)
    WHERE id(current_user) = toInteger($current_user_id)

    // Find group
    WITH current_user
    MATCH (group:Group)

    // Allow only group admin or super admin to delete a group
    WHERE id(group)=toInteger($group_id)
      AND (
        (group)-[:ADMINISTRATED_BY]->(current_user)
        OR current_user.isAdmin
      )

    // Patch properties
    // += implies update of existing properties
    SET group += $properties

    RETURN group
    `, {
    current_user_id: get_current_user_id(res),
    group_id,
    properties: req.body,
  })
  .then(result => {
    if(result.records.length < 1) return res.status(400).send(`Error updating group`)
    console.log(`User ${get_current_user_id(res)} patched group ${group_id}`)
    res.send(result.records[0].get('group'))
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally(() => session.close())

}


exports.get_groups_of_group = (req, res) => {
  // Route to retrieve groups inside a group

  const group_id = req.query.id
    ?? req.query.group_id
    ?? req.params.group_id
    ?? req.params.id


  const direct_only_query = `
    AND NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent)
    `

  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)-[:BELONGS_TO]->(parent:Group)
    WHERE id(parent)=toInteger($group_id)

    ${req.query.direct === 'true' ? direct_only_query : ''}

    RETURN DISTINCT(group)
    `,
    { group_id })
   .then( ({records}) => {
     const groups = records.map(record => record.get('group'))
     res.send(groups)
     console.log(`Subgroups of group ${group_id} queried`)
    })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.get_groups_directly_belonging_to_group = (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)

  // Note: Use GET_CHILD_GROUPS with qyerfy filter

  const group_id = req.query.id
    ?? req.query.group_id
    ?? req.params.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')

  const session = driver.session();
  session
  .run(`
    // Match the parent node
    MATCH (parent_group:Group)
    WHERE id(parent_group)=toInteger($group_id)

    // Match children that only have a direct connection to parent
    WITH parent_group
    MATCH (parent_group)<-[:BELONGS_TO]-(group:Group)
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent_group)

    // DISTINCT JUST IN CASE
    RETURN DISTINCT(group)
    `,
    { group_id })
   .then( ({records}) => {
     console.log(`Direct subgroups of group ${group_id} queried`)
     const groups = records.map(record => record.get('group'))
     res.send(groups)
    })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.add_group_to_group = (req, res) => {
  // Route to make a group join a group
  // Can only be done if user is admin of both groups

  const parent_group_id = req.body.parent_group_id
    ?? req.params.group_id
    ?? req.body.group_id

  const child_group_id = req.body.child_group_id
    ?? req.body.subgroup_id
    ?? req.params.subgroup_id

  const session = driver.session()
  session
  .run(`
    // Find the current user
    MATCH (current_user:User)
    WHERE id(current_user) = toInteger($current_user_id)

    // Find group
    WITH current_user
    MATCH (child_group:Group)

    // Allow only group admin or super admin to delete a group
    WHERE id(child_group)=toInteger($child_group_id)
      AND ( (child_group)-[:ADMINISTRATED_BY]->(current_user)
        OR current_user.isAdmin )

    // Find the parent group
    WITH child_group, current_user
    MATCH (parent_group:Group)
    WHERE id(parent_group)=toInteger($parent_group_id)
      AND ( (parent_group)-[:ADMINISTRATED_BY]->(current_user)
        OR current_user.isAdmin )

      // Prevent cyclic graphs (NOT WORKING)
      AND NOT (parent_group)-[:BELONGS_TO]->(child_group)
      AND NOT (parent_group)-[:BELONGS_TO *1..]->(:Group)-[:BELONGS_TO]->(child_group)

      // Prevent self group
      AND NOT id(parent_group)=id(child_group)

    // MERGE relationship
    MERGE (child_group)-[:BELONGS_TO]->(parent_group)

    // Return
    RETURN child_group
    `,
    {
      current_user_id: get_current_user_id(res),
      parent_group_id,
      child_group_id,
    })
  .then( ({records}) => {
    if(records.length < 1) return res.status(400).send(`Error adding group to group`)
    console.log(`User ${get_current_user_id(res)} added group ${child_group_id} to group ${parent_group_id}`)
    res.send(records[0].get('child_group'))
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.remove_group_from_group = (req, res) => {
  // Route to make a user join a group

  // TODO: Should the user be admin of child group?

  const parent_group_id = req.body.parent_group_id
    ?? req.params.group_id
    ?? req.body.group_id

  const child_group_id = req.body.child_group_id
    ?? req.body.subgroup_id
    ?? req.params.subgroup_id

  const session = driver.session();
  session
  .run(`
    // Find the current user
    MATCH (current_user:User)
    WHERE id(current_user) = toInteger($current_user_id)

    // Find the child group group
    WITH current_user
    MATCH (child_group:Group)

    // Allow only group admin or super admin to remove a group
    WHERE id(child_group)=toInteger($child_group_id)
      AND ( (child_group)-[:ADMINISTRATED_BY]->(current_user)
        OR current_user.isAdmin )

    // Find the parent group
    WITH child_group, current_user
    MATCH (child_group)-[r:BELONGS_TO]->(parent_group:Group)
    WHERE id(parent_group) = toInteger($parent_group_id)
      AND ( (parent_group)-[:ADMINISTRATED_BY]->(current_user)
        OR current_user.isAdmin )

    // delete relationship
    DELETE r

    // Return
    RETURN child_group, parent_group
    `,
    {
      current_user_id: get_current_user_id(res),
      parent_group_id,
      child_group_id,
    })
  .then(result => {
    if(result.records.length < 1) return res.status(400).send(`Error removing group from group`)
    console.log(`User ${get_current_user_id(res)} removed group ${child_group_id} from group ${parent_group_id}`)
    res.send(result.records[0].get('child_group'))
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}
