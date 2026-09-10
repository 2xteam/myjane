/**
 * 네이버 로그인 검수용 "제공 정보 활용처" 증빙 이미지 (2026-09-10).
 *
 *   사전: 포털 verify 서버(3010) · fitlog verify 서버(3013) 가 떠 있어야 한다
 *   node scripts/naver-review-evidence.mjs   → docs/marketing/naver-review-evidence.png
 *
 * 검수자는 **이용자에게 보이는 화면**에서 이메일·이름이 쓰이는 모습을 요구한다. 관리자 화면 캡처는
 * 인정되지 않고(다른 회원 정보도 노출된다), 동의창 캡처도 반려 사유다. 그래서 실제 화면 셋을 찍어
 * 항목별 활용 목적을 붙인다 —
 *   ① /signup/social   네이버 프로필로 첫 가입 확인 — 이름(별칭) 칸에 네이버 이름, 이메일을 계정 이메일로
 *   ② /login           이메일이 로그인 아이디
 *   ③ fitlog /my       화면에 이름 표시
 * 첫 가입 화면은 `oauth_signup` 서명 쿠키를 여기서 만들어 넣는다(콜백이 하는 일과 같다).
 * playwright-core 는 klead 저장소의 것을 빌린다.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CRLF = new RegExp("\\r?\\n");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(CRLF)) {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const secret = process.env.SESSION_SECRET;
const b64 = (b) => Buffer.from(b).toString("base64url");
const hmacTag = (tag, body) => b64(crypto.createHmac("sha256", secret).update(`${tag}:${body}`).digest());
const signTagged = (tag, payload) => {
  const body = b64(JSON.stringify({ p: payload, exp: Math.floor(Date.now() / 1000) + 600 }));
  return `${body}.${hmacTag(tag, body)}`;
};
const hmac = (body) => b64(crypto.createHmac("sha256", secret).update(body).digest());
const signSession = (uid, u, sv = 0) => {
  const body = b64(JSON.stringify({ uid, u, exp: Math.floor(Date.now() / 1000) + 3600, sv }));
  return `${body}.${hmac(body)}`;
};

/* 네이버로 가입한 실제 회원(있으면) — 없으면 예시 값 */
const mongoose = createRequire(path.join(ROOT, "package.json"))("mongoose");
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
const users = mongoose.connection.useDb(process.env.MONGO_USER_DB || "user").collection("users");
const nv = await users.findOne({ "providers.provider": "naver" }, { projection: { _id: 1, userId: 1, sessionVersion: 1, name: 1, nickname: 1, email: 1 } });
await mongoose.disconnect();
const profile = {
  provider: "naver",
  providerId: "demo",
  email: nv?.email ?? "myjane.user@naver.com",
  emailVerified: true,
  name: nv?.nickname ?? nv?.name ?? "홍길동",
  picture: null,
};

const pw = createRequire("C:/Dev/klead/package.json")("playwright-core");
const browser = await pw.chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 860 }, deviceScaleFactor: 2, locale: "ko-KR" });
/* 로그인 화면은 세션이 있으면 홈으로 튀므로 쿠키 없는 컨텍스트로 찍는다 */
const anon = await browser.newContext({ viewport: { width: 900, height: 860 }, deviceScaleFactor: 2, locale: "ko-KR" });
const cookies = [
  { name: "oauth_signup", value: encodeURIComponent(signTagged("signup", { profile, from: null, next: null })), domain: "localhost", path: "/", httpOnly: true },
];
if (nv) {
  const display = { v: 1, user: { id: String(nv._id), name: nv.nickname ?? nv.name ?? "", nickname: nv.nickname ?? "", userId: nv.userId, hasEmail: true }, expiresAt: Date.now() + 3600e3 };
  cookies.push(
    { name: "snap_session", value: encodeURIComponent(signSession(String(nv._id), nv.userId ?? "", nv.sessionVersion ?? 0)), domain: "localhost", path: "/", httpOnly: true },
    { name: "snap_auth", value: "1", domain: "localhost", path: "/" },
    { name: "snap_user", value: encodeURIComponent(JSON.stringify(display)), domain: "localhost", path: "/" },
  );
}
await ctx.addCookies(cookies);

