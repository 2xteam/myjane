export type SessionUser = {
  id: string;
  name: string;
  /** 전화번호+PIN 계열 앱이 쓰는 값. 이메일로 가입한 계정은 빈 문자열이다 */
  phone: string;
  /** 아래 셋은 이메일 로그인 앱(2hbk)이 쓰는 선택 필드 */
  email?: string;
  nickname?: string;
  userId?: string;
};

export const SESSION_KEY = "snap_user";

const SESSION_TTL_SEC = 30 * 24 * 60 * 60;

type StoredPayload = {
  v: 1;
  user: SessionUser;
  /**
   * 앱 서버가 검증하는 HMAC 서명 토큰 → lib/sessionToken.ts
   *
   * 이 쿠키는 클라이언트가 고칠 수 있는 평문이라 `user.id`를 그대로 믿을 수 없다.
   * 남의 데이터를 바꾸는 동작이 있는 앱은 이 토큰만 신뢰한다.
   */
  token?: string;
  expiresAt: number;
};

const ENV_COOKIE_DOMAIN: string | undefined =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_COOKIE_DOMAIN
    ? process.env.NEXT_PUBLIC_COOKIE_DOMAIN
    : undefined;

function getEffectiveDomain(): string | undefined {
  if (!ENV_COOKIE_DOMAIN) return undefined;
  if (typeof location === "undefined") return undefined;
  const host = location.hostname;
  const domain = ENV_COOKIE_DOMAIN.startsWith(".")
    ? ENV_COOKIE_DOMAIN.slice(1)
    : ENV_COOKIE_DOMAIN;
  if (host === domain || host.endsWith("." + domain)) return ENV_COOKIE_DOMAIN;
  return undefined;
}

function getCookie(name: string): string | null {
  return getCookieValues(name)[0] ?? null;
}

/**
 * 같은 이름의 쿠키를 **전부** 모은다.
 *
 * `.myjane.co.kr` 도메인 쿠키와 host-only 쿠키가 함께 있으면 브라우저가 둘 다 보내고,
 * 어느 쪽이 먼저 오는지는 기대할 수 없다. 첫 줄만 읽으면 낡은 쿠키를 집는다.
 */
function getCookieValues(name: string): string[] {
  if (typeof document === "undefined") return [];
  const prefix = name + "=";
  const out: string[] = [];
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    try {
      out.push(decodeURIComponent(trimmed.substring(prefix.length)));
    } catch {
      /* 못 읽는 값은 버린다 */
    }
  }
  return out;
}

/** 살아 있는 쿠키 중 **서명 토큰이 있는 것**을 우선해서 고른다 */
function readBestPayload(): StoredPayload | null {
  const now = Date.now();
  const alive = getCookieValues(SESSION_KEY)
    .map(readPayload)
    .filter((p): p is StoredPayload => p !== null && now <= p.expiresAt);

  if (alive.length === 0) return null;
  return alive.find((p) => p.token) ?? alive[0];
}

/**
 * 세션에 담긴 앱 서버용 서명 토큰. 없으면 그 세션은 토큰을 요구하는 앱
 * (2hbk)에서 쓸 수 없다 → lib/sessionToken.ts
 */
export function loadSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return readBestPayload()?.token ?? null;
}

function setCookie(name: string, value: string, maxAgeSec: number) {
  if (typeof document === "undefined") return;
  const isSecure =
    typeof location !== "undefined" && location.protocol === "https:";
  const cookieDomain = getEffectiveDomain();
  let cookie =
    `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
  if (cookieDomain) cookie += `; domain=${cookieDomain}`;
  if (isSecure) cookie += "; Secure";
  document.cookie = cookie;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  const cookieDomain = getEffectiveDomain();
  if (cookieDomain) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax; domain=${cookieDomain}`;
  }
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function isSessionUser(x: unknown): x is SessionUser {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.phone === "string";
}

function readPayload(raw: string): StoredPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.v === 1 && isSessionUser(o.user) && typeof o.expiresAt === "number") {
      return {
        v: 1,
        user: o.user,
        token: typeof o.token === "string" ? o.token : undefined,
        expiresAt: o.expiresAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function migrateOldStorageOnce(): void {
  if (typeof window === "undefined") return;
  try {
    // 이전 쿠키 이름(snapword_user)에서 마이그레이션
    const oldKey = "snapword_user";
    const oldRaw = getCookie(oldKey);
    if (oldRaw) {
      const payload = readPayload(oldRaw);
      if (payload && Date.now() <= payload.expiresAt) {
        deleteCookie(oldKey);
        saveSession(payload.user);
        return;
      }
      deleteCookie(oldKey);
    }

    const ssRaw = window.sessionStorage.getItem(SESSION_KEY);
    if (ssRaw) {
      const parsed = JSON.parse(ssRaw) as unknown;
      if (isSessionUser(parsed)) {
        window.sessionStorage.removeItem(SESSION_KEY);
        saveSession(parsed);
        return;
      }
      window.sessionStorage.removeItem(SESSION_KEY);
    }

    const lsRaw = window.localStorage.getItem(SESSION_KEY);
    if (lsRaw) {
      const payload = readPayload(lsRaw);
      if (payload && Date.now() <= payload.expiresAt) {
        window.localStorage.removeItem(SESSION_KEY);
        saveSession(payload.user);
        return;
      }
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    migrateOldStorageOnce();

    const raw = getCookie(SESSION_KEY);
    if (!raw) return null;

    const payload = readPayload(raw);
    if (!payload) {
      deleteCookie(SESSION_KEY);
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      deleteCookie(SESSION_KEY);
      return null;
    }

    return payload.user;
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser, token?: string) {
  if (typeof window === "undefined") return;

  /*
    토큰을 넘기지 않았으면 이미 있는 토큰을 그대로 살린다.
    사람이 바뀌었으면 남의 토큰을 물려줄 수 없으니 버린다.
    → 30-Patterns/인증과 세션 공유.md
  */
  const kept = readBestPayload();
  const carried =
    token ?? (kept && kept.user.id === user.id ? kept.token : undefined);

  const expiresAt = Date.now() + SESSION_TTL_SEC * 1000;
  const body: StoredPayload = {
    v: 1,
    user,
    ...(carried ? { token: carried } : {}),
    expiresAt,
  };
  setCookie(SESSION_KEY, JSON.stringify(body), SESSION_TTL_SEC);

  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  deleteCookie(SESSION_KEY);
  // 이전 쿠키 이름도 정리
  deleteCookie("snapword_user");
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem("snapword_user");
    window.sessionStorage.removeItem("snapword_user");
  } catch {
    /* ignore */
  }
}
