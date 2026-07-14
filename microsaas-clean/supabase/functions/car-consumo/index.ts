// TotexCar Co-pilot — CONSUMO OFICIAL (INMETRO/PBE via Auto Data API)
// Casa o carro do dono (marca/modelo/ano) com o catálogo oficial e devolve o consumo de referência
// (cidade/estrada por combustível, autonomia EV, classificação energética, CO2). Cacheia em
// accounts.consumo_oficial. Serve o app (JWT do dono) e o agente (service role + account_id).
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

// marcas do dono → marca do catálogo oficial (uppercase)
const MARCA_ALIAS: Record<string, string> = {
  "GM CHEVROLET": "CHEVROLET", "GM": "CHEVROLET", "CHEVROLET GM": "CHEVROLET",
  "VW": "VOLKSWAGEN", "MERCEDES": "MERCEDES-BENZ", "MERCEDES BENZ": "MERCEDES-BENZ",
  "CITROEN": "CITROËN",
};
function normMarca(m: string): string {
  const up = (m || "").trim().toUpperCase();
  return MARCA_ALIAS[up] || up;
}
// modelo do dono → token base p/ o filtro "contains" (ex.: "civic exl" → "civic", "TANK 300" → "TANK")
function modeloBase(m: string): string {
  return (m || "").trim().split(/[\s/]+/)[0] || "";
}

let _creds: { base: string; key: string; secret: string } | null = null;
async function creds() {
  if (_creds) return _creds;
  const { data } = await admin.from("app_settings").select("autodata_base_url, autodata_key, autodata_secret").eq("id", 1).single();
  _creds = {
    base: (data?.autodata_base_url || "").replace(/\/+$/, ""),
    key: data?.autodata_key || "", secret: data?.autodata_secret || "",
  };
  return _creds;
}
async function adGet(path: string): Promise<any> {
  const c = await creds();
  if (!c.base || !c.key || !c.secret) throw new Error("autodata_nao_configurado");
  const res = await fetch(`${c.base}${path}`, { headers: { "X-API-Key": c.key, "X-API-Secret": c.secret, Accept: "application/json" } });
  if (!res.ok) throw new Error(`autodata_${res.status}`);
  return await res.json();
}

const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : null);

// escolhe a versão: mais perto do ano do dono primeiro, depois combustível compatível
function pickBest(items: any[], combustivel: string, ano: number | null) {
  if (!items.length) return null;
  const c = (combustivel || "").toLowerCase();
  const fuelOk = (i: any) => {
    const f = String(i.combustivel_tipo || "").toLowerCase();
    if (!c) return false;
    return f.includes(c) || (/flex/.test(c) && /flex/.test(f)) ||
      (/h[íi]brido/.test(c) && /h[íi]brido|phev|hev/.test(f)) ||
      (/el[ée]trico/.test(c) && /(el[ée]trico|ev|bev)/.test(f));
  };
  const sorted = [...items].sort((a, b) => {
    const da = ano ? Math.abs((a.ano || 0) - ano) : 0;
    const db = ano ? Math.abs((b.ano || 0) - ano) : 0;
    if (da !== db) return da - db;                 // ano mais próximo
    return (fuelOk(b) ? 1 : 0) - (fuelOk(a) ? 1 : 0); // depois combustível
  });
  return sorted[0];
}

