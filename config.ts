export const {
  DEFAULT_BATCH_SIZE = 100,
  APP_PORT = 80,
  IDENTIFICATION_URL,
  OIDC_JWKS_URI,
  DB_USER_ID_FIELDS,
  AUTH_USER_ID_FIELDS,
} = process.env

const additionalDbUseridentifiers = DB_USER_ID_FIELDS?.split(",") ?? []
export const dbUserIdentifiers = ["_id", ...additionalDbUseridentifiers]

export const authUseridentifiers = AUTH_USER_ID_FIELDS?.split(",") ?? []
