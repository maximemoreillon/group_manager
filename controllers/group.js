const driver = require('../neo4j_driver.js')

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
