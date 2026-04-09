import { drivers } from "../../db";
import createHttpError from "http-errors";
import { get_current_user_id, getCypherUserIdentifiers } from "../../utils";
import { Request, Response, NextFunction } from "express";

const driver = drivers.v2;

export const create_group = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.status(410).send("Deprecated");
};

export const get_groups = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Queries: official vs non official, top level vs normal, type

  // NOTE: Querying top level official groups means groups whith no parent THAT ARE OFFICIAL

  const { batch_size = 100, start_index = 0 } = req.query;

  const top_level_query =
    req.query.top == null
      ? ""
      : "WITH group WHERE NOT (group)-[:BELONGS_TO]->(:Group)";
  const official_query =
    req.query.official == null ? "" : "WITH group WHERE group.official";
  const non_official_query =
    req.query.nonofficial == null
      ? ""
      : "WITH group WHERE (group.official IS NULL OR NOT group.official)";

  const batching = batch_size
    ? `WITH group_count, groups[toInteger($start_index)..toInteger($start_index)+toInteger($batch_size)] AS groups`
    : "";

  const query = `
    MATCH (group:Group)
    ${top_level_query}
    ${official_query}
    ${non_official_query}

    WITH COLLECT(group) as groups, COUNT(group) as group_count
    ${batching}

    RETURN groups, group_count
    `;

  const params = { batch_size, start_index };

  const session = driver.session();

  try {
    const { records } = await session.run(query, params);
    const record = records[0];

    const response = {
      batch_size,
      start_index,
      group_count: record.get("group_count"),
      groups: record.get("groups"),
    };

    res.send(response);
  } catch (e) {
    next(e);
  } finally {
    session.close();
  }
};

export const get_group = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { group_id } = req.params;

  const session = driver.session();

  const query = `
    MATCH (group:Group {_id: $group_id})
    RETURN group
    `;

  try {
    const { records } = await session.run(query, { group_id });
    if (!records.length)
      throw createHttpError(404, `Group ${group_id} not found`);
    res.send(records[0].get("group"));
  } catch (e) {
    next(e);
  } finally {
    session.close();
  }
};

export const patch_group = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.status(410).send("Deprecated");
};

export const delete_group = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.status(410).send("Deprecated");
};

export const join_group = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.status(410).send("Deprecated");
};

export const leave_group = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.status(410).send("Deprecated");
};

export const get_parent_groups_of_group = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Route to retrieve groups inside a group

  const { group_id } = req.params;

  if (!group_id) throw createHttpError(400, "Group ID not defined");

  const direct_only_query = `
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent)
    `;
  const session = driver.session();

  const query = `
    MATCH (group:Group {_id: $group_id})
    WITH group
    OPTIONAL MATCH (group)-[:BELONGS_TO]->(parent:Group)
    ${req.query.direct ? direct_only_query : ""}
    RETURN collect(parent) as parents
    `;

  try {
    const { records } = await session.run(query, { group_id });
    if (!records.length)
      throw createHttpError(400, `Subgroup group ${group_id} not found`);
    const groups = records[0].get("parents");
    res.send(groups);
    console.log(`Parent groups of group ${group_id} queried`);
  } catch (e) {
    next(e);
  } finally {
    session.close();
  }
};

export const get_groups_of_group = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Route to retrieve groups inside a group

  const { group_id } = req.params;

  const direct_only_query = `
    WHERE NOT (subgroup)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(group)
    `;

  const session = driver.session();

  const query = `
    MATCH (group:Group {_id: $group_id})
    WITH group
    OPTIONAL MATCH (subgroup:Group)-[:BELONGS_TO]->(group:Group)
    ${req.query.direct === "true" ? direct_only_query : ""}
    RETURN collect(subgroup) as subgroups
    `;

  const params = { group_id };

  try {
    const { records } = await session.run(query, params);
    if (!records.length)
      throw createHttpError(400, `Parent group ${group_id} not found`);
    const groups = records[0].get("subgroups");
    res.send(groups);
    console.log(`Subgroups of group ${group_id} queried`);
  } catch (e) {
    next(e);
  } finally {
    session.close();
  }
};

export const add_group_to_group = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.status(410).send("Deprecated");
};

export const remove_group_from_group = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.status(410).send("Deprecated");
};

export const get_groups_directly_belonging_to_group = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // THIS IS LEGACY

  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  // Note: Use get_groups_of_group with query filter

  const { group_id } = req.params;

  if (!group_id) throw createHttpError(400, "Group ID not defined");

  const session = driver.session();

  const query = `
    MATCH (group:Group {_id: $group_id})
    WITH group as parent
    // Match children that only have a direct connection to parent
    OPTIONAL MATCH (parent)<-[:BELONGS_TO]-(group:Group)
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent)

    RETURN collect(group) as groups, parent
    `;

  const params = { group_id };

  try {
    const { records } = await session.run(query, params);
    if (!records.length)
      throw createHttpError(400, `Parent group ${group_id} not found`);
    const groups = records[0].get("groups");
    res.send(groups);
    console.log(`Direct subgroups of group ${group_id} queried (LEGACY)`);
  } catch (e) {
    next(e);
  } finally {
    session.close();
  }
};

export const get_top_level_groups = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // This is legacy

  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  // TODO; Should Top level should be a parameter of GET groups

  const session = driver.session();

  try {
    const { records } = await session.run(
      `
    MATCH (group:Group)

    // That do not belong to any group
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)

    // NOT SURE WHY DISTINCT NEEDED
    RETURN DISTINCT(group)
    `,
      {},
    );
    const groups = records.map((record) => record.get("group"));
    res.send(groups);
    console.log(`Top level groups queried (LEGACY)`);
  } catch (e) {
    next(e);
  } finally {
    session.close();
  }
};

export const get_top_level_official_groups = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // This is legacy

  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  const session = driver.session();

  try {
    const { records } = await session.run(
      `
    MATCH (group:Group)

    // That do not belong to any official group
    WHERE NOT (group)-[:BELONGS_TO *1..]->(:Group {official: true})
      AND group.official

    // USED TO BE DISTINCT
    RETURN group
    `,
      {},
    );
    const groups = records.map((record) => record.get("group"));
    res.send(groups);
    console.log(`Top level official groups queried (LEGACY)`);
  } catch (e) {
    next(e);
  } finally {
    session.close();
  }
};

export const get_top_level_non_official_groups = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // This is legacy

  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)
  const session = driver.session();

  try {
    const { records } = await session.run(
      `
    MATCH (group:Group)

    // That do not belong to any group
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)
      AND ( group.official IS NULL OR NOT group.official )

    // USED TO BE DISTINCT
    RETURN group
    `,
      {},
    );
    const groups = records.map((record) => record.get("group"));
    res.send(groups);
    console.log(`Top level nonofficial groups queried (LEGACY)`);
  } catch (e) {
    next(e);
  } finally {
    session.close();
  }
};
