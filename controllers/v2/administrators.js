const {drivers: {v2: driver}} = require('../../db.js')
const {
  get_current_user_id,
} = require('../../utils.js')


exports.get_administrators_of_group = (req, res) => {
  // Route to retrieve a user's groups

  const group_id = req.query.group_id
    ?? req.params.group_id

  const session = driver.session();
  session
  .run(`
    MATCH (admin:User)<-[:ADMINISTRATED_BY]-(group:Group)
    WHERE id(group)=toInteger($group_id)
    RETURN admin
    `,
    { group_id })
  .then(({records}) => {
    const admins = records.map(record => record.get('admin'))
    admins.forEach( admin => { delete admin.properties.password_hashed })
    res.send(admins)
   })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.make_user_administrator_of_group = (req, res) => {
  // Route to leave a group

  const group_id = req.body.group_id
    ?? req.params.group_id

  const user_id = req.body.member_id
    ?? req.body.user_id
    ?? req.body.administrator_id
    ?? req.params.administrator_id

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

    // Merge relationship
    MERGE (group)-[:ADMINISTRATED_BY]->(user)

    // Return
    RETURN user, group
    `,
    {
      current_user_id: get_current_user_id(res),
      user_id,
      group_id,
    })
  .then(({records}) => {
    if(records.length < 1) return res.status(400).send(`Error adding user to administrators`)
    console.log(`User ${user_id} added to administrators of group ${group_id}`)
    res.send(records[0].get('user'))
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.remove_user_from_administrators = (req, res) => {
  // Route to remove a user from the administrators of a group

  const group_id = req.body.group_id
    || req.params.group_id

  const user_id = req.body.member_id
    || req.body.user_id
    || req.body.administrator_id
    || req.params.administrator_id

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
    MATCH (group)-[r:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(administrator)=toInteger($user_id)

    // Delete relationship
    DELETE r

    // Return
    RETURN administrator, group
    `,
    {
      current_user_id: get_current_user_id(res),
      user_id,
      group_id,
    })
  .then(({records}) => {
    if(records.length < 1) return res.status(400).send(`Error removing from administrators`)
    console.log(`User ${user_id} removed from administrators of group ${group_id}`)
    res.send(records[0].get('administrator'))
  })
  .catch(error => {
    console.error(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}


exports.get_groups_of_administrator = (req, res) => {
  // Route to retrieve a user's groups
  let administrator_id = req.params.administrator_id
    ?? req.body.administrator_id
    ?? req.body.id
    ?? req.query.administrator_id
    ?? req.query.id

  if(administrator_id === 'self') administrator_id = get_current_user_id(res)

  const session = driver.session();
  session
  .run(`
    MATCH (user:User)<-[:ADMINISTRATED_BY]-(group:Group)
    WHERE id(user)=toInteger($administrator_id)
    RETURN group
    `,
    { administrator_id, })
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
