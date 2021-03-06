const driver = require('../../utils/neo4j_driver_v1.js')

function get_current_user_id(res){
  return res.locals.user.identity.low
    ?? res.locals.user.identity
}

exports.get_user = (req, res) => {
  // Route to retrieve a user's info

  let user_id = req.params.member_id
    ?? req.params.user_id
    ?? req.query.member_id
    ?? req.query.user_id
    ?? req.query.id

  if(user_id === 'self') user_id = get_current_user_id(res)

  if(!user_id) return res.status(400).send('User ID not defined')

  const session = driver.session()
  session
  .run(`
    MATCH (user:User)
    WHERE id(user)=toInteger($user_id)
    RETURN user
    `,
    { user_id })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.get_members_of_group = (req, res) => {
  // Route to retrieve a user's groups

  const group_id = req.query.id
    ?? req.query.group_id
    ?? req.params.id
    ?? req.params.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')

  // Todo: allow user to pass what key tey want to query
  // IDEA: Could be done with GraphQL

  const session = driver.session();
  session
  .run(`
    MATCH (user:User)-[:BELONGS_TO]->(group:Group)
    WHERE id(group)=toInteger($group_id)
    RETURN user
    `,
    { group_id })
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.add_member_to_group = (req, res) => {
  // Route to make a user join a group

  const group_id = req.body.group_id
    ?? req.params.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')

  const user_id = req.body.member_id
    ?? req.body.user_id
    ?? req.params.member_id

  if(!user_id) return res.status(400).send('User ID not defined')

  const session = driver.session();
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
      AND ( (group)-[:ADMINISTRATED_BY]->(current_user)
        OR current_user.isAdmin )

    // Find the user
    WITH group
    MATCH (user:User)
    WHERE id(user)=toInteger($user_id)

    // MERGE relationship
    MERGE (user)-[:BELONGS_TO]->(group)

    // Return
    RETURN user, group
    `,
    {
      current_user_id: get_current_user_id(res),
      user_id,
      group_id
    })
  .then(result => {
    if(result.records.length < 1){
      console.log(`Error adding user to group`)
      return res.status(400).send(`Error adding user to group`)
    }
    console.log(`Added user ${user_id} to group ${group_id}`)
    res.send(result.records)
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.remove_user_from_group = (req, res) => {
  // Route to make a user leave a group

  let group_id = req.body.group_id
    ?? req.params.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')

  let user_id = req.body.member_id
    ?? req.body.user_id
    ?? req.params.member_id

  if(!user_id) return res.status(400).send('User ID not defined')

  const session = driver.session();
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
      AND ( (group)-[:ADMINISTRATED_BY]->(current_user)
        OR current_user.isAdmin )

    // Find the user
    WITH group
    MATCH (user:User)-[r:BELONGS_TO]->(group)
    WHERE id(user)=toInteger($user_id)

    // delete relationship
    DELETE r

    // Return
    RETURN user, group
    `,
    {
      current_user_id: get_current_user_id(res),
      user_id,
      group_id,
    })
  .then(result => {
    if(result.records.length < 1){
      console.log(`Error removing user from group`)
      return res.status(400).send(`Error removing user from group`)
    }
    console.log(`Removed user ${user_id} from group ${group_id}`)
    res.send(result.records)
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}


exports.get_groups_of_user = (req, res) => {
  // Route to retrieve a user's groups

  let member_id = req.query.member_id
    ?? req.query.user_id
    ?? req.query.id
    ?? req.params.member_id
    ?? get_current_user_id(res)

  if(member_id === 'self') member_id = get_current_user_id(res)

  const session = driver.session()
  session
  .run(`
    MATCH (user:User)-[:BELONGS_TO]->(group:Group)
    WHERE id(user)=toInteger($member_id)
    RETURN group
    `,
    { member_id })
  .then(result => {
    console.log(`Groups of user ${member_id} queried`)
    res.send(result.records)
   })
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
    `, {})
  .then(result => { res.send(result.records) })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}
