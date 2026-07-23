// TotexCar Co-pilot — Relatório IR/MEI do Motorista PRO (RELATORIO-IR-MEI.md v1.1)
// Gera o relatório fiscal (mensal ou anual) do motorista de aplicativo: receitas por app,
// despesas dedutíveis, lucro, km e R$/km — em PDF (pdf-lib) e CSV (UTF-8 BOM, ";").
// TODO cálculo é feito AQUI em código — o LLM nunca faz aritmética fiscal.
// Auth: JWT do usuário (app) OU service role (webhook/cron, pode passar user_id).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?=,))/g, ".")}`;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const DISCLAIMER = "Documento informativo gerado a partir dos seus registros no TotexCar Co-pilot. " +
  "Não substitui contador nem escrituração oficial. Confira os valores antes de declarar.";

function periodRange(periodo: string, kind: string): { ini: string; fim: string; label: string } {
  if (kind === "anual") {
    return { ini: `${periodo}-01-01`, fim: `${periodo}-12-31`, label: `ano de ${periodo}` };
  }
  const [y, m] = periodo.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    ini: `${periodo}-01`, fim: `${periodo}-${String(last).padStart(2, "0")}`,
    label: `${MESES[m - 1]} de ${y}`,
  };
}

async function computeTotals(userId: string, periodo: string, kind: string) {
  const { ini, fim, label } = periodRange(periodo, kind);
  const { data: tx } = await supabase.from("transactions")
    .select("amount, type, odometer, transaction_date, description, categories(name, dedutivel)")
    .eq("user_id", userId).gte("transaction_date", ini).lte("transaction_date", fim)
    .order("transaction_date", { ascending: true });

  let receita = 0, despesa = 0, despesaDedutivel = 0;
  const porCategoria: Record<string, { total: number; tipo: string; dedutivel: boolean }> = {};
  const odos: number[] = [];
  const linhas: any[] = [];
  for (const t of (tx || [])) {
    const val = Math.abs(Number(t.amount));
    const cat = (t as any).categories?.name || "Outros";
    const ded = (t as any).categories?.dedutivel !== false;
    if (t.type === "income") receita += val;
    else { despesa += val; if (ded) despesaDedutivel += val; }
    const k = `${t.type}:${cat}`;
    porCategoria[k] = { total: (porCategoria[k]?.total || 0) + val, tipo: t.type, dedutivel: ded };
    if (Number(t.odometer) > 0) odos.push(Number(t.odometer));
    linhas.push({
      data: String(t.transaction_date), tipo: t.type === "income" ? "receita" : "despesa",
      categoria: cat, descricao: String(t.description || ""), valor: val, km: t.odometer || "",
    });
  }
  const lucro = receita - despesa;
  const km = odos.length >= 2 ? Math.round(Math.max(...odos) - Math.min(...odos)) : null;
  const rsKm = km && km > 0 ? Number((lucro / km).toFixed(2)) : null;

  // limite MEI: receita acumulada no ANO do período
  const ano = periodo.slice(0, 4);
  const { data: anoTx } = await supabase.from("transactions")
    .select("amount").eq("user_id", userId).eq("type", "income")
    .gte("transaction_date", `${ano}-01-01`).lte("transaction_date", `${ano}-12-31`);
  const receitaAno = (anoTx || []).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
  const { data: cfg } = await supabase.from("app_settings").select("mei_limite_anual").eq("id", 1).single();
  const limite = Number(cfg?.mei_limite_anual) || 81000;
  const meiPct = Number(((receitaAno / limite) * 100).toFixed(1));

  return { label, receita, despesa, despesa_dedutivel: despesaDedutivel, lucro, km, rs_km: rsKm, porCategoria, linhas, receita_ano: receitaAno, mei_limite: limite, mei_pct: meiPct, movimentos: (tx || []).length };
}

