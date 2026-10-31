import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { upsertUser } from "@/lib/data/repository";
import { handle, mockLoginSchema } from "@/lib/validation";

// SIMULAÇÃO do retorno do OAuth (Google / Microsoft / Apple).
// Com Supabase: o front chama supabase.auth.signInWithOAuth() e esta rota vira o /auth/callback.
export const POST = handle(async (req: Request) => {
  const user = await upsertUser(mockLoginSchema.parse(await req.json()));
  const res = NextResponse.json({ user });
  setSessionCookie(res, user.id);
  return res;
});
