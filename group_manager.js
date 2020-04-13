const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const neo4j = require('neo4j-driver')

const axios = require('axios')

const secrets = require('./secrets');

const app_port = 7000;


var driver = neo4j.driver(
  secrets.neo4j.url,
  neo4j.auth.basic(secrets.neo4j.username, secrets.neo4j.password)
)

var app = express()
app.use(bodyParser.json())
app.use(cors())



function check_authentication(req, res, next){

  let token = req.headers.authorization.split(" ")[1];
  if(!token) return res.status(400).send(`No token in authorization header`)

  axios.post(secrets.authentication_api_url, { jwt: token })
  .then(response => {
    res.locals.user = response.data
    next()
  })
  .catch(error => { res.status(400).send(error) })
}

function get_user_id_for_viewing(req, res){
  if('employee_id' in req.body) return req.body.employee_id
  if('employee_id' in req.query) return req.query.employee_id

  if('user_id' in req.body) return req.body.user_id
  if('user_id' in req.query) return req.query.user_id

  // if nothing, just use the logged in user
  return res.locals.user.identity.low
}

function get_user_id_for_modification(req, res){

  // TODO: Use user_id instead of employee_id

  // If not requiring particular employee, just return self
  if(! ('employee_id' in req.body)) return res.locals.user.identity.low

  if(res.locals.user.identity.low !== req.body.employee_id) {
    // Does not get gaught by Neo4j catch!
    res.status(403).send(`Cannot edit someone else's info`)
    throw "Cannot edit someone else's info"
  }
  else return eq.body.employee_id
}

app.get('/', (req, res) => {
  res.send('Group management API, Maxime MOREILLON')
});

