import { NextResponse } from "next/server";
import { setAuthCookie, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  if (!verifyPassword(body.password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return setAuthCookie(NextResponse.json({ ok: true }));
}
