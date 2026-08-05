// TotexCar Co-pilot — Consulta Veicular paga (Meu Veículo)
// Fluxo: cliente pede a consulta da PRÓPRIA placa → checkout PIX/cartão no Asaas (R$ 5,90)
// → asaas-webhook confirma (externalReference "vq:{id}") → runVehicleQuery busca no fornecedor
// → resultado sanitizado fica em vehicle_queries e o app/pWhatsApp exibem.
// Segurança: token do fornecedor NUNCA sai do servidor; consulta só da placa do próprio
// usuário (LGPD); cache de N dias não consome crédito pré-pago.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { loadDebitosSettings, cachedDebitos, runVehicleQuery, resumoDebitos, fichaDebitos, temDados } from "../_shared/debitos.ts";

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

// mesmo pixel 1x1 do create-checkout (o Asaas exige imageBase64 VÁLIDA no item — base64 corrompida = 400)
const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const normPlaca = (p: any) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);
  const userId = ud.user.id;

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const action = String(p.action || "quote");

  try {
    const s = await loadDebitosSettings(admin);

    // -------- relatório consolidado de créditos (admin) --------
    if (action === "report") {
      const { data: me } = await admin.from("users").select("role").eq("id", userId).single();
      if (me?.role !== "admin") return json({ error: "forbidden" }, 403);
      const { data: cfg } = await admin.from("app_settings")
        .select("debitos_credits_purchased, debitos_credits_offset").eq("id", 1).single();
      const { data: qs } = await admin.from("vehicle_queries")
        .select("id, placa, status, price, supplier_cost, supplier_hit, source, created_at, paid_at, user_id")
        .order("created_at", { ascending: false }).limit(500);
      const rows = qs || [];
      const done = rows.filter((r: any) => r.status === "done");
      const hits = done.filter((r: any) => r.supplier_hit);
      const comprados = Number(cfg?.debitos_credits_purchased) || 0;
      const offset = Number(cfg?.debitos_credits_offset) || 0;
      const usadosSistema = hits.length;
      const receita = done.filter((r: any) => r.paid_at).reduce((t: number, r: any) => t + Number(r.price || 0), 0);
      const custo = hits.reduce((t: number, r: any) => t + Number(r.supplier_cost || 0), 0);
      // nomes dos clientes das últimas consultas
      const ids = [...new Set(rows.slice(0, 30).map((r: any) => r.user_id).filter(Boolean))];
      const nomes: Record<string, string> = {};
      if (ids.length) {
        const { data: us } = await admin.from("users").select("id, name").in("id", ids);
        (us || []).forEach((u: any) => { nomes[u.id] = u.name; });
      }
      return json({
        ok: true,
        creditos: {
          comprados, usados_fora: offset, usados_sistema: usadosSistema,
          usados_total: offset + usadosSistema, saldo: comprados - offset - usadosSistema,
        },
        consultas: {
          total: rows.length, concluidas: done.length, cache_hits: done.length - hits.length,
          pendentes: rows.filter((r: any) => r.status === "pending").length,
          erros: rows.filter((r: any) => r.status === "error").length,
        },
        financeiro: {
          receita: Number(receita.toFixed(2)), custo: Number(custo.toFixed(2)),
          margem: Number((receita - custo).toFixed(2)),
        },
        ultimas: rows.slice(0, 30).map((r: any) => ({
          placa: r.placa, status: r.status, price: r.price, supplier_hit: r.supplier_hit,
          source: r.source, created_at: r.created_at, cliente: nomes[r.user_id] || null,
        })),
      });
    }

    // erros de negócio saem com HTTP 200 + {error}: o supabase.functions.invoke do front só
    // entrega o corpo em 2xx (senão vira o genérico "non-2xx status code" no toast)
    if (!s || !s.enabled) return json({ error: "Consulta temporariamente indisponível. Tente de novo em instantes." }, 200);

    // placa SEMPRE do veículo do próprio usuário (LGPD: consulta é do carro dele)
    const { data: accs } = await admin.from("accounts")
      .select("id, placa, marca, modelo").eq("user_id", userId).eq("is_active", true).limit(1);
    const veh = accs?.[0];
    const placa = normPlaca(veh?.placa);

    // -------- quote: estado atual pro card --------
    if (action === "quote") {
      const cached = placa ? await cachedDebitos(admin, placa, s.cacheDays) : null;
      const { data: last } = await admin.from("vehicle_queries")
        .select("id, status, result, created_at").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1);
      return json({
        ok: true, price: s.price, placa: placa || null,
        veiculo: veh ? [veh.marca, veh.modelo].filter(Boolean).join(" ") : null,
        cached: cached ? { consultado_em: cached.created_at } : null,
        last: last?.[0] ? { id: last[0].id, status: last[0].status, created_at: last[0].created_at, has_result: !!last[0].result } : null,
      });
    }

    // -------- result: última consulta (própria), com SELF-HEAL --------
    // Não dependemos só do webhook: se a consulta está "pending", conferimos o checkout
    // direto no Asaas; pago → marca e RODA na hora. "paid" travado → roda de novo.
    if (action === "result") {
      let q = admin.from("vehicle_queries")
        .select("id, placa, status, result, error, created_at, paid_at, asaas_checkout_id, checkout_url")
        .eq("user_id", userId);
      if (p.query_id) q = q.eq("id", String(p.query_id));
      const { data } = await q.order("created_at", { ascending: false }).limit(10);
      const rows = data || [];
      // PRIORIDADE (não simplesmente "a mais recente"): paga-e-não-entregue > pendente
      // recente (checkout ainda válido) > concluída > resto. Sem isso, um clique que cria
      // pendente nova ESCONDIA a consulta paga que ainda precisava ser entregue.
      const fresca = (r: any) => Date.now() - new Date(r.created_at).getTime() < 70 * 60_000;
      let row = p.query_id
        ? (rows[0] || null)
        : (rows.find((r: any) => r.status === "paid")
          || rows.find((r: any) => r.status === "pending" && fresca(r))
          || rows.find((r: any) => r.status === "done")
          || rows[0] || null);

      if (row && row.status === "pending") {
        const { data: cfg } = await admin.from("app_settings").select("asaas_api_key, asaas_sandbox").eq("id", 1).single();
        if (cfg?.asaas_api_key) {
          const base = cfg.asaas_sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
          const hd = { access_token: cfg.asaas_api_key };
          try {
            // Procura o PAGAMENTO do checkout desta consulta. ⚠️ Constatado em produção
            // (2026-08-05): o Asaas NÃO propaga o externalReference do checkout pro payment
            // (vem null) — o vínculo confiável é payment.checkoutSession. Mantemos a
            // externalReference como critério extra caso o Asaas passe a preenchê-la.
            const pr = await fetch(`${base}/payments?limit=100`, { headers: hd });
            const pj = await pr.json().catch(() => ({}));
            const pago = pr.ok && (pj?.data || []).some((pay: any) =>
              /RECEIVED|CONFIRMED/.test(String(pay?.status || "").toUpperCase()) &&
              (String(pay?.checkoutSession || "") === String(row.asaas_checkout_id || "x") ||
               String(pay?.externalReference || "") === `vq:${row.id}`));
            if (pago) {
              await admin.from("vehicle_queries").update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", row.id).eq("status", "pending");
              row = { ...row, status: "paid" };
            } else if (pr.ok) {
              // sem pagamento: só declara expirado se o CHECKOUT confirma e já passou da validade (60min)
              const velho = Date.now() - new Date(row.created_at).getTime() > 70 * 60_000;
              if (velho && row.asaas_checkout_id) {
                const cr = await fetch(`${base}/checkouts/${row.asaas_checkout_id}`, { headers: hd });
                const cj = await cr.json().catch(() => ({}));
                const st = String(cj?.status || "").toUpperCase();
                if (cr.ok && /EXPIRED|CANCEL|INACTIVE/.test(st)) {
                  await admin.from("vehicle_queries").update({ status: "error", error: "checkout_expirado" })
                    .eq("id", row.id).eq("status", "pending");
                  row = { ...row, status: "error", error: "checkout_expirado" };
                }
              }
            }
          } catch (e) { console.error("self-heal asaas:", e); }
        }
      }
      if (row && row.status === "paid") {
        const r = await runVehicleQuery(admin, row.id);
        if (r.ok) row = { ...row, status: "done", result: r.result };
        else row = { ...row, status: "error", error: r.error };
      }
      const { asaas_checkout_id: _a, ...pub } = row || ({} as any);
      const valido = row?.result && temDados(row.result);
      return json({
        ok: true, query: row ? pub : null,
        resumo: valido ? resumoDebitos(row.result) : null,
        ficha: valido ? fichaDebitos(row.result) : null,
      });
    }

    // -------- start: cria consulta + checkout (ou serve o cache de graça) --------
    if (action === "start") {
      if (!placa) return json({ error: "sem_placa", detail: "Cadastre a placa do seu veículo em Meu Veículo antes de consultar." }, 200);

      // cache dentro da janela: entrega sem cobrar (mesma placa, dado ainda fresco)
      const cached = await cachedDebitos(admin, placa, s.cacheDays);
      if (cached) {
        const { data: row } = await admin.from("vehicle_queries").insert({
          user_id: userId, placa, status: "done", price: 0, supplier_cost: 0,
          supplier_hit: false, result: cached.result, paid_at: new Date().toISOString(),
          source: String(p.source || "app"),
        }).select("id").single();
        return json({ ok: true, cached: true, query_id: row?.id, resumo: resumoDebitos(cached.result) });
      }

      // IDEMPOTENTE: já existe consulta desta placa aguardando pagamento (checkout expira em 60min)?
      // Devolve o MESMO link — clicar de novo NUNCA cria consulta/cobrança duplicada.
      const desde55m = new Date(Date.now() - 55 * 60_000).toISOString();
      const { data: pendRows } = await admin.from("vehicle_queries")
        .select("id, checkout_url, created_at").eq("user_id", userId).eq("placa", placa)
        .eq("status", "pending").not("checkout_url", "is", null).gte("created_at", desde55m)
        .order("created_at", { ascending: false }).limit(1);
      if (pendRows?.[0]) {
        return json({ ok: true, url: pendRows[0].checkout_url, query_id: pendRows[0].id, price: s.price, reused: true });
      }

      const { data: cfg } = await admin.from("app_settings").select("asaas_api_key, asaas_sandbox, app_url").eq("id", 1).single();
      if (!cfg?.asaas_api_key) return json({ error: "asaas_nao_configurado" }, 400);

      const { data: created, error: insErr } = await admin.from("vehicle_queries").insert({
        user_id: userId, placa, price: s.price, supplier_cost: s.cost, source: String(p.source || "app"),
      }).select("id").single();
      if (insErr || !created) return json({ error: insErr?.message || "erro_criar_consulta" }, 400);

      const base = cfg.asaas_sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
      const appUrl = String(cfg.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
      const res = await fetch(`${base}/checkouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: cfg.asaas_api_key },
        body: JSON.stringify({
          billingTypes: ["CREDIT_CARD", "PIX"],
          chargeTypes: ["DETACHED"],
          minutesToExpire: 60,
          callback: { successUrl: `${appUrl}/settings?consulta=ok`, cancelUrl: `${appUrl}/settings?consulta=cancel` },
          items: [{
            name: "Consulta Veicular Completa".slice(0, 30),
            description: `Débitos, multas (RENAINF), restrições e situação do veículo placa ${placa}`,
            quantity: 1, value: s.price, imageBase64: PIXEL,
          }],
          externalReference: `vq:${created.id}`, // o asaas-webhook roteia por este prefixo
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const desc = data?.errors?.[0]?.description || `Asaas ${res.status}`;
        await admin.from("vehicle_queries").update({ status: "error", error: `asaas_${res.status}: ${String(desc).slice(0, 250)}` }).eq("id", created.id);
        return json({ error: desc }, 200); // 200 + error: o front mostra a mensagem real no toast
      }
      const url = data.link || data.url || (data.id ? `${base.replace("/v3", "")}/checkoutSession/show/${data.id}` : null);
      await admin.from("vehicle_queries").update({ asaas_checkout_id: data.id || null, checkout_url: url }).eq("id", created.id);
      return json({ ok: true, url, query_id: created.id, price: s.price });
    }

    // -------- run: reprocessa uma consulta paga que falhou (própria) --------
    if (action === "run") {
      const id = String(p.query_id || "");
      const { data: rows } = await admin.from("vehicle_queries").select("id, user_id, status, paid_at, placa").eq("id", id).limit(1);
      const q0 = rows?.[0];
      if (!q0 || q0.user_id !== userId) return json({ error: "consulta_nao_encontrada" }, 404);
      if (!q0.paid_at && q0.status !== "paid") return json({ error: "aguardando_pagamento" }, 400);
      // se o cliente corrigiu a placa no cadastro depois de "placa_nao_encontrada",
      // refazemos a MESMA consulta paga com a placa nova (sem nova cobrança)
      if (placa && placa !== q0.placa) {
        await admin.from("vehicle_queries").update({ placa, status: "paid", result: null }).eq("id", id);
      } else if (q0.status === "error") {
        await admin.from("vehicle_queries").update({ status: "paid" }).eq("id", id);
      }
      const r = await runVehicleQuery(admin, id);
      return json(r.ok ? { ok: true, resumo: resumoDebitos(r.result) } : { error: r.error }, 200);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
