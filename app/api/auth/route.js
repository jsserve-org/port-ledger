import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authenticated = isAuthenticated(await cookies());
  return NextResponse.json({ authenticated });
}
