import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const ARC = `
<g transform="rotate(158.96 96 106.46)">
  <circle cx="96" cy="106.46" r="60" fill="none" stroke="#6b4a9e" stroke-width="11" stroke-linecap="round" stroke-dasharray="232.6 144.4"/>
  <circle cx="96" cy="106.46" r="60" fill="none" stroke="#e8d18a" stroke-width="11" stroke-linecap="round" stroke-dasharray="128 249"/>
</g>`;
const M = `
<path d="M52,116 L52,98 C52,90 57,86 64,86 C71,86 76,90 76,98 L76,116" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M76,98 C76,90 81,86 88,86 C95,86 100,90 100,98 L100,116" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`;
const J = `<path d="M121.2,86 L121.2,112.9 A 42 42 0 0 1 40 128" fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round"/>`;
const STAR = `<path d="M121,58.5 L122.77,64.23 L128.5,66 L122.77,67.77 L121,73.5 L119.23,67.77 L113.5,66 L119.23,64.23 Z" fill="#e8d18a"/>`;

const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
<defs><linearGradient id="tile" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(15)">
<stop offset="0" stop-color="#3a1266"/><stop offset="1" stop-color="#1c0733"/></linearGradient></defs>
<rect width="192" height="192" rx="44" fill="url(#tile)"/>${ARC}${M}${J}${STAR}</svg>`;

const svg = Buffer.from(svgStr);
await writeFile("check/final.svg", svg);
await sharp(svg, { density: 600 }).resize(192, 192).png().toFile("check/final-192.png");
for (const s of [64, 32, 16]) {
  const small = await sharp(svg, { density: 600 }).resize(s, s).png().toBuffer();
  await sharp(small).resize(256, 256, { kernel: "nearest" }).png().toFile(`check/final-${s}x.png`);
}
console.log("final rendered");
