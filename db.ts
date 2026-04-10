import neo4j from "neo4j-driver";

export const {
  NEO4J_URL = "bolt://neo4j",
  NEO4J_USERNAME = "neo4j",
  NEO4J_PASSWORD = "",
} = process.env;

const auth = neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD);

const options = {
  v1: {},
  v2: { disableLosslessIntegers: true },
};

export const drivers = {
  v1: neo4j.driver(NEO4J_URL, auth, options.v1),
  v2: neo4j.driver(NEO4J_URL, auth, options.v2),
};

export const get_connection_status = async () => {
  const session = drivers.v2.session();
  try {
    console.log(`[Neo4J] Testing connection...`);
    await session.run("RETURN 1");
    console.log(`[Neo4J] Connection successful`);
    return true;
  } catch (e) {
    console.log(`[Neo4J] Connection failed`);
    return false;
  } finally {
    session.close();
  }
};

const set_ids = async () => {
  const id_setting_query = `
    MATCH (g:Group)
    WHERE g._id IS NULL
    SET g._id = toString(id(g))
    RETURN COUNT(g) as count
    `;

  const session = drivers.v2.session();

  try {
    const { records } = await session.run(id_setting_query);
    const count = records[0].get("count");
    console.log(`[Neo4J] Formatted new ID for ${count} groups`);
  } finally {
    session.close();
  }
};

const create_constraints = async () => {
  const session = drivers.v2.session();

  try {
    await session.run(
      `CREATE CONSTRAINT IF NOT EXISTS FOR (g:Group) REQUIRE g._id IS UNIQUE`,
    );
    console.log(`[Neo4J] Created constraints`);
  } finally {
    session.close();
  }
};

export const close = async () => {
  await Promise.all([drivers.v1.close(), drivers.v2.close()]);
  console.log("[Neo4J] Connections closed");
};

export const init = async () => {
  if (!(await get_connection_status()))
    throw new Error("Could not connect to Neo4J");

  console.log("[Neo4J] Initializing DB...");
  await set_ids();
  await create_constraints();
  console.log("[Neo4J] DB initialized");
};
