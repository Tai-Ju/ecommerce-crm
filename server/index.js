/* global Buffer, process */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import { createHmac, timingSafeEqual } from "node:crypto";

const ALLOWED = new Set([
  "crm3:partners",
  "crm3:partnersTrash",
  "crm3:interactions",
  "crm3:todos",
  "crm3:quotes",
  "crm3:goals",
  "crm3:playbook",
  "crm3:manifest",
  "crm3:incomes",
  "crm3:selfCosts",
]);

const JWT_TTL_SEC = Number(process.env.JWT_TTL_SEC) || 7 * 24 * 3600;

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function signJwt(payload, secret, ttlSec) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyJwt(token, secret) {
  if (typeof token !== "string" || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.sub || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const h = req.headers.authorization;
  return h?.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

function auth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET not configured" });
    return;
  }
  const payload = verifyJwt(getBearerToken(req), secret);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = payload;
  next();
}

function parseKey(req) {
  try {
    return decodeURIComponent(req.params.key);
  } catch {
    return null;
  }
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "crm";

if (!uri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

const client = new MongoClient(uri);
const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "PUT", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// 照片會被轉成 base64 存進 partners/kv，所以需要較大的 body 上限
app.use(express.json({ limit: "20mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");
  const expectedUser = process.env.AUTH_USERNAME;
  const expectedPass = process.env.AUTH_PASSWORD;
  const secret = process.env.JWT_SECRET;

  if (!expectedUser || !expectedPass || !secret) {
    res.status(500).json({ error: "Auth not configured" });
    return;
  }
  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPass)) {
    res.status(401).json({ error: "帳號或密碼錯誤" });
    return;
  }

  const token = signJwt({ sub: username }, secret, JWT_TTL_SEC);
  res.json({ token, expiresIn: JWT_TTL_SEC });
});

app.get("/api/auth/me", auth, (req, res) => {
  res.json({ username: req.user.sub });
});

app.get("/api/kv/:key", auth, async (req, res) => {
  const key = parseKey(req);
  if (!key || !ALLOWED.has(key)) {
    res.status(400).json({ error: "Invalid key" });
    return;
  }
  const col = client.db(dbName).collection("crm_kv");
  const doc = await col.findOne({ key });
  if (!doc) {
    res.status(404).end();
    return;
  }
  res.json(doc.value);
});

app.put("/api/kv/:key", auth, async (req, res) => {
  const key = parseKey(req);
  if (!key || !ALLOWED.has(key)) {
    res.status(400).json({ error: "Invalid key" });
    return;
  }
  const col = client.db(dbName).collection("crm_kv");
  await col.updateOne(
    { key },
    { $set: { key, value: req.body, updatedAt: new Date() } },
    { upsert: true },
  );
  res.status(204).end();
});

const port = Number(process.env.PORT) || 3000;

await client.connect();
await client.db(dbName).collection("crm_kv").createIndex({ key: 1 }, { unique: true });

app.listen(port, () => {
  console.log(`CRM API listening on ${port}`);
});
