import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { readHistory, redactEntry, writeHistory } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const scanId = String(body.scanId || "");
    const port = Number(body.port);
    const history = await readHistory();
    const entry = history.find((item) => item.id === scanId);

    if (!entry) throw new Error("Scan was not found.");
    if (!entry.openPorts.includes(port)) throw new Error("That port is not open in this scan.");

    entry.protectedPorts = [...new Set([...(entry.protectedPorts || []), port])].sort((a, b) => a - b);
    await writeHistory(history);

    const canViewProtected = isAuthenticated(await cookies());
    return NextResponse.json({ scan: redactEntry(entry, canViewProtected) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not protect port" }, { status: 400 });
  }
}
