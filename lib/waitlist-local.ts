import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "waitlist.json");

export type WaitlistRow = {
  id: string;
  email: string;
  name: string;
  social: string;
  fields: Record<string, string>;
  created_at: string;
};

async function readRows(): Promise<WaitlistRow[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as WaitlistRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendLocalWaitlist(row: Omit<WaitlistRow, "id" | "created_at">) {
  const rows = await readRows();
  const next: WaitlistRow = {
    ...row,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  rows.push(next);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
  console.log("Waitlist saved locally");
  return next;
}
