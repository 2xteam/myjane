# -*- coding: utf-8 -*-
"""네 앱(SnapWord · SnapNote · 2hbk · TypeLog)의 인스타그램 카드 HTML + 게시글 md 생성.
   FitLog 카드(docs/marketing/instagram-fitlog.html)와 같은 CSS·구조. 문구는 각 앱 app/page.tsx 의 문장."""
import io, os

ROOT = "C:/Dev"

CSS = r"""
  :root {
    --bg: #f7fbfb; --surface: #ffffff; --tint: #e8f2f3;
    --ink: #0f2027; --dim: #566b70; --border: #d5e3e5;
    --accent: #116271; --accent-2: #1a7f8f; --deep: #0b4550; --deeper: #071c22;
    --gold: #ead58c; --gold-ink: #a8842f;
    --success: #2f8f6b; --success-subtle: #dcefe6; --danger: #c8443f; --warning: #b98a1e;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e4ecee; font-family: Pretendard, -apple-system, "Segoe UI", sans-serif; color: var(--ink); }
  .toolbar { position: sticky; top: 0; z-index: 10; display: flex; gap: 10px; align-items: center; padding: 12px 20px; background: rgba(228,236,238,.92); backdrop-filter: blur(6px); font-size: 13px; color: var(--dim); }
  .toolbar button { font: inherit; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); background: #fff; cursor: pointer; }
  .toolbar button[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: var(--accent); }
  .deck { display: grid; gap: 40px; padding: 30px 20px 80px; justify-content: center; }
  body.solo .deck { gap: 0; padding: 0; }
  body.solo .card { display: none; }
  body.solo .card.show { display: flex; }
  .card { width: 1080px; height: 1080px; position: relative; overflow: hidden; display: flex; flex-direction: column; padding: 96px; background: var(--surface); }
  .card.dark { background: linear-gradient(160deg, var(--accent-2) 0%, var(--deep) 62%, var(--deeper) 100%); color: #eef7f8; }
  .card.tint { background: var(--tint); }
  .card.gold { background: linear-gradient(160deg, #fdf7e4 0%, #f7ecc6 100%); }
  .eyebrow { font-size: 22px; letter-spacing: .22em; font-weight: 800; color: var(--accent); text-transform: uppercase; }
  .dark .eyebrow { color: var(--gold); } .gold .eyebrow { color: var(--gold-ink); }
  h1, h2 { font-family: "Gowun Batang", serif; font-weight: 700; margin: 26px 0 0; letter-spacing: -0.01em; line-height: 1.22; }
  h1 { font-size: 88px; } h2 { font-size: 72px; }
  .lead { font-size: 32px; line-height: 1.6; color: var(--dim); margin: 34px 0 0; max-width: 860px; }
  .dark .lead { color: #cfe3e6; }
  .hl { color: var(--gold); }
  .mark { background: linear-gradient(transparent 58%, #ead58c 58%, #ead58c 92%, transparent 92%); padding: 0 4px; }
  .foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; font-size: 24px; color: var(--dim); }
  .dark .foot { color: #a9c6cb; }
  .brand { display: flex; align-items: center; gap: 16px; font-weight: 800; letter-spacing: -0.02em; font-size: 30px; }
  .brand svg { width: 64px; height: 64px; border-radius: 16px; }
  .url { font-weight: 700; } .idx { font-variant-numeric: tabular-nums; }
  .viz { margin-top: 40px; display: grid; place-items: center; flex: 1; }
  .viz svg { width: 100%; max-height: 520px; }
  .steps { list-style: none; margin: 44px 0 0; padding: 0; display: grid; gap: 34px; }
  .steps li { display: grid; grid-template-columns: 84px 1fr; gap: 22px; align-items: start; }
  .num { width: 84px; height: 84px; border-radius: 999px; display: grid; place-items: center; background: var(--accent); color: #fff; font-weight: 800; font-size: 28px; font-variant-numeric: tabular-nums; }
  .steps h3 { margin: 12px 0 8px; font-size: 38px; font-weight: 800; letter-spacing: -0.01em; }
  .steps p { margin: 0; font-size: 27px; line-height: 1.55; color: var(--dim); }
  .feat { margin-top: 40px; display: grid; gap: 18px; }
  .feat div { padding: 26px 30px; border-radius: 22px; background: var(--surface); border: 1px solid var(--border); }
  .tint .feat div, .gold .feat div { background: rgba(255,255,255,.75); }
  .feat strong { font-size: 32px; display: block; margin-bottom: 8px; }
  .feat p { margin: 0; font-size: 25px; line-height: 1.5; color: var(--dim); }
  .cta { display: inline-block; margin-top: 44px; padding: 26px 44px; border-radius: 999px; background: var(--gold); color: var(--deeper); font-weight: 800; font-size: 32px; letter-spacing: -0.01em; }
  .pill { display: inline-block; padding: 10px 20px; border-radius: 999px; background: var(--tint); color: var(--accent); font-weight: 700; font-size: 24px; margin: 0 10px 10px 0; }
  .dark .pill { background: rgba(255,255,255,.12); color: #eef7f8; }
"""

