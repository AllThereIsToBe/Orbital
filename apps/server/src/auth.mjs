import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { AUTH_SECRET } from "./config.mjs";

const base64url = (value) => Buffer.from(value).toString("base64url");
const unbase64url = (value) => Buffer.from(value, "base64url").toString("utf8");

export const createSalt = () => randomBytes(16).toString("hex");
export const hashPassword = (password, salt) =>
  scryptSync(password, salt, 64).toString("hex");

export const passwordsMatch = (password, salt, expectedHash) => {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const sign = (payload) =>
  createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");

export const createAuthToken = (user) => {
  const payload = JSON.stringify({
    sub: user.id,
    username: user.username,
    exp: Date.now() + 14 * 86_400_000
  });

  const encoded = base64url(payload);
  return `${encoded}.${sign(encoded)}`;
};

export const verifyAuthToken = (token) => {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  const actual = sign(encoded);
  const actualBuffer = Buffer.from(actual, "utf8");
  const signatureBuffer = Buffer.from(signature || "", "utf8");

  if (
    actualBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(actualBuffer, signatureBuffer)
  ) {
    return null;
  }

  let payload;

  try {
    payload = JSON.parse(unbase64url(encoded));
  } catch {
    return null;
  }

  if (payload.exp < Date.now()) {
    return null;
  }

  return payload;
};

export const readBearerToken = (request) => {
  const header = request.headers.authorization || request.headers.Authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
};
