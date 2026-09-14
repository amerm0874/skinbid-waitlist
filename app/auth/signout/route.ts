import { NextResponse } from "next/server";
import { SIGNED_OUT_HREF } from "@/lib/config";
import { createServerSupabase } from "@/lib/supabase/server";

function expireAuthCookies(request: Request, response: NextResponse) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name) {
      continue;
    }
    if (name.startsWith("sb-") || name.includes("auth-token")) {
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
      });
    }
  }
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await createServerSupabase();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      console.log("Sign out failed", error.message);
    }
  }

  const response = NextResponse.redirect(new URL(SIGNED_OUT_HREF, origin));
  expireAuthCookies(request, response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
