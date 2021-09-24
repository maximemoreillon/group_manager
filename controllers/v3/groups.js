const driver = require('../../utils/neo4j_driver_v2.js')



exports.get_groups = async (req, res) => {

  // Queries: official vs non official, top level vs normal, type


  const top_level_query = ``

  const batch_size = req.query.batch_size || 100
  const start_index = req.query.start_index || 0

  const batching = `WITH group_count, all_groups[toInteger($start_index)..toInteger($start_index)+toInteger($batch_size)] AS group_batch`


  const query = `
    MATCH (group:Group)

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
      group_count: r.get('group_count'),
      batch_size,
      start_index,
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
