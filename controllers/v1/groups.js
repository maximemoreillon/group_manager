const {drivers: {v1: driver}} = require('../../db.js')
const {
  get_current_user_id,
  group_query,
} = require('../../utils.js')

exports.get_group = (req, res) => {

  const group_id = req.params.group_id
    || req.query.id
    || req.query.group_id

  const session = driver.session()
  session
  .run(`
    ${group_query}
    RETURN group
    `, {
    group_id,
  })
  .then( ({records}) => {
    // NOTE: Not too sure about sendig only one record
    // How about sending all records and let the front end deal with it?
    if(records.length < 1) return res.status(404).send('Not found')
    console.log(`Group ${group_id} (LEGACY)`)
    res.send(records[0].get('group'))
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}




exports.get_top_level_groups = (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)

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
  .then(result => {
    res.send(result.records)
    console.log(`Top level groups queried (V1 LEGACY)`)
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
  .then(result => {
    res.send(result.records)
    console.log(`Top level official groups queried (V1 LEGACY)`)
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
  .then(result => {
    res.send(result.records)
    console.log(`Top level non official groups queried (V1 LEGACY)`)

   })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.get_groups_directly_belonging_to_group = (req, res) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)



  const group_id = req.query.id
    ?? req.query.group_id
    ?? req.params.group_id

  if(!group_id) return res.status(400).send('Group ID not defined')

  const session = driver.session();
  session
  .run(`
    ${group_query}
    WITH group as parent_group
    MATCH (parent_group)<-[:BELONGS_TO]-(group:Group)
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent_group)

    // DISTINCT JUST IN CASE
    RETURN DISTINCT(group)
    `,
    { group_id })
  .then(result => {
    console.log(`Direct subgroups of group ${group_id} queried (V1 LEGACY)`)
    res.send(result.records)
   })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.get_parent_groups_of_group = (req, res) => {
  // Route to retrieve groups inside a group


  const subgroup_id = req.params.group_id
    ?? req.query.id
    ?? req.query.group_id

  if(!subgroup_id) return res.status(400).send('Group ID not defined')

  const session = driver.session()
  session
  .run(`
    ${group_query}
    WITH group as child
    MATCH (child)-[:BELONGS_TO]->(group:Group)
    RETURN group
    `,
    { group_id: subgroup_id })
  .then(result => {
    console.log(`Parent groups of group ${subgroup_id} queried`)
    res.send(result.records)
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.get_groups_of_group = (req, res) => {
  // Route to retrieve groups inside a group

  const group_id = req.query.id
    ?? req.query.group_id
    ?? req.params.group_id
    ?? req.params.id

  const session = driver.session();
  session
  .run(`
    ${group_query}
    WITH group as parent
    MATCH (group:Group)-[:BELONGS_TO]->(parent)
    RETURN group
    `,
    { group_id })
  .then(result => {
    console.log(`Subgroups of group ${group_id} queried (V1 LEGACY)`)
    res.send(result.records)
   })
  .catch(error => { res.status(400).send(`Error accessing DB: ${error}`) })
  .finally( () => { session.close() })
}

exports.add_group_to_group = (req, res) => {
  res.status(410).send('deprecated')
}

exports.remove_group_from_group = (req, res) => {
  res.status(410).send('deprecated')
}

exports.create_group = (req, res) => {
  res.status(410).send('Deprecated')
}

exports.delete_group = (req, res) => {
  res.status(410).send('Deprecated')
}

exports.join_group = (req, res) => {
  res.status(410).send('Deprecated')
}

exports.leave_group = (req, res) => {
  res.status(410).send('Deprecated')
}

exports.patch_group = (req, res) => {
  res.status(410).send('deprecated')
}
