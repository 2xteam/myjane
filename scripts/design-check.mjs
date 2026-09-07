/**
 * 여섯 앱이 디자인 시스템을 지키고 있는지 검사한다.
 *
 *   npm run design:check
 *
 * 새 AI 세션이 다른 앱을 만지기 시작할 때 **가장 먼저 돌릴 것.**
 * 규칙을 글로만 적어두면 세션마다 놓친다. 실제로 그래서 다섯 앱에 원형 장식이
 * 남고, 금색이 글자로 쓰이고, 강조색 배경에 순수 검정이 얹혔다.
 *
 * 규칙과 이유는 → my-obsidian-vault / 20-Design/여섯 앱 디자인 시스템.md
 *
 * 종료 코드: 위반이 있으면 1. 고칠 수 없는 예외는 ALLOW 에 이유와 함께 적는다.
 */
import { readFile } from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = "C:/Dev";
const APPS = ["myjane", "SnapWord", "SnapNote", "fitlog", "2hbk", "typelog"];

/**
 * 검사에서 빼는 자리 — 브랜드 팔레트가 아닌 색이 들어 있다.
 * 새로 추가할 때는 **왜 예외인지** 함께 적는다.
 */
const ALLOW = [
  { match: "BouncingSmiley.tsx", why: "튀는 스마일리용 무지개색 배열" },
  { match: "vocabId", why: "단어 상세의 스마일리 무지개색 배열" },
  { match: "ThemeProvider.tsx", why: "커스텀 테마 기본값 — 사용자가 고르는 값" },
  { match: path.join("api", "auth"), why: "이메일 HTML — CSS 변수를 못 쓴다" },
  { match: "opengraph-image", why: "OG 이미지 — 런타임 CSS 가 없다" },
  { match: "palette.css", why: "생성 파일 — 원본은 design/palette.json" },
  { match: "admin.css", why: "포털 admin — 팔레트 별칭을 쓰는 별도 화면" },
];
const allowed = (p) => ALLOW.find((a) => p.includes(a.match));

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".next")) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

/**
 * 아직 못 고친 것 — **기준선**이다.
 *
 * 규칙 자체는 맞는데 고치려면 사용자 판단이 필요한 자리들이다.
 * 숫자를 박아두고 **늘어나면 실패**시킨다.
 * 0으로 만들 수 없다고 규칙을 지우면 다시 스며든다.
 *
 * 줄이는 방법 → my-obsidian-vault / 20-Design/여섯 앱 디자인 시스템.md
 */
const BASELINE = {
  "C 면적색을 글자로": {
    count: 46,
    why:
      "--danger 를 오류 문구에 쓰는 자리. --danger-ink 로 바꾸면 색이 조금 어두워진다" +
      " (#e0455f → #a83447). --success 는 색상까지 130°로 밀어야 해서 개선 표시의" +
      " 외형이 바뀐다 — 사용자 확인이 필요하다",
  },
  "D 순수 검정·흰색 글자": {
    // 2026-09-07 랜딩 푸터를 토큰으로 바꿔 18 → 14 로 줄였다. 되돌아가면 실패한다.
    count: 14,
    why:
      "#fff 이 세 종류로 섞여 있다 — 강조색 배경 위(--on-accent), 짙은 면 위(--on-dark)," +
      " 그리고 푸터처럼 배경까지 리터럴인 자리(--footer-bg)." +
      " 자리마다 달라 일괄 치환이 안 된다",
  },
};

const findings = [];
const add = (app, rule, file, detail) =>
  findings.push({ app, rule, file: file ? path.relative(path.join(ROOT, app), file) : "", detail });

