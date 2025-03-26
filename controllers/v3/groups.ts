import createHttpError from "http-errors";
import { drivers } from "../../db";
import { DEFAULT_BATCH_SIZE } from "../../config";
import {
  get_current_user_id,
  batch_items,
  format_batched_response,
  getCypherUserIdentifiers,
} from "../../utils";
import { Request, Response, NextFunction } from "express";

const driver = drivers.v2;

export const create_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Create a group
  // TODO: validation with joi

  const user_id = get_current_user_id(req, res);
  const { name } = req.body;
  if (!name) throw createHttpError(400, `Missing group name`);

  const session = driver.session();

  const query = `
    // Create the group
    CREATE (group:Group)
    SET group.name = $name
    SET group._id = randomUUID() // IMPORTANT

    // Create relationships
    WITH group
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}
    CREATE (group)-[:ADMINISTRATED_BY]->(user)
    CREATE (group)-[creation:CREATED_BY]->(user)
    CREATE (group)<-[:BELONGS_TO]-(user)

    // Setting creation relationship properties
    SET creation.date = date()

    RETURN properties(group) as group
    `;

  session
    .run(query, { user_id, name })
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(500, `Error while creating group ${name}`);
      const group = records[0].get("group");
      res.send(group);
      console.log(
        `User ${get_current_user_id(req, res)} created group ${group._id}`
      );
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};

export const read_groups = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Queries: official vs non official, top level vs normal, type

  // WARNING: Querying top level official groups means groups whith no parent THAT ARE OFFICIAL
  // WARNING: Some query parameters might be string instead of boolean

  // Shallow: only groups that are not part of another group

  const { parent_id, subgroup_id } = req.params;

  const {
    batch_size = DEFAULT_BATCH_SIZE,
    start_index = 0,
    shallow, // Only query top level groups
    direct,
    official,
    nonofficial,
    search,
    ...filters
  } = req.query;

  const filtering_query = `
    UNWIND KEYS($filters) as filterKey
    WITH filterKey
    // NOTE: This MATCH overrides the previous
    OPTIONAL MATCH (group:Group)
    WHERE group[filterKey] = $filters[filterKey]
    `;

  const as_parent_query = `AND (group)<-[:BELONGS_TO]-(:Group {_id: $subgroup_id})`;
  const as_subgroup_query = `AND (group)-[:BELONGS_TO]->(:Group {_id: $parent_id})`;

  // TODO: There must be a simpler way to do this
  const direct_query = `
    ${
      parent_id
        ? "AND NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(:Group {_id: $parent_id})"
        : ""
    }
    ${
      subgroup_id
        ? "AND NOT (:Group {_id: $subgroup_id})-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(group)"
        : ""
    }
  `;

  const shallow_query = "AND NOT (group)-[:BELONGS_TO]->(:Group)";

  const official_query = "AND group.official";
  const non_official_query =
    "AND (group.official IS NULL OR NOT group.official)";

  const search_query =
    "AND toLower(toString(group.name)) CONTAINS toLower($search) ";

  const query = `
    ${
      Object.keys(filters).length
        ? filtering_query
        : "OPTIONAL MATCH (group:Group) WHERE group._id IS NOT NULL"
    }    
    ${parent_id ? as_subgroup_query : ""}
    ${subgroup_id ? as_parent_query : ""}
    ${direct ? direct_query : ""}
    ${shallow ? shallow_query : ""}
    ${official ? official_query : ""}
    ${nonofficial ? non_official_query : ""}
    ${search ? search_query : ""}
    
    // Renaming as item for universal batching function
    WITH group as item
    ${batch_items(batch_size as number)}
    `;

  const params = {
    batch_size,
    start_index,
    parent_id,
    subgroup_id,
    filters,
    search,
  };

  const session = driver.session();
  session
    .run(query, params)
    .then(({ records }) => {
      const response = format_batched_response(records);
      res.send(response);
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};

export const read_group = (req: Request, res: Response, next: NextFunction) => {
  const { group_id } = req.params;
  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined");

  const query = `MATCH (group:Group {_id: $group_id}) RETURN properties(group) as group`;
  const params = { group_id };

  const session = driver.session();
  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(404, `Group ${group_id} not found`);
      res.send(records[0].get("group"));
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};

export const update_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { group_id } = req.params;
  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined");

  const user_id = get_current_user_id(req, res);

  const properties = req.body;

  // TODO: Have this list in an external file
  let customizable_fields = ["avatar_src", "name", "restricted"];

  const current_user = res.locals.user;
  const current_user_is_admin =
    current_user.isAdmin || current_user.properties?.isAdmin;

  // Allow master admin to make groups officials
  // TODO: improve concatenation
  if (current_user_is_admin) customizable_fields.push("official");

  // prevent user from modifying disallowed properties
  // TODO: could be achieved using JOI
  for (let [key, value] of Object.entries(properties)) {
    if (!customizable_fields.includes(key)) {
      delete req.body[key];
      // TODO: forbid changes
      throw createHttpError(403, `Not allowed to modify property ${key}`);
    }
  }

  const session = driver.session();

  const query = `
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}

    WITH user
    MATCH (group:Group {_id: $group_id})
    // Only allow group admin or super admin
    WHERE ( (group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    // Patch properties
    // += implies update of existing properties
    SET group += $properties

    RETURN properties(group) as group
    `;

  const params = {
    user_id,
    group_id,
    properties,
  };

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(400, `Error patching group ${group_id}`);
      console.log(`User ${user_id} patched group ${group_id}`);
      const group = records[0].get("group");
      res.send(group);
    })
    .catch(next)
    .finally(() => session.close());
};

