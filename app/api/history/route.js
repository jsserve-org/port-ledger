import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { readHistory, redactHistory } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const history = await readHistory();
  const canViewProtected = isAuthenticated(await cookies());
  return NextResponse.json({ history: redactHistory(history, canViewProtected), canViewProtected });
}
