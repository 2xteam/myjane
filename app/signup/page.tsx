"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { AuthShell, AuthTabs } from "@/components/AuthShell";
import { buildReturnUrl, getApp } from "@/lib/apps";
import { parseIdentifier } from "@/lib/identifier";
import { saveSession, type SessionUser } from "@/lib/session";

/**
 * 통합 회원가입.
 *
 * **이메일이나 전화번호 중 하나만** 넣으면 가입된다. 넣은 쪽에 따라 비밀 값이
 * 비밀번호(이메일)나 PIN(전화번호)이 되고, 그것이 그 계정의 로그인 수단이 된다.
 *
 * `?from=fitlog` 처럼 출처 앱을 받으면
 *  - 가입 출처를 `users.signupFrom`에 기록하고
 *  - 신체 프로필이 필요한 앱(FitLog)이면 키·성별·출생연도를 함께 받는다.
 *    (인바디 표준범위와 기초대사량이 성별·연령 기준이라 없으면 해석이 안 된다)
 */
function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const app = getApp(params.get("from"));
  const returnUrl = buildReturnUrl(app, params.get("next"));
  const needsBody = Boolean(app?.needsBodyProfile);

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [secretConfirm, setSecretConfirm] = useState("");
  const [reveal, setReveal] = useState(false);

  const [heightCm, setHeightCm] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const thisYear = useMemo(() => new Date().getFullYear(), []);

  /** 입력칸에 넣은 값이 이메일인지 전화번호인지에 따라 안내와 최소 길이가 달라진다 */
  const kind = parseIdentifier(identifier).kind;
  const secretLabel = kind === "phone" ? "PIN" : "비밀번호";
  const secretHint =
    kind === "phone"
      ? "숫자 4자리 이상. 전화번호와 함께 로그인에 사용해요."
      : kind === "email"
        ? "8자 이상으로 정해 주세요."
        : "이메일을 넣으면 비밀번호(8자 이상), 전화번호를 넣으면 PIN(4자 이상)이에요.";

  const submit = useCallback(async () => {
    if (secret !== secretConfirm) {
      setMsg("입력한 두 값이 일치하지 않아요.");
      return;
    }
    if (needsBody && (!heightCm || !gender || !birthYear)) {
      setMsg("키·성별·출생연도를 모두 입력해 주세요.");
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
          identifier,
          secret,
          secretConfirm,
          signupFrom: app?.key ?? null,
          ...(needsBody
            ? { heightCm: Number(heightCm), gender, birthYear: Number(birthYear) }
            : {}),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        token?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMsg(json.error ?? "가입에 실패했습니다.");
        return;
      }
      // 토큰을 함께 저장해야 2hbk 같은 앱이 이 세션을 쓸 수 있다
      saveSession(json.user, json.token);
      if (app) window.location.href = returnUrl;
      else router.replace("/");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [
    name,
    identifier,
    secret,
    secretConfirm,
    needsBody,
    heightCm,
    gender,
    birthYear,
    app,
    returnUrl,
    router,
  ]);

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
          * 이메일이나 전화번호 **하나만** 넣으면 돼요. 넣은 쪽으로 로그인해요
          <br />* 이메일로 가입하면 비밀번호를 잊었을 때 재설정 링크를 받을 수 있어요
          {needsBody ? (
            <>
              <br />* 키·성별·출생연도는 인바디 결과를 해석하는 데 필요해요.
              나중에 마이페이지에서 바꿀 수 있어요.
            </>
          ) : null}
        </>
      }
    >
      <AuthTabs current="signup" qs={qs} />

      <h2 className="auth-title">처음 오셨네요</h2>
      <p className="auth-sub">이메일 또는 전화번호 하나로 계정을 만들어요</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
      >
        <div className="auth-field">
          <label className="auth-label" htmlFor="name">
            이름
          </label>
          <input
            id="name"
            className="auth-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="홍길동"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="identifier">
            이메일 또는 전화번호
          </label>
          <input
            id="identifier"
            className="auth-input"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@example.com 또는 01012345678"
          />
          <p className="auth-hint">
            {kind === "email"
              ? "이메일로 가입해요."
              : kind === "phone"
                ? "전화번호로 가입해요."
                : "둘 중 아무거나 하나만 넣으면 돼요."}
          </p>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="secret">
            {secretLabel}
          </label>
          <div className="auth-input-wrap">
            <input
              id="secret"
              className="auth-input"
              type={reveal ? "text" : "password"}
              autoComplete="new-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              style={{ paddingRight: 52 }}
            />
            <button
              type="button"
              className="auth-reveal"
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? "숨기기" : "보기"}
            </button>
          </div>
          <p className="auth-hint">{secretHint}</p>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="secretConfirm">
            {secretLabel} 확인
          </label>
          <input
            id="secretConfirm"
            className="auth-input"
            type="password"
            autoComplete="new-password"
            value={secretConfirm}
            onChange={(e) => setSecretConfirm(e.target.value)}
          />
        </div>

        {needsBody ? (
          <>
            <div className="auth-section">
              <p className="auth-eyebrow">BODY PROFILE</p>
              <p>인바디 결과를 해석하는 데 필요한 정보예요.</p>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="heightCm">
                키 (cm)
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
              </label>
              <select
                id="gender"
                className="auth-input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">선택해 주세요</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="birthYear">
                출생연도
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
