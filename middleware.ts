import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function createSessionToken(username: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(username));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  const AUTH_USERNAME = process.env.AUTH_USERNAME ?? "admin";
  const AUTH_SECRET = process.env.AUTH_SECRET ?? "orderie-secret";

  const session = request.cookies.get("auth_session");
  const expectedToken = await createSessionToken(AUTH_USERNAME, AUTH_SECRET);
  const isAuthenticated = session?.value === expectedToken;

  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
