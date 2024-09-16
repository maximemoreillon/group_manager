import { NextFunction, Request, Response, Router } from "express"
import legacyAuth from "@moreillon/express_identification_middleware"
import oidcAuth from "@moreillon/express-oidc"
import { OIDC_JWKS_URI, IDENTIFICATION_URL } from "./config"

export const useMiddleware = (router: Router) => {
  if (IDENTIFICATION_URL) {
    console.log(`[Auth] Legacy auth enabled with URL: ${IDENTIFICATION_URL}`)
    router.use(legacyAuth({ url: IDENTIFICATION_URL, lax: !!OIDC_JWKS_URI }))
  }

  if (OIDC_JWKS_URI) {
    console.log(`[Auth] OIDC auth enabled with JWKS URI: ${OIDC_JWKS_URI}`)
    if (IDENTIFICATION_URL) {
      const wrappingMiddleware = (
        req: Request,
        res: Response,
        next: NextFunction
      ) => {
        // Do nothing if already identified from previous middleware

        if (res.locals.user) return next()
        if (!OIDC_JWKS_URI) return next()

        oidcAuth({ jwksUri: OIDC_JWKS_URI })(req, res, next)
      }

      router.use(wrappingMiddleware)
    } else {
      router.use(
        oidcAuth({
          jwksUri: OIDC_JWKS_URI,
        })
      )
    }
  }
}
