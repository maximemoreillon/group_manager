import { NextFunction, Request, Response, Router } from "express";
import legacyAuth from "@moreillon/express_identification_middleware";
import oidcAuth from "@moreillon/express-oidc";
import { OIDC_JWKS_URI, IDENTIFICATION_URL } from "./config";

export const registerAuthMiddleware = (router: Router) => {
  if (!IDENTIFICATION_URL && !OIDC_JWKS_URI) {
    throw new Error(
      "[Auth] No authentication configured. Set IDENTIFICATION_URL or OIDC_JWKS_URI",
    );
  }

  if (IDENTIFICATION_URL && OIDC_JWKS_URI) {
    console.log(`[Auth] Both Legacy and OIDC auth are enabled`);

    const legacyMiddleware = legacyAuth({ url: IDENTIFICATION_URL });
    const oidcMiddleware = oidcAuth({ jwksUri: OIDC_JWKS_URI });

    router.use((req: Request, res: Response, next: NextFunction) => {
      // Route to the correct middleware based on the JWT header's kid field.
      // Legacy JWTs never carry a kid; OIDC JWTs always do (required for JWKS
      // key lookup). This lets us avoid running both middlewares on every request.
      const token = req.headers.authorization?.split(" ")[1];
      let hasKid = false;

      if (token) {
        try {
          const header = JSON.parse(
            Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
          );
          hasKid = !!header.kid;
        } catch {
          // Malformed token — let the selected middleware produce the error
        }
      }

      if (hasKid) {
        oidcMiddleware(req, res, next);
      } else {
        legacyMiddleware(req, res, next);
      }
    });
  } else if (IDENTIFICATION_URL) {
    console.log(`[Auth] Legacy auth enabled with URL: ${IDENTIFICATION_URL}`);
    router.use(legacyAuth({ url: IDENTIFICATION_URL }));
  } else if (OIDC_JWKS_URI) {
    console.log(`[Auth] OIDC auth enabled with JWKS URI: ${OIDC_JWKS_URI}`);
    router.use(oidcAuth({ jwksUri: OIDC_JWKS_URI }));
  }
};
