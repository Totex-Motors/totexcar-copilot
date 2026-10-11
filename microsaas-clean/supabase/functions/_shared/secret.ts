// Autenticação das funções chamadas por cron/webhook (?secret=...).
// FAIL-CLOSED: sem WEBHOOK_SECRET no ambiente, NADA passa. (Antes, env vazio = checagem desligada:
// qualquer um podia chamar carro-do-dia, car-expiration-alerts, fipe-sync e o próprio webhook.)
// O valor vive SÓ em Supabase → Edge Functions → Secrets. Nunca em código, migration, doc ou bundle.
const WEBHOOK_SECRET = (Deno.env.get("WEBHOOK_SECRET") || "").trim();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function secretOk(url: URL): boolean {
  const given = (url.searchParams.get("secret") || "").trim();
  return WEBHOOK_SECRET.length >= 16 && given.length > 0 && timingSafeEqual(given, WEBHOOK_SECRET);
}

export function unauthorized(headers: Record<string, string> = {}): Response {
  return new Response("unauthorized", { status: 401, headers });
}
