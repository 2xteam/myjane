import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 인증 링크를 받은 사람이 여는 자리. `/verify-email?token=…` 페이지가 부른다.
 *
 * **세션이 없어도 된다.** 메일은 다른 기기·다른 브라우저에서 열리는 일이 흔하고,
 * 로그인부터 요구하면 그 자리에서 막힌다. 토큰 자체가 그 이메일함에 접근할 수
 * 있다는 증거다 — `reset-pin-email` 도 같은 이유로 세션을 보지 않는다.
 *
 * 토큰은 **한 번 쓰면 폐기**한다.
 */
export async function POST(req: Request) {
  try {
    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const token = typeof body.token === "string" ? body.token : "";
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 링크입니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const user = await User.findOne({
      emailToken: token,
      emailTokenExpires: { $gt: new Date() },
    }).exec();

    if (!user) {
      /*
        이미 인증을 마친 사람이 링크를 한 번 더 누른 경우와 구분되지 않는다.
        토큰을 지웠기 때문이다. 만료와 재사용을 같은 문구로 안내하고,
        화면에서 재발송 버튼을 함께 보여 준다.
      */
      return NextResponse.json(
        {
          ok: false,
          error: "링크가 만료되었거나 이미 사용되었습니다. 인증 메일을 다시 받아 주세요.",
        },
        { status: 400 },
      );
    }

    /*
      `pendingEmail` 이 있으면 이번 인증이 **그 주소**에 대한 것이다.
      이제 진짜 주인임이 확인됐으니 `email` 로 옮긴다 → app/api/auth/update-email/route.ts

      옮기기 직전에 중복을 한 번 더 본다. 메일을 보낸 뒤 링크를 누르기까지의
      사이에 다른 사람이 그 주소로 가입할 수 있다(유일 인덱스가 없다).
    */
    if (user.pendingEmail) {
      const taken = await User.findOne({
        email: user.pendingEmail,
        _id: { $ne: user._id },
      }).exec();

      if (taken) {
        user.pendingEmail = null;
        user.emailToken = undefined as unknown as string;
        user.emailTokenExpires = undefined as unknown as Date;
        await user.save();

        return NextResponse.json(
          {
            ok: false,
            error: "그 사이에 다른 계정이 이 이메일을 사용하게 되었습니다. 다른 주소를 등록해 주세요.",
          },
          { status: 409 },
        );
      }

      user.email = user.pendingEmail;
      user.pendingEmail = null;
    }

    user.emailVerified = true;
    user.emailToken = undefined as unknown as string;
    user.emailTokenExpires = undefined as unknown as Date;
    // 인증이 끝났으니 안내를 다시 띄울 이유가 없다
    user.emailPromptSnoozedUntil = undefined as unknown as Date;
    await user.save();

    return NextResponse.json({ ok: true, email: user.email ?? "" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
