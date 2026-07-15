// Regras de pontuação da CNH (Lei 14.071/2021, vigente desde 2021).
// Suspensão em 12 meses: 20 pts (2+ gravíssimas), 30 pts (1 gravíssima), 40 pts (nenhuma).
// CNH com EAR (atividade remunerada) pode optar por limite fixo de 40 pts.
// Pontos por gravidade (base): leve 3, média 4, grave 5, gravíssima 7 (multiplicadores já vêm no campo `pontos`).

export interface MultaLike {
  pontos?: number | null;
  gravidade?: string | null;
  data_infracao?: string | null;
  created_at?: string | null;
  status?: string | null;
}

export function pointsOf(m: MultaLike): number {
  if (m.pontos != null && Number(m.pontos) > 0) return Number(m.pontos);
  const g = (m.gravidade || "").toLowerCase();
  if (/grav[ií]ss/.test(g)) return 7;
  if (/grave/.test(g)) return 5;
  if (/m[ée]dia/.test(g)) return 4;
  if (/leve/.test(g)) return 3;
  return 0;
}

export function isGravissima(m: MultaLike): boolean {
  const g = (m.gravidade || "").toLowerCase();
  return /grav[ií]ss/.test(g) || pointsOf(m) >= 7;
}

export interface CnhResult {
  pontos: number;
  gravissimas: number;
  limite: number;
  faltam: number;
  atingido: boolean;
  risco: "suspensao" | "alto" | "medio" | "baixo";
  consideradas: number;
  proxima_queda: { data: string; pontos: number } | null; // quando a multa mais antiga sai da conta
}

const dt = (m: MultaLike) => new Date(m.data_infracao || m.created_at || "").getTime();

export function computeCnh(multas: MultaLike[], opts?: { ear?: boolean }): CnhResult {
  const now = Date.now();
  const dozeMeses = now - 365 * 86400000;
  // conta as dos últimos 12 meses que NÃO foram deferidas (recurso deferido = multa cancelada, sem pontos)
  const validas = (multas || []).filter((m) => String(m.status || "") !== "deferida")
    .filter((m) => { const d = dt(m); return isFinite(d) && d >= dozeMeses; });

  const pontos = validas.reduce((s, m) => s + pointsOf(m), 0);
  const gravissimas = validas.filter(isGravissima).length;
  const limite = opts?.ear ? 40 : gravissimas >= 2 ? 20 : gravissimas === 1 ? 30 : 40;
  const faltam = Math.max(0, limite - pontos);
  const atingido = pontos >= limite;
  const risco: CnhResult["risco"] = atingido ? "suspensao" : faltam <= 5 ? "alto" : faltam <= limite / 2 ? "medio" : "baixo";

  let proxima_queda: CnhResult["proxima_queda"] = null;
  const comData = validas.map((m) => ({ d: dt(m), p: pointsOf(m) })).filter((x) => isFinite(x.d) && x.p > 0).sort((a, b) => a.d - b.d);
  if (comData.length) {
    const q = new Date(comData[0].d);
    q.setFullYear(q.getFullYear() + 1);
    proxima_queda = { data: q.toISOString().split("T")[0], pontos: comData[0].p };
  }
  return { pontos, gravissimas, limite, faltam, atingido, risco, consideradas: validas.length, proxima_queda };
}
