import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { buildDiff, DEFAULT_SCAN_TARGET, normalizeTarget, parsePorts, scanPorts } from "@/lib/scanner";
import { readHistory, redactEntry, writeHistory } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const target = normalizeTarget(DEFAULT_SCAN_TARGET);
    const ports = parsePorts("");
    const startedAt = new Date().toISOString();
    const results = await scanPorts(target, ports);
    const open = results.filter((result) => result.open);
    const openPorts = open.map((result) => result.port);
    const history = await readHistory();
    const previousForTarget = history.find((entry) => entry.target === target);
    const diff = buildDiff(previousForTarget?.openPorts || [], openPorts);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      target,
      startedAt,
      finishedAt: new Date().toISOString(),
      scannedPorts: ports.length,
      openPorts,
      protectedPorts: [],
      open,
      diff
    };

    await writeHistory([entry, ...history]);
    const canViewProtected = isAuthenticated(await cookies());
    return NextResponse.json({ scan: redactEntry(entry, canViewProtected) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Scan failed" }, { status: 400 });
  }
}
