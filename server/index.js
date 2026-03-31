/* global Buffer, process */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import { timingSafeEqual } from "node:crypto";

const ALLOWED = new Set([
  "crm3:partners",
  "crm3:interactions",
  "crm3:todos",
  "crm3:quotes",
  "crm3:goals",
  "crm3:playbook",
  "crm3:manifest",
  "crm3:incomes",
  "crm3:selfCosts",
]);

function safeEqualToken(a, b) {
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

function auth(req, res, next) {
  const expected = process.env.API_TOKEN;
  if (!expected) {
    res.status(500).json({ error: "API_TOKEN not configured" });
    return;
  }
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7).trim() : String(req.headers["x-api-token"] ?? "").trim();
  if (!safeEqualToken(token, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
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
    methods: ["GET", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Token"],
  }),
);
// 照片會被轉成 base64 存進 partners/kv，所以需要較大的 body 上限
app.use(express.json({ limit: "20mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
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
