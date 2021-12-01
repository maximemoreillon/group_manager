const driver = require('../../utils/neo4j_driver_v2.js')



exports.get_groups = async (req, res) => {

  // Queries: official vs non official, top level vs normal, type

  const batch_size = req.query.batch_size || 100
  const start_index = req.query.start_index || 0

  // WARNING: Querying top level official groups means groups whith no parent THAT ARE OFFICIAL

  const top_level_query = req.query.top == null ? '' : 'WITH group WHERE NOT (group)-[:BELONGS_TO]->(:Group)'
  const official_query = req.query.official == null ? '' : 'WITH group WHERE group.official'
  const non_official_query = req.query.nonofficial == null ? '' : 'WITH group WHERE (NOT EXISTS(group.official) OR NOT group.official)'

  const batching = `WITH group_count, all_groups[toInteger($start_index)..toInteger($start_index)+toInteger($batch_size)] AS group_batch`


  const query = `
    MATCH (group:Group)
    ${top_level_query}
    ${official_query}
    ${non_official_query}

    WITH COLLECT(group) as all_groups, COUNT(group) as group_count

    ${batching}

    RETURN group_batch, group_count
    `

  const params = {
    batch_size,
    start_index,
  }

  const session = driver.session()
  session.run(query,params)
  .then( ({records}) => {

    const output = records.map(r => ({
      batch_size,
      start_index,
      group_count: r.get('group_count'),
      groups: r.get('group_batch'),
    }))

    res.send(output)
    console.log(`Groups queried`)
  })
  .catch(error => {
    console.log(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}
