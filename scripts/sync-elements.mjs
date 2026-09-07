#!/usr/bin/env node
/**
 * design/elements.css → 여섯 앱의 app/elements.css
 *
 * 팔레트와 같은 구조다. 원본은 이 저장소에 하나뿐이고, 여섯 앱의
 * app/elements.css 는 생성 파일이다.
 *
 *     npm run elements            무엇이 달라지는지만 본다
 *     npm run elements -- --write 여섯 앱에 쓴다
 *
 * 왜 복사가 아니라 스크립트인가 — 아이콘과 Sheet.tsx 가 여섯 벌로 갈라져
 * 사고가 났다. 아이콘은 세 앱이 다른 색으로 남았고 그걸 나란히 렌더해 보고서야
 * 알았다. 사람이 여섯 번 붙여넣는 일은 언젠가 다섯 번이 된다.
 *   → my-obsidian-vault / 20-Design/여섯 앱 디자인 시스템.md
 *
 * ⚠️ CSS 만 옮긴다. 이 요소들이 동작하려면 앱마다 두 가지가 더 필요하다 —
 *
 *   ① app/layout.tsx 가 globals.css **다음 줄**에서 elements.css 를 불러야 한다.
 *      @import 로는 안 된다 (import 는 파일 맨 앞이라야 하니 규칙이 늘 먼저
 *      들어가고 .sheet--point 가 특이도 같은 .sheet 에 진다)
 *   ② 진행 띠는 components/ScrollProgress.tsx 가 필요하다
 *
 * 둘 다 이 스크립트가 **검사만** 한다. 없으면 알려주고 고치라고 말한다.
 * 코드를 자동으로 끼워 넣지는 않는다 — 어디에 넣을지는 앱마다 다르다.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");       // myjane
const siblings = resolve(root, "..");   // C:\Dev

const APPS = ["myjane", "SnapWord", "SnapNote", "fitlog", "2hbk", "typelog"];

const write = process.argv.includes("--write");
const source = join(root, "design", "elements.css");
const css = await readFile(source, "utf8");

const header =
  "/* 생성 파일 — 고치지 말 것. 원본은 myjane/design/elements.css 다.\n" +
  "   고친 뒤 `npm run elements -- --write` 로 여섯 앱에 함께 반영한다. */\n\n";

let changed = 0;
let missing = 0;

for (const app of APPS) {
  const dir = join(siblings, app);
  if (!existsSync(dir)) {
    console.log("  ? " + app + "  저장소가 없다 — 건너뛴다");
    continue;
  }

  const target = join(dir, "app", "elements.css");
  const next = header + css;
  const prev = existsSync(target) ? await readFile(target, "utf8") : null;
  const same = prev === next;

  if (!same) changed++;
  if (write && !same) await writeFile(target, next, "utf8");

  const mark = same ? "=" : write ? "✓" : "→";
  console.log("  " + mark + " " + app + "/app/elements.css" + (same ? "  (그대로)" : ""));

  // ① layout.tsx 가 globals.css 다음에 부르는가
  const layout = join(dir, "app", "layout.tsx");
  if (existsSync(layout)) {
    const t = await readFile(layout, "utf8");
    const iGlobals = t.indexOf('import "./globals.css"');
    const iElements = t.indexOf('import "./elements.css"');
    if (iElements === -1) {
      console.log("      ⚠ app/layout.tsx 에 import \"./elements.css\" 가 없다");
      console.log("        globals.css 다음 줄에 넣는다 — 순서가 뒤바뀌면 라운딩이 조용히 안 먹는다");
      missing++;
    } else if (iGlobals !== -1 && iElements < iGlobals) {
      console.log("      ⚠ elements.css 를 globals.css **앞에서** 부르고 있다");
      console.log("        .sheet--point 가 .sheet 의 border-radius 에 진다 — 순서를 바꾼다");
      missing++;
    }
  }

  // ② 진행 띠 컴포넌트가 있는가
  if (!existsSync(join(dir, "components", "ScrollProgress.tsx"))) {
    console.log("      ⚠ components/ScrollProgress.tsx 가 없다 — 진행 띠가 그려지지 않는다");
    missing++;
  }
}

// ── 다섯 앱의 Sheet.tsx 가 아직 같은가 ─────────────
// 이 파일만은 복사본이다 (myjane 은 raw section 을 쓰므로 갖지 않는다).
// 아이콘이 세 앱에서 다른 색으로 갈라졌던 사고가 이런 모양이었다.
{
  const five = APPS.filter((a) => a !== "myjane");
  const seen = new Map();
  for (const app of five) {
    const f = join(siblings, app, "components", "Sheet.tsx");
    if (!existsSync(f)) continue;
    const t = await readFile(f, "utf8");
    if (!seen.has(t)) seen.set(t, []);
    seen.get(t).push(app);
  }
  if (seen.size > 1) {
    console.log("");
    console.log("⚠ components/Sheet.tsx 가 갈라졌다 — 다섯 앱이 같아야 한다");
    for (const [, apps] of seen) console.log("    " + apps.join(" · "));
    missing++;
  }
}

console.log("");
if (!write) {
  console.log(changed === 0 ? "여섯 앱이 원본과 같다." : changed + "개 앱이 달라진다. --write 로 쓴다.");
} else {
  console.log(changed === 0 ? "쓸 것이 없었다." : changed + "개 앱에 썼다.");
}

if (missing) {
  console.log("");
  console.log("붙이지 못한 자리 " + missing + "곳 — 위 ⚠ 를 손으로 고친다.");
  process.exit(1);
}
