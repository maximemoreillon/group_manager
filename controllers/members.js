const driver = require('../neo4j_driver.js')
const auth = require('../auth.js')

exports.get_user = (req, res) => {
  // Route to retrieve a user's info

  let user_id = req.params.member_id
    || req.params.user_id
    || req.query.member_id
    || req.query.user_id
    || req.query.id

  if(!user_id) return res.status(400).send('User ID not defined')

  if(user_id === 'self') user_id = res.locals.user.identity.low

  const session = driver.session();
  session
  .run(`
    MATCH (user:User)
    WHERE id(user)=toInt({user_id})
    RETURN user
    `,
    {
      user_id: user_id,
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.get_members_of_group = (req, res) => {
  // Route to retrieve a user's groups

  let group_id = req.query.id
    || req.query.group_id
    || req.params.id
    || req.params.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')
  // Todo: allow user to pass what key tey want to query

  const session = driver.session();
  session
  .run(`
    MATCH (user:User)-[:BELONGS_TO]->(group:Group)
    WHERE id(group)=toInt({id})
    RETURN user
    `,
    {
      id: group_id,
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.add_member_to_group = (req, res) => {
  // Route to make a user join a group

  let group_id = req.body.group_id
    || req.params.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')

  let user_id = req.body.member_id
    || req.body.user_id
    || req.params.member_id

  const session = driver.session();
  session
  .run(`
    // Find the user
    MATCH (user:User)
    WHERE id(user)=toInt({user_id})

    // Find the group
    WITH user
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(group)=toInt({group_id})
      AND id(administrator)=toInt({current_user_id})

    // MERGE relationship
    MERGE (user)-[:BELONGS_TO]->(group)

    // Return
    RETURN user, group
    `,
    {
      current_user_id: res.locals.user.identity.low,
      user_id: user_id,
      group_id: group_id
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.remove_user_from_group = (req, res) => {
  // Route to make a user leave a group

  let group_id = req.body.group_id
    || req.params.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')

  let user_id = req.body.member_id
    || req.body.user_id
    || req.params.member_id

  const session = driver.session();
  session
  .run(`
    // Find the user and the group
    MATCH (user:User)-[r:BELONGS_TO]->(group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(user)=toInt({user_id})
      AND id(group)=toInt({group_id})
      AND id(administrator)=toInt({current_user_id})

    // delete relationship
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
    if(result.records.length < 1) return res.send(`Error removing from group`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}


exports.get_groups_of_user = (req, res) => {
  // Route to retrieve a user's groups

  let member_id = req.query.member_id
    || req.query.user_id
    || req.query.id
    || req.params.member_id
    || res.locals.user.identity.low

  if(member_id === 'self') member_id = res.locals.user.identity.low

  const session = driver.session()
  session
  .run(`
    MATCH (user:User)-[:BELONGS_TO]->(group:Group)
    WHERE id(user)=toInt({id})
    RETURN group
    `,
    {
      id: member_id,
    })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.users_with_no_group = (req, res) => {
  // Route to retrieve users without a group

  const session = driver.session();
  session
  .run(`
    MATCH (user:User)
    WHERE NOT (user)-[:BELONGS_TO]->(:Group)
    RETURN user
    `,
    {})
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}
