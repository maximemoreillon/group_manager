import { drivers } from "../../db"
import createHttpError from "http-errors"
import { Request, Response, NextFunction } from "express"

const driver = drivers.v1

export const create_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("Deprecated")
}

export const get_group = (req: Request, res: Response, next: NextFunction) => {
  const group_id = req.params.group_id || req.query.id || req.query.group_id

  const session = driver.session()

  const query = `
    MATCH (group:Group {_id: $group_id})
    RETURN group
    `

  session
    .run(query, { group_id })
    .then(({ records }) => {
      // NOTE: Not too sure about sendig only one record
      // How about sending all records and let the front end deal with it?
      if (!records.length) throw createHttpError(404, "Not found")
      res.send(records[0].get("group"))
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_top_level_groups = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)

  const session = driver.session()
  const query = `
    MATCH (group:Group)
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)
    RETURN DISTINCT(group)
    `

  session
    .run(query, {})
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_top_level_official_groups = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)

  const session = driver.session()

  const query = `
    // Find groups
    MATCH (group:Group)

    // That do not belong to any group
    // Not sure what *1.. is for anymore
    WHERE NOT (group)-[:BELONGS_TO *1..]->(:Group {official: true})
      AND group.official

    // NOT SURE WHY DISTINCT NEEDED
    RETURN DISTINCT(group)
    `
  session
    .run(query, {})
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_top_level_non_official_groups = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)

  const session = driver.session()

  const query = `
    MATCH (group:Group)
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)
      AND (group.official IS NULL OR NOT group.official)

    RETURN DISTINCT(group)
    `
  session
    .run(query, {})
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_groups_directly_belonging_to_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve the top level groups (i.e. groups that don't belong to any other group)

  const group_id = req.query.id ?? req.query.group_id ?? req.params.group_id

  if (!group_id) throw createHttpError(400, "Group ID not defined")

  const session = driver.session()

  const query = `
    MATCH (group:Group {_id: $group_id})
    WITH group as parent_group
    MATCH (parent_group)<-[:BELONGS_TO]-(group:Group)
    WHERE NOT (group)-[:BELONGS_TO]->(:Group)-[:BELONGS_TO]->(parent_group)

    // DISTINCT JUST IN CASE
    RETURN DISTINCT(group)
    `

  session
    .run(query, { group_id })
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_parent_groups_of_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve groups inside a group

  const subgroup_id = req.params.group_id ?? req.query.id ?? req.query.group_id

  if (!subgroup_id) throw createHttpError(400, "Group ID not defined")

  const session = driver.session()

  const query = `
    MATCH (group:Group {_id: $group_id})
    WITH group as child
    MATCH (child)-[:BELONGS_TO]->(group:Group)
    RETURN group
    `

  const params = { group_id: subgroup_id }
  session
    .run(query, params)
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const get_groups_of_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Route to retrieve groups inside a group

  const group_id =
    req.query.id ?? req.query.group_id ?? req.params.group_id ?? req.params.id

  const session = driver.session()

  const query = `
    MATCH (group:Group {_id: $group_id})
    WITH group as parent
    MATCH (group:Group)-[:BELONGS_TO]->(parent)
    RETURN group
    `

  session
    .run(query, { group_id })
    .then((result) => {
      res.send(result.records)
    })
    .catch(next)
    .finally(() => {
      session.close()
    })
}

export const add_group_to_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("deprecated")
}

export const remove_group_from_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("deprecated")
}

export const delete_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("Deprecated")
}

export const join_group = (req: Request, res: Response, next: NextFunction) => {
  res.status(410).send("Deprecated")
}

export const leave_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("Deprecated")
}

export const patch_group = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(410).send("deprecated")
}
