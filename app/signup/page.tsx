"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { AuthShell, AuthTabs } from "@/components/AuthShell";
import { buildReturnUrl, getApp } from "@/lib/apps";
import { saveSession, type SessionUser } from "@/lib/session";

/**
 * 통합 회원가입.
 *
 * **이메일이 필수, 전화번호가 선택이다.** (2026-09-07 에 뒤집었다)
 * 예전에는 둘 중 하나만 넣으면 됐는데, 전화번호만 넣은 사람은 비밀번호를
 * 잊었을 때 스스로 되찾을 길이 없었다.
 *
 * 필수·선택을 라벨 옆에 붙여 **입력 전에** 알 수 있게 한다. 넣고 나서
 * "이건 필수입니다" 를 만나는 것이 가장 나쁘다.
 *
 * `?from=fitlog` 처럼 출처 앱을 받으면 그 앱에 필요한 값을 **선택으로** 더 받는다.
 * 건너뛰어도 가입은 끝난다 → lib/apps.ts
 */

/** 라벨 옆에 붙는 작은 표시. 색만으로 구분하지 않도록 글자로 적는다 */
function Mark({ required }: { required: boolean }) {
  return (
    <span
      style={{
        marginLeft: 6,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: required ? "var(--accent-ink)" : "var(--text-muted)",
      }}
    >
      {required ? "필수" : "선택"}
    </span>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const app = getApp(params.get("from"));
  const returnUrl = buildReturnUrl(app, params.get("next"));
  const needsBody = Boolean(app?.needsBodyProfile);
  const needsNickname = Boolean(app?.needsNickname);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [reveal, setReveal] = useState(false);

  const [nickname, setNickname] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** 가입이 끝난 뒤의 안내 화면. 바로 앱으로 보내면 인증 메일 안내를 놓친다 */
  const [done, setDone] = useState<{ email: string; mailSent: boolean } | null>(null);

  const thisYear = useMemo(() => new Date().getFullYear(), []);

  const submit = useCallback(async () => {
    if (password !== passwordConfirm) {
      setMsg("입력한 두 비밀번호가 일치하지 않아요.");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          passwordConfirm,
          // 빈 값은 아예 보내지 않는다 — 선택 항목이라 없는 것과 같다
          ...(phone.trim() ? { phone } : {}),
          ...(nickname.trim() ? { nickname } : {}),
          ...(heightCm ? { heightCm: Number(heightCm) } : {}),
          ...(gender ? { gender } : {}),
          ...(birthYear ? { birthYear: Number(birthYear) } : {}),
          signupFrom: app?.key ?? null,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        token?: string;
        mailSent?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMsg(json.error ?? "가입에 실패했습니다.");
        return;
      }
      // 토큰을 함께 저장해야 2hbk 같은 앱이 이 세션을 쓸 수 있다
      saveSession(json.user, json.token);
      setDone({ email: json.user.email ?? email, mailSent: json.mailSent !== false });
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [
    name,
    email,
    password,
    passwordConfirm,
    phone,
    nickname,
    heightCm,
    gender,
    birthYear,
    app,
  ]);

  const goOn = useCallback(() => {
    if (app) window.location.href = returnUrl;
    else router.replace("/");
  }, [app, returnUrl, router]);

  const qs = params.toString();

  return (
    <AuthShell
      eyebrow="START YOUR RECORD"
      headline={
        <>
          기록은
          <br />
          여기서 시작해요
        </>
      }
      storySub={
        <>
          한 번 가입하면 여러 기록을
          <br />
          같은 계정으로 골라 써요.
        </>
      }
      app={app}
      note={
        <>
          <strong>NOTE · 이것만 확인해 주세요</strong>
          * 이메일은 로그인과 비밀번호 찾기에 쓰여요. 받을 수 있는 주소로 넣어 주세요
          <br />* 전화번호는 선택이에요. 넣지 않아도 모든 기능을 쓸 수 있어요
          {needsBody || needsNickname ? (
            <>
              <br />* 아래 {app?.name} 항목은 <strong>입력하지 않아도 돼요.</strong> 쓰실 때
              입력해도 됩니다
            </>
          ) : null}
        </>
      }
    >
      <AuthTabs current="signup" qs={qs} />

      {done ? (
        <>
          <h2 className="auth-title">가입이 끝났어요</h2>
          <p className="auth-sub">
            {done.mailSent
              ? `${done.email} 으로 인증 메일을 보냈어요. 메일함을 확인해 주세요.`
              : `${done.email} 으로 인증 메일을 보내지 못했어요. 나중에 다시 받을 수 있어요.`}
          </p>
          <p className="auth-hint">
            인증하지 않아도 지금 바로 쓸 수 있어요. 비밀번호를 잊었을 때 재설정 링크를
            받으려면 인증이 필요해요.
          </p>
          <button type="button" className="auth-btn" onClick={goOn}>
            {app ? `${app.name}${app.particle ?? "으로"} 시작하기` : "시작하기"}
          </button>
        </>
      ) : (
        <>
          <h2 className="auth-title">처음 오셨네요</h2>
          <p className="auth-sub">이메일과 비밀번호로 계정을 만들어요</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void submit();
            }}
          >
            <div className="auth-field">
              <label className="auth-label" htmlFor="name">
                이름
                <Mark required />
              </label>
              <input
                id="name"
                className="auth-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="홍길동"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="email">
                이메일
                <Mark required />
              </label>
              <input
                id="email"
                className="auth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
              />
              <p className="auth-hint">로그인과 비밀번호 찾기에 쓰여요.</p>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="password">
                비밀번호
                <Mark required />
              </label>
              <div className="auth-input-wrap">
                <input
                  id="password"
                  className="auth-input"
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 52 }}
                  required
                />
                <button
                  type="button"
                  className="auth-reveal"
                  onClick={() => setReveal((v) => !v)}
                >
                  {reveal ? "숨기기" : "보기"}
                </button>
              </div>
              <p className="auth-hint">8자 이상, 영문과 숫자를 함께 넣어 주세요.</p>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="passwordConfirm">
                비밀번호 확인
                <Mark required />
              </label>
              <input
                id="passwordConfirm"
                className="auth-input"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="phone">
                전화번호
                <Mark required={false} />
              </label>
              <input
                id="phone"
                className="auth-input"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
              />
              <p className="auth-hint">문자로 알림을 받고 싶을 때만 넣어 주세요.</p>
            </div>

            {needsNickname ? (
              <div className="auth-field">
                <label className="auth-label" htmlFor="nickname">
                  닉네임
                  <Mark required={false} />
                </label>
                <input
                  id="nickname"
                  className="auth-input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="이름을 그대로 써도 돼요"
                />
                <p className="auth-hint">
                  {app?.name}에서 보이는 이름이에요. 입력하지 않아도 돼요.
                </p>
              </div>
            ) : null}

            {needsBody ? (
              <>
                <div className="auth-section">
                  <p className="auth-eyebrow">BODY PROFILE</p>
                  <p>
                    인바디 결과를 해석하는 데 쓰는 정보예요.{" "}
                    <strong>입력하지 않아도 돼요.</strong> 쓰실 때 입력해도 됩니다.
                  </p>
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="heightCm">
                    키 (cm)
                    <Mark required={false} />
                  </label>
                  <input
                    id="heightCm"
                    className="auth-input"
                    type="number"
                    inputMode="numeric"
                    min={80}
                    max={250}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="170"
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="gender">
                    성별
                    <Mark required={false} />
                  </label>
                  <select
                    id="gender"
                    className="auth-input"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="">선택 안 함</option>
                    <option value="male">남성</option>
                    <option value="female">여성</option>
                  </select>
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="birthYear">
                    출생연도
                    <Mark required={false} />
                  </label>
                  <input
                    id="birthYear"
                    className="auth-input"
                    type="number"
                    inputMode="numeric"
                    min={1900}
                    max={thisYear}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="1990"
                  />
                </div>
              </>
            ) : null}

            {/*
              ⚠️ 약관·개인정보 동의 체크박스가 들어갈 자리.

              문구와 링크가 C 작업(app/legal/*)의 결과물이라 여기서 먼저 만들면
              두 벌이 된다. C 가 페이지를 올린 뒤 이 자리에 체크박스를 넣는다.
              → my-obsidian-vault / 50-Plans/C 법적 페이지.md
            */}

            <button type="submit" className="auth-btn" disabled={busy}>
              {busy ? "만드는 중…" : "가입하고 시작하기"}
            </button>
          </form>

          {msg ? <p className="auth-msg">{msg}</p> : null}

          <div className="auth-links">
            <div>
              이미 계정이 있으신가요?{" "}
              <Link href={qs ? `/login?${qs}` : "/login"}>로그인</Link>
            </div>
          </div>
        </>
      )}
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
