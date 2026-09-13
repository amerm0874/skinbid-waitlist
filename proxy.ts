import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { destinationForSession } from "@/lib/auth-map";
import {
  isAuthGatePath,
  loginPath,
  parseRole,
  SIGNIN_AGAIN_HREF,
} from "@/lib/config";
import {
  isAuthErrorQuery,
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

  if (pathname === "/" && isAuthErrorQuery(request.nextUrl.searchParams)) {
    return NextResponse.redirect(new URL(SIGNIN_AGAIN_HREF, request.url));
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = parseRole(request.nextUrl.searchParams.get("role"));

  if (!user && isAuthGatePath(pathname)) {
    const next =
      pathname + (request.nextUrl.search ? request.nextUrl.search : "");
    return NextResponse.redirect(
      new URL(loginPath(role, next), request.url),
    );
  }

  if (user && pathname === "/") {
    const destination = await destinationForSession(supabase, user.id, role);
    if (destination && destination !== "/") {
      return NextResponse.redirect(new URL(destination, request.url));
    }
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|js|css)$).*)",
  ],
};