for (const app of APPS) {
  const root = path.join(ROOT, app);
  const cssFiles = walk(path.join(root, "app"), [".css"]);
  const codeFiles = [
    ...walk(path.join(root, "app"), [".tsx", ".ts"]),
    ...walk(path.join(root, "components"), [".tsx", ".ts"]),
    ...walk(path.join(root, "lib"), [".ts"]),
  ];

  // ── A. 원형 장식 잔재 ────────────────────────────
  // 2026-09-07 에 여섯 앱에서 걷었다. Sheet 안의 타원 호 + 금색 점.
  for (const f of [...cssFiles, ...codeFiles]) {
    if (allowed(f)) continue;
    const t = await readFile(f, "utf8");
    if (t.includes("sheet-ornament") || /\bOrnament\b/.test(t) || /\bornament\b/.test(t)) {
      add(app, "A 원형 장식", f, "sheet-ornament · Ornament · ornament prop");
    }
  }

  // ── B. 선언 없이 쓰이는 CSS 변수 ──────────────────
  // 다른 앱 마크업을 가져올 때 토큰 이름만 따라오는 일이 흔하다.
  // 그러면 카드 배경·입력칸 테두리가 통째로 빠진 채 렌더된다.
  const used = new Set();
  const declared = new Set();
  for (const f of [...cssFiles, ...codeFiles]) {
    const t = await readFile(f, "utf8");
    for (const m of t.matchAll(/var\((--[a-z0-9-]+)\)/g)) used.add(m[1]);
    if (f.endsWith(".css")) for (const m of t.matchAll(/^\s*(--[a-z0-9-]+):/gm)) declared.add(m[1]);
    // theme.ts 가 런타임에 심는 것도 선언으로 본다
    if (f.endsWith("theme.ts")) for (const m of t.matchAll(/"(--[a-z0-9-]+)"/g)) declared.add(m[1]);
  }
  for (const v of [...used].sort()) {
    if (!declared.has(v)) add(app, "B 미정의 변수", "", v);
  }

  // ── C. 면적용 색을 글자로 ────────────────────────
  // 금색은 흰 시트 위 2.29:1 이다. 글자용 -ink 토큰이 따로 있다.
  const INK_PAIRS = [
    ["--point", "--point-ink"],
    ["--gold", "--point-ink"],
    ["--danger", "--danger-ink"],
    ["--success", "--success-ink"],
  ];
  for (const f of [...cssFiles, ...codeFiles]) {
    if (allowed(f)) continue;
    const t = await readFile(f, "utf8");
    for (const [area, ink] of INK_PAIRS) {
      const re = new RegExp(`color:\\s*"?var\\(${area}\\)`, "g");
      const n = (t.match(re) || []).length;
      if (n) add(app, "C 면적색을 글자로", f, `var(${area}) → var(${ink}) (${n}곳)`);
    }
  }

  // ── D. 순수 검정·흰색을 글자색으로 ────────────────
  // 강조색 배경 위 검정은 3.01:1 이었다. 짙은 면 위 글자는 --on-dark 를 쓴다.
  for (const f of codeFiles) {
    if (allowed(f)) continue;
    const t = await readFile(f, "utf8");
    const n = (t.match(/color:\s*"#(000|000000|fff|ffffff)"/gi) || []).length;
    if (n) add(app, "D 순수 검정·흰색 글자", f, `${n}곳 → --on-accent · --on-dark`);
  }

  // ── F. 폰트 링크 ─────────────────────────────────
  // .headline 이 "Gowun Batang" 을 요구하는데 링크가 없으면 **조용히** 일반 명조로
  // 떨어진다. 오류도 경고도 없다. SnapWord·SnapNote 가 그 상태였다 (2026-09-07).
  const layout = path.join(root, "app", "layout.tsx");
  if (existsSync(layout)) {
    const t = await readFile(layout, "utf8");
    const need = [
      ["Gowun+Batang", "헤드라인 명조"],
      ["pretendard", "본문 Pretendard"],
      ["fonts.gstatic.com", "gstatic preconnect"],
    ];
    const miss = need.filter(([k]) => !t.toLowerCase().includes(k.toLowerCase())).map(([, w]) => w);
    if (miss.length) add(app, "F 폰트 링크 누락", layout, miss.join(" · "));
  }
  // body 스택에 Pretendard 가 없으면 시스템 기본으로 떨어진다
  for (const f of cssFiles) {
    if (allowed(f)) continue;
    const t = await readFile(f, "utf8");
    const m = t.match(/body\s*\{[^}]*font-family:([^;]+);/s);
    if (m && !/Pretendard/i.test(m[1])) {
      add(app, "F 폰트 링크 누락", f, "body 스택에 Pretendard 없음");
    }
  }

  // ── E. 팔레트 리터럴이 다시 스며들었나 ────────────
  // 색은 palette.json 하나가 원본이다. globals.css 에 hex 가 있으면 안 된다.
  for (const f of cssFiles) {
    if (allowed(f)) continue;
    const t = await readFile(f, "utf8");
    const hex = (t.match(/^\s*--[a-z0-9-]+:\s*(#[0-9a-f]{3,8}|rgba?\()/gim) || []).length;
    if (hex) add(app, "E 토큰을 리터럴로 선언", f, `${hex}곳 — palette.json 으로`);
  }
}

// ── 출력 ──────────────────────────────────────────
const RULES = {
  "A 원형 장식": "2026-09-07 에 여섯 앱에서 걷었다. 되살리지 말 것",
  "B 미정의 변수": "선언이 없으면 그 속성이 통째로 빠진 채 렌더된다",
  "C 면적색을 글자로": "금색은 흰 시트 위 2.29:1 이다. -ink 토큰을 쓴다",
  "D 순수 검정·흰색 글자": "--on-accent (강조색 위) · --on-dark (짙은 면 위)",
  "E 토큰을 리터럴로 선언": "원본은 myjane/design/palette.json 하나다",
  "F 폰트 링크 누락": "링크가 없으면 조용히 일반 명조·시스템 폰트로 떨어진다",
};

const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}

let failed = 0;
const verbose = process.argv.includes("--all");

for (const [rule, list] of byRule) {
  const base = BASELINE[rule];
  if (base && list.length <= base.count) {
    // 기준선 이내 — 새로 생긴 것이 아니다
    console.log("· " + rule + "  " + list.length + "/" + base.count + "건 (기준선 이내)");
    console.log("    " + base.why);
    if (verbose) for (const f of list) console.log("      " + f.app.padEnd(9) + " " + f.file.padEnd(44) + " " + f.detail);
    continue;
  }
  failed += list.length;
  const over = base ? "  ← 기준선 " + base.count + "건을 넘었다" : "";
  console.log("");
  console.log("✗ " + rule + " — " + RULES[rule] + over);
  for (const f of list) {
    console.log("    " + f.app.padEnd(9) + " " + f.file.padEnd(44) + " " + f.detail);
  }
}

if (failed === 0) {
  console.log("");
  console.log("✓ 새 위반 없음 (기준선 항목은 --all 로 펼쳐 본다)");
  console.log("");
  console.log("예외로 빼둔 자리:");
  for (const a of ALLOW) console.log("  · " + a.match.padEnd(22) + " " + a.why);
  process.exit(0);
}

console.log("");
console.log("새 위반 " + failed + "건");
console.log("규칙과 이유 → my-obsidian-vault / 20-Design/여섯 앱 디자인 시스템.md");
process.exit(1);
