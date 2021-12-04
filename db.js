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
const connection_check = async () => {
  try {
    const session = drivers.v2.session()
    await session.run(`RETURN 'OK'`)
    console.log(`[Neo4J] connected`)
    connected = true
  }
  catch (e) {
    console.log(e)
    console.log(`[Neo4J] connection error`)
  }
}

connection_check()

exports.url = NEO4J_URL
exports.get_connected = () => connected
exports.drivers = drivers
