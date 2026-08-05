// Consulta veicular paga — fornecedor parceiro (pré-pago, ~R$2,60/crédito por requisição).
// Cobre dados cadastrais + débitos + multas RENAINF (nacional) + restrições + roubo/furto.
// REGRAS DE OURO:
//  1. O token NUNCA sai do servidor (vive em app_settings.debitos_api_token).
//  2. A resposta é SANITIZADA antes de persistir: nome/CPF do proprietário são dados
//     pessoais (LGPD) — removemos qualquer chave de identificação de pessoa.
//  3. Cache: resultado de até N dias para a MESMA placa não consome crédito de novo.

export interface DebitosSettings {
  url: string;
  token: string;
  enabled: boolean;
  price: number;
  cost: number;
  cacheDays: number;
}

export async function loadDebitosSettings(admin: any): Promise<DebitosSettings | null> {
  const { data: s } = await admin.from("app_settings")
    .select("debitos_api_url, debitos_api_token, consulta_veicular_enabled, consulta_veicular_price, consulta_veicular_cost, consulta_veicular_cache_days")
    .eq("id", 1).single();
  if (!s?.debitos_api_url || !s?.debitos_api_token) return null;
  return {
    url: String(s.debitos_api_url),
    token: String(s.debitos_api_token),
    enabled: s.consulta_veicular_enabled !== false,
    price: Number(s.consulta_veicular_price) || 5.9,
    cost: Number(s.consulta_veicular_cost) || 2.6,
    cacheDays: Number(s.consulta_veicular_cache_days) || 7,
  };
}

// Remove RECURSIVAMENTE chaves de identificação de pessoa (o retorno traz nome e CPF
// do proprietário — não podem chegar ao cliente nem ficar no nosso banco).
const PII_KEY = /(cpf|cnpj|propriet|possuidor|arrendat|documento|endereco|logradouro|email|telefone|celular)/i;
export function sanitizeDebitos(v: any): any {
  if (Array.isArray(v)) return v.map(sanitizeDebitos);
  if (v && typeof v === "object") {
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      if (PII_KEY.test(k)) continue;
      if (k.toLowerCase() === "nome") continue; // "nome" solto = nome de pessoa no payload deste fornecedor
      out[k] = sanitizeDebitos(val);
    }
    return out;
  }
  return v;
}

// Achata o objeto para leitura tolerante de campos (nomes variam por fonte/UF)
function flatten(obj: any, out: Record<string, any> = {}): Record<string, any> {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, out);
    else {
      const key = k.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (out[key] == null && v != null && v !== "") out[key] = v;
    }
  }
  return out;
}

// Resumo estruturado pro card do app e pra mensagem do WhatsApp
export function resumoDebitos(result: any): {
  multas_qtd: number; multas_valor: number; pontos: number;
  roubo_furto: boolean | null; restricao_judicial: boolean | null; restricoes: string[];
  licenciamento: string | null; ok: boolean;
} {
  const f = flatten(result);
  const multasArr = (function find(v: any): any[] | null {
    if (Array.isArray(v)) return null;
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (/multas?/i.test(k) && Array.isArray(val)) return val;
        const sub = find(val); if (sub) return sub;
      }
    }
    return null;
  })(result) || [];
  const num = (x: any) => { const n = parseFloat(String(x ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const bool = (x: any) => x === true || /^(true|sim|s|1)$/i.test(String(x ?? ""));
  const restricoes: string[] = [];
  for (const [k, v] of Object.entries(f)) {
    if (/^restricao/.test(k) && typeof v === "string" && v.trim() && !/nao ha|não há|nada consta|sem restricao/i.test(v)) restricoes.push(v.trim());
  }
  const multasQtd = Number(f.total_multas ?? multasArr.length) || multasArr.length;
  return {
    multas_qtd: multasQtd,
    multas_valor: num(f.valor_total ?? f.valor_total_multas),
    pontos: Number(f.pontos_total ?? 0) || 0,
    roubo_furto: f.roubo_furto != null || f.roubofurto != null ? bool(f.roubo_furto ?? f.roubofurto) : null,
    restricao_judicial: f.restricao_judicial != null ? bool(f.restricao_judicial) : null,
    restricoes,
    licenciamento: f.licenciamento != null ? String(f.ultimo_licenciamento ?? f.licenciamento) : (f.ultimo_licenciamento != null ? String(f.ultimo_licenciamento) : null),
    ok: multasQtd === 0 && restricoes.length === 0,
  };
}

// Cache: última consulta CONCLUÍDA da mesma placa dentro da janela
export async function cachedDebitos(admin: any, placa: string, cacheDays: number) {
  const desde = new Date(Date.now() - cacheDays * 86400000).toISOString();
  const { data } = await admin.from("vehicle_queries")
    .select("id, result, created_at")
    .eq("placa", placa).eq("status", "done").not("result", "is", null)
    .gte("created_at", desde)
    .order("created_at", { ascending: false }).limit(1);
  return data?.[0] || null;
}

// Executa a consulta de uma linha vehicle_queries (chamada após o PIX confirmar, ou em cache-hit).
// Idempotente: se já está done, devolve o que tem.
export async function runVehicleQuery(admin: any, queryId: string): Promise<{ ok: boolean; result?: any; error?: string }> {
  const { data: rows } = await admin.from("vehicle_queries").select("*").eq("id", queryId).limit(1);
  const q = rows?.[0];
  if (!q) return { ok: false, error: "consulta_nao_encontrada" };
  if (q.status === "done" && q.result) return { ok: true, result: q.result };

  const s = await loadDebitosSettings(admin);
  if (!s) {
    await admin.from("vehicle_queries").update({ status: "error", error: "fornecedor_nao_configurado" }).eq("id", queryId);
    return { ok: false, error: "fornecedor_nao_configurado" };
  }

  // cache primeiro: mesma placa consultada há pouco = não gasta crédito
  const cached = await cachedDebitos(admin, q.placa, s.cacheDays);
  if (cached && cached.id !== queryId) {
    await admin.from("vehicle_queries").update({
      status: "done", result: cached.result, supplier_hit: false, supplier_cost: 0,
      paid_at: q.paid_at || new Date().toISOString(),
    }).eq("id", queryId);
    return { ok: true, result: cached.result };
  }

  try {
    const sep = s.url.includes("?") ? "&" : "?";
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(`${s.url}${sep}token=${encodeURIComponent(s.token)}&placa=${encodeURIComponent(q.placa)}`, { signal: ctrl.signal });
    clearTimeout(t);
    const raw = await res.json().catch(() => null);
    const status = String(raw?.status || "").toLowerCase();
    if (!res.ok || !raw || (status && status !== "sucesso" && status !== "success")) {
      const msg = `fornecedor_${res.status}${raw?.mensagem ? `: ${String(raw.mensagem).slice(0, 200)}` : ""}`;
      await admin.from("vehicle_queries").update({ status: "error", error: msg }).eq("id", queryId);
      return { ok: false, error: msg };
    }
    const clean = sanitizeDebitos(raw);
    await admin.from("vehicle_queries").update({
      status: "done", result: clean, supplier_hit: true, supplier_cost: s.cost,
      paid_at: q.paid_at || new Date().toISOString(), error: null,
    }).eq("id", queryId);
    return { ok: true, result: clean };
  } catch (e) {
    const msg = String((e as any)?.message || e).slice(0, 300);
    await admin.from("vehicle_queries").update({ status: "error", error: msg }).eq("id", queryId);
    return { ok: false, error: msg };
  }
}