function get_group_by_id(req, res){
  const session = driver.session();
  session
  .run(`
    MATCH (group)
    WHERE id(group)=toInt({id})
    RETURN group
    `, {
    id: req.query.id,
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

app.get('/group_by_id', get_group_by_id)
app.get('/group', get_group_by_id)

app.post('/create_group', check_authentication, (req, res) => {
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
})

app.post('/delete_group', check_authentication, (req, res) => {
  // Routeto delete a group
  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(group)=toInt({group_id}) AND id(administrator)=toInt({user_id})
    DETACH DELETE group
    RETURN "success"
    `, {
    user_id: res.locals.user.identity.low,
    group_id: req.body.id,
  })
  .then(result => {
    if(result.records.length < 1) return res.status(404).send('Error deleting node')
    res.send(result.records[0])
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})


app.post('/add_user_to_group', check_authentication, (req, res) => {
  // Route to make a user join a group

  const session = driver.session();
  session
  .run(`
    // Find the user
    MATCH (user:User)
    WHERE id(user)=toInt({user_id})

    // Find the group
    WITH user
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(group)=toInt({group_id}) AND id(administrator)=toInt({current_user_id})

    // MERGE relationship
    MERGE (user)-[:BELONGS_TO]->(group)

    // Return
    RETURN user, group
    `,
    {
      current_user_id: res.locals.user.identity.low,
      user_id: req.body.user_id,
      group_id: req.body.group_id
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.post('/add_group_to_group', check_authentication, (req, res) => {
  // Route to make a group join a group
  // Can only be done if user is admin of both groups

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
      parent_group_id: req.body.parent_group_id,
      child_group_id: req.body.child_group_id
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.post('/remove_group_from_group', check_authentication, (req, res) => {
  // Route to make a user join a group

  // TODO: Should the user b eadmin of child group?

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
      parent_group_id: req.body.parent_group_id,
      child_group_id: req.body.child_group_id
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})


app.post('/join_group', check_authentication, (req, res) => {
  // Route to join a group (only works if group is not private)

  const session = driver.session();
  session
  .run(`
    // Find the user
    MATCH (user:User)
    WHERE id(user)=toInt({user_id})

    // Find the group
    // TODO: CHECK IF GROUP IS PRIVATE
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
      user_id: get_user_id_for_modification(req, res),
      group_id: req.body.group_id
    })
  .then(result => {
    if(result.records.length < 1) return res.send(`Error joining group`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.post('/leave_group', check_authentication, (req, res) => {
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
      user_id: get_user_id_for_modification(req, res),
      group_id: req.body.group_id
    })
  .then(result => {
    if(result.records.length < 1) return res.send(`Error leaving group`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})



app.post('/remove_user_from_group', check_authentication, (req, res) => {
  // Route to make a user leave a group

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
      user_id: req.body.user_id,
      group_id: req.body.group_id,
    })
  .then(result => {
    if(result.records.length < 1) return res.send(`Error removing from group`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.post('/make_user_administrator_of_group', check_authentication, (req, res) => {
  // Route to leave a group

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
      user_id: req.body.user_id,
      group_id: req.body.group_id,
    })
  .then(result => {
    if(result.records.length < 1) return res.send(`Error leaving group`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.post('/remove_user_from_administrators', check_authentication, (req, res) => {
  // Route to remove a user from the administrators of a group

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
      user_id: req.body.user_id,
      group_id: req.body.group_id,
    })
  .then(result => {
    if(result.records.length < 1) return res.send(`Error removing from administrators`)
    res.send(result.records)
  })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})


app.get('/groups_of_user', check_authentication, (req, res) => {
  // Route to retrieve a user's groups
  const session = driver.session();
  session
  .run(`
    MATCH (user:User)-[:BELONGS_TO]->(group:Group)
    WHERE id(user)=toInt({id})
    RETURN group
    `,
    {
      id: get_user_id_for_viewing(req, res),
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.get('/groups_of_administrator', check_authentication, (req, res) => {
  // Route to retrieve a user's groups
  const session = driver.session();
  session
  .run(`
    MATCH (user:User)<-[:ADMINISTRATED_BY]-(group:Group)
    WHERE id(user)=toInt({id})
    RETURN group
    `,
    {
      id: get_user_id_for_viewing(req, res),
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.get('/top_level_groups', (req, res) => {
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
})

app.get('/top_level_groups/official', (req, res) => {
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
})

app.get('/top_level_groups/non_official', (req, res) => {
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
})

app.get('/groups_directly_belonging_to_group', (req, res) => {
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
});



app.get('/users_of_group', (req, res) => {
  // Route to retrieve a user's groups

  const session = driver.session();
  session
  .run(`
    MATCH (user:User)-[:BELONGS_TO]->(group:Group) // Final
    WHERE id(group)=toInt({id})
    RETURN user
    `,
    {
      id: req.query.id
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.get('/groups_of_group', check_authentication, (req, res) => {
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
})

app.get('/users_with_no_group', (req, res) => {
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
})

app.get('/administrators_of_group', (req, res) => {
  // Route to retrieve a user's groups

  const session = driver.session();
  session
  .run(`
    MATCH (user:User)<-[:ADMINISTRATED_BY]-(group:Group)
    WHERE id(group)=toInt({id})
    RETURN user
    `,
    {
      id: req.query.id
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.post('/set_group_restriction', check_authentication, (req, res) => {
  // Route to make a group restricted (i.e. cannot be joined)
  // Todo: error message when failure
  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator:User)
    WHERE id(group)=toInt({id}) AND id(administrator)=toInt({current_user_id})
    SET group.restricted={restricted}
    RETURN group
    `,
    {
      current_user_id: res.locals.user.identity.low,
      restricted: req.body.restricted,
      id: req.body.id,
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.post('/set_group_officiality', check_authentication, (req, res) => {
  // Route to make a group official
  // Can only be done by admins
  // Todo: error message when failure
  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator:User{isAdmin: true})
    WHERE id(group)=toInt({id}) AND id(administrator)=toInt({current_user_id})
    SET group.official={officiality}
    RETURN group
    `,
    {
      current_user_id: res.locals.user.identity.low,
      officiality: req.body.official,
      id: req.body.id,
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})



app.post('/update_avatar', check_authentication, (req, res) => {
  // Route to update the avatar of the group
  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(user:User)
    WHERE id(group) = toInt({group_id}) AND id(user) = toInt({user_id})
    SET group.avatar_src={avatar_src}
    RETURN group
    `, {
      user_id: get_user_id_for_modification(req, res),
      group_id: req.body.group_id,
      avatar_src: req.body.avatar_src
    })
    .then(result => { res.send(result.records) })
    .catch(error => res.status(400).send(`Error accessing DB: ${error}`))
    .finally( () => session.close())
});



app.listen(app_port, () => {
  console.log(`Group manager listening on port ${app_port}`)
})
