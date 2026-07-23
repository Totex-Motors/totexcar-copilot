// TotexCar Co-pilot — Motor do Score de Cuidado (GAMIFICACAO-SCORE-CUIDADO.md v1.1)
// FASE SILENCIOSA: acumula pontos desde já, SEM UI e SEM menção do agente — o programa
// Selo Totex (PROGRAMA-SELO-TOTEX-RECOMPRA.md) lança na Fase 4 com histórico retroativo.
// Regras nesta fase (só o que dá pra validar hoje, sem OCR de nota/CNPJ):
//   abastecimento com litros+km = +10 (cap 40/mês) · só parcial = +5 (cap 20/mês)
//   hodômetro atualizado = +10 (1×/mês) · streak 3 meses com ≥4 registros = +50
//   retroativo (>7 dias) = metade · ritmo: 1 abastecimento pontuado a cada 48h (PRO: 24h)
//   decay: 90d sem atividade (dono) / 45d (PRO) = −50/semana até o piso do tier
// Parâmetros ficam AQUI (constantes) na fase silenciosa; migram p/ app_settings na Fase 4.

export const CARE_POINTS = {
  fuel_full: 10, fuel_partial: 5,
  fuel_month_cap_full: 40, fuel_month_cap_partial: 20,
  odometer_month: 10, streak_bonus: 50, decay_week: 50,
};

// faixas do Selo: score mínimo + meses de histórico ativo (meses com ≥1 evento positivo)
// Scores vêm de app_settings (Fase 4, parametrizável); estes são os fallbacks.
export const CARE_TIERS: Array<{ tier: string; score: number; months: number }> = [
  { tier: "ouro", score: 850, months: 12 },
  { tier: "prata", score: 600, months: 6 },
  { tier: "bronze", score: 300, months: 3 },
];
const tierFloor = (tier: string) => CARE_TIERS.find((t) => t.tier === tier)?.score ?? 0;

// ---- PROGRAMA SELO TOTEX (Fase 4) ----
export type SeloConfig = {
  scores: { bronze: number; prata: number; ouro: number };
  fipe: { bronze: number; prata: number; ouro_min: number; ouro_max: number; troca12m: number };
};
export async function loadSeloConfig(supabase: any): Promise<SeloConfig> {
  const { data } = await supabase.from("app_settings")
    .select("selo_bronze_score, selo_prata_score, selo_ouro_score, selo_bronze_fipe_min, selo_prata_fipe_min, selo_ouro_fipe_min, selo_ouro_fipe_max, selo_ouro_troca12m_fipe")
    .eq("id", 1).single();
  return {
    scores: { bronze: Number(data?.selo_bronze_score) || 300, prata: Number(data?.selo_prata_score) || 600, ouro: Number(data?.selo_ouro_score) || 850 },
    fipe: {
      bronze: Number(data?.selo_bronze_fipe_min) || 0.82, prata: Number(data?.selo_prata_fipe_min) || 0.85,
      ouro_min: Number(data?.selo_ouro_fipe_min) || 0.87, ouro_max: Number(data?.selo_ouro_fipe_max) || 0.90,
      troca12m: Number(data?.selo_ouro_troca12m_fipe) || 0.90,
    },
  };
}

// REGRA DO DONO: Selo SÓ para cliente vindo de loja parceira que ADERIU ao programa.
export async function seloElegivel(supabase: any, user: { dealership?: string | null }): Promise<boolean> {
  if (!user?.dealership) return false;
  const { data } = await supabase.from("dealership_settings")
    .select("selo_aderido").eq("dealership", user.dealership).maybeSingle();
  return !!data?.selo_aderido;
}

// mapa de lojas aderidas (pro cron não consultar por usuário)
export async function lojasAderidas(supabase: any): Promise<Set<string>> {
  const { data } = await supabase.from("dealership_settings").select("dealership").eq("selo_aderido", true);
  return new Set((data || []).map((d: any) => String(d.dealership)));
}

const KIND_LABEL: Record<string, string> = {
  abastecimento: "Abastecimento completo (cupom + km)", abastecimento_parcial: "Abastecimento",
  hodometro: "Hodômetro do mês", streak_bonus: "Bônus de constância (3 meses)", decay: "Inatividade",
};

