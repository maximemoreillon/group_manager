const driver = require('../neo4j_driver.js')
const auth = require('../auth.js')

exports.get_administrators_of_group = (req, res) => {
  // Route to retrieve a user's groups

  let group_id = req.query.group_id
    || req.params.group_id



  const session = driver.session();
  session
  .run(`
    MATCH (user:User)<-[:ADMINISTRATED_BY]-(group:Group)
    WHERE id(group)=toInt({id})
    RETURN user
    `,
    {
      id: group_id
    })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.make_user_administrator_of_group = (req, res) => {
  // Route to leave a group

  let group_id = req.body.group_id
    || req.params.group_id

  let user_id = req.body.member_id
    || req.body.user_id
    || req.body.administrator_id
    || req.params.administrator_id

  const session = driver.session();
  session
  .run(`
    // Find the user and administrator
    MATCH (user:User)
    WHERE id(user)=toInt({user_id})

    // Find the group and its administrator
    WITH user
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(group)=toInt({group_id}) AND id(administrator)=toInt({current_user_id})

    // Merge relationship
    MERGE (group)-[:ADMINISTRATED_BY]->(user)

    // Return
    RETURN user
    `,
    {
      current_user_id: res.locals.user.identity.low,
      user_id: user_id,
      group_id: group_id,
    })
  .then(result => {
    if(result.records.length < 1) return res.send(`Error leaving group`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.remove_user_from_administrators = (req, res) => {
  // Route to remove a user from the administrators of a group

  let group_id = req.body.group_id
    || req.params.group_id

  let user_id = req.body.member_id
    || req.body.user_id
    || req.body.administrator_id
    || req.params.administrator_id

  const session = driver.session();
  session
  .run(`
    // Find the group (only an admin can remove an admin)
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(group)=toInt({group_id}) AND id(administrator)=toInt({current_user_id})

    WITH group
    MATCH (user:User)<-[r:ADMINISTRATED_BY]-(group)
    WHERE id(user)=toInt({user_id})

    // Delete relationship
    DELETE r

    // Return
    RETURN user
    `,
    {
      current_user_id: res.locals.user.identity.low,
      user_id: user_id,
      group_id: group_id,
    })
  .then(result => {
    if(result.records.length < 1) return res.send(`Error removing from administrators`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}


exports.get_groups_of_administrator = (req, res) => {
  // Route to retrieve a user's groups
  const session = driver.session();
  session
  .run(`
    MATCH (user:User)<-[:ADMINISTRATED_BY]-(group:Group)
    WHERE id(user)=toInt({id})
    RETURN group
    `,
    {
      id: auth.get_user_id_for_viewing(req, res),
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}
