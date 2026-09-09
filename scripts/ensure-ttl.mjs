/**
 * 보관 기간 TTL 인덱스를 운영 DB 에 만든다 — 방침 5항의 숫자가 실제로 지켜지게.
 *
 *   node scripts/ensure-ttl.mjs          드라이런 — 지금 인덱스와 할 일을 보여 준다
 *   node scripts/ensure-ttl.mjs --apply  실제로 만든다
 *
 * 각 앱의 Mongoose 스키마에도 같은 인덱스가 선언돼 있다(autoIndex). 그런데
 * `openai_request_logs` 에는 예전 단일 인덱스 `createdAt_1` 이 있고, TTL 인덱스는 키가
 * 같으면 만들 수 없다(IndexKeySpecsConflict). autoIndex 는 이 충돌을 조용히 넘기므로
 * **여기서 옛 인덱스를 지우고 TTL 을 만든다.** 정렬은 `createdAt_-1_kind_1` 이 대신한다.
 *
 * | DB    | 컬렉션              | 기준           | 기간   |
 * |-------|---------------------|----------------|--------|
 * | vocab · math · fit | openai_request_logs | createdAt  | 90일  |
 * | vocab · math       | applicants          | createdAt  | 1년   |
 * | vocab · math · fit | inquiries           | answeredAt (status: answered 만) | 1년 |
 * | user               | login_attempts      | expiresAt  | 즉시  |
 *
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 8번
 */
import fs from "node:fs";
import mongoose from "mongoose";

/* dotenv 없이 .env.local 을 읽는다 — 값은 출력하지 않는다 */
const CRLF = new RegExp("\\r?\\n");
for (const line of fs.readFileSync(".env.local", "utf8").split(CRLF)) {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const APPLY = process.argv.includes("--apply");
const DAY = 24 * 3600;

const PLAN = [
  ...["vocab", "math", "fit"].map((db) => ({ db, coll: "openai_request_logs", drop: ["createdAt_1"], key: { createdAt: 1 }, opts: { expireAfterSeconds: 90 * DAY, name: "ttl_createdAt_90d" } })),
  ...["vocab", "math"].map((db) => ({ db, coll: "applicants", drop: [], key: { createdAt: 1 }, opts: { expireAfterSeconds: 365 * DAY, name: "ttl_createdAt_1y" } })),
  ...["vocab", "math", "fit"].map((db) => ({ db, coll: "inquiries", drop: [], key: { answeredAt: 1 }, opts: { expireAfterSeconds: 365 * DAY, partialFilterExpression: { status: "answered" }, name: "ttl_answered_1y" } })),
  { db: process.env.MONGO_USER_DB || "user", coll: "login_attempts", drop: [], key: { expiresAt: 1 }, opts: { expireAfterSeconds: 0, name: "expiresAt_1" } },
];

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
for (const p of PLAN) {
  const coll = mongoose.connection.useDb(p.db, { useCache: true }).collection(p.coll);
  let existing = [];
  try { existing = await coll.indexes(); } catch { /* 컬렉션이 아직 없음 */ }
  const names = existing.map((i) => i.name);
  const has = existing.find((i) => i.name === p.opts.name);
  const toDrop = p.drop.filter((n) => names.includes(n));
  const line = `${p.db}.${p.coll}: ${has ? "TTL 있음" : "TTL 없음"}${toDrop.length ? ` · 지울 옛 인덱스 ${toDrop.join(",")}` : ""}`;
  if (!APPLY) { console.log("[dry]", line); continue; }
  for (const n of toDrop) { await coll.dropIndex(n); console.log(`  dropped ${p.db}.${p.coll}.${n}`); }
  if (!has) { await coll.createIndex(p.key, p.opts); console.log(`  created ${p.db}.${p.coll}.${p.opts.name}`); }
  else console.log(`  ok      ${p.db}.${p.coll}.${p.opts.name}`);
}
await mongoose.disconnect();
console.log(APPLY ? "done" : "드라이런입니다. 실제로 만들려면 --apply");
