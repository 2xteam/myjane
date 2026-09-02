# myjane

`www.myjane.co.kr` — SnapWord와 SnapNote로 이동하는 링크 사이트.

## 스택

Next.js 15 (App Router) · React 19 · TypeScript · Node.js 22
의존성은 Next/React뿐이며, 서버 로직이 없어 **정적 페이지로 빌드**된다.
Vercel에서 함수 호출이 발생하지 않으므로 사실상 무료로 운영된다.

## 개발

```bash
npm install
npm run dev      # http://localhost:3002
```

포트를 3002로 둔 이유: SnapWord(3000)·SnapNote(3001)와 동시에 띄우기 위해서다.

## 디자인

브랜드 색은 MJ 아이콘([public/myjane-mark.svg](public/myjane-mark.svg))에서 가져왔다.
값은 [app/globals.css](app/globals.css)의 CSS 변수로 모아 두었다.

| | 배경 | 강조 |
|---|---|---|
| 다크(기본) | `#0f1e3d` | `#fdc02b` |
| 라이트 | `#f4f6fc` | `#f2951a` (텍스트용 `#a2620a`) |

앰버는 흰 배경에서 대비가 부족하므로, 라이트 모드의 텍스트 강조에는
어둡게 조정한 `--accent-ink`를 쓴다.
라이트/다크는 OS 설정(`prefers-color-scheme`)을 따른다.
카드 아이콘은 두 앱의 앱 전환 메뉴에서 쓰는 아이콘과 동일한 이미지다.

### 아이콘 에셋

`public/myjane-icon.png`(512px)가 원본이고 나머지는 여기서 파생한다.

| 파일 | 용도 |
|---|---|
| `public/myjane-icon.png` | 원본 512px, 페이지 히어로에 사용 |
| `public/icon-192.png` | PWA·안드로이드 홈 화면 |
| `public/apple-touch-icon.png` | iOS 홈 화면 (180px) |
| `public/favicon-32.png` | 브라우저 탭 |
| `app/icon.png` | Next.js 파일 규칙 파비콘 (256px) |

아이콘을 교체하면 512px 원본을 `public/myjane-icon.png`로 덮어쓴 뒤
아래 명령으로 나머지를 다시 만든다(`sharp` 필요).

```bash
node -e "const s=require('sharp');[[192,'public/icon-192.png'],[180,'public/apple-touch-icon.png'],[32,'public/favicon-32.png'],[256,'app/icon.png']].forEach(([n,p])=>s('public/myjane-icon.png').resize(n,n).png().toFile(p))"
```

아이콘 배경(네이비)이 페이지 배경과 거의 같아, 히어로의 타일은
`.mark`의 테두리·그림자로 경계를 만든다.

링크 대상을 바꾸거나 앱을 추가하려면 [app/page.tsx](app/page.tsx)의 `APPS` 배열만 수정하면 된다.

## 배포 (Vercel)

1. Vercel → Add New → Project → `2xteam/myjane` Import
2. Framework: Next.js 자동 감지, **Node.js Version 22.x**
3. 환경 변수 없음 — 그대로 Deploy
4. Settings → Domains에 다음 두 개 추가
   - `www.myjane.co.kr` (Primary)
   - `myjane.co.kr` → `www.myjane.co.kr`로 리다이렉트

### DNS (가비아)

`myjane.co.kr`의 네임서버는 가비아다.
My가비아 → 서비스관리 → 도메인 → `myjane.co.kr` → DNS 정보 → DNS 관리

| 호스트 | 타입 | 값 | 비고 |
|---|---|---|---|
| `@` | A | Vercel이 안내하는 A 레코드 IP | 기존 `165.22.247.25` 삭제 |
| `www` | CNAME | Vercel이 안내하는 CNAME 값 | 기존 A 레코드 삭제 |

- 값은 반드시 **Vercel Domains 탭에 표시된 것**을 쓴다.
- 가비아는 apex(`@`)에 CNAME을 넣을 수 없어 apex는 A 레코드를 사용한다.
- 같은 호스트에 A와 CNAME은 공존할 수 없으므로 기존 A를 먼저 삭제한다.
- **`snapword` / `snapnote` 레코드는 건드리지 않는다.** 이미 Vercel을 가리키고 있다.

이 전환이 끝나면 Cloudways 서버에 남은 앱이 없어지므로 서버를 정리할 수 있다.

## 관련 저장소

- [snapword](https://github.com/2xteam/snapword) — `snapword.myjane.co.kr`
- [snapnote](https://github.com/2xteam/snapnote) — `snapnote.myjane.co.kr`
