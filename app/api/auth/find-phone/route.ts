import { NextResponse } from "next/server";
import { authMailOnCooldown } from "@/lib/authMailCooldown";
import { connectDB } from "@/lib/db";
import { signLookupToken, verifyLookupToken } from "@/lib/lookupToken";
import { sendMail } from "@/lib/mail";
import { authMail } from "@/lib/mailTemplate";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 등록된 전화번호(로그인 아이디) 안내.
 *
 * ⚠️ **전화번호를 메일 본문에 적지 않는다.** 예전에는 그렇게 보냈는데, 메일은
 * 받은 편지함에 오래 남고 전달되고 기기를 옮겨도 따라간다. 대신 30분짜리
 * 링크를 보내고 **그 화면에서만** 보여 준다 → lib/lookupToken.ts
 *
 * ⚠️ **계정이 있든 없든 같은 답을 준다.** 예전에는 없으면 404 로
 * "등록된 계정이 없습니다" 를 돌려줬는데, 그건 **어떤 이메일이 가입돼 있는지
 * 알려주는 것**이다. 이메일만 넣으면 되니 그대로 열거할 수 있었다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

/**
 * 있든 없든 이 답을 준다.
 *
 * ⚠️ **함수여야 한다.** 모듈 상수로 두면 `Response` 본문이 한 번만 소비되고
 * 두 번째 요청부터 **빈 응답**이 나간다. 실제로 그렇게 만들었다가 잡았다.
 */
const sameAnswer = () =>
  NextResponse.json({
    ok: true,
    message: "입력하신 이메일로 등록된 계정이 있으면 안내 메일을 보내드렸어요.",
  });

export async function POST(req: Request) {
  try {
    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ ok: false, error: "이메일을 입력해 주세요." }, { status: 400 });
    }

    await connectDB();
    const user = await getUserModel().findOne({ email }).exec();

    /* 없어도 같은 답 · 연타도 같은 답 */
    if (!user) return sameAnswer();
    if (authMailOnCooldown(user)) return sameAnswer();

    /* 전화번호가 없는 계정(이메일로 가입)은 안내할 것이 없다 */
    if (!user.phone) return sameAnswer();

    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.myjane.co.kr";
    const url = `${origin}/find-phone?token=${signLookupToken(String(user._id))}`;

    /*
      ⚠️ 발송이 실패해도 **같은 답을 준다.**

      던지게 두면 500 이 나가는데, 없는 계정은 200 이다. 그 차이만으로
      "이 이메일은 가입돼 있다" 를 알아낼 수 있다 — 404 를 없앤 의미가 사라진다.
      실패는 로그로 남기고 사람에게는 같은 문장을 보여 준다.
    */
    try {
      await sendMail(
        email,
        "[myjane] 등록된 전화번호 안내",
        authMail({
          name: user.name ?? user.nickname ?? "회원",
          body: "<p>아래 버튼을 누르시면 이 계정에 등록된 전화번호를 보여드립니다.</p>",
          action: { label: "전화번호 확인하기", url },
          notes: [
            "이 링크는 30분 동안만 열립니다.",
            "메일에 전화번호를 직접 적지 않았습니다 — 메일함에 남지 않도록 하기 위해서예요.",
          ],
          warn: "본인이 요청하지 않으셨다면 이 링크를 누르지 마시고 이 메일을 무시해 주세요.",
        }),
      );
    } catch (e) {
      console.error("[find-phone] 메일 발송 실패", e);
      return sameAnswer();
    }

    user.authMailSentAt = new Date();
    await user.save();

    return sameAnswer();
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** 메일의 링크로 들어와 전화번호를 확인한다. `?token=…` */
export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    const claims = verifyLookupToken(token);
    if (!claims) {
      return NextResponse.json(
        { ok: false, error: "링크가 만료되었거나 올바르지 않습니다. 다시 요청해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getUserModel().findById(claims.uid, { phone: 1, name: 1 }).lean().exec();
    if (!user?.phone) {
      return NextResponse.json(
        { ok: false, error: "등록된 전화번호를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, phone: user.phone, name: user.name ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