const out = path.join(ROOT, "docs/marketing");
fs.mkdirSync(out, { recursive: true });
const page = await ctx.newPage();
const anonPage = await anon.newPage();
async function shot(url, file, waitText, pg = page) {
  await pg.goto(url, { waitUntil: "networkidle" });
  if (waitText) await pg.getByText(waitText, { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(600);
  const buf = await pg.screenshot({ type: "png", fullPage: false });
  fs.writeFileSync(path.join(out, file), buf);
  return buf.toString("base64");
}
const s1 = await shot("http://localhost:3010/signup/social", "_ev-signup.png", "가입 확인");
const s2 = await shot("http://localhost:3010/login", "_ev-login.png", "다시 만나요", anonPage);
const s3 = nv ? await shot("http://localhost:3013/my", "_ev-my.png", "님의") : null;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
<style>
 body{margin:0;background:#f7fbfb;font-family:Pretendard,sans-serif;color:#0f2027}
 .doc{width:1600px;padding:48px 56px;box-sizing:border-box}
 h1{margin:0 0 8px;font-size:30px} .sub{margin:0 0 30px;color:#566b70;font-size:16px;line-height:1.6}
 .grid{display:grid;grid-template-columns:repeat(${s3 ? 3 : 2},1fr);gap:24px}
 .card{background:#fff;border:1px solid #d5e3e5;border-radius:16px;overflow:hidden}
 .card img{display:block;width:100%;height:auto;border-bottom:1px solid #d5e3e5}
 .cap{padding:16px 18px;font-size:14px;line-height:1.6}
 .cap b{display:block;font-size:16px;margin-bottom:6px;color:#116271}
 .tag{display:inline-block;padding:2px 8px;border-radius:999px;background:#e8f2f3;color:#116271;font-weight:700;font-size:12px;margin-right:6px}
 table{width:100%;border-collapse:collapse;margin-top:28px;font-size:14px}
 th,td{border:1px solid #d5e3e5;padding:10px 14px;text-align:left;vertical-align:top;line-height:1.55}
 th{background:#e8f2f3;color:#116271;width:140px}
</style></head><body><div class="doc">
<h1>myjane — 네이버 로그인 제공 정보 활용처</h1>
<p class="sub">myjane(www.myjane.co.kr)은 이메일 하나로 여러 기록 서비스(FitLog·SnapWord·SnapNote·2hbk·TypeLog)를 쓰는 통합 계정입니다.
네이버 로그인에서 받은 <b>이메일</b>은 계정 식별자(로그인 아이디·비밀번호 찾기·안내 메일)로, <b>이름(별명)</b>은 서비스 화면에 표시되는 회원 이름으로 씁니다. 네이버 토큰은 저장하지 않습니다.</p>
<div class="grid">
 <div class="card"><img src="data:image/png;base64,${s1}"><div class="cap"><b>① 첫 가입 확인 화면 (/signup/social)</b><span class="tag">이름</span>네이버 이름이 "이름(별칭)" 칸에 미리 채워지고 회원 이름으로 저장됩니다.<br><span class="tag">이메일</span>네이버에서 확인된 이메일을 계정 이메일로 그대로 씁니다(인증 메일 생략).</div></div>
 <div class="card"><img src="data:image/png;base64,${s2}"><div class="cap"><b>② 로그인 화면 (/login)</b><span class="tag">이메일</span>이메일이 로그인 아이디입니다. 네이버로 가입한 뒤 이메일·비밀번호 찾기·비밀번호 재설정 메일도 이 주소로 갑니다.</div></div>
 ${s3 ? `<div class="card"><img src="data:image/png;base64,${s3}"><div class="cap"><b>③ 서비스 My 화면 (FitLog /my)</b><span class="tag">이름</span>"OO님의 프로필" 처럼 회원 이름이 화면 곳곳에 표시되고, 기록·목표 화면에서 참가자 이름으로 쓰입니다.</div></div>` : ""}
</div>
<table>
 <tr><th>이메일</th><td>계정 식별자(로그인 아이디) · 비밀번호 찾기/재설정 및 이메일 인증 메일 발송 · 여섯 서비스 공통 계정 연결(동일 이메일 회원 자동 연결)</td></tr>
 <tr><th>이름(별명)</th><td>서비스 화면에 표시되는 회원 이름(My · 인사말 · 2hbk 목표 참가자 · 친구 목록) · 가입 확인 화면에서 미리 채움(수정 가능)</td></tr>
 <tr><th>저장하지 않는 것</th><td>네이버 액세스 토큰 · 프로필 사진 · 그 외 항목. 개인정보처리방침 4항에 명시 — https://www.myjane.co.kr/legal/privacy</td></tr>
</table>
</div></body></html>`;
const p2 = await ctx.newPage();
await p2.setViewportSize({ width: 1600, height: 1200 });
await p2.setContent(html, { waitUntil: "networkidle" });
await p2.evaluate(() => document.fonts.ready);
await p2.waitForTimeout(400);
const doc = await p2.$(".doc");
await doc.screenshot({ path: path.join(out, "naver-review-evidence.png"), type: "png" });
await browser.close();
for (const f of ["_ev-signup.png", "_ev-login.png", "_ev-my.png"]) fs.rmSync(path.join(out, f), { force: true });
console.log("saved docs/marketing/naver-review-evidence.png", nv ? "(네이버 회원 있음)" : "(예시 값)");
