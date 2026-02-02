import { drivers } from "../../db";
import createHttpError from "http-errors";
import { Request, Response, NextFunction } from "express";

import {
  get_current_user_id,
  getCypherUserIdentifiers,
} from "../../utils";
import { defaultAdmins } from "../../config";

const driver = drivers.v2;

export const make_user_administrator_of_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { group_id } = req.params;
  const { user_id, user_ids } = req.body;

  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined");
  if (!user_id && !user_ids)
    throw createHttpError(400, "User ID(s) not defined");

  const current_user_id = get_current_user_id(req, res);

  const session = driver.session();

  const single_user_add_query = `
    WITH group
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}
    MERGE (user)<-[:ADMINISTRATED_BY]-(group)
    `;

  const multiple_user_add_query = `
    WITH group
    UNWIND
      CASE
        WHEN $user_ids = []
          THEN [null]
        ELSE $user_ids
      END AS user_id

    OPTIONAL MATCH (user:User)
    WHERE user_id IN ${getCypherUserIdentifiers("user")}
    WITH group, collect(user) as users
    FOREACH(user IN users | MERGE (user)<-[:ADMINISTRATED_BY]-(group))
    `;

  const query = `
    MATCH (current_user:User) WHERE $current_user_id IN ${getCypherUserIdentifiers(
    "current_user"
  )}

    WITH current_user
    MATCH (group:Group {_id: $group_id})
    // Allow only group admin or super admin to delete a group
    WHERE ( (group)-[:ADMINISTRATED_BY]->(current_user)
    OR ANY(admin IN $defaultAdmins
        WHERE admin IN ${getCypherUserIdentifiers("current_user")}
      )
    )
    // Create relationship for single user
    ${user_id ? single_user_add_query : ""}

    // OR multiple users at once
    ${user_ids ? multiple_user_add_query : ""}

    // Return
    RETURN properties(group) as group
    `;

  const params = { current_user_id, user_id, user_ids, group_id, defaultAdmins };

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(400, `Error adding user to administrators`);
      console.log(`User ${user_id ?? user_ids} added administrators to group ${group_id}`);
      res.send(records[0].get("group"));
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};

export const remove_user_from_administrators = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { group_id } = req.params;
  const { administrator_id: user_id } = req.params;

  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined");
  if (!user_id || user_id === "undefined")
    throw createHttpError(400, "Administrator ID not defined");

  const session = driver.session();

  const current_user_id = get_current_user_id(req, res);

  const query = `
    MATCH (current_user:User) WHERE $current_user_id IN ${getCypherUserIdentifiers(
    "current_user"
  )}

    WITH current_user
    MATCH (group:Group {_id: $group_id})
    WHERE ( (group)-[:ADMINISTRATED_BY]->(current_user) 
      OR ANY(admin IN $defaultAdmins
        WHERE admin IN ${getCypherUserIdentifiers("current_user")}
      )
    )

    WITH group
    MATCH (group)-[r:ADMINISTRATED_BY]->(user:User {_id: $user_id})

    DELETE r

    // Return
    RETURN properties(group) as group
    `;

  const params = {
    current_user_id,
    user_id,
    group_id,
    defaultAdmins,
  };

  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(400, `Error removing from administrators`);
      console.log(
        `User ${user_id} removed from administrators of group ${group_id}`
      );
      res.send(records[0].get("group"));
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};
