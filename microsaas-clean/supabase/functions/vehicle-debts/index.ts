// TotexCar Co-pilot — Consulta Veicular paga (Meu Veículo)
// Fluxo: cliente pede a consulta da PRÓPRIA placa → checkout PIX/cartão no Asaas (R$ 5,90)
// → asaas-webhook confirma (externalReference "vq:{id}") → runVehicleQuery busca no fornecedor
// → resultado sanitizado fica em vehicle_queries e o app/pWhatsApp exibem.
// Segurança: token do fornecedor NUNCA sai do servidor; consulta só da placa do próprio
// usuário (LGPD); cache de N dias não consome crédito pré-pago.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { loadDebitosSettings, cachedDebitos, runVehicleQuery, resumoDebitos } from "../_shared/debitos.ts";

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

const PIXEL = "iVBORw0KGgoAAAABAAAAAQCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
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

    if (!s || !s.enabled) return json({ error: "consulta_indisponivel" }, 400);

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

    // -------- result: resultado de uma consulta (própria) --------
    if (action === "result") {
      let q = admin.from("vehicle_queries").select("id, placa, status, result, error, created_at, paid_at")
        .eq("user_id", userId);
      q = p.query_id ? q.eq("id", String(p.query_id)) : q.eq("status", "done");
      const { data } = await q.order("created_at", { ascending: false }).limit(1);
      const row = data?.[0] || null;
      return json({ ok: true, query: row, resumo: row?.result ? resumoDebitos(row.result) : null });
    }

    // -------- start: cria consulta + checkout (ou serve o cache de graça) --------
    if (action === "start") {
      if (!placa) return json({ error: "sem_placa", detail: "Cadastre a placa do seu veículo em Meu Veículo antes de consultar." }, 400);

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

      // rate-limit: 3 consultas pendentes/h por usuário
      const desde1h = new Date(Date.now() - 3600_000).toISOString();
      const { count: pend } = await admin.from("vehicle_queries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("status", "pending").gte("created_at", desde1h);
      if ((pend || 0) >= 3) return json({ error: "muitas_consultas", detail: "Você já tem consultas aguardando pagamento. Conclua o PIX ou aguarde alguns minutos." }, 429);

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
        await admin.from("vehicle_queries").update({ status: "error", error: `asaas_${res.status}` }).eq("id", created.id);
        return json({ error: data?.errors?.[0]?.description || `Asaas ${res.status}` }, 400);
      }
      await admin.from("vehicle_queries").update({ asaas_checkout_id: data.id || null }).eq("id", created.id);
      const url = data.link || data.url || (data.id ? `${base.replace("/v3", "")}/checkoutSession/show/${data.id}` : null);
      return json({ ok: true, url, query_id: created.id, price: s.price });
    }

    // -------- run: reprocessa uma consulta paga que falhou (própria) --------
    if (action === "run") {
      const id = String(p.query_id || "");
      const { data: rows } = await admin.from("vehicle_queries").select("id, user_id, status, paid_at").eq("id", id).limit(1);
      const q0 = rows?.[0];
      if (!q0 || q0.user_id !== userId) return json({ error: "consulta_nao_encontrada" }, 404);
      if (!q0.paid_at && q0.status !== "paid") return json({ error: "aguardando_pagamento" }, 400);
      const r = await runVehicleQuery(admin, id);
      return json(r.ok ? { ok: true, resumo: resumoDebitos(r.result) } : { error: r.error }, r.ok ? 200 : 400);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
