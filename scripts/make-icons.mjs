/**
 * public/app-icon.svg 에서 PNG 파생물을 만든다.
 *
 *   node scripts/make-icons.mjs
 *
 * sharp 는 Next 의 전이 의존성이라 따로 설치하지 않는다.
 * density 를 높여 렌더한 뒤 축소해야 작은 크기에서 선이 뭉개지지 않는다.
 *
 * 2026-09-04 이전에는 사용자가 준 사진(`app-icon-source.jpg`)에서 파생했다.
 * 지금은 다섯 앱과 같은 기하학으로 직접 그린 SVG 가 원본이다.
 * → my-obsidian-vault / 20-Design/앱 공통 UI와 아이콘.md
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = path.join(process.cwd(), "public", "app-icon.svg");

/** 이름 → 크기. 이 파일들을 실제로 참조하는 곳은 아래 주석 참고 */
const TARGETS = [
  ["myjane-icon.png", 512], // 랜딩·AuthShell 로고 (app/page.tsx · components/AuthShell.tsx)
  ["icon-192.png", 192], // PWA · metadata.icons
  ["apple-touch-icon.png", 180], // iOS 홈 화면
  ["favicon-32.png", 32], // 탭
];

const svg = await readFile(SRC);

for (const [name, size] of TARGETS) {
  const out = path.join(process.cwd(), "public", name);
  await sharp(svg, { density: 600 }).resize(size, size).png().toFile(out);
  console.log(`${name.padEnd(22)} ${size}×${size}`);
}
