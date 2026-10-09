// TotexCar Co-pilot — PUBLICAÇÃO DE WHATSAPP FLOWS pela API da Meta (operação, não é chamada pelo app).
// Flow publicado não se edita: cria um flow NOVO, sobe o JSON (asset), valida e publica. Depois, o id novo
// vai pro secret VIAGEM_FLOW_ID e o webhook é redeployado. Token/WABA vêm de app_settings (nunca saem do servidor).
// Uso: ?secret=<WEBHOOK_SECRET>&action=publicar_viagem[&name=...]   |   ?secret=…&action=status&flow_id=…
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import viagemFlow from "./viagem-flow.json" with { type: "json" };

import { secretOk, unauthorized } from "../_shared/secret.ts";
const GRAPH = "https://graph.facebook.com/v21.0";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (!secretOk(url)) return unauthorized();
  const { data: s } = await admin.from("app_settings").select("meta_wa_token, meta_waba_id").eq("id", 1).single();
  const action = url.searchParams.get("action") || "status";

  const token = String(s?.meta_wa_token || "").trim();
  const waba = String(s?.meta_waba_id || "").trim();
  if (!token || !waba) return json({ ok: false, error: "meta_wa_token/meta_waba_id não configurados" }, 400);
  const auth = { Authorization: `Bearer ${token}` };

  if (action === "status") {
    const id = url.searchParams.get("flow_id") || "";
    const r = await fetch(`${GRAPH}/${id}?fields=id,name,status,validation_errors,json_version,data_api_version`, { headers: auth });
    return json({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) });
  }

  if (action === "listar") {
    const r = await fetch(`${GRAPH}/${waba}/flows?fields=id,name,status,validation_errors`, { headers: auth });
    return json({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) });
  }

  if (action === "publicar_viagem") {
    const name = url.searchParams.get("name") || `modo_viagem_v2_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    // 1) cria o flow
    const c = await fetch(`${GRAPH}/${waba}/flows`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ name, categories: ["OTHER"] }),
    });
    const cj = await c.json().catch(() => null);
    if (!c.ok || !cj?.id) return json({ ok: false, etapa: "criar", status: c.status, body: cj }, 502);
    const flowId = String(cj.id);
    // 2) sobe o JSON como asset (multipart)
    const fd = new FormData();
    fd.append("name", "flow.json");
    fd.append("asset_type", "FLOW_JSON");
    fd.append("file", new Blob([JSON.stringify(viagemFlow)], { type: "application/json" }), "flow.json");
    const u = await fetch(`${GRAPH}/${flowId}/assets`, { method: "POST", headers: auth, body: fd });
    const uj = await u.json().catch(() => null);
    if (!u.ok || !uj?.success) return json({ ok: false, etapa: "asset", flow_id: flowId, status: u.status, body: uj }, 502);
    const erros = Array.isArray(uj?.validation_errors) ? uj.validation_errors : [];
    if (erros.length) return json({ ok: false, etapa: "validacao", flow_id: flowId, validation_errors: erros }, 422);
    // 3) publica
    const p = await fetch(`${GRAPH}/${flowId}/publish`, { method: "POST", headers: auth });
    const pj = await p.json().catch(() => null);
    if (!p.ok || !pj?.success) return json({ ok: false, etapa: "publicar", flow_id: flowId, status: p.status, body: pj }, 502);
    return json({ ok: true, flow_id: flowId, name, proximo_passo: "setar secret VIAGEM_FLOW_ID com este id e redeployar whatsapp-webhook" });
  }

  return json({ ok: false, error: "action desconhecida (status | listar | publicar_viagem)" }, 400);
});