// extrato do Selo pro agente/extrato mensal — SEMPRE traduzível em faixa da FIPE, nunca só pontos
export async function careStatement(supabase: any, user: any): Promise<any> {
  const cfg = await loadSeloConfig(supabase);
  const elegivel = await seloElegivel(supabase, user);
  const { data: evs } = await supabase.from("care_score_events")
    .select("kind, points, created_at").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(200);
  const score = Number(user.care_score) || 0;
  const tier = String(user.care_tier || "none");
  const meses = new Set((evs || []).filter((e: any) => Number(e.points) > 0).map((e: any) => String(e.created_at).slice(0, 7))).size;

  const ladder = [
    { tier: "bronze", score: cfg.scores.bronze, months: 3, fipe_min: cfg.fipe.bronze },
    { tier: "prata", score: cfg.scores.prata, months: 6, fipe_min: cfg.fipe.prata },
    { tier: "ouro", score: cfg.scores.ouro, months: 12, fipe_min: cfg.fipe.ouro_min },
  ];
  const prox = ladder.find((l) => score < l.score || meses < l.months) || null;
  const atual = [...ladder].reverse().find((l) => l.tier === tier) || null;

  const iniMes = new Date().toISOString().slice(0, 7) + "-01";
  const deltaMes = (evs || []).filter((e: any) => String(e.created_at) >= iniMes)
    .reduce((s: number, e: any) => s + Number(e.points || 0), 0);

  let troca12mAte: string | null = null;
  if (tier === "ouro" && user.care_tier_at) {
    const d = new Date(user.care_tier_at); d.setFullYear(d.getFullYear() + 1);
    troca12mAte = d.toISOString().split("T")[0];
  }
  return {
    elegivel, loja: user.dealership || null, score, tier, meses_ativos: meses, delta_mes: deltaMes,
    faixa_garantida: atual ? { min_pct: Math.round(atual.fipe_min * 100), max_pct: tier === "ouro" ? Math.round(cfg.fipe.ouro_max * 100) : null } : null,
    proximo_selo: prox ? { tier: prox.tier, faltam_pontos: Math.max(0, prox.score - score), faltam_meses: Math.max(0, prox.months - meses), fipe_min_pct: Math.round(prox.fipe_min * 100) } : null,
    troca12m_ate: troca12mAte,
    ultimos_eventos: (evs || []).slice(0, 5).map((e: any) => ({ o_que: KIND_LABEL[e.kind] || e.kind, pontos: Number(e.points), data: String(e.created_at).split("T")[0] })),
  };
}

const monthKey = (d: Date = new Date()) => d.toISOString().slice(0, 7);
const todayStr = () => new Date().toISOString().split("T")[0];

// recalcula score/tier do usuário a partir dos eventos (fonte da verdade = care_score_events)
export async function careRecompute(supabase: any, userId: string, opts?: { touchActivity?: boolean }): Promise<void> {
  const { data: evs } = await supabase.from("care_score_events")
    .select("points, created_at").eq("user_id", userId);
  const score = Math.max(0, (evs || []).reduce((s: number, e: any) => s + Number(e.points || 0), 0));
  const months = new Set((evs || []).filter((e: any) => Number(e.points) > 0)
    .map((e: any) => String(e.created_at).slice(0, 7))).size;
  // limiares parametrizáveis (Fase 4); meses seguem os padrões 3/6/12
  let tiers = CARE_TIERS;
  try {
    const cfg = await loadSeloConfig(supabase);
    tiers = [
      { tier: "ouro", score: cfg.scores.ouro, months: 12 },
      { tier: "prata", score: cfg.scores.prata, months: 6 },
      { tier: "bronze", score: cfg.scores.bronze, months: 3 },
    ];
  } catch { /* fallback constantes */ }
  let tier = "none";
  for (const t of tiers) if (score >= t.score && months >= t.months) { tier = t.tier; break; }

  const { data: u } = await supabase.from("users").select("care_tier").eq("id", userId).single();
  const upd: any = { care_score: score };
  if (opts?.touchActivity !== false) upd.care_last_activity = todayStr();
  if (u && u.care_tier !== tier) { upd.care_tier = tier; upd.care_tier_at = new Date().toISOString(); }
  await supabase.from("users").update(upd).eq("id", userId);
}

