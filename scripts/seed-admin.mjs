/**
 * 마스터 관리자를 세운다.
 *
 *   node scripts/seed-admin.mjs            현재 상태만 보여준다
 *   node scripts/seed-admin.mjs --run      2xteam@naver.com 을 마스터로 세운다
 *
 * 마스터는 **이 스크립트로만** 만든다. admin API로 마스터를 세울 수 있게 두면
 * 운영자 한 명만 뚫려도 마스터가 늘어난다. 운영자는 마스터가 화면에서 세운다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** `.env.local` 을 읽어 process.env 에 채운다 (Next 밖에서 도는 스크립트용) */
function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) throw new Error(".env.local 이 없습니다.");
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    if (!(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
  }
}

loadEnv();

const MASTER_EMAIL = "2xteam@naver.com";
const RUN = process.argv.includes("--run");
const USER_DB = process.env.MONGO_USER_DB || "user";

const mask = (e) => (typeof e === "string" ? e.replace(/^(.{2}).*?(@.*)$/, "$1***$2") : "-");

async function main() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 25000 });
  await client.connect();
  const users = client.db(USER_DB).collection("users");

  console.log("\n== 현재 관리자 ==");
  const current = await users.find({ adminRole: { $in: ["master", "operator"] } }).toArray();
  if (current.length === 0) console.log("  (없음)");
  for (const u of current) {
    console.log(`  [${u.adminRole}] ${u.nickname ?? u.name} ${mask(u.email)}`);
  }

  const target = await users.findOne({ email: MASTER_EMAIL });
  console.log("\n== 마스터 대상 ==");
  if (!target) {
    console.log(`  ⚠ ${mask(MASTER_EMAIL)} 계정이 없습니다.`);
    console.log("    포털에서 이 이메일로 먼저 가입한 뒤 다시 실행하세요.");
    await client.close();
    return;
  }
  console.log(`  ${target.nickname ?? target.name} ${mask(target.email)} (${target._id})`);
  console.log(`  현재 권한: ${target.adminRole ?? "없음"}`);

  if (target.adminRole === "master") {
    console.log("\n  이미 마스터입니다. 할 일이 없습니다.");
    await client.close();
    return;
  }

  if (!RUN) {
    console.log("\n실제로 세우려면 --run 을 붙여 다시 실행하세요.");
    await client.close();
    return;
  }

  await users.updateOne({ _id: target._id }, { $set: { adminRole: "master" } });
  console.log("\n  ✓ 마스터로 세웠습니다.");

  const after = await users.countDocuments({ adminRole: "master" });
  console.log(`  마스터 계정 수: ${after}`);
  if (after > 1) console.log("  ⚠ 마스터가 둘 이상입니다. 의도한 것인지 확인하세요.");

  await client.close();
}

main().catch((e) => {
  console.error("실패:", e);
  process.exit(1);
});
