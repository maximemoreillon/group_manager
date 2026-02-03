import { drivers } from "../../db";
import { Request, Response, NextFunction } from "express";

import {
    getCypherUserIdentifiers,
} from "../../utils";
import { defaultAdmins } from "../../config";

const driver = drivers.v2;

export const get_system_admins = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (defaultAdmins.size === 0) {
        return res.send([]);
    }

    const session = driver.session();
    const identifiers = [...defaultAdmins];

    const query = `
    MATCH (user:User)
    WHERE ANY(identifier IN $identifiers
      WHERE identifier IN ${getCypherUserIdentifiers("user")}
    )
    RETURN properties(user) AS user
  `;

    try {
        const { records } = await session.run(query, {
            identifiers: identifiers,
        });

        const users = records.map(r => {
            const user = r.get("user");
            delete user.password_hashed;
            return user;
        });

        res.send(users);
    } catch (err) {
        next(err);
    } finally {
        await session.close();
    }
};
