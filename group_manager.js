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

function get_employee_id_for_viewing(req, res){
  if('employee_id' in req.body) return req.body.employee_id
  if('employee_id' in req.query) return req.query.employee_id

  if('user_id' in req.body) return req.body.user_id
  if('user_id' in req.query) return req.query.user_id

  // if nothing, just use the logged in user
  return res.locals.user.identity.low
}

function get_user_id_for_modification(req, res){

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
  res.send('Group manager')
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
    MATCH (creator) // Todo: Label
    WHERE id(creator)=toInt({user_id})
    CREATE (group)-[:ADMINISTRATED_BY]->(creator)
    CREATE (group)-[:CREATED_BY]->(creator) // ADD DATE
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
  // TODO: authenticate better
  const session = driver.session();
  session
  .run(`
    MATCH (group:Group)-[:ADMINISTRATED_BY]->(administrator)
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


app.post('/invite_user_in_group', check_authentication, (req, res) => {
  // Route to make a user join a group

  const session = driver.session();
  session
  .run(`
    // Find the user
    // TODO: Add Label
    MATCH (user)
    WHERE id(user)=toInt({user_id})

    // Find the workplace
    WITH user
    MATCH (group)-[:ADMINISTRATED_BY]->(administrator) // No labels yet
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


app.post('/join_group', check_authentication, (req, res) => {
  // Route to join a group (only works if group is not private)

  const session = driver.session();
  session
  .run(`
    // TODO: Switch to User label
    // Find the user
    MATCH (user)
    WHERE id(user)=toInt({user_id})

    // Find the group
    // TODO: CHECK IF GROUP IS PRIVATE
    WITH user
    MATCH (group)
    WHERE id(group)=toInt({group_id})

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
    // TODO: Switch to User label
    // Find the user and the group
    MATCH (user:Employee)-[r:BELONGS_TO]->(group)// Temporary
    //MATCH (user:User)-[r:BELONGS_TO]->(group:Group)// Final
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
  // Route to leave a group
  // TODO CHECK OF SUCCESS
  const session = driver.session();
  session
  .run(`
    // TODO: Switch to User label
    // Find the user and the group
    MATCH (user:Employee)-[r:BELONGS_TO]->(group)-[:ADMINISTRATED_BY]->(administrator)
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
    // TODO: Switch to User label
    // Find the user and administrator
    MATCH (user:Employee)
    WHERE id(user)=toInt({user_id})

    // Find the group
    WITH user
    MATCH (group)-[:ADMINISTRATED_BY]->(administrator)
    WHERE id(group)=toInt({group_id}) AND id(administrator)=toInt({current_user_id})

    // Merge relationship
    MERGE (group)-[:ADMINISTRATED_BY]->(user) // No labels yet

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
  // Route to leave a group

  const session = driver.session();
  session
  .run(`
    // TODO: Switch to User label

    // Find the group (only an admin can remove an admin)
    MATCH (group)-[:ADMINISTRATED_BY]->(administrator)
    WHERE id(group)=toInt({group_id}) AND id(administrator)=toInt({current_user_id})

    WITH group
    MATCH (user:Employee)<-[r:ADMINISTRATED_BY]-(group)
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
    MATCH (user:Employee)-[:BELONGS_TO]->(group) // Temporary
    //MATCH (user:User)-[:BELONGS_TO]->(group:Group) // Final
    WHERE id(user)=toInt({id})
    RETURN group
    `,
    {
      id: get_employee_id_for_viewing(req, res),
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.get('/top_level_groups', (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)

  // TODO: use labels
  const session = driver.session();
  session
  .run(`
    // Find groups
    MATCH (group)<-[:BELONGS_TO]-() // Temporary
    // MATCH (group:Group) // Final

    // That do not belong to any group
    WHERE NOT (group)-[:BELONGS_TO]->() // Temporary
    // WHERE NOT (group)-[:BELONGS_TO]->()

    // NOT SURE WHY DISTINCT NEEDED
    RETURN DISTINCT(group)
    `, {})
  .then(result => { res.send(result.records); })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.get('/groups_directly_belonging_to_group', (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  // TODO: use labels
  const session = driver.session();
  session
  .run(`
    // Match the parent node
    MATCH (parent_group) // Temporary
    //MATCH (parent_group:Group) // Final
    WHERE id(parent_group)=toInt({id})

    // Match children that only have a direct connection to parent
    WITH parent_group
    MATCH (parent_group)<-[:BELONGS_TO]-(group) // Temporary
    WHERE NOT group:Employee
      AND NOT (group)-[:BELONGS_TO]->()-[:BELONGS_TO]->(parent_group) // temporary

    // MATCH (parent_group)<-[:BELONGS_TO]-(group:Group) // Final
    // WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent_group) // Final

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

app.get('/all_groups_of_group', check_authentication, (req, res) => {
  // Route to retrieve groups inside a group

  const session = driver.session();
  session
  .run(`
    MATCH (child:Group)-[:BELONGS_TO]->(parent:Group)
    WHERE id(parent)=toInt({parent})
    RETURN child
    `,
    {
      id: req.query.id
    })
  .then(result => { res.send(result.records) })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
})

app.get('/users_of_group', (req, res) => {
  // Route to retrieve a user's groups

  const session = driver.session();
  session
  .run(`
    MATCH (user:Employee)-[:BELONGS_TO]->(group) // Temporary
    //MATCH (user:User)-[:BELONGS_TO]->(group:Group) // Final
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

app.get('/users_with_no_group', (req, res) => {
  // Route to retrieve users without a group

  const session = driver.session();
  session
  .run(`
    MATCH (user:Employee)
    WHERE NOT (user)-[:BELONGS_TO]->()
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
    MATCH (user:Employee)<-[:ADMINISTRATED_BY]-(group) // Temporary
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


app.listen(app_port, () => {
  console.log(`Group manager listening on port ${app_port}`)
})
