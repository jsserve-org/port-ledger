import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

export async function readHistory() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function writeHistory(history) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export function redactEntry(entry, canViewProtected) {
  const protectedPorts = new Set(entry.protectedPorts || []);
  const open = entry.open.map((item) => {
    if (!protectedPorts.has(item.port) || canViewProtected) return { ...item, protected: false };
    return {
      protected: true,
      redactedId: protectedHash(entry.id, item.port)
    };
  });

  return {
    ...entry,
    open,
    openPorts: canViewProtected
      ? entry.openPorts
      : entry.openPorts.filter((port) => !protectedPorts.has(port)),
    protectedCount: protectedPorts.size
  };
}

export function redactHistory(history, canViewProtected) {
  return history.map((entry) => redactEntry(entry, canViewProtected));
}

function protectedHash(scanId, port) {
  let value = 0;
  const input = `${scanId}:${port}`;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value.toString(16);
}
