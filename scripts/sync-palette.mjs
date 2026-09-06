/**
 * design/palette.json 하나에서 여섯 앱의 app/palette.css 를 만든다.
 *
 *   npm run palette            검사만 (아무것도 안 씀)
 *   npm run palette -- --write  실제로 씀
 *
 * 왜 있나: 보라 → 살구 → 먹청으로 두 번 갈면서 245곳을 손으로 바꿨다.
 * 토큰이 있었는데도 그랬던 이유가 둘이다.
 *   ① 값이 여섯 저장소에 복사돼 있었다
 *   ② 짙은 시트·어두운 푸터·버튼 그라디언트처럼 손이 많이 가는 값은 토큰조차 아니었다
 * 이 스크립트가 ①을, palette.css 의 --sheet-dark-* 계열 토큰이 ②를 없앤다.
 *
 * ⚠️ 쓰기 전에 palette.json 의 `checks` 대비를 모두 검사하고, 하나라도 미달이면
 * **아무 파일도 쓰지 않고 멈춘다.** 색을 고르다 읽을 수 없게 만드는 일이 실제로
 * 여러 번 있었다 — 사람이 기억하는 대신 여기서 막는다.
 *
 * 알파가 섞인 색은 검사에서 빠진다. 뒤에 무엇이 오는지에 따라 달라져서
 * 계산으로는 알 수 없다. 그건 렌더된 화면에서 재야 한다 → scripts/audit-contrast.mjs
 *
 * 근거: my-obsidian-vault → 20-Design/먹청 톤 팔레트.md
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const ROOT = "C:/Dev";
const SRC = path.join(ROOT, "myjane", "design", "palette.json");

/**
 * 앱별 CSS 변수 이름.
 *
 * myjane 과 다섯 앱이 **같은 역할에 다른 이름**을 쓴다. 통일하면 좋겠지만
 * 이름을 바꾸는 것은 팔레트 교체와 별개의 작업이라, 여기서 역할 → 이름만 옮긴다.
 * 새 앱을 만들 때는 `app` 쪽 이름을 쓸 것.
 */
const NAMES = {
  app: {
    bg: "--bg-primary",
    bgAlt: "--bg-secondary",
    card: "--bg-card",
    elevated: "--bg-elevated",
    border: "--border",
    borderSubtle: "--border-subtle",
    text: "--text-primary",
    textDim: "--text-secondary",
    textMuted: "--text-muted",
    accent: "--accent",
    accentHover: "--accent-hover",
    accentSubtle: "--accent-subtle",
    point: "--point",
    pointSubtle: "--point-subtle",
    pointInk: "--point-ink",
    gold: "--gold",
    onAccent: "--on-accent",
    danger: "--danger",
    dangerInk: "--danger-ink",
    dangerSubtle: "--danger-subtle",
    success: "--success",
    successInk: "--success-ink",
    successSubtle: "--success-subtle",
    warning: "--warning",
    inputBg: "--input-bg",
    inputBorder: "--input-border",
  },
  myjane: {
    bg: "--bg",
    card: "--surface",
    bgAlt: "--surface-hover",
    border: "--border",
    borderStrong: "--border-strong",
    text: "--text",
    textDim: "--text-dim",
    accent: "--accent",
    accentInk: "--accent-ink",
    accentSubtle: "--accent-soft",
    accentBright: "--gold-from",
    accentHover: "--gold-to",
    gold: "--gold",
    goldSoft: "--gold-soft",
    onAccent: "--on-accent",
    placeholder: "--placeholder",
    textMuted: "--text-muted",
    danger: "--danger",
    dangerSubtle: "--danger-subtle",
    dangerInk: "--danger-ink",
    success: "--success",
    successSubtle: "--success-subtle",
    successInk: "--success-ink",
  },
};

/** 저장소 → 어느 이름 체계를 쓰는지 · 다크 테마가 있는지 */
const APPS = [
  { dir: "myjane", vocab: "myjane", dark: false },
  { dir: "SnapWord", vocab: "app", dark: false },
  { dir: "SnapNote", vocab: "app", dark: false },
  { dir: "fitlog", vocab: "app", dark: true },
  { dir: "2hbk", vocab: "app", dark: true },
  { dir: "typelog", vocab: "app", dark: false },
];

