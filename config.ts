export const {
  DEFAULT_BATCH_SIZE = 100,
  USER_IDENTIFIERS,
  APP_PORT = 80,
} = process.env

const additionalUseridentifiers = USER_IDENTIFIERS?.split(",") ?? []
export const userIdentifiers = ["_id", ...additionalUseridentifiers]
