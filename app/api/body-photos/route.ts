import { NextResponse } from "next/server";

// Old clients must not bypass private originals, AI review and photo approval.
export async function POST() {
  return NextResponse.json({ error: "Photo uploads have moved to your profile. Open Photos & video to prepare and approve your photos.", href: "/me#athlete-media" }, { status: 410 });
}