// ───────────────────────────── 대비 계산
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** 알파가 없는 hex 만 rgb 로. 그 외는 null (검사 불가) */
function rgb(v) {
  if (typeof v !== "string") return null;
  const m = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const palette = JSON.parse(await readFile(SRC, "utf8"));

/** "light.text" · "surfaces.footerBg" 같은 경로를 따라간다 */
function resolve(ref) {
  if (typeof ref !== "string") return ref;
  if (ref.startsWith("#")) return ref;
  let cur = ref.startsWith("surfaces.") ? palette : palette.roles;
  for (const key of ref.split(".")) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

// ───────────────────────────── 대비 관문
console.log("── 대비 검사 ──");
let failed = 0;
let skipped = 0;
for (const [fgRef, bgRef, min, label] of palette.checks) {
  const fg = rgb(resolve(fgRef));
  const bgRaw = resolve(bgRef);
  const bgs = (Array.isArray(bgRaw) ? bgRaw : [bgRaw]).map((b) => rgb(resolve(b)));
  if (!fg || bgs.some((b) => !b)) {
    skipped++;
    console.log(`  · ${label} — 알파가 섞여 계산 불가, 렌더에서 재야 한다`);
    continue;
  }
  const worst = Math.min(...bgs.map((b) => ratio(fg, b)));
  const ok = worst >= min;
  if (!ok) failed++;
  console.log(
    `  ${ok ? "✓" : "✗"} ${worst.toFixed(2).padStart(5)} / ${min}  ${label}` +
      (ok ? "" : `   (${fgRef} on ${JSON.stringify(bgRef)})`),
  );
}
console.log(
  `\n검사 ${palette.checks.length}건 · 미달 ${failed}건` +
    (skipped ? ` · 계산 불가 ${skipped}건` : ""),
);
if (failed > 0) {
  console.error("\n✗ 미달이 있어 아무 파일도 쓰지 않았다. palette.json 의 값을 고칠 것.");
  process.exit(1);
}

// ───────────────────────────── palette.css 생성
function block(selector, vocab, theme) {
  const names = NAMES[vocab];
  const lines = [`${selector} {`];
  for (const [role, cssVar] of Object.entries(names)) {
    const v = theme[role];
    if (v === undefined) continue;
    lines.push(`  ${cssVar}: ${v};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function surfaceBlock(s) {
  return [
    ":root {",
    "  /*",
    "   * 테마와 무관하게 항상 같은 면들. 결쩜사 패턴의 짙은 시트와 어두운 푸터는",
    "   * 라이트에서도 어둡다 — 그래서 테마 토큰이 아니다.",
    "   *",
    "   * ⚠️ 이 값들을 리터럴로 다시 쓰지 말 것. 지난 두 번의 색 교체에서 가장",
    "   * 손이 많이 간 자리가 정확히 여기였다.",
    "   */",
    `  --sheet-dark: linear-gradient(150deg, ${s.sheetDark[0]}, ${s.sheetDark[1]} 65%, ${s.sheetDark[2]});`,
    `  --sheet-dark-glow: ${s.sheetDarkGlow};`,
    `  --footer-bg: ${s.footerBg};`,
    `  --btn-gradient: linear-gradient(135deg, ${s.btnFrom}, ${s.btnTo});`,
    `  --btn-shadow: ${s.btnShadow};`,
    "  /* 짙은 면 위에 얹는 색 — 밝은 면용 토큰을 쓰면 2~3:1 로 떨어진다 */",
    `  --on-dark: ${s.onDark};`,
    `  --on-dark-dim: ${s.onDarkDim};`,
    `  --on-dark-faint: ${s.onDarkFaint};`,
    `  --border-on-dark: ${s.borderOnDark};`,
    `  --accent-on-dark: ${s.accentOnDark};`,
    `  --gold-on-dark: ${s.goldOnDark};`,
    "  /* 그림자 — rgba() 안에 넣어 쓴다: rgba(var(--shadow-rgb), 0.1) */",
    `  --shadow-rgb: ${s.shadowRgb};`,
    "}",
  ].join("\n");
}

const HEADER = (name) =>
  [
    "/*",
    " * ⚠️ 생성 파일 — 직접 고치지 말 것.",
    " *",
    " * 원본은 myjane/design/palette.json 하나다. 색을 바꾸려면 거기를 고치고",
    " * myjane 에서 `npm run palette -- --write` 를 돌린다. 여섯 앱이 함께 갱신된다.",
    " *",
    ` * 팔레트: ${name}`,
    " * 근거: my-obsidian-vault → 20-Design/먹청 톤 팔레트.md",
    " */",
    "",
  ].join("\n");

let wrote = 0;
for (const app of APPS) {
  const out = path.join(ROOT, app.dir, "app", "palette.css");
  if (!existsSync(path.dirname(out))) {
    console.log(`  ✗ ${app.dir} — app 폴더가 없다`);
    continue;
  }
  const parts = [HEADER(palette.name)];
  if (app.vocab === "myjane") {
    parts.push(block(":root", "myjane", palette.roles.light));
  } else if (app.dark) {
    parts.push("/* 라이트 — 기본 테마 */");
    parts.push(block(':root,\n[data-theme="light"]', "app", palette.roles.light));
    parts.push("");
    parts.push("/* 먹청 다크 */");
    parts.push(block('[data-theme="dark"]', "app", palette.roles.dark));
  } else {
    parts.push(block(":root", "app", palette.roles.light));
  }
  parts.push("");
  parts.push(surfaceBlock(palette.surfaces));
  parts.push("");
  const text = parts.join("\n");
  if (WRITE) await writeFile(out, text, "utf8");
  console.log(`  ${WRITE ? "✓" : "→"} ${app.dir}/app/palette.css  (${text.split("\n").length}줄)`);
  wrote++;
}

console.log(`\n${wrote}개 앱`);
if (!WRITE) console.log("(검사만 했다. 실제로 쓰려면 --write)");
