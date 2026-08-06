// Cliente da API Full (api.apifull.com.br) — 2º fornecedor de dados veiculares.
// Pré-pago por requisição (preços de 2026-08: debitos-veicular ~R$2,97 · leilao ~R$9,64 ·
// ic-historico-roubo-furto ~R$3,96 · renajud ~R$3,96 · ic-bin-nacional ~R$3,30 · gravame ~R$2,42).
// Autenticação: Bearer token em app_settings.apifull_token (NUNCA sai do servidor).
// Formato: POST /api/{slug} com { placa|chassi, link: slug }.

export async function afToken(admin: any): Promise<string | null> {
  const { data: s } = await admin.from("app_settings").select("apifull_token").eq("id", 1).single();
  const t = String(s?.apifull_token || "").trim();
  return t || null;
}

export async function afCall(token: string, slug: string, body: Record<string, unknown>, timeoutMs = 30000): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`https://api.apifull.com.br/api/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...body, link: slug }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const j = await res.json().catch(() => null);
    if (!res.ok || !j) { console.error(`apifull ${slug}: HTTP ${res.status}`); return null; }
    return j;
  } catch (e) {
    console.error(`apifull ${slug}:`, String((e as any)?.message || e).slice(0, 200));
    return null;
  }
}

// Saldo real da conta API Full (pro relatório do admin)
export async function afBalance(admin: any): Promise<number | null> {
  const token = await afToken(admin);
  if (!token) return null;
  try {
    const res = await fetch("https://api.apifull.com.br/api/get-balance", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json().catch(() => null);
    const n = parseFloat(String(j?.saldo ?? j?.balance ?? j?.data?.saldo ?? ""));
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
