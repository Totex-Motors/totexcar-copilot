// TotexCar Co-pilot — Alertas de vencimento via WhatsApp (DUAL: Uazapi OU API oficial Meta)
// Roda diariamente (pg_cron). Para cada usuário/veículo, avisa sobre vencimentos
// de licenciamento, IPVA, seguro e CNH em marcos (30/15/7/1/0 dias) e quando vencido.
// v4: + parcelas de financiamento (5/1/0) e PRAZO DE RECURSO de multas (5/3/1/0).
// v8: + RADAR da Garagem Totex — avisa quando um carro do desejo aparece no estoque do marketplace.
// v9: TODO alerta é iniciado pelo negócio → na API oficial sai por TEMPLATE aprovado (ver _shared/wa.ts).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { loadWaSettings, waSendTemplate, type WaSettings } from "../_shared/wa.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";
const MARKETPLACE = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const MARKS = [30, 15, 7, 1, 0];

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

let _wa: WaSettings | null = null;
async function waS(): Promise<WaSettings> {
  if (_wa) return _wa;
  _wa = await loadWaSettings(supabase);
  return _wa;
}
// Envia um alerta (iniciado pelo negócio) pelo template certo; no uazapi vira o texto equivalente.
async function sendTpl(phone: string, name: string, params: any[]) {
  await waSendTemplate(await waS(), phone, name, params);
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function fmt(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const LABELS: Record<string, string> = {
  licenciamento: "licenciamento",
  ipva: "IPVA",
  seguro: "seguro",
  cnh: "CNH (carta de habilitação)",
};

async function maybeNotify(
  userId: string, phone: string, doc: string, dueDate: string, vehicleName: string,
) {
  const days = daysUntil(dueDate);
  let kind = "";
  let situacao = "";
  const label = LABELS[doc];
  const alvo = doc === "cnh" ? "sua " + label : `o ${label} de ${vehicleName || "seu veículo"}`;

  if (days < 0) {
    kind = `${doc}_overdue`;
    situacao = "está VENCIDO — regularize o quanto antes para evitar multas";
  } else if (MARKS.includes(days)) {
    kind = `${doc}_d${days}`;
    situacao = days === 0 ? "vence HOJE" : days === 1 ? "vence AMANHÃ" : `vence em ${days} dias`;
  } else {
    return false;
  }

  // dedup: insere no log; se já existir (unique), pula o envio
  const { error } = await supabase
    .from("notification_log")
    .insert({ user_id: userId, kind, due_date: dueDate, channel: "whatsapp" });
  if (error) {
    if ((error as any).code === "23505") return false; // já notificado
    console.error("erro notification_log:", error);
    return false;
  }
  await sendTpl(phone, "vencimento_documento", [alvo, situacao, fmt(dueDate)]);
  return true;
}

// Marcos de alerta da parcela do financiamento (mais curtos que os vencimentos anuais)
const PARCELA_MARKS = [5, 1, 0];

function addMonthsStr(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(y, (m - 1) + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, lastDay));
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${base.getFullYear()}-${mm}-${dd}`;
}

async function maybeNotifyParcela(userId: string, phone: string, f: any, dueDate: string) {
  const days = daysUntil(dueDate);
  const banco = f.banco ? String(f.banco) : "do seu carro";
  const parcelaNum = Number(f.parcelas_pagas) + 1;
  const valor = `R$ ${Number(f.valor_parcela).toFixed(2).replace(".", ",")}`;
  let kind = "";
  let situacao = "";
  if (days < 0) {
    kind = `parcela:${f.id}:overdue`;
    situacao = "está ATRASADA — evite juros e pague o quanto antes";
  } else if (PARCELA_MARKS.includes(days)) {
    kind = `parcela:${f.id}:d${days}`;
    situacao = days === 0 ? "vence HOJE" : days === 1 ? "vence AMANHÃ" : `vence em ${days} dias`;
  } else {
    return false;
  }
  const { error } = await supabase
    .from("notification_log")
    .insert({ user_id: userId, kind, due_date: dueDate, channel: "whatsapp" });
  if (error) {
    if ((error as any).code === "23505") return false;
    console.error("erro notification_log parcela:", error);
    return false;
  }
  // linha digitável vai junto (copia e cola). Prioridade: boleto da PARCELA CERTA no carnê salvo
  // (mapa boletos {parcela: linha}); fallback: boleto avulso salvo (pode ser de outra parcela).
  const linhaCarne = (f.boletos || {})[String(parcelaNum)];
  const boletoInfo = linhaCarne
    ? `Linha digitável (copia e cola): ${linhaCarne}`
    : f.boleto_linha
    ? `Linha digitável (copia e cola): ${f.boleto_linha} — se este boleto for de outra parcela, me mande o carnê em PDF que eu atualizo.`
    : `Me mande o carnê em PDF (ou a foto do boleto) que eu envio a linha digitável junto com o lembrete, todo mês.`;
  await sendTpl(phone, "parcela_financiamento", [`${parcelaNum}/${f.num_parcelas}`, banco, valor, situacao, fmt(dueDate), boletoInfo]);
  return true;
}

// ---- Resumo semanal do Motorista PRO (TotexCar Co-pilot PRO) ----
// Roda às segundas: fatura/gastos/lucro (+ lucro/km) da semana anterior (seg–dom).
const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

function lastWeekRange(): { de: string; ate: string; weekKey: string } {
  const now = new Date();
  const dow = now.getDay(); // 0=dom
  const monThis = new Date(now); monThis.setDate(now.getDate() - ((dow + 6) % 7)); // segunda desta semana
  const monPrev = new Date(monThis); monPrev.setDate(monThis.getDate() - 7);
  const sunPrev = new Date(monThis); sunPrev.setDate(monThis.getDate() - 1);
  const iso = (d: Date) => d.toISOString().split("T")[0];
  return { de: iso(monPrev), ate: iso(sunPrev), weekKey: iso(monPrev) };
}

async function maybeWeeklyPro(userId: string, phone: string) {
  if (new Date().getDay() !== 1) return false; // só segunda
  const { de, ate, weekKey } = lastWeekRange();

  const { data: tx } = await supabase.from("transactions")
    .select("amount, type, odometer")
    .eq("user_id", userId).gte("transaction_date", de).lte("transaction_date", ate);
  let receita = 0, despesa = 0;
  const odos: number[] = [];
  (tx || []).forEach((t: any) => {
    if (t.type === "income") receita += Math.abs(Number(t.amount));
    else despesa += Math.abs(Number(t.amount));
    if (Number(t.odometer) > 0) odos.push(Number(t.odometer));
  });
  if (receita === 0 && despesa === 0) return false; // semana sem movimento: não incomoda

  // dedup por semana
  const { error } = await supabase.from("notification_log")
    .insert({ user_id: userId, kind: `pro_weekly:${weekKey}`, due_date: weekKey, channel: "whatsapp" });
  if (error) { if ((error as any).code === "23505") return false; console.error("log pro_weekly:", error); return false; }

  const lucro = receita - despesa;
  const km = odos.length >= 2 ? Math.round(Math.max(...odos) - Math.min(...odos)) : null;
  const kmLinha = km && km > 0
    ? `🛣️ ${km.toLocaleString("pt-BR")} km rodados, lucro de ${fmtBRL(lucro / km)} por km.`
    : `Bora pra mais uma semana!`;
  await sendTpl(phone, "resumo_pro_semanal", [
    `${fmt(de)} a ${fmt(ate)}`, fmtBRL(receita), fmtBRL(despesa),
    `${lucro >= 0 ? "sobrou" : "ficou negativo"} ${fmtBRL(lucro)}`, kmLinha,
  ]);
  return true;
}

// Marcos do prazo de recurso de multa (curtos: o recurso é urgente)
const MULTA_MARKS = [5, 3, 1, 0];

async function maybeNotifyMulta(userId: string, phone: string, m: any, appUrl: string) {
  const days = daysUntil(m.prazo_recurso);
  if (!MULTA_MARKS.includes(days)) return false; // prazo vencido não notifica (recurso perdeu o objeto)
  const kind = `multa:${m.id}:d${days}`;
  const desc = m.descricao || "sua multa";
  const valor = m.valor != null ? ` (R$ ${Number(m.valor).toFixed(2).replace(".", ",")})` : "";
  const quando = days === 0 ? "termina HOJE" : days === 1 ? "termina AMANHÃ" : `termina em ${days} dias`;
  const instrucao = m.recurso_texto
    ? `Seu recurso já está PRONTO no app, é só copiar e protocolar no órgão autuador: ${appUrl}/multas`
    : `Me mande a foto da multa que eu preparo o recurso pra você. 📄`;

  const { error } = await supabase
    .from("notification_log")
    .insert({ user_id: userId, kind, due_date: m.prazo_recurso, channel: "whatsapp" });
  if (error) {
    if ((error as any).code === "23505") return false; // já notificado
    console.error("erro notification_log multa:", error);
    return false;
  }
  await sendTpl(phone, "prazo_recurso_multa", [`${desc}${valor}`, quando, fmt(m.prazo_recurso), instrucao]);
  return true;
}

// ---- RADAR da Garagem Totex ----
// Cruza cada desejo salvo (car_radar) com o estoque AO VIVO do marketplace e avisa no WhatsApp
// quando um carro NOVO (ainda não avisado) casa com o filtro. Dedup por (radar, veículo) no
// notification_log usando a data de criação do radar como âncora estável → avisa 1x por carro.
// mapa nome-da-loja → dealershipId (p/ escopar o radar do cliente pela loja dele), cacheado no isolate
let _dealerIds: Record<string, string> | null = null;
async function dealerIdByName(name?: string | null): Promise<string | null> {
  if (!name) return null;
  if (!_dealerIds) {
    try {
      const res = await fetch(`${MARKETPLACE}/api/dealerships`, { headers: { Accept: "application/json" } });
      const d = await res.json().catch(() => []);
      const arr = Array.isArray(d) ? d : (d?.data || []);
      const m: Record<string, string> = {};
      for (const x of arr) if (x?.id && x?.name) m[String(x.name).trim().toLowerCase()] = x.id;
      _dealerIds = m;
    } catch { _dealerIds = {}; }
  }
  return _dealerIds[String(name).trim().toLowerCase()] || null;
}

async function fetchRadarMatches(r: any, dealershipId?: string | null) {
  const u = new URL(`${MARKETPLACE}/api/vehicles`);
  const params: Record<string, unknown> = {
    brand: r.brand || undefined, search: r.model || undefined,
    maxPrice: r.max_price || undefined, minYear: r.min_year || undefined,
    maxMileage: r.max_km || undefined, limit: 6,
    dealershipId: dealershipId || undefined, // cliente de loja → só o estoque dela
  };
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`marketplace_${res.status}`);
  const d = await res.json().catch(() => ({}));
  return Array.isArray(d?.data) ? d.data : [];
}

function carLine(v: any, refCode?: string | null) {
  const title = [v.brand, v.model, v.version].filter(Boolean).join(" ");
  const km = Number(v.mileage) > 0 ? `${Number(v.mileage).toLocaleString("pt-BR")} km` : "";
  const preco = v.price != null ? `R$ ${Number(v.price).toLocaleString("pt-BR")}` : "";
  const url = `${MARKETPLACE}/veiculo/${v.id}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`;
  const info = [v.year, km, preco].filter(Boolean).join(" · ");
  return `*${title} ${v.year || ""}*\n${info}\n🔗 ${url}`;
}

async function maybeNotifyRadar(userId: string, phone: string, r: any, refCode?: string | null, dealership?: string | null) {
  let matches: any[] = [];
  try {
    const scopeId = await dealerIdByName(dealership); // cliente de loja: só notifica match da loja dele
    matches = await fetchRadarMatches(r, scopeId);
  } catch { return false; }
  if (!matches.length) return false;

  const anchor = String(r.created_at || "").split("T")[0] || "2000-01-01"; // data estável p/ dedup
  const novos: any[] = [];
  for (const v of matches) {
    if (!v?.id) continue;
    const { error } = await supabase.from("notification_log").insert({
      user_id: userId, kind: `radar:${r.id}:${v.id}`, due_date: anchor, channel: "whatsapp",
    });
    if (error) { if ((error as any).code === "23505") continue; console.error("log radar:", error); continue; }
    novos.push(v);
  }
  if (!novos.length) return false;

  const desejo = [r.brand, r.model].filter(Boolean).join(" ") || "seu radar";
  // API oficial: 1 template por carro (parâmetro não aceita quebra de linha) — máx. 3 por rodada
  for (const v of novos.slice(0, 3)) {
    const title = [v.brand, v.model, v.version, v.year].filter(Boolean).join(" ");
    const km = Number(v.mileage) > 0 ? `, ${Number(v.mileage).toLocaleString("pt-BR")} km` : "";
    const preco = v.price != null ? `R$ ${Number(v.price).toLocaleString("pt-BR")}` : "consulte";
    const url = `${MARKETPLACE}/veiculo/${v.id}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`;
    await sendTpl(phone, "radar_match", [desejo, `${title}${km}`, preco, url]);
  }
  return true;
}

// ---- Renovação da assinatura (cobrança AVULSA, sem auto-renovar) ----
// Lembra o dono antes de vencer (5/3/1 dias) e, no vencimento, RE-BLOQUEIA (plan free + overdue)
// e avisa pra renovar. Só p/ quem é premium pago (tem plan_expires_at).
const RENEW_MARKS = [5, 3, 1];
async function maybeNotifyRenovacao(u: any, phone: string, appUrl: string, sponsor: { dealership: string | null; sponsored_at: string | null; coupon_code: string | null } | null) {
  if (u.plan !== "premium" || !u.plan_expires_at) return false;
  const dueDate = String(u.plan_expires_at).split("T")[0];
  const days = daysUntil(dueDate);

  // É o vencimento do ANO CORTESIA? (só enquanto o vencimento ainda estiver dentro da janela do 1º ano
  // patrocinado; depois que o cliente renova, plan_expires_at avança e cai no fluxo normal).
  let isCortesia = false;
  if (sponsor?.sponsored_at) {
    const limite = new Date(sponsor.sponsored_at); limite.setDate(limite.getDate() + 380);
    isCortesia = new Date(dueDate) <= limite;
  }
  const loja = sponsor?.dealership || "sua loja";
  const planLink = `${appUrl}/plans${sponsor?.coupon_code ? `?coupon=${encodeURIComponent(sponsor.coupon_code)}` : ""}`;

  if (days <= 0) {
    // venceu: re-bloqueia no servidor (o app já bloqueia em tempo real) + avisa
    const { error } = await supabase.from("notification_log")
      .insert({ user_id: u.id, kind: `sub_expired:${u.id}`, due_date: dueDate, channel: "whatsapp" });
    if (error) { if ((error as any).code === "23505") return false; console.error("log sub_expired:", error); return false; }
    await supabase.from("users").update({ plan: "free", subscription_status: "overdue" }).eq("id", u.id);
    if (isCortesia) await sendTpl(phone, "cortesia_vencida", [loja, planLink]);
    else await sendTpl(phone, "assinatura_vencida", [`${appUrl}/plans`]);
    return true;
  }

  if (!RENEW_MARKS.includes(days)) return false;
  const { error } = await supabase.from("notification_log")
    .insert({ user_id: u.id, kind: `sub_renew:${u.id}:d${days}`, due_date: dueDate, channel: "whatsapp" });
  if (error) { if ((error as any).code === "23505") return false; console.error("log sub_renew:", error); return false; }
  const quando = days === 1 ? "amanhã" : `em ${days} dias`;
  if (isCortesia) await sendTpl(phone, "cortesia_vencendo", [loja, quando, fmt(dueDate), planLink]);
  else await sendTpl(phone, "assinatura_vencendo", [quando, fmt(dueDate), `${appUrl}/plans`]);
  return true;
}

// ---- Pós-venda / Sucesso do Cliente (Fase 1): NPS no D+atraso e aniversário da compra no D+365 ----
async function runPostsale(): Promise<number> {
  let sent = 0;
  const { data: journeys } = await supabase.from("postsale_journeys")
    .select("*").neq("status", "encerrado");
  if (!journeys?.length) return 0;

  // config por loja (atraso do NPS)
  const { data: cfgs } = await supabase.from("dealership_settings").select("dealership, nps_delay_days");
  const delayByLoja: Record<string, number> = {};
  (cfgs || []).forEach((c: any) => { delayByLoja[c.dealership] = Number(c.nps_delay_days) || 3; });

  // telefones dos lojistas por loja (p/ alertas à loja, ex.: transferência pendente)
  const { data: dealers } = await supabase.from("users").select("phone, dealership").eq("role", "dealer").not("phone", "is", null);
  const dealerPhones: Record<string, string[]> = {};
  (dealers || []).forEach((d: any) => { const p = onlyDigits(d.phone || ""); if (p) (dealerPhones[d.dealership] ||= []).push(p); });

  const daysSince = (d: string) => -daysUntil(d);

  for (const j of journeys) {
    const phone = onlyDigits(j.customer_phone || "");
    if (!phone) continue;
    const nome = j.customer_name ? String(j.customer_name).split(" ")[0] : "";

    const carroTpl = j.car_desc ? String(j.car_desc) : "carro";

    // 1) NPS — uma vez, no D+atraso (default 3 dias), se ainda não perguntado
    const delay = delayByLoja[j.dealership] ?? 3;
    if (!j.nps_asked_at && j.nps_score == null && daysSince(j.purchase_date) >= delay) {
      await sendTpl(phone, "nps_pesquisa", [nome || "tudo bem", j.dealership]);
      await supabase.from("postsale_journeys").update({ nps_asked_at: new Date().toISOString() }).eq("id", j.id);
      sent++;
      continue; // não manda 2 coisas no mesmo dia
    }

    // 2) Transferência de propriedade pendente há >15 dias → alerta A LOJA (ela é quem processa)
    if (j.transfer_status !== "concluida" && !j.transfer_reminded && daysSince(j.purchase_date) >= 15) {
      const alvo = dealerPhones[j.dealership] || [];
      for (const dp of alvo) {
        await sendTpl(dp, "transferencia_pendente_loja", [j.dealership, j.customer_name || j.customer_phone, carroTpl, String(daysSince(j.purchase_date))]);
      }
      await supabase.from("postsale_journeys").update({ transfer_reminded: true }).eq("id", j.id);
      if (alvo.length) { sent++; continue; }
    }

    // 3) Garantia perto de vencer (≤15 dias) → avisa o CLIENTE
    if (j.warranty_until && !j.warranty_reminded) {
      const d = daysUntil(String(j.warranty_until).split("T")[0]);
      if (d >= 0 && d <= 15) {
        await sendTpl(phone, "garantia_vencendo", [carroTpl, j.dealership, d === 0 ? "HOJE" : `em ${d} dia(s)`, fmt(String(j.warranty_until).split("T")[0])]);
        await supabase.from("postsale_journeys").update({ warranty_reminded: true }).eq("id", j.id);
        sent++; continue;
      }
    }

    // 4) Próxima revisão agendada (≤7 dias) → avisa o CLIENTE
    if (j.revisao_proxima && !j.revisao_reminded) {
      const d = daysUntil(String(j.revisao_proxima).split("T")[0]);
      if (d >= 0 && d <= 7) {
        await sendTpl(phone, "revisao_proxima", [carroTpl, fmt(String(j.revisao_proxima).split("T")[0]), j.dealership]);
        await supabase.from("postsale_journeys").update({ revisao_reminded: true }).eq("id", j.id);
        sent++; continue;
      }
    }

    // 5) Aniversário da compra — 1 ano
    if (!j.anniversary_sent && daysSince(j.purchase_date) >= 365) {
      await sendTpl(phone, "aniversario_compra", [carroTpl, j.dealership]);
      await supabase.from("postsale_journeys").update({ anniversary_sent: true }).eq("id", j.id);
      sent++;
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  _wa = null;
  // proteção: aceita secret na query (usado pelo cron) — ou execução manual autenticada
  const url = new URL(req.url);
  if (WEBHOOK_SECRET && url.searchParams.get("secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let sent = 0;
  try {
    const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
    const appUrl = (cfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");

    // Cortesias patrocinadas: user_id → dados da loja, pra personalizar o lembrete de renovação do 1º ano.
    const sponsoredByUser: Record<string, { dealership: string | null; sponsored_at: string | null; coupon_code: string | null }> = {};
    try {
      const { data: spons } = await supabase.from("postsale_journeys")
        .select("user_id, dealership, sponsored_at, coupon_code")
        .eq("sponsored", true).not("user_id", "is", null);
      (spons || []).forEach((s: any) => { sponsoredByUser[s.user_id] = { dealership: s.dealership, sponsored_at: s.sponsored_at, coupon_code: s.coupon_code }; });
    } catch (e) { console.error("erro carregando cortesias:", e); }

    const { data: users } = await supabase
      .from("users")
      .select("id, phone, cnh_vencimento, driver_mode, referral_code, plan, plan_expires_at, subscription_status, dealership")
      .not("phone", "is", null);

    for (const u of users || []) {
      const phone = onlyDigits(u.phone || "");
      if (!phone) continue;

      const { data: vehicles } = await supabase
        .from("accounts").select("name, licenciamento_vencimento, ipva_vencimento, seguro_vencimento")
        .eq("user_id", u.id).eq("is_active", true).limit(1);
      const v = vehicles && vehicles.length ? vehicles[0] : null;

      const checks: Array<[string, string | null, string]> = [
        ["licenciamento", v?.licenciamento_vencimento ?? null, v?.name ?? ""],
        ["ipva", v?.ipva_vencimento ?? null, v?.name ?? ""],
        ["seguro", v?.seguro_vencimento ?? null, v?.name ?? ""],
        ["cnh", u.cnh_vencimento ?? null, ""],
      ];

      for (const [doc, date, vname] of checks) {
        if (!date) continue;
        const ok = await maybeNotify(u.id, phone, doc, date as string, vname);
        if (ok) sent++;
      }

      // Parcelas de financiamento (próxima parcela em aberto)
      const { data: fins } = await supabase
        .from("financiamentos")
        .select("id, banco, valor_parcela, num_parcelas, parcelas_pagas, primeira_parcela, boleto_linha, boletos")
        .eq("user_id", u.id).eq("ativo", true);
      for (const f of fins || []) {
        if (Number(f.parcelas_pagas) >= Number(f.num_parcelas)) continue;
        const due = addMonthsStr(f.primeira_parcela, Number(f.parcelas_pagas));
        if (await maybeNotifyParcela(u.id, phone, f, due)) sent++;
      }

      // Resumo semanal do Motorista PRO (segundas)
      if ((u as any).driver_mode) {
        try { if (await maybeWeeklyPro(u.id, phone)) sent++; } catch (e) { console.error("erro weekly pro:", e); }
      }

      // Prazo de recurso de multas (só as que ainda precisam de ação)
      try {
        const { data: multas } = await supabase
          .from("multas")
          .select("id, descricao, valor, prazo_recurso, recurso_texto, status")
          .eq("user_id", u.id)
          .in("status", ["nova", "recurso_gerado"])
          .not("prazo_recurso", "is", null);
        for (const m of multas || []) {
          if (await maybeNotifyMulta(u.id, phone, m, appUrl)) sent++;
        }
      } catch (e) { console.error("erro multas alerts:", e); }

      // Renovação da assinatura (avulsa): lembra antes e re-bloqueia no vencimento
      try { if (await maybeNotifyRenovacao(u, phone, appUrl, sponsoredByUser[u.id] || null)) sent++; } catch (e) { console.error("erro renovacao:", e); }

      // Radar da Garagem Totex (carro do desejo apareceu no estoque)
      try {
        const { data: radars } = await supabase
          .from("car_radar")
          .select("id, brand, model, max_price, min_year, max_km, created_at")
          .eq("user_id", u.id).eq("active", true);
        for (const r of radars || []) {
          if (await maybeNotifyRadar(u.id, phone, r, (u as any).referral_code, (u as any).dealership)) sent++;
        }
      } catch (e) { console.error("erro radar alerts:", e); }
    }

    // Pós-venda / Sucesso do Cliente (NPS + aniversário) — independente dos usuários do app
    try { sent += await runPostsale(); } catch (e) { console.error("erro postsale:", e); }

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro alertas:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
