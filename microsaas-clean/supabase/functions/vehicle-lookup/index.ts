// TotexCar Co-pilot — Consulta de veículo por placa (autopreenche o cadastro)
// Provedor plugável (padrão: API Brasil "API Placa Dados"). Credenciais em app_settings.
// Normaliza a resposta (que varia por provedor) buscando os campos de forma tolerante.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// achata o JSON em pares chave->valor (chave em minúsculo, sem separadores) para busca tolerante
function flatten(obj: any, out: Record<string, any> = {}): Record<string, any> {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flatten(v, out);
    else {
      const key = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (out[key] == null && v != null && v !== "") out[key] = v;
    }
  }
  return out;
}
function pick(flat: Record<string, any>, candidates: string[]): string | null {
  for (const c of candidates) {
    const key = c.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (flat[key] != null) return String(flat[key]);
  }
  return null;
}
const toInt = (v: string | null) => { const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : null; };
const titleCase = (s: string | null) => s ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const placa = String(p.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (placa.length < 7) return json({ error: "placa_invalida" }, 400);

  const { data: s } = await admin.from("app_settings")
    .select("placa_api_url, placa_api_bearer, placa_api_device").eq("id", 1).single();
  const cfgUrl = s?.placa_api_url || "";
  const bearer = s?.placa_api_bearer || "";   // PuxaPlaca: token; legado API Brasil: bearer
  const device = s?.placa_api_device || "";
  if (!bearer) return json({ error: "placa_api_nao_configurado" }, 400);

  // Provedor: PuxaPlaca por padrão (GET /v2/consulta/{placa}, header `token`).
  // Mantém o legado API Brasil (POST) se a URL configurada apontar pra lá.
  const isLegacy = /apibrasil|gateway/i.test(cfgUrl);

  try {
    let data: any = {};
    if (isLegacy) {
      const url = cfgUrl || "https://gateway.apibrasil.io/api/v2/vehicles/dados";
      const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` };
      if (device) headers["DeviceToken"] = device;
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ placa }) });
      data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: data?.message || data?.error || `Provedor ${res.status}`, detail: data }, 400);
    } else {
      const base = (/puxaplaca/i.test(cfgUrl) ? cfgUrl : "https://api.puxaplaca.app").replace(/\/+$/, "");
      const res = await fetch(`${base}/v2/consulta/${encodeURIComponent(placa)}`, {
        headers: { token: bearer, Accept: "application/json" },
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: data?.message || `Provedor ${res.status}`, detail: data }, 400);
    }

    const flat = flatten(data);
    const vehicle = {
      marca: titleCase(pick(flat, ["marca", "fabricante", "marcamodelo"])),
      modelo: titleCase(pick(flat, ["modelo", "submodelo", "versao", "marcamodelo"])),
      ano_fabricacao: toInt(pick(flat, ["anofabricacao", "ano", "anofab"])),
      ano_modelo: toInt(pick(flat, ["anomodelo", "anomod", "ano"])),
      cor: titleCase(pick(flat, ["cor", "corveiculo"])),
      chassi: pick(flat, ["chassi", "chassis"]),
      renavam: pick(flat, ["renavam"]),
      combustivel: titleCase(pick(flat, ["combustivel", "tipocombustivel"])),
      municipio: titleCase(pick(flat, ["municipio", "cidade"])),
      uf: pick(flat, ["uf", "estado"]),
    };
    const found = Object.values(vehicle).some((v) => v != null);
    if (!found) return json({ ok: true, vehicle, raw: data, warning: "sem_dados_reconhecidos" });
    return json({ ok: true, vehicle, raw: data });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