HEAD = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{name} · 인스타그램 카드</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
<style>
  /*
    {name} 인스타그램 카드 {n}장 — 1080×1080. PNG 는 docs/marketing/export-cards.mjs 로 뽑는다.
    색·서체·구조는 FitLog 카드와 같다(먹청 팔레트 · Pretendard · Gowun Batang). 문구는 app/page.tsx 의 문장.
    → my-obsidian-vault / 30-Patterns/SNS 소개 카드와 게시글.md
  */
{css}
</style>
</head>
<body>
<div class="toolbar">
  <span>{name} 인스타그램 카드 · 1080×1080 · {n}장</span>
  <button id="solo" aria-pressed="false" onclick="toggleSolo()">카드만 보기</button>
  <span id="nav" hidden><button onclick="go(-1)">◀</button> <span id="pos"></span> <button onclick="go(1)">▶</button></span>
</div>
<div class="deck" id="deck">
"""

TAIL = """
</div>
<script>
  let cur = 1;
  const cards = [...document.querySelectorAll('.card')];
  function render() { cards.forEach(c => c.classList.toggle('show', Number(c.dataset.i) === cur)); document.getElementById('pos').textContent = cur + ' / ' + cards.length; }
  function toggleSolo() { const on = document.body.classList.toggle('solo'); document.getElementById('solo').setAttribute('aria-pressed', String(on)); document.getElementById('nav').hidden = !on; render(); }
  function go(d) { cur = Math.min(cards.length, Math.max(1, cur + d)); render(); }
  document.addEventListener('keydown', e => { if (!document.body.classList.contains('solo')) return; if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
</script>
</body>
</html>
"""

# ── 아이콘 (public/app-icon.svg 에서 옮김 · id 충돌을 피해 접미사) ──
def tile(gid, symbol, gold="#ead58c", rot=""):
    return f'''<svg viewBox="0 0 192 192"><defs><linearGradient id="{gid}" x1="0" y1="0" x2=".4" y2="1"{rot}><stop offset="0" stop-color="#134450"/><stop offset="1" stop-color="#071c22"/></linearGradient></defs><rect width="192" height="192" rx="44" fill="url(#{gid})"/><g transform="rotate(158.96 96 106.46)" fill="none" stroke-width="11" stroke-linecap="round"><circle cx="96" cy="106.46" r="60" stroke="#4a95a6" stroke-dasharray="232.6 144.4"/><circle cx="96" cy="106.46" r="60" stroke="{gold}" stroke-dasharray="128 249"/></g>{symbol}</svg>'''

SYM = {
    "snapword": '<g stroke="#eef7f8" stroke-width="9" stroke-linecap="round"><path d="M70 82h52"/><path d="M70 102h52"/><path d="M70 122h30"/></g>',
    "snapnote": '<path d="M68 102 L88 122 L128 74" fill="none" stroke="#eef7f8" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>',
    "2hbk": '<defs><path id="star{k}" d="M96.00 61.00 L105.17 86.38 L132.14 87.26 L110.84 103.82 L118.34 129.74 L96.00 114.60 L73.66 129.74 L81.16 103.82 L59.86 87.26 L86.83 86.38 Z"/><clipPath id="half{k}"><polygon points="-20,-17 209,212 -20,212"/></clipPath></defs><use href="#star{k}" fill="#eef7f8" clip-path="url(#half{k})"/><use href="#star{k}" fill="none" stroke="#eef7f8" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>',
    "typelog": '<g fill="#eef7f8"><path transform="rotate(-6 84 80)" d="M84,58 C88.5,58 90.5,62 90.5,68 C90.5,80 90,92 89,100 C87.5,108 80.5,108 79,100 C78,92 77.5,80 77.5,68 C77.5,62 79.5,58 84,58 Z"/><path d="M103,101 C100,86 103,71 113,66 C123,61 133,66 130,75 C127,84 116,85 111,92 C108,96 108,99 108,102 Z"/></g><g fill="#a7d3dc"><path transform="rotate(-6 84 80)" d="M84,69 C86.8,69 88,71.5 88,75.5 C88,84 87.6,92 87,97 C86,102 82,102 81,97 C80.4,92 80,84 80,75.5 C80,71.5 81.2,69 84,69 Z"/><path d="M107,98 C105,86 107,76 114,72 C120,69 125,71 124,76 C122,82 114,84 111,90 Z"/></g><path fill="#eef7f8" d="M96,99 C77,99 66,110 66,126 C66,142 77,153 96,153 C115,153 126,142 126,126 C126,110 115,99 96,99 Z"/><g fill="#0b262e"><rect x="67" y="111" width="26" height="18" rx="6" transform="rotate(-3 80 120)"/><rect x="99" y="111" width="26" height="18" rx="6" transform="rotate(3 112 120)"/><rect x="92" y="117" width="8" height="5" rx="2"/></g><path d="M107,138 C104,145 95,147.5 88,143.5 C85,141 84,138 85.5,134" fill="none" stroke="#0b262e" stroke-width="5" stroke-linecap="round"/><path d="M136,86 L138.6,91.4 L144,94 L138.6,96.6 L136,102 L133.4,96.6 L128,94 L133.4,91.4 Z" fill="#e8d18a"/>',
}
def icon(app, k):
    sym = SYM[app].replace("{k}", k)
    return tile(f"g{k}", sym, gold="#e8d18a" if app in ("2hbk", "typelog") else "#ead58c")

def brand(app, name, k):
    return f'<div class="brand">{icon(app, k)} {name}</div>'

def card(cls, i, n, eyebrow, body, name, foot_right=None):
    fr = foot_right if foot_right is not None else f'<span class="idx">{i} / {n}</span>'
    return f'\n<section class="card {cls}" data-i="{i}">\n  <div class="eyebrow">{eyebrow}</div>\n{body}\n  <div class="foot"><span>{name}</span>{fr}</div>\n</section>\n'

def steps(items):
    lis = "".join(f'<li><span class="num">{str(i+1).zfill(2)}</span><div><h3>{t}</h3><p>{d}</p></div></li>' for i, (t, d) in enumerate(items))
    return f'<ol class="steps">{lis}</ol>'

def feats(items):
    return '<div class="feat">' + "".join(f'<div><strong>{t}</strong><p>{d}</p></div>' for t, d in items) + '</div>'

# ── 앱 시각 요소 (SVG 목업 · 값은 예시) ──
VIZ = {
"snapword": '''<svg viewBox="0 0 560 300" aria-label="사진에서 뽑은 단어장">
  <rect x="16" y="24" width="200" height="252" rx="14" fill="#e8f2f3" stroke="#d5e3e5"/>
  <g stroke="#9fb7bb" stroke-width="6" stroke-linecap="round"><line x1="40" y1="64" x2="190" y2="64"/><line x1="40" y1="94" x2="170" y2="94"/><line x1="40" y1="124" x2="185" y2="124"/><line x1="40" y1="154" x2="150" y2="154"/><line x1="40" y1="184" x2="180" y2="184"/><line x1="40" y1="214" x2="160" y2="214"/><line x1="40" y1="244" x2="188" y2="244"/></g>
  <path d="M232 150 L288 150" stroke="#116271" stroke-width="5" stroke-linecap="round"/><path d="M276 136 L292 150 L276 164" fill="none" stroke="#116271" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="308" y="24" width="236" height="252" rx="14" fill="#fff" stroke="#d5e3e5"/>
  <text x="330" y="58" font-family="Pretendard, sans-serif" font-size="13" font-weight="800" fill="#116271" letter-spacing=".18em">UNIT 3 · 12 WORDS</text>
  <g font-family="Pretendard, sans-serif" font-size="17" fill="#0f2027">
    <text x="330" y="96" font-weight="800">resilient</text><text x="440" y="96" fill="#566b70">회복력 있는</text>
    <text x="330" y="132" font-weight="800">deliberate</text><text x="440" y="132" fill="#566b70">신중한</text>
    <text x="330" y="168" font-weight="800">subtle</text><text x="440" y="168" fill="#566b70">미묘한</text>
    <text x="330" y="204" font-weight="800">thrive</text><text x="440" y="204" fill="#566b70">번성하다</text>
    <text x="330" y="240" font-weight="800">notion</text><text x="440" y="240" fill="#566b70">개념</text>
  </g>
  <rect x="330" y="252" width="200" height="6" rx="3" fill="#e8f2f3"/><rect x="330" y="252" width="120" height="6" rx="3" fill="#116271"/>
</svg>''',
"snapnote": '''<svg viewBox="0 0 560 300" aria-label="틀린 문제를 모노톤으로 정리한 오답노트">
  <rect x="16" y="20" width="220" height="260" rx="14" fill="#cfd8d9"/>
  <g stroke="#7a8f93" stroke-width="5" stroke-linecap="round"><line x1="40" y1="60" x2="210" y2="60"/><line x1="40" y1="90" x2="190" y2="90"/><line x1="40" y1="120" x2="205" y2="120"/><line x1="40" y1="180" x2="170" y2="180"/><line x1="40" y1="210" x2="200" y2="210"/></g>
  <ellipse cx="120" cy="150" rx="70" ry="22" fill="none" stroke="#c8443f" stroke-width="4"/>
  <path d="M252 150 L308 150" stroke="#116271" stroke-width="5" stroke-linecap="round"/><path d="M296 136 L312 150 L296 164" fill="none" stroke="#116271" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="328" y="20" width="216" height="260" rx="14" fill="#fff" stroke="#d5e3e5"/>
  <text x="348" y="52" font-family="Pretendard, sans-serif" font-size="13" font-weight="800" fill="#116271" letter-spacing=".18em">WRONG · 수학 2단원</text>
  <g stroke="#0f2027" stroke-width="5" stroke-linecap="round"><line x1="348" y1="86" x2="520" y2="86"/><line x1="348" y1="114" x2="500" y2="114"/><line x1="348" y1="142" x2="515" y2="142"/><line x1="348" y1="196" x2="480" y2="196"/><line x1="348" y1="224" x2="510" y2="224"/></g>
  <rect x="348" y="246" width="70" height="22" rx="11" fill="#e8f2f3"/><text x="383" y="261" font-family="Pretendard, sans-serif" font-size="11" font-weight="800" fill="#116271" text-anchor="middle">인쇄</text>
</svg>''',
"2hbk": '''<svg viewBox="0 0 560 300" aria-label="20칸 스티커판, 13칸 채움">
  <rect x="20" y="20" width="520" height="260" rx="22" fill="#fff" stroke="#d5e3e5"/>
  <text x="48" y="58" font-family="Pretendard, sans-serif" font-size="14" font-weight="800" fill="#116271" letter-spacing=".18em">매일 30분 걷기 · 13 / 20</text>
  <g>''' + "".join(
      f'<circle cx="{70 + (i % 10) * 47}" cy="{105 + (i // 10) * 70}" r="19" fill="{"#e8d18a" if i < 13 else "#eef3f4"}" stroke="{"#c9a84c" if i < 13 else "#d5e3e5"}" stroke-width="2"/>' +
      (f'<path d="M{70 + (i % 10) * 47 - 7} {105 + (i // 10) * 70 + 1} l5 5 l10 -11" fill="none" stroke="#7a5a12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' if i < 13 else "")
      for i in range(20)) + '''</g>
  <text x="48" y="256" font-family="Pretendard, sans-serif" font-size="15" fill="#566b70">남은 칸 7 · 다 채우면 금색 판으로</text>
</svg>''',
"typelog": '''<svg viewBox="0 0 560 300" aria-label="나의 타입 결과 카드와 도감">
  <rect x="16" y="20" width="250" height="260" rx="18" fill="#0b4550"/>
  <text x="141" y="58" font-family="Pretendard, sans-serif" font-size="13" font-weight="800" fill="#ead58c" letter-spacing=".22em" text-anchor="middle">YOUR TYPE</text>
  <text x="141" y="150" font-size="72" text-anchor="middle">🦊</text>
  <text x="141" y="200" font-family="Gowun Batang, serif" font-size="26" font-weight="700" fill="#eef7f8" text-anchor="middle">호기심 많은 여우</text>
  <text x="141" y="232" font-family="Pretendard, sans-serif" font-size="14" fill="#cfe3e6" text-anchor="middle">새로운 걸 먼저 보는 편이에요</text>
  <text x="141" y="258" font-family="Pretendard, sans-serif" font-size="12" fill="#a9c6cb" text-anchor="middle">지난번엔 🐬 돌고래 · 이번엔 다른 타입</text>
  <rect x="292" y="20" width="252" height="260" rx="18" fill="#fff" stroke="#d5e3e5"/>
  <text x="418" y="52" font-family="Pretendard, sans-serif" font-size="13" font-weight="800" fill="#116271" letter-spacing=".18em" text-anchor="middle">MY COLLECTION · 4 / 12</text>
  <g font-size="34" text-anchor="middle">''' + "".join(
      f'<rect x="{312 + (i % 4) * 55}" y="{72 + (i // 4) * 62}" width="46" height="50" rx="12" fill="{"#e8f2f3" if i in (0,2,5,9) else "#f4f7f8"}"/>' +
      (f'<text x="{335 + (i % 4) * 55}" y="{108 + (i // 4) * 62}">{e}</text>' if i in (0,2,5,9) else f'<text x="{335 + (i % 4) * 55}" y="{106 + (i // 4) * 62}" font-size="22" fill="#c6d4d7">?</text>')
      for i, e in enumerate(["🦊","","🐬","","","🦉","","","","🐢","",""])) + '''</g>
</svg>''',
}

# ── 앱별 카드 스펙 ──
APPS = {
"SnapWord": dict(key="snapword", name="SnapWord", domain="snapword.myjane.co.kr", eyebrow="SNAPWORD · VOCABULARY",
  hero=('찍으면,<br /><span class="hl">단어장이 됩니다.</span>', "교재나 화면을 사진 한 장으로 찍으면 단어와 뜻을 뽑아 나만의 단어장으로 만듭니다.<br />옮겨 적는 시간을 없앴습니다."),
  why=("옮겨 적다가<br />지치지 않으셨나요?", "단어를 노트에 베끼는 시간이 공부 시간보다 길었죠.<br />외운 것과 아닌 것도 섞여 있고요.",
       [("교재를 옮겨 적기", "종이책이든 화면이든 손으로 다시 적어야 단어장이 됐어요."), ("다 아는 단어까지 반복", "외운 단어와 틀린 단어가 한 목록에 섞여 있으면 볼 게 많아만 보여요.")]),
  steps=[("교재를 찍는다", "종이책이든 화면이든 사진 한 장이면 됩니다."), ("단어와 뜻을 뽑아 준다", "찍은 곳에서 단어와 뜻을 읽어 단어장으로 정리합니다."), ("외운 것과 나눠 테스트", "외운 단어와 틀린 단어를 나눠 다시 볼 것만 남깁니다.")],
  viz_title=('사진 한 장이<br />단어장이 돼요', "SNAP", "찍은 곳에서 단어와 뜻을 바로 뽑아요. 단원·시험 범위대로 폴더에 묶어 두면 나중에 찾기 쉬워요."),
  feats_title=('<span class="mark">옮겨 적지 않아도</span> 됩니다', "WHAT YOU GET",
       [("사진으로 단어 추출", "손으로 옮겨 적지 않습니다. 찍은 곳에서 바로 뽑습니다."), ("폴더로 묶는 단어장", "단원·시험 범위대로 묶어 두면 나중에 찾기 쉽습니다."), ("학습과 테스트", "외운 것은 접어 두고 틀린 것만 반복합니다.")]),
  care=("아이의 사진은<br />단어만 남기고 잊어요", "CARE", "사진은 단어를 뽑는 데만 쓰고 단어장에는 단어와 뜻만 남아요. 공부 기록은 이 서비스에만 쌓여요.",
       ["사진 인식은 동의 뒤에만", "기록은 서비스마다 따로", "쓰지 않는 서비스는 열지 않아도"]),
  cta=("오늘 한 장만<br />찍어 볼까요?", "myjane 계정 하나로 들어와요. 단어장과 기록은 이 서비스에만 쌓여요."),
  tags="#영어단어 #단어장 #영어공부 #공부기록 #SnapWord",
  story_hint="단어를 노트에 옮겨 적는 아이를 보며 만들었다 — 처럼, 운영자가 겪은 장면 한두 줄을 앞에 붙이면 좋다"),
"SnapNote": dict(key="snapnote", name="SnapNote", domain="snapnote.myjane.co.kr", eyebrow="SNAPNOTE · WRONG ANSWERS",
  hero=('틀린 문제만,<br /><span class="hl">모아 둡니다.</span>', "틀린 문제를 찍어 모노톤으로 정리해 나만의 오답노트를 만듭니다.<br />폴더로 묶어 인쇄해 다시 풀 수 있습니다."),
  why=("오답노트,<br />만들다가 포기하셨죠?", "오려 붙이고 옮겨 적는 데 시간이 다 가요.<br />막상 다시 풀 때는 어디 있는지도 모르고요.",
       [("오려 붙이는 오답노트", "시험지를 자르고 풀칠하는 사이 문제는 안 풀게 돼요."), ("사진은 앨범에 묻힘", "찍어 두기만 한 사진은 다시 열지 않아요. 풀어야 오답노트예요.")]),
  steps=[("틀린 문제를 찍는다", "시험지든 문제집이든 그 자리에서 찍습니다."), ("보기 좋게 정리된다", "모노톤으로 다듬어 오려 붙인 것처럼 깔끔하게 남습니다."), ("묶어서 인쇄한다", "폴더로 묶어 인쇄하면 그대로 오답노트가 됩니다.")],
  viz_title=('찍은 그대로,<br />깨끗한 흑백으로', "MONO", "배경과 그림자를 눌러 인쇄해도 깨끗해요. 오려 붙인 것처럼 문제만 남아요."),
  feats_title=('<span class="mark">다시 풀 것만</span> 남깁니다', "WHAT YOU GET",
       [("사진 한 장으로", "오려 붙이거나 다시 옮겨 적지 않습니다."), ("모노톤 정리", "배경과 그림자를 눌러 인쇄해도 깨끗합니다."), ("인쇄해서 다시 풀기", "화면으로 보는 것과 손으로 푸는 것은 다릅니다.")]),
  care=("화면보다<br />손으로 다시 풀어요", "CARE", "폴더째 인쇄해서 종이로 다시 풀어요. 사진은 문제를 정리하는 데만 쓰고 기록은 이 서비스에만 쌓여요.",
       ["인쇄해서 다시 풀기", "사진 인식은 동의 뒤에만", "기록은 서비스마다 따로"]),
  cta=("틀린 문제 하나만<br />찍어 볼까요?", "myjane 계정 하나로 들어와요. 오답노트와 기록은 이 서비스에만 쌓여요."),
  tags="#오답노트 #수학공부 #문제집 #공부기록 #SnapNote",
  story_hint="시험지를 자르고 붙이던 밤 — 처럼, 운영자가 겪은 장면 한두 줄을 앞에 붙이면 좋다"),
"2hbk": dict(key="2hbk", name="2hbk", domain="2hbk.myjane.co.kr", eyebrow="2HBK · STICKER GOALS",
  hero=('오늘 하나,<br /><span class="hl">스티커 한 장.</span>', "목표를 정하고 해낼 때마다 스티커를 붙입니다.<br />칸이 채워지는 걸 보는 것만으로 다음 하나를 하게 됩니다."),
  why=("작심삼일,<br />왜 그럴까요?", "해낸 게 눈에 안 보이면 이어 가기 어려워요.<br />숫자보다 <strong>남은 칸</strong>이 보여야 다음 하나를 하게 돼요.",
       [("체크리스트는 금방 잊어요", "✓ 표시는 지나가면 끝이에요. 쌓인 게 보이지 않아요."), ("아이에게는 더 그래요", "칭찬 스티커판이 냉장고에 붙어 있던 이유가 있어요.")]),
  steps=[("목표를 만든다", "이름과 필요한 스티커 수를 정합니다. 20칸짜리 판이 생깁니다."), ("해낼 때마다 붙인다", "목표를 만든 사람이 스티커를 붙입니다. 잘못 붙였다면 뺄 수도 있습니다."), ("다 채우면 달성", "칸을 다 채우면 금색 판으로 바뀝니다. 지나온 기록은 그대로 남습니다.")],
  viz_title=('남은 칸이<br />보이면 하게 돼요', "BOARD", "12/20이라고 적는 것보다 빈 칸 여덟 개가 보이는 쪽이 훨씬 잘 통해요. 다 채우면 금색 판으로 바뀌어요."),
  feats_title=('혼자 해도, <span class="mark">같이 해도</span>', "THREE MODES",
       [("혼자 하기 · 나만 보기", "내 목표를 내가 채웁니다. 만들면 바로 참가자가 됩니다."), ("겨루기 · 전체 공개", "누구나 찾아 참가를 요청할 수 있습니다. 같은 목표를 여럿이 나란히 채웁니다."), ("챌린저 모집 · 친구에게만", "친구로 이어진 사람에게만 보입니다. 초대해서 함께 시작합니다.")]),
  care=("스티커는 목표를<br />만든 사람이 붙여요", "TOGETHER", "아이의 목표는 부모가, 함께 겨루는 목표는 그 목표를 연 사람이 붙입니다. 아무나 남의 칸을 채울 수 없어요.",
       ["부모가 붙이는 아이 목표", "친구 초대", "기록은 서비스마다 따로"]),
  cta=("오늘 목표 하나만<br />정해 볼까요?", "myjane 계정 하나로 들어와요. 목표와 스티커 기록은 이 서비스에만 쌓여요."),
  tags="#습관만들기 #칭찬스티커 #목표달성 #습관기록 #2hbk",
  story_hint="함히보까 — 아이와 냉장고 스티커판을 쓰던 이야기처럼, 운영자가 겪은 장면 한두 줄을 앞에 붙이면 좋다"),
"typelog": dict(key="typelog", name="TypeLog", domain="typelog.myjane.co.kr", eyebrow="TYPE PLAY",
  hero=('어떤 타입이<br /><span class="hl">나와 가장 가까울까요?</span>', "짧은 질문에 답하면 나의 타입이 나와요.<br />다시 할 때마다 그 변화가 기록으로 쌓여요."),
  why=("한 번 하고<br />잊어버리셨죠?", "결과는 재밌는데 캡처 한 장으로 끝나요.<br />몇 달 뒤 다시 하면 뭐가 달라졌는지 볼 길이 없었어요.",
       [("결과가 캡처로 흩어져요", "그때 나온 타입이 어디 있는지, 지난번과 같은지 모르게 돼요."), ("아이는 자주 바뀌어요", "자라면서 답이 달라지는 게 정상이에요. 그 변화가 재미예요.")]),
  steps=[("질문에 답해요", "한 번에 한 질문씩 나와요. 마음이 바뀌면 되돌아가도 괜찮아요."), ("나의 타입을 봐요", "어울리는 순간과 잘 맞는 타입까지 함께 알려드려요."), ("기록으로 모아요", "다시 해볼 수 있어요. 나온 타입은 도감에 모여요.")],
  viz_title=('나온 타입은<br />도감에 모여요', "COLLECTION", "회차마다 나온 타입이 전부 모여요. 지난번과 다르면 \"이번엔 다른 타입이 나왔어요\"라고 알려줘요."),
  feats_title=('<span class="mark">검사</span>가 아니라 놀이예요', "WHAT YOU GET",
       [("짧은 질문지 여러 개", "16가지 성향 · 나와 가까운 동물 · 나에게 맞는 이름. 아이도 금방 해요."), ("회차별 기록", "같은 질문지를 다시 하면 회차가 쌓이고, 바뀐 지점을 한 줄로 말해줘요."), ("타입 도감", "지금까지 나온 타입을 카드로 모아요. 안 나온 건 실루엣으로.")]),
  care=("점수도, 등급도<br />없어요", "PLAY", "숫자로 사람을 재지 않아요. \"~한 편이에요\"라고만 말해요. 로그인 없이 친구가 보낸 링크로 한 번 해볼 수도 있어요.",
       ["점수·등급 없음", "링크로 한 번 해보기", "기록은 서비스마다 따로"]),
  cta=("지금<br />해볼까요?", "myjane 계정 하나로 들어와요. 타입 기록은 이 서비스에만 쌓여요."),
  tags="#성향테스트 #나는어떤타입 #아이랑놀기 #성향기록 #TypeLog",
  story_hint="아이가 '나는 무슨 동물이야?'라고 물었던 날 — 처럼, 운영자가 겪은 장면 한두 줄을 앞에 붙이면 좋다"),
}

def build(app):
    a = APPS[app]; name = a["name"]; k = a["key"]; n = 8
    hero_h, hero_lead = a["hero"]
    why_h, why_lead, why_items = a["why"]
    viz_h, viz_eyebrow, viz_lead = a["viz_title"]
    feat_h, feat_eyebrow, feat_items = a["feats_title"]
    care_h, care_eyebrow, care_lead, pills = a["care"]
    cta_h, cta_lead = a["cta"]
    cards = []
    cards.append(f'\n<section class="card dark" data-i="1">\n  <div class="eyebrow">{a["eyebrow"]}</div>\n  <h1>{hero_h}</h1>\n  <p class="lead">{hero_lead}</p>\n  <div class="foot">{brand(k, name, "c1")}<span class="url">{a["domain"]}</span></div>\n</section>\n')
    cards.append(card("tint", 2, n, "WHY", f'  <h2>{why_h}</h2>\n  <p class="lead">{why_lead}</p>\n  {feats(why_items)}', name))
    cards.append(card("", 3, n, "HOW IT WORKS", f'  <h2>세 걸음이면 됩니다</h2>\n  {steps(a["steps"])}', name))
    cards.append(card("", 4, n, viz_eyebrow, f'  <h2>{viz_h}</h2>\n  <div class="viz">{VIZ[k]}</div>\n  <p class="lead" style="margin-top:20px">{viz_lead}</p>', name))
    cards.append(card("tint", 5, n, feat_eyebrow, f'  <h2>{feat_h}</h2>\n  {feats(feat_items)}', name))
    cards.append(card("", 6, n, "ONE ACCOUNT", '  <h2>계정만 공유해요</h2>\n  <p class="lead">myjane 계정 하나로 여러 기록 서비스를 골라 씁니다. 기록과 데이터는 서비스마다 따로 쌓여요.</p>\n  ' + feats([("하나만 써도 충분해요", "쓰지 않는 서비스는 열지 않아도 돼요. 이 앱만 써도 됩니다."), ("계정만, 기록은 따로", "공부는 공부끼리, 건강은 건강끼리, 습관은 습관끼리 쌓여요.")]), name))
    cards.append(card("gold", 7, n, care_eyebrow, f'  <h2>{care_h}</h2>\n  <p class="lead">{care_lead}</p>\n  <div style="margin-top:34px">' + "".join(f'<span class="pill">{p}</span>' for p in pills) + '</div>', name))
    cards.append(f'\n<section class="card dark" data-i="8">\n  <div class="eyebrow">START</div>\n  <h1>{cta_h}</h1>\n  <p class="lead">{cta_lead}</p>\n  <span class="cta">{a["domain"]}</span>\n  <div class="foot">{brand(k, name, "c8")}<span>my<span style="color:#5fb8c9">jane</span></span></div>\n</section>\n')
    html = HEAD.format(name=name, n=n, css=CSS) + "".join(cards) + TAIL
    return html

def caption(app):
    a = APPS[app]; name = a["name"]
    hero_plain = a["hero"][0].replace("<br />", " ").replace('<span class="hl">', "").replace("</span>", "")
    why_h = a["why"][0].replace("<br />", " ")
    st = a["steps"]
    f = a["feats_title"][2]
    care = a["care"][2]
    return f"""# {name} 인스타그램 게시글 문구 (2026-09-09)

카드 8장(`instagram-{a['key']}.html` → `cards/`)과 함께 올리는 본문. 문장은 소개 페이지(app/page.tsx)의 것이고,
톤은 FitLog 게시글과 같다(첫 줄 후킹 · 짧은 줄 · 이모지 1~3개 · 질문형 CTA · 본문에 주소 없음 · 해시태그 5개).
→ my-obsidian-vault / 30-Patterns/SNS 소개 카드와 게시글.md

> **운영자 이야기 자리.** {a['story_hint']}. 이야기가 들어가면 아래 첫 문단을 그 뒤로 미룬다.

## 기본안

{why_h}

{a['why'][1].replace('<br />', chr(10)).replace('<strong>', '').replace('</strong>', '')}

그래서 만들었습니다, {name} ✨

📸 {st[0][0]} — {st[0][1]}
📚 {st[1][0]} — {st[1][1]}
✅ {st[2][0]} — {st[2][1]}

{care}

저처럼 필요했던 분들께 무료로 공개합니다 🫶
{a['cta'][0].replace('<br />', ' ')}

👉 프로필의 링크에서 {name} 을 열어 보세요.

{a['tags']}

## 짧은 안 (첫 줄이 잘리는 피드용)

{hero_plain}
{a['hero'][1].replace('<br />', ' ')}
{f[0][0]} · {f[1][0]} · {f[2][0]}.

프로필의 링크에서 {name} 을 열어 보세요 👉

{a['tags']}

## 해시태그 — 5개
- 검색되는 큰 태그 셋 + 맥락 하나 + 서비스 이름 하나. 브랜드(#myjane)·광고성 태그는 넣지 않는다

## 다듬을 때
- 운영자의 이야기가 오면 첫 문단으로 올리고, 사실·감정·숫자는 그대로 둔다
- 다른 서비스를 나열하지 않는다. "계정만 공유" 는 카드 6장에만
"""

EXPORT = r'''/**
 * 인스타그램 카드 HTML → PNG 내보내기.
 *
 *   node docs/marketing/export-cards.mjs            (저장소 루트에서)
 *   → docs/marketing/cards/<html 파일명>-01.png …   (2160×2160, 2배 해상도 · SCALE=3 이면 3240)
 *
 * 이 폴더의 instagram-*.html 을 모두 찾아 카드(.card) 요소를 한 장씩 찍는다.
 * 화면 캡처는 배율·안티앨리어싱 때문에 흐리다. 로컬 Chrome(없으면 Edge)을 headless 로 띄운다.
 * playwright-core 는 다른 저장소(klead)에 설치된 것을 빌려 쓴다 — 브라우저를 내려받지 않는다.
 * → my-obsidian-vault / 30-Patterns/SNS 소개 카드와 게시글.md
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const outDir = path.join(here, "cards");
const scale = Number(process.env.SCALE ?? 2);
const htmls = fs.readdirSync(here).filter((f) => /^instagram-.*\.html$/.test(f));
if (htmls.length === 0) { console.error("instagram-*.html 이 없습니다."); process.exit(1); }

let pw = null;
for (const c of ["C:/Dev/klead", "C:/Dev/jangmini", "C:/Dev/myjane"]) {
  try { pw = createRequire(path.join(c, "package.json"))("playwright-core"); break; } catch { /* 다음 */ }
}
if (!pw) { console.error("playwright-core 를 찾지 못했습니다. `npm i -D playwright-core` 후 다시 실행하세요."); process.exit(1); }

let browser = null;
for (const opt of [{ channel: "chrome" }, { channel: "msedge" }]) {
  try { browser = await pw.chromium.launch({ ...opt, headless: true }); break; } catch { /* 다음 */ }
}
if (!browser) { console.error("Chrome 또는 Edge 를 찾지 못했습니다."); process.exit(1); }

fs.mkdirSync(outDir, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: scale });
for (const html of htmls) {
  const base = html.replace(/\.html$/, "");
  await page.goto("file:///" + path.join(here, html).replace(/\\/g, "/"), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const cards = await page.$$(".card");
  let i = 0;
  for (const card of cards) {
    i += 1;
    const file = path.join(outDir, `${base}-${String(i).padStart(2, "0")}.png`);
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: file, type: "png" });
    console.log("saved", path.relative(process.cwd(), file));
  }
  console.log(`${base}: ${i}장 · ${1080 * scale}×${1080 * scale}px`);
}
await browser.close();
'''

def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    io.open(p, "w", encoding="utf-8", newline="\n").write(s)

for repo, app in [("SnapWord", "SnapWord"), ("SnapNote", "SnapNote"), ("2hbk", "2hbk"), ("typelog", "typelog")]:
    a = APPS[app]
    d = f"{ROOT}/{repo}/docs/marketing"
    wr(f"{d}/instagram-{a['key']}.html", build(app))
    wr(f"{d}/instagram-{a['key']}-caption.md", caption(app))
    wr(f"{d}/export-cards.mjs", EXPORT)
    gi = f"{ROOT}/{repo}/.gitignore"
    g = io.open(gi, encoding="utf-8").read() if os.path.exists(gi) else ""
    if "docs/marketing/cards/" not in g:
        io.open(gi, "a", encoding="utf-8", newline="\n").write("\n# 인스타 카드 PNG 는 export-cards.mjs 로 다시 만들 수 있다\ndocs/marketing/cards/\n")
    print("written", repo)
# fitlog 의 내보내기도 범용판으로
wr(f"{ROOT}/fitlog/docs/marketing/export-cards.mjs", EXPORT)
print("done")
