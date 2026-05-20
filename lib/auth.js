import crypto from "node:crypto";

const COOKIE_NAME = "port_ledger_auth";
const PASSWORD = process.env.SCAN_PASSWORD || "admin123";
const SECRET = process.env.AUTH_SECRET || "dev-port-ledger-secret";

export function isAuthenticated(cookieStore) {
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function verifyPassword(password) {
  const input = Buffer.from(String(password || ""));
  const expected = Buffer.from(PASSWORD);
  if (input.length !== expected.length) return false;
  return crypto.timingSafeEqual(input, expected);
}

export function setAuthCookie(response) {
  const payload = Buffer.from(JSON.stringify({ unlockedAt: Date.now() })).toString("base64url");
  response.cookies.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return response;
}

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}
