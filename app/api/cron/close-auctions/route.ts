import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { closeDueAuctions } from "@/lib/close-auctions";

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

function secretMatches(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = secret ? `Bearer ${secret}` : "";

  // Empty secret = unlocked door. Refuse until CRON_SECRET is set.
  if (!secret || !secretMatches(auth, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await closeDueAuctions();
  return NextResponse.json(result);
}