async function fetchConsumoOficial(acct: any) {
  const marca = normMarca(acct.marca || "");
  const modelo = modeloBase(acct.modelo || "");
  const ano = acct.ano_modelo || acct.ano_fabricacao || null;
  if (!marca && !modelo) return null;

  const qs = (o: Record<string, any>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");

  // tenta: marca+modelo+ano → marca+modelo → modelo+ano → modelo
  const tries = [
    { marca, modelo, ano, page_size: 50 },
    { marca, modelo, page_size: 50 },
    { modelo, ano, page_size: 50 },
    { modelo, page_size: 50 },
  ];
  let items: any[] = [];
  for (const t of tries) {
    if (!t.modelo && !t.marca) continue;
    try {
      const d = await adGet(`/catalog/vehicles?${qs(t)}`);
      items = (((d?.data || {}).data || {}).items) || [];
      if (items.length) break;
    } catch (e) { if (String((e as any)?.message) === "autodata_nao_configurado") throw e; }
  }
  if (!items.length) return null;

  const pick = pickBest(items, acct.combustivel || "", ano);
  if (!pick?.id) return null;
  // guarda de época: se o dono tem ano e o match está a mais de 3 anos, não é o mesmo carro
  // (ex.: Classic 1985 casaria com Classic 2016 — carro pré-2009 nem está no INMETRO)
  if (ano && pick.ano && Math.abs(Number(pick.ano) - Number(ano)) > 3) return null;

  const det = await adGet(`/catalog/vehicles/${pick.id}`);
  const body = (det?.data || {}).data || {};
  const v = body.veiculo || pick;
  const co = body.consumo || {};
  const em = body.emissoes || {};

  const out: any = {
    fonte: "INMETRO/PBE (Auto Data)",
    match: [v.marca, v.modelo, v.versao, v.ano].filter(Boolean).join(" "),
    combustivel: v.combustivel_tipo || null,
    classificacao: co.classificacao_absoluta_geral || null,
    classificacao_categoria: co.classificacao_relativa_categoria || null,
    cidade_gasolina: num(co.consumo_cidade_gasolina),
    estrada_gasolina: num(co.consumo_estrada_gasolina),
    cidade_etanol: num(co.consumo_cidade_etanol),
    estrada_etanol: num(co.consumo_estrada_etanol),
    cidade_eletrico_kmle: num(co.consumo_cidade_eletrico_kmle),
    estrada_eletrico_kmle: num(co.consumo_estrada_eletrico_kmle),
    autonomia_km: num(co.autonomia_km),
    co2_g_km: num(em.co2_fossil_g_km),
    versoes_no_catalogo: items.length,
  };
  // "melhor" consumo de referência (média cidade/estrada do combustível principal) p/ comparar com o real
  const pares: number[][] = [
    [out.cidade_gasolina, out.estrada_gasolina], [out.cidade_etanol, out.estrada_etanol],
    [out.cidade_eletrico_kmle, out.estrada_eletrico_kmle],
  ];
  for (const [ci, es] of pares) {
    if (ci && es) { out.referencia_media = Math.round(((ci + es) / 2) * 10) / 10; break; }
    if (ci || es) { out.referencia_media = ci || es; break; }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "missing_token" }, 401);

  let b: any = {};
  try { b = await req.json(); } catch { /* */ }
  const force = !!b.force;

  let account: any = null;
  if (jwt === SERVICE_ROLE && b.account_id) {
    const { data } = await admin.from("accounts").select("*").eq("id", b.account_id).maybeSingle();
    account = data;
  } else {
    const { data: ud, error } = await admin.auth.getUser(jwt);
    if (error || !ud?.user) return json({ error: "invalid_token" }, 401);
    const { data } = await admin.from("accounts").select("*")
      .eq("user_id", ud.user.id).eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
    account = data;
  }
  if (!account) return json({ error: "sem_veiculo" }, 404);
  if (!account.marca && !account.modelo) return json({ error: "veiculo_incompleto" }, 400);

  if (account.consumo_oficial && !force) {
    return json({ ok: true, cached: true, consumo_oficial: account.consumo_oficial });
  }

  try {
    const co = await fetchConsumoOficial(account);
    // grava sempre (mesmo null vira {nao_encontrado:true}) p/ não reconsultar toda hora
    const toStore = co || { nao_encontrado: true };
    await admin.from("accounts").update({ consumo_oficial: toStore, consumo_oficial_at: new Date().toISOString() }).eq("id", account.id);
    return json({ ok: true, cached: false, consumo_oficial: co ? toStore : null, nao_encontrado: !co });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