export const delete_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { group_id } = req.params;
  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined");

  const user_id = get_current_user_id(req, res);

  const { deep } = req.query;

  const deep_delete_query = `
    WITH group
    OPTIONAL MATCH (subgroup:Group)-[:BELONGS_TO]->(group)
    DETACH DELETE subgroup
  `;

  const query = `
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}
    WITH user
    MATCH (group:Group {_id: $group_id})

    // Only allow group admin or super admin
    WHERE ( (group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    ${deep === "true" ? deep_delete_query : ""}

    // Delete the group
    DETACH DELETE group

    RETURN $group_id as group_id
    `;

  const session = driver.session();

  session
    .run(query, { user_id, group_id })
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(404, `Group ${group_id} not found`);
      console.log(`User ${user_id} deleted group ${group_id}`);
      res.send({ group_id });
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};

export const add_group_to_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to make a group join a group
  // Can only be done if user is admin of both groups

  const { parent_id } = req.params;
  const subgroup_id = req.params.subgroup_id || req.body.group_id;

  if (!parent_id || parent_id === "undefined")
    throw createHttpError(400, "Parent group ID not defined");
  if (!subgroup_id || subgroup_id === "undefined")
    throw createHttpError(400, "Child group ID not defined");

  const user_id = get_current_user_id(req, res);

  const session = driver.session();

  const query = `
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}

    // Find child group
    WITH user
    MATCH (child_group:Group)

    // Allow only group admin or super admin to delete a group
    WHERE child_group._id = $subgroup_id
      AND ( (child_group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    // Find the parent group
    WITH child_group, user
    MATCH (parent_group:Group)
    WHERE parent_group._id = $parent_id
      AND ( (parent_group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

      // Prevent cyclic graphs (NOT WORKING)
      AND NOT (parent_group)-[:BELONGS_TO]->(child_group)
      AND NOT (parent_group)-[:BELONGS_TO *1..]->(:Group)-[:BELONGS_TO]->(child_group)

      // Prevent self group
      AND NOT id(parent_group)=id(child_group)

    // MERGE relationship
    MERGE (child_group)-[:BELONGS_TO]->(parent_group)

    // Return
    RETURN properties(child_group) as child_group
    `;

  const params = { user_id, parent_id, subgroup_id };

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(
          400,
          `Failed to add group ${subgroup_id} in ${parent_id}`
        );
      console.log(
        `User ${user_id} added group ${subgroup_id} to group ${parent_id}`
      );
      const child_group = records[0].get("child_group");
      res.send(child_group);
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};

export const remove_group_from_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to make a user join a group

  // TODO: Should the user be admin of child group?

  const { parent_id, subgroup_id } = req.params;

  if (!parent_id || parent_id === "undefined")
    throw createHttpError(400, "Parent group ID not defined");
  if (!subgroup_id || subgroup_id === "undefined")
    throw createHttpError(400, "Child group ID not defined");

  const user_id = get_current_user_id(req, res);

  const session = driver.session();

  const query = `
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}

    // Find the child group group
    WITH user
    MATCH (child_group:Group)

    // Allow only group admin or super admin to remove a group
    WHERE child_group._id = $subgroup_id
      AND ( (child_group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    // Find the parent group
    WITH child_group, user
    MATCH (child_group)-[r:BELONGS_TO]->(parent_group:Group)
    WHERE parent_group._id = $parent_id
      AND ( (parent_group)-[:ADMINISTRATED_BY]->(user) OR user.isAdmin )

    // delete relationship
    DELETE r

    // Return
    RETURN properties(child_group) as child_group
  `;

  const params = {
    user_id,
    parent_id,
    subgroup_id,
  };

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(
          400,
          `Failed to remove group ${subgroup_id} from group ${parent_id}`
        );
      console.log(
        `User ${user_id} removed group ${subgroup_id} from group ${parent_id}`
      );
      const subgroup = records[0].get("child_group");
      res.send(subgroup);
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};
