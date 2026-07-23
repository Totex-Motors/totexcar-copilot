// TotexCar Co-pilot — Calendário do Carro (CALENDARIO-DO-CARRO.md v1.1)
// Motor de datas unificado: o cron ALIMENTA car_calendar (refactor do que ele já sabe — não é
// sistema paralelo) e as revisões ganham DATA PROJETADA pelo ritmo real de uso (km médio/dia).
// Fonte das datas fixas = o que o dono informou (accounts.*_vencimento, cnh, financiamento,
// multas, assinatura). A tabela ipva_calendario (UF × final de placa) existe mas o seed é
// manual/futuro — dados oficiais mudam por ano.

const todayStr = () => new Date().toISOString().split("T")[0];
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };

// km médio/dia pelas leituras de hodômetro dos últimos 90 dias (fallback: 40 dono / 250 PRO)
export async function kmMedioDia(supabase: any, userId: string, isPro: boolean): Promise<number> {
  const fallback = isPro ? 250 : 40;
  try {
    const since = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const { data } = await supabase.from("transactions")
      .select("odometer, transaction_date")
      .eq("user_id", userId).gt("odometer", 0).gte("transaction_date", since)
      .order("transaction_date", { ascending: true });
    const pts = (data || []).filter((t: any) => Number(t.odometer) > 0);
    if (pts.length < 2) return fallback;
    const kms = pts.map((t: any) => Number(t.odometer));
    const kmSpan = Math.max(...kms) - Math.min(...kms);
    const dias = Math.max(1, (new Date(pts[pts.length - 1].transaction_date).getTime() - new Date(pts[0].transaction_date).getTime()) / 86400000);
    const kmDia = kmSpan / dias;
    if (!isFinite(kmDia) || kmDia <= 0 || kmDia > 1500) return fallback; // typo de odômetro
    return Math.round(kmDia * 10) / 10;
  } catch { return fallback; }
}

// projeta a data de cada revisão ativa pelo ritmo de uso e grava em maintenance_reminders +
// car_calendar (kind=revisao, projected=true). Retorna as revisões com a projeção calculada.
export async function projectRevisions(supabase: any, userId: string, vehicle: any, kmDia: number): Promise<Array<{ id: string; title: string; km_restante: number; projected_date: string }>> {
  const out: Array<{ id: string; title: string; km_restante: number; projected_date: string }> = [];
  try {
    const hod = Number(vehicle?.hodometro) || 0;
    if (!hod) return out;
    const { data: rems } = await supabase.from("maintenance_reminders")
      .select("id, title, interval_km, last_km").eq("user_id", userId).eq("active", true);
    for (const r of (rems || [])) {
      const intervalo = Number(r.interval_km) || 0;
      if (!intervalo) continue;
      const base = Number(r.last_km) || 0;
      const kmRestante = (base + intervalo) - hod;
      const diasAte = Math.max(0, Math.round(kmRestante / Math.max(1, kmDia)));
      const projected = addDays(diasAte);
      await supabase.from("maintenance_reminders").update({ projected_date: projected }).eq("id", r.id);
      out.push({ id: r.id, title: r.title, km_restante: kmRestante, projected_date: projected });
    }
    // reescreve as linhas de revisão do calendário (delete+insert = idempotente e sem lixo)
    await supabase.from("car_calendar").delete().eq("user_id", userId).eq("kind", "revisao").eq("status", "pendente");
    for (const r of out) {
      await supabase.from("car_calendar").insert({
        user_id: userId, account_id: vehicle?.id || null, kind: "revisao", label: r.title,
        due_date: r.projected_date, projected: true, source_id: r.id,
        meta: { km_restante: r.km_restante, km_dia: kmDia },
      });
    }
  } catch (e) { console.error("projectRevisions:", e); }
  return out;
}

// sincroniza as datas FIXAS no calendário (docs, CNH, parcela, multas, assinatura).
// Estratégia: apaga as pendentes de cada kind e regrava a partir da fonte — 2 rodadas seguidas
// produzem o mesmo estado (critério de aceite do doc).
export async function syncCalendar(supabase: any, u: any, vehicle: any, fins: any[], proximaParcelaDe: (f: any) => string): Promise<void> {
  try {
    const rows: any[] = [];
    const push = (kind: string, label: string, due: any, extra: any = {}) => {
      const d = String(due || "").split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) rows.push({ user_id: u.id, account_id: vehicle?.id || null, kind, label, due_date: d, ...extra });
    };
    if (vehicle?.ipva_vencimento) push("ipva", `IPVA ${String(vehicle.ipva_vencimento).slice(0, 4)}`, vehicle.ipva_vencimento);
    if (vehicle?.licenciamento_vencimento) push("licenciamento", `Licenciamento ${String(vehicle.licenciamento_vencimento).slice(0, 4)}`, vehicle.licenciamento_vencimento);
    if (vehicle?.seguro_vencimento) push("seguro", "Seguro do carro", vehicle.seguro_vencimento);
    if (u?.cnh_vencimento) push("cnh", "CNH (habilitação)", u.cnh_vencimento);
    for (const f of (fins || [])) {
      if (Number(f.parcelas_pagas) >= Number(f.num_parcelas)) continue;
      const due = proximaParcelaDe(f);
      push("parcela", `Parcela ${Number(f.parcelas_pagas) + 1}/${f.num_parcelas} ${f.banco || ""}`.trim(), due,
        { source_id: String(f.id), amount: Number(f.valor_parcela) || null });
    }
    const { data: multas } = await supabase.from("multas")
      .select("id, descricao, prazo_recurso, valor").eq("user_id", u.id)
      .in("status", ["nova", "recurso_gerado"]).not("prazo_recurso", "is", null);
    for (const m of (multas || [])) {
      push("prazo_multa", `Recurso: ${String(m.descricao || "multa").slice(0, 60)}`, m.prazo_recurso,
        { source_id: String(m.id), amount: Number(m.valor) || null });
    }
    if (u?.plan === "premium" && u?.plan_expires_at) push("assinatura", "Assinatura/cortesia Co-pilot", u.plan_expires_at);

    const kinds = ["ipva", "licenciamento", "seguro", "cnh", "parcela", "prazo_multa", "assinatura"];
    await supabase.from("car_calendar").delete().eq("user_id", u.id).in("kind", kinds).eq("status", "pendente");
    if (rows.length) await supabase.from("car_calendar").upsert(rows, { onConflict: "user_id,kind,label,due_date", ignoreDuplicates: true });
    // o que passou sem quitação fica marcado (alimenta o congelamento do Score na Fase 4)
    await supabase.from("car_calendar").update({ status: "vencido" })
      .eq("user_id", u.id).eq("status", "pendente").lt("due_date", todayStr());
  } catch (e) { console.error("syncCalendar:", e); }
}

// próximos eventos (pra tool do agente e pro seletor de insight)
export async function upcoming(supabase: any, userId: string, days = 60): Promise<any[]> {
  const { data } = await supabase.from("car_calendar")
    .select("kind, label, due_date, projected, amount, status, meta")
    .eq("user_id", userId).in("status", ["pendente", "vencido"])
    .gte("due_date", addDays(-7)).lte("due_date", addDays(days))
    .order("due_date", { ascending: true }).limit(20);
  const hoje = new Date(todayStr() + "T12:00:00").getTime();
  return (data || []).map((e: any) => ({
    ...e,
    dias: Math.round((new Date(e.due_date + "T12:00:00").getTime() - hoje) / 86400000),
  }));
}
