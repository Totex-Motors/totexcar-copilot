// TotexCar Co-pilot — Alertas de vencimento via WhatsApp (Uazapi)
// Roda diariamente (pg_cron). Para cada usuário/veículo, avisa sobre vencimentos
// de licenciamento, IPVA, seguro e CNH em marcos (30/15/7/1/0 dias) e quando vencido.
// v4: + parcelas de financiamento (5/1/0) e PRAZO DE RECURSO de multas (5/3/1/0).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UAZAPI_URL = (Deno.env.get("UAZAPI_URL") || "").replace(/\/+$/, "");
const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN") || "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const MARKS = [30, 15, 7, 1, 0];

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

let _uazapi: { url: string; token: string } | null = null;
async function uazapiCreds() {
  if (_uazapi) return _uazapi;
  const { data } = await supabase.from("app_settings").select("uazapi_url, uazapi_token").eq("id", 1).single();
  _uazapi = {
    url: (data?.uazapi_url || UAZAPI_URL || "").replace(/\/+$/, ""),
    token: data?.uazapi_token || UAZAPI_TOKEN || "",
  };
  return _uazapi;
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

async function sendText(phone: string, text: string) {
  const { url, token } = await uazapiCreds();
  if (!url || !token) { console.error("Uazapi não configurado"); return; }
  try {
    const res = await fetch(`${url}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": token },
      body: JSON.stringify({ number: phone, text }),
    });
    if (!res.ok) console.error("Uazapi send falhou:", res.status, await res.text());
  } catch (e) { console.error("Erro Uazapi:", e); }
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
  let message = "";
  const label = LABELS[doc];
  const alvo = doc === "cnh" ? "sua " + label : `o ${label} de ${vehicleName || "seu veículo"}`;

  if (days < 0) {
    kind = `${doc}_overdue`;
    message = `⚠️ Atenção: ${alvo} está VENCIDO desde ${fmt(dueDate)}. Regularize o quanto antes para evitar multas.`;
  } else if (MARKS.includes(days)) {
    kind = `${doc}_d${days}`;
    const quando = days === 0 ? "vence HOJE" : days === 1 ? "vence AMANHÃ" : `vence em ${days} dias`;
    message = `🔔 Lembrete TotexCar Co-pilot: ${alvo} ${quando} (${fmt(dueDate)}).`;
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
  await sendText(phone, message);
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
  const banco = f.banco ? ` (${f.banco})` : "";
  const parcelaNum = Number(f.parcelas_pagas) + 1;
  const valor = `R$ ${Number(f.valor_parcela).toFixed(2).replace(".", ",")}`;
  let kind = "";
  let message = "";
  if (days < 0) {
    kind = `parcela:${f.id}:overdue`;
    message = `⚠️ A parcela ${parcelaNum}/${f.num_parcelas} do financiamento${banco} de ${valor} está ATRASADA desde ${fmt(dueDate)}. Evite juros — pague o quanto antes.`;
  } else if (PARCELA_MARKS.includes(days)) {
    kind = `parcela:${f.id}:d${days}`;
    const quando = days === 0 ? "vence HOJE" : days === 1 ? "vence AMANHÃ" : `vence em ${days} dias`;
    message = `🔔 Parcela ${parcelaNum}/${f.num_parcelas} do financiamento${banco} de ${valor} ${quando} (${fmt(dueDate)}).`;
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
  if (linhaCarne) {
    message += `\n\n📋 Linha digitável da parcela ${parcelaNum} (copia e cola):\n${linhaCarne}`;
  } else if (f.boleto_linha) {
    message += `\n\n📋 Linha digitável (copia e cola):\n${f.boleto_linha}\n\nSe este boleto for de outra parcela, me manda o carnê em PDF ou a foto do boleto atual que eu atualizo. 😉`;
  } else {
    message += `\n\n💡 Me manda o carnê em PDF (ou a foto do boleto) que eu te envio a linha digitável junto com o lembrete, todo mês.`;
  }
  await sendText(phone, message);
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
  const linhas = [
    `📊 *Resumo PRO da semana* (${fmt(de)} a ${fmt(ate)})`,
    ``,
    `💵 Faturou: ${fmtBRL(receita)}`,
    `💸 Gastou: ${fmtBRL(despesa)}`,
    `${lucro >= 0 ? "✅ Sobrou" : "⚠️ Ficou negativo"}: *${fmtBRL(lucro)}*`,
  ];
  if (km && km > 0) linhas.push(`🛣️ ${km.toLocaleString("pt-BR")} km rodados · lucro de ${fmtBRL(lucro / km)} por km`);
  linhas.push(``, `Bora pra mais uma semana! 🚗 (mande os prints de ganhos e os cupons que eu cuido do resto)`);
  await sendText(phone, linhas.join("\n"));
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
  const temRecurso = !!m.recurso_texto;
  const message = `⚖️ O prazo para recorrer de ${desc}${valor} ${quando} (${fmt(m.prazo_recurso)}).` +
    (temRecurso
      ? `\n\nSeu recurso já está PRONTO no app — é só copiar e protocolar no órgão autuador:\n${appUrl}/multas`
      : `\n\nMe mande a foto da multa que eu preparo o recurso pra você. 📄`);

  const { error } = await supabase
    .from("notification_log")
    .insert({ user_id: userId, kind, due_date: m.prazo_recurso, channel: "whatsapp" });
  if (error) {
    if ((error as any).code === "23505") return false; // já notificado
    console.error("erro notification_log multa:", error);
    return false;
  }
  await sendText(phone, message);
  return true;
}

Deno.serve(async (req) => {
  _uazapi = null;
  // proteção: aceita secret na query (usado pelo cron) — ou execução manual autenticada
  const url = new URL(req.url);
  if (WEBHOOK_SECRET && url.searchParams.get("secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let sent = 0;
  try {
    const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
    const appUrl = (cfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");

    const { data: users } = await supabase
      .from("users")
      .select("id, phone, cnh_vencimento, driver_mode")
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
    }

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro alertas:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