async function buildPdf(userName: string, kind: string, t: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(0.05, 0.58, 0.53);
  const ink = rgb(0.07, 0.09, 0.13);
  const mut = rgb(0.4, 0.45, 0.52);
  let y = 800;
  const text = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(s, { x, y, size, font: f, color });

  text("TotexCar Co-pilot", 40, 16, bold, teal); y -= 18;
  text(`Relatório ${kind === "anual" ? "ANUAL (declaração)" : "MENSAL (carnê-leão)"} do Motorista`, 40, 12, bold); y -= 14;
  text(`Período: ${t.label}   ·   Motorista: ${userName || "—"}   ·   Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 40, 9, font, mut);
  y -= 24;

  // resumo
  page.drawRectangle({ x: 40, y: y - 66, width: 515, height: 78, color: rgb(0.95, 0.98, 0.97) });
  text("RESUMO", 50, 9, bold, teal); y -= 16;
  text(`Receita tributável (apps): ${brl(t.receita)}`, 50, 11, bold); y -= 15;
  text(`Despesas do período: ${brl(t.despesa)}   (dedutíveis: ${brl(t.despesa_dedutivel)})`, 50, 10); y -= 15;
  text(`Resultado (lucro): ${brl(t.lucro)}${t.km ? `   ·   ${t.km.toLocaleString("pt-BR")} km rodados` : ""}${t.rs_km != null ? `   ·   ${brl(t.rs_km)}/km` : ""}`, 50, 10); y -= 30;

  // categorias
  text("POR CATEGORIA", 40, 9, bold, teal); y -= 14;
  const cats = Object.entries(t.porCategoria as Record<string, any>)
    .sort((a, b) => b[1].total - a[1].total).slice(0, 20);
  for (const [k, v] of cats) {
    const nome = k.split(":").slice(1).join(":");
    const tipo = v.tipo === "income" ? "receita" : v.dedutivel ? "despesa dedutível" : "despesa (não dedutível)";
    text(`${nome} — ${tipo}`, 50, 9);
    page.drawText(brl(v.total), { x: 460, y, size: 9, font: bold, color: ink });
    y -= 13;
    if (y < 140) break;
  }
  y -= 12;

  // MEI
  text("LIMITE MEI", 40, 9, bold, teal); y -= 14;
  text(`Receita acumulada em ${String(t.label).slice(-4)}: ${brl(t.receita_ano)}  =  ${t.mei_pct}% do limite anual (${brl(t.mei_limite)})`, 50, 10, t.mei_pct >= 90 ? bold : font, t.mei_pct >= 90 ? rgb(0.8, 0.2, 0.2) : ink);
  y -= 30;

  // disclaimer
  const words = DISCLAIMER.split(" ");
  let line = "";
  const flush = () => { if (line) { text(line, 40, 8, font, mut); y -= 11; line = ""; } };
  for (const w of words) { if ((line + " " + w).length > 105) flush(); line = line ? `${line} ${w}` : w; }
  flush();

  return await doc.save();
}

function buildCsv(linhas: any[]): Uint8Array {
  const head = "data;tipo;categoria;descricao;valor;km";
  const rows = linhas.map((l) =>
    [l.data, l.tipo, l.categoria, String(l.descricao).replace(/[;\n\r]/g, " "), String(l.valor.toFixed(2)).replace(".", ","), l.km].join(";"));
  return new TextEncoder().encode("﻿" + [head, ...rows].join("\r\n"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const isService = auth && auth === SERVICE_ROLE;

    // resolve o usuário-alvo: service role pode indicar user_id; JWT comum usa o próprio
    let userId = "";
    if (isService && body.user_id) userId = String(body.user_id);
    else {
      const { data: udata } = await createClient(SUPABASE_URL, SERVICE_ROLE).auth.getUser(auth);
      userId = udata?.user?.id || "";
    }
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const kind = body.kind === "anual" ? "anual" : "mensal";
    // default: mês anterior fechado (mensal) / ano anterior se janeiro (anual)
    const now = new Date();
    let periodo = String(body.periodo || "");
    if (!/^\d{4}(-\d{2})?$/.test(periodo)) {
      if (kind === "anual") periodo = String(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
      else { const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15); periodo = prev.toISOString().slice(0, 7); }
    }
    if (kind === "anual") periodo = periodo.slice(0, 4);

    const t = await computeTotals(userId, periodo, kind);
    if (!t.movimentos) {
      return new Response(JSON.stringify({ ok: false, error: "sem_movimento", periodo, kind }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: u } = await supabase.from("users").select("name").eq("id", userId).single();
    const pdf = await buildPdf(u?.name || "", kind, t);
    const csv = buildCsv(t.linhas);

    const base = `${userId}/${kind}-${periodo}`;
    const up1 = await supabase.storage.from("reports").upload(`${base}.pdf`, pdf, { contentType: "application/pdf", upsert: true });
    const up2 = await supabase.storage.from("reports").upload(`${base}.csv`, csv, { contentType: "text/csv", upsert: true });
    if (up1.error || up2.error) throw new Error(`upload: ${up1.error?.message || up2.error?.message}`);

    const [s1, s2] = await Promise.all([
      supabase.storage.from("reports").createSignedUrl(`${base}.pdf`, 7 * 24 * 3600),
      supabase.storage.from("reports").createSignedUrl(`${base}.csv`, 7 * 24 * 3600),
    ]);

    const totals = {
      receita: t.receita, despesa: t.despesa, despesa_dedutivel: t.despesa_dedutivel,
      lucro: t.lucro, km: t.km, rs_km: t.rs_km, mei_pct: t.mei_pct, movimentos: t.movimentos,
    };
    await supabase.from("fiscal_reports").upsert({
      user_id: userId, periodo, kind, pdf_path: `${base}.pdf`, csv_path: `${base}.csv`,
      totals, created_at: new Date().toISOString(),
    }, { onConflict: "user_id,periodo,kind" });

    return new Response(JSON.stringify({
      ok: true, periodo, kind, label: t.label, totals,
      pdf_url: s1.data?.signedUrl || null, csv_url: s2.data?.signedUrl || null,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("fiscal-report:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
