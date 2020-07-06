const driver = require('../neo4j_driver.js')
const auth = require('../auth.js')

exports.get_group = (req, res) => {

  let group_id = req.params.group_id
    || req.query.id
    || req.query.group_id

  const session = driver.session()
  session
  .run(`
    MATCH (group)
    WHERE id(group)=toInt({id})
    RETURN group
    `, {
    id: group_id,
  })
  .then(result => {
    // Not too usre about sendig only one record
    // How about sending all records and let the front end deal with it?
    if(result.records.length < 1) return res.status(404).send('Not found')
    res.send(result.records[0].get('group'))
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.create_group = (req, res) => {
  // Create a group
  const session = driver.session();
  session
  .run(`
    // Create the group
    CREATE (group:Group)
    SET group.name = {group_name}

    // Create creation relationship
    WITH group
    MATCH (creator:User)
    WHERE id(creator)=toInt({user_id})
    CREATE (group)-[:ADMINISTRATED_BY]->(creator)
    CREATE (group)-[:CREATED_BY]->(creator) // TODO: ADD DATE
    CREATE (group)<-[:BELONGS_TO]-(creator)

    // Could have a CREATED_BY relationship

    RETURN group
    `, {
    user_id: res.locals.user.identity.low,
    group_name: req.body.name,
  })
  .then(result => {
    if(result.records.length < 1) return res.status(500).send('Error creating node')
    res.send(result.records[0].get('group'))
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}


exports.delete_group = (req, res) => {
  // Route to delete a group

  let group_id = req.params.group_id
    || req.query.id
    || req.query.group_id

  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(group)=toInt({group_id}) AND id(administrator)=toInt({user_id})
    DETACH DELETE group
    RETURN "success"
    `, {
    user_id: res.locals.user.identity.low,
    group_id: group_id,
  })
  .then(result => {
    if(result.records.length < 1) return res.status(404).send('Error deleting node')
    res.send(result.records[0])
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.join_group = (req, res) => {
  // TODO: Could be combined with make user member of group
  // Route to join a group (only works if group is not private)

  let group_id = req.params.group_id
    || req.body.group_id

  const session = driver.session();
  session
  .run(`
    // Find the user
    MATCH (user:User)
    WHERE id(user)=toInt({user_id})

    // Find the group
    WITH user
    MATCH (group:Group)
    WHERE id(group)=toInt({group_id})
      AND (NOT EXISTS(group.restricted) OR NOT group.restricted)

    // MERGE relationship
    MERGE (user)-[:BELONGS_TO]->(group)

    // Return
    RETURN user
    `,
    {
      user_id: auth.get_user_id_for_modification(req, res),
      group_id: group_id,
    })
  .then(result => {
    if(result.records.length < 1) return res.send(`Error joining group`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}


exports.leave_group = (req, res) => {
  // TODO: Could be combined with make user member of group
  // Route to leave a group

  const session = driver.session();
  session
  .run(`
    // Find the user and the group
    MATCH (user:User)-[r:BELONGS_TO]->(group:Group)
    WHERE id(user)=toInt({user_id}) AND id(group)=toInt({group_id})

    // delete relationship
    DELETE r

    // Return
    RETURN user
    `,
    {
      user_id: auth.get_user_id_for_modification(req, res),
      group_id: req.body.group_id
    })
  .then(result => {
    if(result.records.length < 1) return res.send(`Error leaving group`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}


exports.get_top_level_groups = (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  const session = driver.session();
  session
  .run(`
    // Find groups
    MATCH (group:Group) // Final

    // That do not belong to any group
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)

    // NOT SURE WHY DISTINCT NEEDED
    RETURN DISTINCT(group)
    `, {})
  .then(result => { res.send(result.records); })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.get_top_level_official_groups = (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  const session = driver.session();
  session
  .run(`
    // Find groups
    MATCH (group:Group) // Final

    // That do not belong to any group
    WHERE NOT (group)-[:BELONGS_TO *1..]->(:Group {official: true})
      AND group.official

    // NOT SURE WHY DISTINCT NEEDED
    RETURN DISTINCT(group)
    `, {})
  .then(result => { res.send(result.records); })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
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
  .then(result => { res.send(result.records); })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.get_groups_directly_belonging_to_group = (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  const session = driver.session();
  session
  .run(`
    // Match the parent node
    MATCH (parent_group:Group)
    WHERE id(parent_group)=toInt({id})

    // Match children that only have a direct connection to parent
    WITH parent_group
    MATCH (parent_group)<-[:BELONGS_TO]-(group:Group)
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent_group) // temporary

    // DISTINCT JUST IN CASE
    RETURN DISTINCT(group)
    `,
    {
      id: req.query.id
    })
  .then(result => { res.send(result.records); })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.get_parent_groups_of_group = (req, res) => {
  // Route to retrieve groups inside a group

  let subgroup_id = req.params.group_id
    || req.query.id
    || req.query.group_id

  const session = driver.session();
  session
  .run(`
    MATCH (child:Group)-[:BELONGS_TO]->(group:Group)
    WHERE id(child)=toInt({id})
    RETURN group
    `,
    {
      id: subgroup_id
    })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.patch_group = (req, res) => {

  let group_id = req.body.id
    || req.body.group_id
    || req.params.group_id

  let customizable_fields = [
    'avatar_src',
    'name',
    'restricted',
  ]

  if(res.locals.user.properties.isAdmin){
    customizable_fields.push('official')
  }

  // prevent user from modifying disallowed properties
  for (let [key, value] of Object.entries(req.body)) {
    if(!customizable_fields.includes(key)) {
      delete req.body[key]
    }
  }

  var session = driver.session()
  session
  .run(`
    // Find the group
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(group)=toInt({group_id})
      AND id(administrator)=toInt({current_user_id})

    // Patch properties
    // += implies update of existing properties
    SET group += {properties}

    RETURN group
    `, {
    current_user_id: res.locals.user.identity.low,
    group_id: group_id,
    properties: req.body,
  })
  .then(result => {
    res.send(result.records)
  })
  .catch(error => { res.status(500).send(`Error updating group: ${error}`) })
  .finally(() => session.close())

}


exports.get_groups_of_group = (req, res) => {
  // Route to retrieve groups inside a group

  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)-[:BELONGS_TO]->(parent:Group)
    WHERE id(parent)=toInt({id})
    RETURN group
    `,
    {
      id: req.query.id
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.add_group_to_group = (req, res) => {
  // Route to make a group join a group
  // Can only be done if user is admin of both groups

  let parent_group_id = req.body.parent_group_id
    || req.params.group_id
    || req.body.group_id

  let child_group_id = req.body.child_group_id
    || req.body.subgroup_id
    || req.params.subgroup_id

  const session = driver.session();
  session
  .run(`
    // Find the group to put in the parent group
    MATCH (child_group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(child_group)=toInt({child_group_id})
      AND id(administrator)=toInt({current_user_id})

    // Find the parent group
    WITH child_group
    MATCH (parent_group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(parent_group)=toInt({parent_group_id})
      AND id(administrator)=toInt({current_user_id})
      // Prevent cyclic graphs
      AND NOT (parent_group)-[:BELONGS_TO]->(child_group)
      AND NOT (parent_group)-[:BELONGS_TO *1..]->(:Group)-[:BELONGS_TO]->(child_group)

    // MERGE relationship
    MERGE (child_group)-[:BELONGS_TO]->(parent_group)

    // Return
    RETURN child_group
    `,
    {
      current_user_id: res.locals.user.identity.low,
      parent_group_id: parent_group_id,
      child_group_id: child_group_id,
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.remove_group_from_group = (req, res) => {
  // Route to make a user join a group

  // TODO: Should the user be admin of child group?

  let parent_group_id = req.body.parent_group_id
    || req.params.group_id
    || req.body.group_id

  let child_group_id = req.body.child_group_id
    || req.body.subgroup_id
    || req.params.subgroup_id

  const session = driver.session();
  session
  .run(`
    // Find the parent_group and the child_group
    MATCH (child_group:Group)-[r:BELONGS_TO]->(parent_group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(child_group)=toInt({child_group_id})
      AND id(parent_group)=toInt({parent_group_id})
      AND id(administrator)=toInt({current_user_id})

    // delete relationship
    DELETE r

    // Return
    RETURN child_group
    `,
    {
      current_user_id: res.locals.user.identity.low,
      parent_group_id: parent_group_id,
      child_group_id: child_group_id,
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}