// abastecimento registrado (chamado pelo registrar_gasto quando é combustível/despesa)
export async function careFuel(supabase: any, userId: string, accountId: string | null, args: {
  litros: number | null; odometer: number | null; dateStr: string; isPro: boolean;
}): Promise<void> {
  try {
    // ritmo: 1 abastecimento pontuado a cada 48h (PRO roda todo dia: 24h)
    const winH = args.isPro ? 24 : 48;
    const since = new Date(Date.now() - winH * 3600_000).toISOString();
    const { count: recentes } = await supabase.from("care_score_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).in("kind", ["abastecimento", "abastecimento_parcial"])
      .gte("created_at", since);
    if (recentes && recentes > 0) return;

    const full = Number(args.litros) > 0 && Number(args.odometer) > 0;
    const kind = full ? "abastecimento" : "abastecimento_parcial";
    const cap = full ? CARE_POINTS.fuel_month_cap_full : CARE_POINTS.fuel_month_cap_partial;
    let points = full ? CARE_POINTS.fuel_full : CARE_POINTS.fuel_partial;

    // cap mensal por tipo
    const iniMes = `${monthKey()}-01T00:00:00Z`;
    const { data: doMes } = await supabase.from("care_score_events")
      .select("points").eq("user_id", userId).eq("kind", kind).gte("created_at", iniMes);
    const soma = (doMes || []).reduce((s: number, e: any) => s + Number(e.points || 0), 0);
    if (soma >= cap) return;

    // anti-retroatividade: cupom com data > 7 dias vale metade (evita "dump" na véspera da venda)
    const retro = args.dateStr && args.dateStr < new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    if (retro) points = Math.ceil(points / 2);

    await supabase.from("care_score_events").insert({
      user_id: userId, account_id: accountId, kind, points,
      meta: { litros: args.litros, odometer: args.odometer, data: args.dateStr, ...(retro ? { retroativo: true } : {}) },
    });
    await careRecompute(supabase, userId);
  } catch (e) { console.error("careFuel (silencioso, não afeta o registro):", e); }
}

// hodômetro atualizado (1×/mês)
export async function careOdometer(supabase: any, userId: string, accountId: string | null, km: number): Promise<void> {
  try {
    const iniMes = `${monthKey()}-01T00:00:00Z`;
    const { count } = await supabase.from("care_score_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("kind", "hodometro").gte("created_at", iniMes);
    if (count && count > 0) return;
    await supabase.from("care_score_events").insert({
      user_id: userId, account_id: accountId, kind: "hodometro", points: CARE_POINTS.odometer_month, meta: { km },
    });
    await careRecompute(supabase, userId);
  } catch (e) { console.error("careOdometer:", e); }
}

// ---- rotinas do cron (chamar 1×/dia; dedup interno) ----

// streak: 3 meses-calendário seguidos (terminando no mês FECHADO) com ≥4 eventos positivos
export async function careStreak(supabase: any, userId: string): Promise<boolean> {
  try {
    const now = new Date();
    const meses: string[] = [];
    for (let i = 1; i <= 3; i++) meses.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 15)));
    const janela = meses[0]; // mês fechado mais recente — chave de dedup

    const { count: ja } = await supabase.from("care_score_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("kind", "streak_bonus").contains("meta", { janela });
    if (ja && ja > 0) return false;

    const ini = `${meses[2]}-01T00:00:00Z`;
    const { data: evs } = await supabase.from("care_score_events")
      .select("points, created_at").eq("user_id", userId).gt("points", 0).gte("created_at", ini);
    const porMes: Record<string, number> = {};
    (evs || []).forEach((e: any) => { const k = String(e.created_at).slice(0, 7); porMes[k] = (porMes[k] || 0) + 1; });
    if (!meses.every((m) => (porMes[m] || 0) >= 4)) return false;

    await supabase.from("care_score_events").insert({
      user_id: userId, kind: "streak_bonus", points: CARE_POINTS.streak_bonus, meta: { janela },
    });
    await careRecompute(supabase, userId);
    return true;
  } catch (e) { console.error("careStreak:", e); return false; }
}

// decay: sumiu (90d dono / 45d PRO) → −50/semana até o piso do tier atual
export async function careDecay(supabase: any, u: { id: string; driver_mode?: boolean; care_score?: number; care_tier?: string; care_last_activity?: string | null }): Promise<boolean> {
  try {
    const score = Number(u.care_score) || 0;
    if (score <= 0 || !u.care_last_activity) return false;
    const limite = u.driver_mode ? 45 : 90;
    const diasParado = Math.floor((Date.now() - new Date(u.care_last_activity + "T12:00:00").getTime()) / 86400000);
    if (diasParado < limite) return false;

    // dedup semanal (chave = segunda-feira da semana corrente)
    const now = new Date();
    const seg = new Date(now); seg.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const semana = seg.toISOString().split("T")[0];
    const { count: ja } = await supabase.from("care_score_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", u.id).eq("kind", "decay").contains("meta", { semana });
    if (ja && ja > 0) return false;

    const piso = tierFloor(String(u.care_tier || "none"));
    const perda = Math.min(CARE_POINTS.decay_week, Math.max(0, score - piso));
    if (perda <= 0) return false;

    await supabase.from("care_score_events").insert({
      user_id: u.id, kind: "decay", points: -perda, meta: { semana, dias_parado: diasParado },
    });
    await careRecompute(supabase, u.id, { touchActivity: false });
    return true;
  } catch (e) { console.error("careDecay:", e); return false; }
}
