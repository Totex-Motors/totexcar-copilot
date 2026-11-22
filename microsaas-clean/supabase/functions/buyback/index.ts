// TotexCar Co-pilot — Recompra FIPE (Fase 4)
// O dono avalia o carro pela tabela FIPE (API pública parallelum) e pede a recompra à loja
// (até X% da FIPE). O pedido aparece no painel do lojista e dispara um aviso no WhatsApp da loja.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { loadWaSettings, waSendTemplate } from "../_shared/wa.ts";
import { loadSeloConfig, seloElegivel } from "../_shared/care-score.ts";
import { FICHA_KIND, VALIDADE_DIAS, gravarFicha, fotosDaFicha } from "../_shared/ficha-venda.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const FIPE = "https://parallelum.com.br/fipe/api/v1/carros";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const onlyDigits = (s: any) => String(s || "").replace(/\D/g, "");
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

// "R$ 89.790,00" -> 89790
function parseBRL(s: any): number {
  const clean = String(s || "").replace(/[^\d,]/g, "").replace(",", ".");
  return Number(clean) || 0;
}

async function fipeGet(path: string) {
  const res = await fetch(`${FIPE}${path}`);
  if (!res.ok) throw new Error(`FIPE ${res.status}`);
  return res.json();
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);

  const { data: me } = await admin.from("users")
    .select("id, name, phone, role, dealership, care_tier, care_tier_at").eq("id", ud.user.id).single();
  if (!me) return json({ error: "no_profile" }, 403);
  const isDealerOrAdmin = me.role === "dealer" || me.role === "admin";

  // SELO TOTEX (Fase 4): garantia por faixa da FIPE — SÓ cliente de loja parceira ADERIDA.
  // Retorna null quando não elegível; tier "none" volta com faixa null (ainda sem selo).
  async function seloInfo(): Promise<any | null> {
    try {
      if (!(await seloElegivel(admin, me))) return null;
      const cfg = await loadSeloConfig(admin);
      const tier = String(me.care_tier || "none");
      const faixas: Record<string, { min: number; teto: number | null }> = {
        bronze: { min: cfg.fipe.bronze, teto: null },
        prata: { min: cfg.fipe.prata, teto: null },
        ouro: { min: cfg.fipe.ouro_min, teto: cfg.fipe.ouro_max },
      };
      let troca12mAte: string | null = null;
      let dentro12m = false;
      if (tier === "ouro" && me.care_tier_at) {
        const d = new Date(me.care_tier_at); d.setFullYear(d.getFullYear() + 1);
        troca12mAte = d.toISOString().split("T")[0];
        dentro12m = new Date() <= d;
      }
      const f = faixas[tier] || null;
      return {
        elegivel: true, tier,
        min_pct: f ? Math.round((dentro12m ? cfg.fipe.troca12m : f.min) * 100) : null,
        teto_pct: Math.round(cfg.fipe.ouro_max * 100),
        troca12m_ate: troca12mAte, troca12m_ativo: dentro12m,
      };
    } catch { return null; }
  }

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const action = p.action as string;

  try {
    switch (action) {
      // ---- Proxy FIPE (parallelum) — qualquer usuário logado ----
      case "fipe_brands": {
        const data = await fipeGet("/marcas");
        return json({ ok: true, brands: data });
      }
      case "fipe_models": {
        if (!p.brand) return json({ error: "brand_required" }, 400);
        const data = await fipeGet(`/marcas/${encodeURIComponent(p.brand)}/modelos`);
        return json({ ok: true, models: data?.modelos || [] });
      }
      case "fipe_years": {
        if (!p.brand || !p.model) return json({ error: "brand_model_required" }, 400);
        const data = await fipeGet(`/marcas/${encodeURIComponent(p.brand)}/modelos/${encodeURIComponent(p.model)}/anos`);
        return json({ ok: true, years: data });
      }
      case "fipe_price": {
        if (!p.brand || !p.model || !p.year) return json({ error: "brand_model_year_required" }, 400);
        const d = await fipeGet(`/marcas/${encodeURIComponent(p.brand)}/modelos/${encodeURIComponent(p.model)}/anos/${encodeURIComponent(p.year)}`);
        const fipeValue = parseBRL(d?.Valor);
        const { data: s } = await admin.from("app_settings").select("buyback_fipe_pct").eq("id", 1).single();
        const pct = Number(s?.buyback_fipe_pct ?? 90);
        const selo = await seloInfo();
        return json({
          ok: true,
          fipe: {
            value: fipeValue, code: d?.CodigoFipe || null,
            brand: d?.Marca, model: d?.Modelo, year: d?.AnoModelo, fuel: d?.Combustivel,
          },
          offer_pct: pct,
          offer_value: round2(fipeValue * pct / 100),
          // garantia do Selo: MÍNIMO da faixa (condicionado à vistoria) — a oferta final é da loja
          selo: selo && selo.min_pct ? {
            ...selo,
            valor_minimo_garantido: round2(fipeValue * selo.min_pct / 100),
          } : selo,
        });
      }

      // ---- Dono cria o pedido de recompra ----
      case "request": {
        const fipeValue = Number(p.fipe_value) || 0;
        if (!fipeValue) return json({ error: "fipe_value_required" }, 400);
        if (!me.dealership) return json({ error: "owner_without_dealership" }, 400);
        const { data: s } = await admin.from("app_settings")
          .select("buyback_fipe_pct").eq("id", 1).single();
        const pct = Number(p.offer_pct ?? s?.buyback_fipe_pct ?? 90);
        const offerValue = round2(fipeValue * pct / 100);

        const seloReq = await seloInfo();
        const { data: inserted, error } = await admin.from("buyback_requests").insert({
          selo_aplicado: seloReq && seloReq.min_pct ? seloReq : null,
          owner_id: me.id,
          dealership: me.dealership,
          owner_name: me.name,
          owner_phone: me.phone,
          brand: p.brand || null,
          model: p.model || null,
          year: p.year || null,
          fuel: p.fuel || null,
          fipe_code: p.fipe_code || null,
          fipe_value: fipeValue,
          offer_pct: pct,
          offer_value: offerValue,
          status: "new",
        }).select().single();
        if (error) throw error;

        // avisa o lojista da loja no WhatsApp (best-effort) — iniciado pelo negócio → TEMPLATE na API oficial
        const { data: dealer } = await admin.from("users")
          .select("phone").eq("role", "dealer").eq("dealership", me.dealership).limit(1);
        const dealerPhone = dealer?.[0]?.phone;
        if (dealerPhone) {
          const wa = await loadWaSettings(admin);
          await waSendTemplate(wa, dealerPhone, "pedido_recompra_loja", [
            me.dealership,
            me.name || "Cliente",
            [p.brand, p.model, p.year].filter(Boolean).join(" ") || "veículo",
            `${brl(offerValue)} (${pct}% da FIPE ${brl(fipeValue)})${seloReq?.min_pct ? ` · cliente com SELO ${String(seloReq.tier).toUpperCase()} (mín. ${seloReq.min_pct}% garantido${seloReq.troca12m_ativo ? ", bônus troca 12m ativo" : ""})` : ""}`,
            me.phone || "sem telefone",
          ]);
        }
        return json({ ok: true, request: inserted });
      }

      case "my_requests": {
        const { data } = await admin.from("buyback_requests")
          .select("*").eq("owner_id", me.id).order("created_at", { ascending: false });
        return json({ ok: true, requests: data || [] });
      }

      // ---- Lojista: lista e atualiza os pedidos da loja ----
      case "list_requests": {
        if (!isDealerOrAdmin) return json({ error: "forbidden" }, 403);
        let q = admin.from("buyback_requests").select("*").order("created_at", { ascending: false });
        const scope = me.role === "admin" ? (p.dealership || null) : me.dealership;
        if (scope) q = q.eq("dealership", scope);
        const { data } = await q.limit(500);
        return json({ ok: true, requests: data || [] });
      }

      case "update_request": {
        if (!isDealerOrAdmin) return json({ error: "forbidden" }, 403);
        if (!p.id) return json({ error: "id_required" }, 400);
        const status = ["new", "contacted", "closed", "declined"].includes(String(p.status)) ? String(p.status) : "new";
        let q = admin.from("buyback_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", p.id);
        if (me.role !== "admin") q = q.eq("dealership", me.dealership); // escopo da loja
        const { data, error } = await q.select().single();
        if (error) throw error;
        return json({ ok: true, request: data });
      }

      // PEDIR A FICHA (placa, km, situação e fotos) de um pedido que chegou sem ela: o Co-pilot chama o
      // cliente no WhatsApp e conduz; quando ele terminar, o pedido aparece completo no painel.
      case "pedir_ficha": {
        if (!isDealerOrAdmin) return json({ error: "forbidden" }, 403);
        let q = admin.from("buyback_requests").select("*").eq("id", String(p.id || ""));
        if (me.role !== "admin") q = q.eq("dealership", me.dealership);
        const { data: b } = await q.maybeSingle();
        if (!b) return json({ error: "nao_encontrado" }, 404);
        const phone = String(b.owner_phone || "").trim();
        if (onlyDigits(phone).length < 10) return json({ error: "sem_telefone" }, 400);
        if (b.qualificacao?.ficha?.completa) return json({ error: "ficha_ja_completa" }, 400);
        const carro = [b.brand, b.model, b.year].filter(Boolean).join(" ") || "seu carro";
        // se já existe uma ficha em andamento pra esse cliente, só cobra de novo (não reinicia o passo)
        const desde = new Date(Date.now() - VALIDADE_DIAS * 86400_000).toISOString();
        const { data: evs } = await admin.from("whatsapp_events").select("id, parsed").eq("from_phone", phone).eq("kind", FICHA_KIND).gte("created_at", desde).order("created_at", { ascending: false }).limit(1);
        const emAndamento = evs?.[0] && evs[0].parsed?.buyback_id === b.id && evs[0].parsed?.step !== "done";
        if (!emAndamento) {
          await admin.from("whatsapp_events").insert({ from_phone: phone, kind: FICHA_KIND, status: "processed", raw: { origem: "painel" },
            parsed: { step: "placa_km", buyback_id: b.id, carro, modalidade: b.modalidade || null, dealership: b.dealership || null, nome: b.owner_name || null } });
          await gravarFicha(admin, b.id, { iniciada_em: new Date().toISOString(), completa: false });
        }
        const wa = await loadWaSettings(admin);
        const texto = `Pra acelerar a venda do seu ${carro}, só falta a ficha do carro: leva 2 minutos e ele já vai pra nossa equipe de compra. Me responda aqui com a placa e o km atual (ex.: ABC1D23 85.000) que eu te guio no resto, inclusive as fotos.`;
        const ok = await waSendTemplate(wa, phone, "copilot_msg", [texto]);
        if (ok) await admin.from("whatsapp_events").insert({ from_phone: onlyDigits(phone), kind: "proativo", status: "sent", raw: { proativo: true, ficha: true }, parsed: { assunto: "ficha_venda", texto, variante: "copilot_msg" } });
        const up = await gravarFicha(admin, b.id, { pedida_em: new Date().toISOString() } as any);
        return json({ ok, request: up, error: ok ? undefined : "whatsapp_falhou" });
      }
      // fotos já recebidas de um pedido ainda incompleto (o cliente parou no meio)
      case "fotos_ficha": {
        if (!isDealerOrAdmin) return json({ error: "forbidden" }, 403);
        let q = admin.from("buyback_requests").select("id").eq("id", String(p.id || ""));
        if (me.role !== "admin") q = q.eq("dealership", me.dealership);
        const { data: b } = await q.maybeSingle();
        if (!b) return json({ error: "nao_encontrado" }, 404);
        return json({ ok: true, fotos: await fotosDaFicha(admin, b.id) });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 400);
  }
});
