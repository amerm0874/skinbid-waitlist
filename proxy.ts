import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isHiddenWaitlistApi,
  isHiddenWaitlistPage,
  isWaitlistOnly,
} from "@/lib/launch";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Waitlist launch: send leftover marketplace URLs home so nobody finds them.
  if (isWaitlistOnly()) {
    if (isHiddenWaitlistPage(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (isHiddenWaitlistApi(pathname)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|js|css)$).*)",
  ],
};
