import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = join(__dirname, "..");
export const DATA_DIR = join(SERVER_ROOT, "data");
export const UPLOADS_DIR = join(DATA_DIR, "uploads");
export const DB_PATH = join(DATA_DIR, "orbital.sqlite");
const SECRET_PATH = join(DATA_DIR, "auth-secret.txt");

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOADS_DIR, { recursive: true });

const readOrCreateSecret = () => {
  if (process.env.ORBITAL_AUTH_SECRET) {
    return process.env.ORBITAL_AUTH_SECRET;
  }

  if (existsSync(SECRET_PATH)) {
    return readFileSync(SECRET_PATH, "utf8").trim();
  }

  const secret = randomBytes(32).toString("hex");
  writeFileSync(SECRET_PATH, secret);
  return secret;
};

export const AUTH_SECRET = readOrCreateSecret();
export const PORT = Number(process.env.ORBITAL_PORT || 8787);
export const HOST = process.env.ORBITAL_HOST || "127.0.0.1";
