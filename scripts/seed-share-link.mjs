/**
 * 공유형 링크 첫 항목을 넣는다 — TypeLog 러닝 성향 결과 공유 (2026-09-10).
 *
 *   node scripts/seed-share-link.mjs            드라이런
 *   node scripts/seed-share-link.mjs --apply    실제로 넣는다 (같은 url 이 있으면 건너뛴다)
 *
 * 이후 등록·수정은 admin(/admin/share)에서 한다. 이 스크립트는 첫 한 건을 위한 것이다.
 */
import fs from "node:fs";
import mongoose from "mongoose";

const CRLF = new RegExp("\\r?\\n");
for (const line of fs.readFileSync(".env.local", "utf8").split(CRLF)) {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const APPLY = process.argv.includes("--apply");

const doc = {
  title: "러닝 성향 · 나는 어떤 러너일까?",
  description: "TypeLog 러닝 성향 질문지예요. 친구가 나눈 결과를 보고, 로그인 없이 나도 바로 해볼 수 있어요.",
  url: "https://typelog.myjane.co.kr/r/orGgEBkFe2ZFZL-mOKrpYuny2htf239S",
  app: "typelog",
  emoji: "🏃",
  order: 0,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
const coll = mongoose.connection.useDb(process.env.MONGO_USER_DB || "user").collection("share_links");
const exists = await coll.findOne({ url: doc.url });
if (exists) console.log("이미 있음:", String(exists._id));
else if (!APPLY) console.log("[dry] 넣을 것:", doc.title, doc.url);
else {
  const r = await coll.insertOne(doc);
  console.log("넣었다:", String(r.insertedId));
}
await mongoose.disconnect();
