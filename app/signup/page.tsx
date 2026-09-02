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
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const [heightCm, setHeightCm] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const thisYear = useMemo(() => new Date().getFullYear(), []);

  const submit = useCallback(async () => {
    if (pin !== pinConfirm) {
      setMsg("PIN과 PIN 확인이 일치하지 않아요.");
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
          phone,
          email,
          pin,
          pinConfirm,
          signupFrom: app?.key ?? null,
          ...(needsBody
            ? {
                heightCm: Number(heightCm),
                gender,
                birthYear: Number(birthYear),
              }
            : {}),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMsg(json.error ?? "가입에 실패했습니다.");
        return;
      }
      saveSession(json.user);
      if (app) window.location.href = returnUrl;
      else router.replace("/");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [
    name,
    phone,
    email,
    pin,
    pinConfirm,
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
          <span>여기서 시작해요</span>
        </>
      }
      sub={
        <>
          한 번 가입하면 SnapWord · SnapNote · FitLog를
          <br />
          같은 계정으로 사용해요.
        </>
      }
      app={app}
      note={
        <>
          <strong>NOTE · 이것만 확인해 주세요</strong>
          * PIN은 4자리 이상으로 정해요. 전화번호와 함께 로그인에 사용해요.
          <br />* 이메일은 PIN을 잊었을 때 재설정 링크를 받는 곳이에요.
          {needsBody ? (
            <>
              <br />* 키·성별·출생연도는 인바디 결과를 해석하는 데 필요해요. 나중에
              마이페이지에서 바꿀 수 있어요.
            </>
          ) : null}
        </>
      }
    >
      <AuthTabs current="signup" qs={qs} />

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
          <label className="auth-label" htmlFor="phone">
            전화번호
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
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="email">
            이메일
          </label>
          <input
            id="email"
            className="auth-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
          <p className="auth-hint">PIN을 잊었을 때 재설정 링크를 받는 주소예요.</p>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="pin">
            PIN
          </label>
          <input
            id="pin"
            className="auth-input"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="4자리 이상"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="pinConfirm">
            PIN 확인
          </label>
          <input
            id="pinConfirm"
            className="auth-input"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value)}
          />
        </div>

        {needsBody ? (
          <>
            <p className="auth-eyebrow" style={{ marginTop: 26 }}>
              BODY PROFILE
            </p>

            <div className="auth-field">
              <label className="auth-label" htmlFor="heightCm">
                키 (cm)
              </label>
              <input
                id="heightCm"
                className="auth-input"
                type="number"
                inputMode="decimal"
                min={80}
                max={250}
                step="0.1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="179"
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
                placeholder="1988"
              />
            </div>
          </>
        ) : null}

        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? "가입 중…" : "가입하기"}
        </button>
      </form>

      {msg ? <p className="auth-msg">{msg}</p> : null}

      <div className="auth-links">
        <span>이미 계정이 있으신가요?</span>
        <Link href={qs ? `/login?${qs}` : "/login"}>로그인</Link>
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
