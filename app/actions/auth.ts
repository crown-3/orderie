"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

const AUTH_USERNAME = process.env.AUTH_USERNAME ?? "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? "1234";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "orderie-secret";

function createSessionToken(username: string): string {
  return crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(username)
    .digest("hex");
}

export async function login(_prevState: { error: string } | null, formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  const token = createSessionToken(username);
  const cookieStore = await cookies();
  cookieStore.set("auth_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_session");
  redirect("/login");
}
