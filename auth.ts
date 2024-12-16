import { NextFunction, Request, Response, Router } from "express"
import legacyAuth from "@moreillon/express_identification_middleware"
import oidcAuth from "@moreillon/express-oidc"
import { OIDC_JWKS_URI, IDENTIFICATION_URL } from "./config"

export const registerAuthMiddleware = (router: Router) => {
  if (IDENTIFICATION_URL) {
    console.log(`[Auth] Legacy auth enabled with URL: ${IDENTIFICATION_URL}`)
    router.use(legacyAuth({ url: IDENTIFICATION_URL, lax: !!OIDC_JWKS_URI }))
  }

  if (OIDC_JWKS_URI) {
    console.log(`[Auth] OIDC auth enabled with JWKS URI: ${OIDC_JWKS_URI}`)

    const oidcMiddleware = oidcAuth({ jwksUri: OIDC_JWKS_URI })

    if (IDENTIFICATION_URL) {
      console.log(`[Auth] Both Legacy and OIDC auth are enabled`)
      const wrappingMiddleware = (
        req: Request,
        res: Response,
        next: NextFunction
      ) => {
        // Do nothing if user already identified from previous middleware

        if (res.locals.user) return next()
        if (!OIDC_JWKS_URI) return next()

        oidcMiddleware(req, res, next)
      }

      router.use(wrappingMiddleware)
    }
    // If just OIDC, register as usual
    else {
      router.use(oidcMiddleware)
    }
  }
}
