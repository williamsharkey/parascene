import { expressjwt } from "express-jwt";

const COOKIE_NAME = "ps_session";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret() {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}

function authMiddleware() {
  return expressjwt({
    secret: getJwtSecret(),
    algorithms: ["HS256"],
    credentialsRequired: false,
    requestProperty: "auth",
    getToken: (req) => req.cookies?.[COOKIE_NAME]
  });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_MS
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export { COOKIE_NAME, getJwtSecret, authMiddleware, setAuthCookie, clearAuthCookie };
