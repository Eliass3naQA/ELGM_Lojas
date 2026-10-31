// Sessão do comprador em cookie assinado (HMAC). Substituível pela sessão do Supabase Auth.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { DomainError, getUser } from "../data/repository";

const COOKIE = "lf_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias
const SECRET = process.env.SESSION_SECRET ?? "dev-secret-troque-em-producao";

const sign = (data: string) => createHmac("sha256", SECRET).update(data).digest("base64url");

export function encodeSession(userId: string) {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof uid === "string" && exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const uid = decodeSession((await cookies()).get(COOKIE)?.value);
  return uid ? getUser(uid) : null;
}

export function setSessionCookie(res: NextResponse, userId: string) {
  res.cookies.set(COOKIE, encodeSession(userId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
}

/** Para rotas de API: exige comprador logado. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new DomainError("Faça login para continuar.", 401);
  return user;
}
