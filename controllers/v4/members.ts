import createHttpError from "http-errors";
import { drivers } from "../../db";
import { Request, Response, NextFunction } from "express";

import { defaultAdmins } from "../../config";
import {
  get_current_user_id,
  getCypherUserIdentifiers,
} from "../../utils";

const driver = drivers.v2;

export const add_member_to_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const current_user_id = get_current_user_id(req, res);

  const { group_id } = req.params;
  let { user_id, user_ids } = req.body;
  if (user_id === "self") user_id = current_user_id;
  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined");
  if (!user_id && !user_ids)
    throw createHttpError(400, "User ID(s) not defined");

  const session = driver.session();

  const join_possible_check = `
    // Allow user to join unrestricted groups even if not admin
    OR (
      $user_id = $current_user_id 
      AND ( group.restricted IS NULL OR NOT group.restricted )
    )`;

  const single_user_add_query = `
    
    WITH group
    MATCH (user:User) WHERE $user_id IN ${getCypherUserIdentifiers("user")}
    MERGE (user)-[:BELONGS_TO]->(group)
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
    FOREACH(user IN users | MERGE (user)-[:BELONGS_TO]->(group))
    `;

  const query = `
    MATCH (current_user:User) WHERE $current_user_id IN ${getCypherUserIdentifiers(
    "current_user"
  )}

    WITH current_user
    MATCH (group:Group {_id: $group_id})
    // Allow only group admin or super admin to manage group
    WHERE ( 
      (group)-[:ADMINISTRATED_BY]->(current_user)
      OR ANY(admin IN $defaultAdmins
        WHERE admin IN ${getCypherUserIdentifiers("current_user")}
      )
      // Allowing oneself to join if group is not restricted
      ${user_id ? join_possible_check : ""}
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
        throw createHttpError(
          400,
          `Error adding adding user(s) ${user_id || user_ids.join(", ")
          } to group ${group_id}`
        );

      console.log(
        `User ${current_user_id} added user(s) ${user_id || user_ids.join(", ")
        } to group ${group_id}`
      );

      const group = records[0].get("group");
      res.send(group);
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};

export const remove_user_from_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const current_user_id = get_current_user_id(req, res);

  let { group_id, member_id: user_id } = req.params;
  if (user_id === "self") user_id = current_user_id;

  if (!group_id || group_id === "undefined")
    throw createHttpError(400, "Group ID not defined");
  if (!user_id) throw createHttpError(400, "User ID not defined");

  const session = driver.session();

  const query = `
    MATCH (current_user:User) WHERE $current_user_id IN ${getCypherUserIdentifiers(
    "current_user"
  )}

    WITH current_user
    MATCH (group:Group {_id: $group_id})
    WHERE ( 
      (group)-[:ADMINISTRATED_BY]->(current_user) 
      OR ANY(admin IN $defaultAdmins
        WHERE admin IN ${getCypherUserIdentifiers("current_user")}
      )
      // Allow oneself to leave group
      OR $user_id = $current_user_id 
    )
    
    WITH group
    MATCH (user:User)-[r:BELONGS_TO]->(group) WHERE $user_id IN ${getCypherUserIdentifiers(
    "user"
  )}

    DELETE r

    RETURN properties(group) as group
    `;

  const params = { current_user_id, user_id, group_id, defaultAdmins };
  console.log("here", params)
  session
    .run(query, params)
    .then(({ records }) => {
      if (!records.length)
        throw createHttpError(
          400,
          `Error removing using ${user_id} from group ${group_id}`
        );
      console.log(
        `User ${current_user_id} removed user ${user_id} from group ${group_id}`
      );

      const group = records[0].get("group");
      res.send(group);
    })
    .catch(next)
    .finally(() => {
      session.close();
    });
};
