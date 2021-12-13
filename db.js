const neo4j = require('neo4j-driver')
const dotenv = require('dotenv')

dotenv.config()

const {
  NEO4J_URL = 'bolt://neo4j',
  NEO4J_USERNAME = 'neo4j',
  NEO4J_PASSWORD = 'neo4j',
} = process.env

const auth = neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)

const options = {
  v1: {},
  v2: { disableLosslessIntegers: true }
}


const drivers = {
  v1: neo4j.driver(NEO4J_URL, auth, options.v1),
  v2: neo4j.driver(NEO4J_URL, auth, options.v2)
}

let connected = false
const init = async () => {
  console.log('[Neo4J] Initializing DB')

  const id_setting_query = `
  MATCH (g:Group)
  WHERE NOT EXISTS(g._id)
  SET g._id = toString(id(g))
  RETURN COUNT(g) as count
  `

  const session = drivers.v2.session()

  try {
    const {records} = await session.run(id_setting_query)
    const count = records[0].get('count')
    console.log(`[Neo4J] ID of ${count} groups have been set`)
    connected = true
  }
  catch (e) {
    console.log(e)
    console.log(`[Neo4J] init failed, retrying in 10s`)
    setTimeout(init,10000)
  }
  finally {
    session.close()
  }

}


exports.url = NEO4J_URL
exports.drivers = drivers
exports.connected = () => connected
exports.init = init
