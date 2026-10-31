/** Só aceita destinos internos da própria loja (evita open redirect via ?next=). */
export function safeNext(slug: string, next: string | undefined) {
  return next && next.startsWith(`/${slug}/`) && !next.startsWith("//") && !next.includes("\\") ? next : `/${slug}/conta`;
}
