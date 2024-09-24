import { NextFunction, Request, Response, Router } from "express"
import legacyAuth from "@moreillon/express_identification_middleware"
import oidcAuth from "@moreillon/express-oidc"
import { OIDC_JWKS_URI, IDENTIFICATION_URL } from "./config"

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (IDENTIFICATION_URL) {
    await new Promise((resolve) =>
      legacyAuth({ url: IDENTIFICATION_URL, lax: !!OIDC_JWKS_URI })(
        req,
        res,
        resolve
      )
    )

    if (res.locals.user) return next()
  }

  if (OIDC_JWKS_URI) oidcAuth({ jwksUri: OIDC_JWKS_URI })(req, res, next)

  if (!IDENTIFICATION_URL && !OIDC_JWKS_URI) {
    console.error(`Authentication not configured`)
    res.status(500).send(`Authentication not configured`)
  }
}
