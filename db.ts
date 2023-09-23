import neo4j from "neo4j-driver"
import dotenv from "dotenv"

dotenv.config()

export const {
  NEO4J_URL = "bolt://neo4j",
  NEO4J_USERNAME = "neo4j",
  NEO4J_PASSWORD = "neo4j",
} = process.env

const auth = neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)

const options = {
  v1: {},
  v2: { disableLosslessIntegers: true },
}

export const drivers = {
  v1: neo4j.driver(NEO4J_URL, auth, options.v1),
  v2: neo4j.driver(NEO4J_URL, auth, options.v2),
}

let connected = false

const get_connection_status = async () => {
  const session = drivers.v2.session()
  try {
    console.log(`[Neo4J] Testing connection...`)
    await session.run("RETURN 1")
    console.log(`[Neo4J] Connection successful`)
    return true
  } catch (e) {
    console.log(`[Neo4J] Connection failed`)
    return false
  } finally {
    session.close()
  }
}

const set_ids = async () => {
  const id_setting_query = `
    MATCH (g:Group)
    WHERE g._id IS NOT NULL
    SET g._id = toString(id(g))
    RETURN COUNT(g) as count
    `

  const session = drivers.v2.session()

  try {
    const { records } = await session.run(id_setting_query)
    const count = records[0].get("count")
    console.log(`[Neo4J] Formatted new ID for ${count} groups`)
  } catch (e) {
    throw e
  } finally {
    session.close()
  }
}

const create_constraints = async () => {
  const session = drivers.v2.session()

  try {
    await session.run(`CREATE CONSTRAINT ON (g:Group) ASSERT g._id IS UNIQUE`)
    console.log(`[Neo4J] Created constraints`)
  } catch (error) {
    console.error(`Creating contraints failed`)
    throw error
  } finally {
    session.close()
  }
}

export const init = async () => {
  if (await get_connection_status()) {
    connected = true

    try {
      console.log("[Neo4J] Initializing DB")
      await set_ids()
      await create_constraints()
    } catch (error) {
      console.log(error)
    }
  } else {
    setTimeout(init, 10000)
  }
}

export const getConnected = () => connected
