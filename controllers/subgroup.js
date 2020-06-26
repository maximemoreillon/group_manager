const driver = require('../neo4j_driver.js')

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
