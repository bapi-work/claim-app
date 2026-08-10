import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET || "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

export interface TokenPayload {
  sub: string;
  role: string;
}

interface AccessTokenClaims extends TokenPayload {
  typ: "access";
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, typ: "access" }, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

// Only accepts tokens minted by signAccessToken — rejects the 2FA challenge token below even
// though both are signed with the same secret, so a challenge token can never be used to skip 2FA.
export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, ACCESS_SECRET) as AccessTokenClaims;
  if (payload.typ !== "access") {
    throw new Error("Not an access token");
  }
  return payload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}

export interface TwoFactorChallengePayload {
  sub: string;
  typ: "2fa-challenge";
}

// Short-lived, single-purpose token issued after password check when 2FA is enabled.
export function signTwoFactorChallenge(userId: string): string {
  return jwt.sign({ sub: userId, typ: "2fa-challenge" }, ACCESS_SECRET, { expiresIn: "5m" });
}

export function verifyTwoFactorChallenge(token: string): TwoFactorChallengePayload {
  const payload = jwt.verify(token, ACCESS_SECRET) as TwoFactorChallengePayload;
  if (payload.typ !== "2fa-challenge") {
    throw new Error("Invalid challenge token");
  }
  return payload;
}
