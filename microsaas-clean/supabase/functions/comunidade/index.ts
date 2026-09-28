// TotexCar — CONFIG PÚBLICA DA COMUNIDADE: alimenta a página /comunidade (grupos + links).
// GET /functions/v1/comunidade → { ok, comunidade_link, grupos[] }.
// Só expõe os campos públicos da Comunidade (nunca segredos). Deploy verify_jwt=false.

const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", ...CORS } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const r = await fetch(`${SB}/rest/v1/app_settings?id=eq.1&select=comunidade_link,comunidade_grupos&limit=1`, { headers: H });
    const row = r.ok ? (await r.json())?.[0] : null;
    const grupos = Array.isArray(row?.comunidade_grupos)
      ? row.comunidade_grupos
          .filter((g: any) => g && g.nome)
          .map((g: any) => ({ nome: String(g.nome), emoji: String(g.emoji || "•"), desc: String(g.desc || ""), link: String(g.link || "") }))
      : [];
    return json({ ok: true, comunidade_link: row?.comunidade_link || null, grupos });
  } catch (_e) {
    return json({ ok: false, comunidade_link: null, grupos: [] }, 200);
  }
});
