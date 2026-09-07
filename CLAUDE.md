# 작업 전에 읽을 것

이 프로젝트의 배경 지식은 별도의 옵시디언 볼트에 정리되어 있다.

```
로컬:   C:\Dev\my-obsidian-vault
저장소: https://github.com/2xteam/my-obsidian-vault
```

## 먼저 읽기

1. `10-Projects/MyJane.md` — 이 프로젝트의 스택·데이터·현황·결정 사항
2. `00-Meta/AI 협업 규칙.md` — 볼트를 읽고 갱신하는 방법

작업 성격에 따라 추가로:

| 작업 | 노트 |
|---|---|
| 배포·환경 변수·도메인 | `30-Patterns/Vercel 배포 패턴.md`, `40-Infra/도메인과 DNS.md` |
| 이미지 업로드 | `30-Patterns/이미지 업로드 패턴.md` |
| 로그인·회원·세션 | `30-Patterns/인증과 세션 공유.md` |
| DB 연결 | `40-Infra/MongoDB Atlas.md` |
| 페이지 디자인 | `20-Design/` 전체 |

## 이 프로젝트 메모

- 통합 로그인·회원가입과 통합 admin이 여기 있다 → `30-Patterns/통합 admin.md`
- 회원은 `user` DB 공유 — 포털이 원본을 갖는다
- `/admin` 은 앱 DB를 직접 읽지 않고 **각 앱의 `/api/admin/*`** 을 부른다
- 필수 환경 변수: `MONGODB_URI` `SESSION_SECRET` `ADMIN_API_SECRET` `SMTP_*`

## 디자인을 만질 때

**먼저 검사부터 돌린다.**

```bash
cd C:/Dev/myjane && npm run design:check
```

규칙 · 이유 · 현재 기준선 → my-obsidian-vault / 20-Design/여섯 앱 디자인 시스템.md

- 시트의 **원형 장식은 쓰지 않는다** (2026-09-07 에 여섯 앱에서 걷었다)
- `components/Sheet.tsx` 는 다섯 앱에 **복사본**이다. 고치면 다섯 앱을 함께 고친다
- 아이콘은 여섯 개가 한 가족이다. 하나만 바꾸지 않는다

### 포인트 요소 넷 — CSS 원본도 한 곳이다

```
design/elements.css          ← 여기만 고친다
npm run elements -- --write  ← 여섯 앱의 app/elements.css 가 함께 갱신된다
```

`app/elements.css` 는 **생성 파일**이다. `npm run elements` 는 쓰지 않고 검사만
하며, 앱마다 `layout.tsx` 의 import 순서와 `ScrollProgress.tsx` 존재,
다섯 앱 `Sheet.tsx` 가 아직 같은지까지 함께 본다.

| 요소 | 클래스 | 쓰는 법 |
|---|---|---|
| 스크롤 진행 띠 | `.scroll-progress` | sticky 헤더 안에 `<ScrollProgress />` 하나 |
| 형광 밑줄 | `.mark` | 밝은 시트 헤드라인 **한 화면에 한 군데** |
| 프로세스 타임라인 | `.flow` | 3단계 이상 · 순서가 중요할 때만. 가운데 정렬 시트면 `.flow--center` |
| 라운딩 포인트 (시트) | `.sheet--point` | 히어로 · 마무리 CTA. **한 화면에 최대 2개** |
| 라운딩 포인트 (안쪽 카드) | `.card--point` | 시트 안 카드들에 **한 벌로** 다 붙인다 |

`npm run design:check` 의 규칙 G 가 남발을 막는다. 어디에 넣고 어디에 넣지
않는지는 → my-obsidian-vault / 20-Design/여섯 앱 디자인 시스템.md

⚠️ `elements.css` 는 `layout.tsx` 에서 **globals.css 다음 줄**이라야 한다.
`@import` 로 넣으면 `.sheet--point` 가 `.sheet` 에 **조용히** 진다.

## 색을 바꿀 때

**`app/palette.css` 를 직접 고치지 말 것.** 생성 파일이다.

색은 여섯 앱이 공유하고 원본은 한 곳뿐이다.

```
design/palette.json          ← 여기만 고친다 (원본이 이 저장소에 있다)
npm run palette -- --write   ← 여섯 앱이 함께 갱신된다
```

`npm run palette` 는 쓰기 전에 대비를 31건 검사하고, 하나라도 미달이면
**아무 파일도 쓰지 않고 멈춘다.**

새 색을 쓸 때는 리터럴 대신 토큰을 쓴다. 짙은 시트·어두운 푸터·버튼
그라디언트도 토큰이 있다 (`--sheet-dark` `--footer-bg` `--btn-gradient`
`--on-dark` `--accent-on-dark`). 리터럴로 쓰면 다음 색 교체 때 또 손으로 찾아야 한다.

⚠️ 밝은 색을 글자로 쓰지 말 것. 면적용과 글자용이 따로 있다 —
`--accent` / `--accent-ink`, `--point` / `--point-ink`, `--danger` / `--danger-ink`.
→ my-obsidian-vault / 20-Design/먹청 톤 팔레트.md

## 지금 진행 중인 큰 작업

세 덩어리가 병행 중이다. 만지기 전에 해당 계획서를 읽고, 진행 상황을 거기 갱신한다.

```
my-obsidian-vault / 50-Plans / Plans MOC.md
  A 디자인 요소 추가      프로그레스 바 · 밑줄 포인트 · 프로세스 타임라인 · 카드 포인트
  B 로그인·회원가입 개편   이메일 필수화 · 인증 · 기존 회원 이메일 수집
  C 법적 페이지           개인정보처리방침 · 이용약관 · 쿠키 안내
```

⚠️ B 는 여섯 앱이 공유하는 `users` 컬렉션을 건드린다.
**`email` 을 스키마에서 필수로 바꾸면 기존 전화번호 계정의 `save()` 가 터진다** —
계획서에 이유가 있다.

## 작업이 끝나면

바뀐 사실(도메인·DB·진행 상황·새로 발견한 함정)을 볼트의 해당 노트에 반영하고
`updated` 날짜를 올린다. 볼트 수정은 코드와 **별도 커밋**으로 남긴다.

비밀값은 볼트에 쓰지 않는다. 공개 저장소다.
