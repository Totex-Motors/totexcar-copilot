// TotexCar Co-pilot — Admin API (gestão de proprietários)
// Ações protegidas por papel admin. Usa service role para criar/excluir contas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { SERVICE_TYPES } from "../_shared/radar-search.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // identifica o chamador pelo JWT
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
  const caller = userData.user;

  let payload: any = {};
  try { payload = await req.json(); } catch { /* */ }
  const action = payload.action as string;

  // papel atual do chamador
  const { data: me } = await admin.from("users").select("role").eq("id", caller.id).single();
  const isAdmin = me?.role === "admin";

  // bootstrap: 1º admin (só se ainda não existe nenhum admin)
  if (action === "bootstrap_admin") {
    const { count } = await admin.from("users").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count || 0) > 0) return json({ error: "admin_already_exists" }, 403);
    const { error } = await admin.from("users").update({ role: "admin" }).eq("id", caller.id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, role: "admin" });
  }

  if (!isAdmin) return json({ error: "forbidden" }, 403);

  try {
    switch (action) {
      // FUNIL DO STAND (todas as lojas) — escaneios → presente → conversa → ativação, por loja+promotor
      case "stand_report": {
        const { data, error } = await admin.rpc("stand_report", { p_loja: null });
        if (error) throw error;
        // mapeia slug → nome bonito da loja (marketplace)
        let nomes: Record<string, string> = {};
        try {
          const res = await fetch(`${Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com"}/api/dealerships`, { headers: { Accept: "application/json" } });
          const d = await res.json();
          const list = Array.isArray(d) ? d : (d?.data || []);
          for (const x of list) if (x?.slug) nomes[String(x.slug).toLowerCase()] = x.name || x.slug;
        } catch { /* usa o slug mesmo */ }
        const rows = (data || []).map((r: any) => ({ ...r, loja_nome: nomes[r.loja] || r.loja }));
        return json({ ok: true, rows });
      }

      // LISTA de leads individuais (nome + contato) pra exportar/campanha — todas as lojas
      case "stand_leads": {
        const { data, error } = await admin.rpc("stand_leads", { p_loja: null });
        if (error) throw error;
        let nomes: Record<string, string> = {};
        try {
          const res = await fetch(`${Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com"}/api/dealerships`, { headers: { Accept: "application/json" } });
          const d = await res.json();
          const list = Array.isArray(d) ? d : (d?.data || []);
          for (const x of list) if (x?.slug) nomes[String(x.slug).toLowerCase()] = x.name || x.slug;
        } catch { /* usa o slug */ }
        const leads = (data || []).map((r: any) => ({ ...r, loja_nome: nomes[r.loja] || r.loja }));
        return json({ ok: true, leads });
      }

      // FUNIL "QUANTO VALE / VALOR VIVO" (piloto da versão grátis): consulta → opt-in → aviso → avaliação
      case "funil_vale": {
        const now = Date.now();
        const iso = (ms: number) => new Date(now - ms).toISOString();
        const d7 = iso(7 * 864e5), d30 = iso(30 * 864e5), d14 = iso(14 * 864e5);
        const ev = () => admin.from("whatsapp_events").select("id", { count: "exact", head: true });
        const qv = (q: any) => q.eq("kind", "stand_lead").eq("parsed->>origem", "quanto_vale");

        const [cTot, c7, c30, canal, comunidade, convert] = await Promise.all([
          qv(ev()), qv(ev()).gte("created_at", d7), qv(ev()).gte("created_at", d30),
          ev().eq("kind", "stand_lead").eq("parsed->>origem", "canal"),
          ev().eq("kind", "stand_lead").eq("parsed->>origem", "comunidade"),
          ev().eq("kind", "valor_vivo_convert"),
        ]);
        const [optTot, optAtivos, avisados] = await Promise.all([
          admin.from("valor_vivo_subs").select("id", { count: "exact", head: true }),
          admin.from("valor_vivo_subs").select("id", { count: "exact", head: true }).eq("active", true),
          admin.from("valor_vivo_subs").select("id", { count: "exact", head: true }).not("last_sent_at", "is", null),
        ]);

        // série de 14 dias (consultas x novos opt-ins) pra um mini-gráfico
        const { data: evRows } = await qv(admin.from("whatsapp_events").select("created_at")).gte("created_at", d14);
        const { data: subRows } = await admin.from("valor_vivo_subs").select("created_at").gte("created_at", d14);
        const dias: string[] = [];
        for (let i = 13; i >= 0; i--) dias.push(new Date(now - i * 864e5).toISOString().slice(0, 10));
        const bucket = (rows: any[]) => { const m: Record<string, number> = {}; (rows || []).forEach((r) => { const k = String(r.created_at).slice(0, 10); m[k] = (m[k] || 0) + 1; }); return m; };
        const bc = bucket(evRows || []), bo = bucket(subRows || []);
        const serie14 = dias.map((dia) => ({ dia, consultas: bc[dia] || 0, optin: bo[dia] || 0 }));

        const consultas_total = cTot.count || 0;
        return json({
          ok: true,
          funil: {
            consultas: { total: consultas_total, d7: c7.count || 0, d30: c30.count || 0 },
            optin: { ativos: optAtivos.count || 0, total: optTot.count || 0, avisados: avisados.count || 0 },
            conversas: { avaliar: convert.count || 0 },
            canal: { total: canal.count || 0 },
            comunidade: { total: comunidade.count || 0 },
            taxa_optin: consultas_total ? Math.round(((optTot.count || 0) / consultas_total) * 100) : 0,
          },
          serie14,
        });
      }

      case "list_owners": {
        const { data, error } = await admin
          .from("users")
          .select("id, name, phone, email, role, created_at")
          .neq("role", "dealer")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ ok: true, owners: data });
      }

      case "create_owner": {
        const { email, password, name, phone, role, dealership } = payload;
        if (!email || !password) return json({ error: "email_password_required" }, 400);
        const phoneNorm = phone ? String(phone).replace(/\D/g, "") : null;
        const normRole = role === "admin" ? "admin" : role === "dealer" ? "dealer" : "owner";
        const defaultName = normRole === "dealer" ? "Lojista" : "Proprietário";
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: name || defaultName, phone: phoneNorm, email },
        });
        if (error) throw error;
        const newId = data.user!.id;
        // garante perfil atualizado (o trigger já cria a linha)
        await admin.from("users").update({
          name: name || defaultName,
          phone: phoneNorm,
          email,
          role: normRole,
          dealership: dealership || null,
        }).eq("id", newId);
        return json({ ok: true, id: newId });
      }

      case "update_owner": {
        const { id, name, phone, role, dealership } = payload;
        if (!id) return json({ error: "id_required" }, 400);
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (phone !== undefined) updates.phone = phone ? String(phone).replace(/\D/g, "") : null;
        if (role !== undefined) updates.role = role === "admin" ? "admin" : role === "dealer" ? "dealer" : "owner";
        if (dealership !== undefined) updates.dealership = dealership || null;
        const { error } = await admin.from("users").update(updates).eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "list_dealers": {
        const { data, error } = await admin
          .from("users")
          .select("id, name, phone, email, role, dealership, created_at")
          .eq("role", "dealer")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ ok: true, dealers: data });
      }

      case "delete_owner": {
        const { id } = payload;
        if (!id) return json({ error: "id_required" }, 400);
        if (id === caller.id) return json({ error: "cannot_delete_self" }, 400);
        await admin.from("users").delete().eq("id", id);
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
        return json({ ok: true });
      }

      // ===================== PARCEIROS DO RADAR =====================
      case "list_partners": {
        const { data, error } = await admin.from("service_partners").select("*")
          .order("category", { ascending: true }).order("priority", { ascending: false }).order("created_at", { ascending: false });
        if (error) throw error;
        return json({ ok: true, partners: data || [] });
      }

      case "save_partner": {
        const b = payload;
        const row: Record<string, unknown> = {
          name: String(b.name || "").trim(),
          category: String(b.category || "").trim() || null,
          city: String(b.city || "").trim() || null,
          phone: b.phone ? String(b.phone).replace(/\D/g, "") : null,
          whatsapp: b.whatsapp ? String(b.whatsapp).replace(/\D/g, "") : null,
          address: String(b.address || "").trim() || null,
          website: String(b.website || "").trim() || null,
          dealership: String(b.dealership || "").trim() || null,
          priority: Number(b.priority) || 0,
          active: b.active !== false,
          notes: String(b.notes || "").trim() || null,
          benefit: String(b.benefit || "").trim() || null,
          email: String(b.email || "").trim().toLowerCase() || null,
          contact_name: String(b.contact_name || "").trim() || null,
          updated_at: new Date().toISOString(),
        };
        if (["pending", "approved", "rejected"].includes(String(b.status))) row.status = String(b.status);
        if (!row.name) return json({ error: "name_required" }, 400);
        if (b.id) {
          const { error } = await admin.from("service_partners").update(row).eq("id", b.id);
          if (error) throw error;
          return json({ ok: true, id: b.id });
        }
        const { data, error } = await admin.from("service_partners").insert({ ...row, code: crypto.randomUUID().replace(/-/g, "").slice(0, 6), created_by: caller.id }).select("id").single();
        if (error) throw error;
        return json({ ok: true, id: data!.id });
      }

      // Clube de Parceiros: aprova/recusa um cadastro self-service (/parceiro). Aprovado = entra no Radar.
      case "set_partner_status": {
        const id = String(payload.id || "");
        const status = String(payload.status || "");
        if (!id || !["pending", "approved", "rejected"].includes(status)) return json({ error: "params" }, 400);
        const upd: Record<string, unknown> = { status, active: status === "approved", updated_at: new Date().toISOString() };
        const { data: cur } = await admin.from("service_partners").select("code").eq("id", id).maybeSingle();
        if (status === "approved" && !cur?.code) upd.code = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
        const { error } = await admin.from("service_partners").update(upd).eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      // ===================== PROSPECÇÃO (Radar → convite 1 a 1) =====================
      // Lista os estabelecimentos públicos que o Radar já descobriu (com telefone), o estágio de cada um
      // e se já virou parceiro (telefone bate com service_partners).
      case "list_prospects": {
        const { data: provs, error } = await admin.from("discovered_providers")
          .select("id, name, category, city, state, address, phone, phone_normalized, whatsapp, rating, review_count, last_checked_at")
          .eq("provider_status", "publico").not("phone", "is", null)
          .order("last_checked_at", { ascending: false }).limit(1000);
        if (error) throw error;
        const { data: pros } = await admin.from("partner_prospects").select("*");
        const { data: parts } = await admin.from("service_partners").select("id, phone, whatsapp, status");
        const byProv = new Map((pros || []).map((x: any) => [x.provider_id, x]));
        const partnerPhones = new Map<string, any>();
        for (const pt of (parts || [])) for (const ph of [pt.phone, pt.whatsapp]) { const d = String(ph || "").replace(/\D/g, ""); if (d) partnerPhones.set(d, pt); }
        const keyOf = (label: string) => Object.entries(SERVICE_TYPES).find(([, v]) => v.label === label)?.[0] || null;
        const list = (provs || []).map((pv: any) => {
          const digits = String(pv.whatsapp || pv.phone_normalized || pv.phone || "").replace(/\D/g, "");
          const already = partnerPhones.get(digits) || null;
          return {
            ...pv, digits, category_key: keyOf(String(pv.category || "")),
            prospect: byProv.get(pv.id) || null,
            already_partner: already ? { id: already.id, status: already.status } : null,
          };
        });
        return json({ ok: true, prospects: list });
      }

      case "touch_prospect": {
        const providerId = String(payload.provider_id || "");
        const status = String(payload.status || "");
        if (!providerId || !["novo", "contatado", "respondeu", "cadastrou", "recusou", "sem_whatsapp"].includes(status)) return json({ error: "params" }, 400);
        const { data: cur } = await admin.from("partner_prospects").select("*").eq("provider_id", providerId).maybeSingle();
        const now = new Date().toISOString();
        const row: Record<string, unknown> = {
          provider_id: providerId, status, updated_at: now, last_touch_at: now,
          ref: String(payload.ref || cur?.ref || "").trim() || null,
          notes: payload.notes !== undefined ? (String(payload.notes || "").trim() || null) : (cur?.notes ?? null),
          created_by: cur?.created_by || caller.id,
          touches: (Number(cur?.touches) || 0) + (status === "contatado" ? 1 : 0),
          contacted_at: cur?.contacted_at || (status === "contatado" ? now : null),
        };
        const { error } = await admin.from("partner_prospects").upsert(row, { onConflict: "provider_id" });
        if (error) throw error;
        return json({ ok: true });
      }

      case "delete_partner": {
        if (!payload.id) return json({ error: "id_required" }, 400);
        const { error } = await admin.from("service_partners").delete().eq("id", payload.id);
        if (error) throw error;
        return json({ ok: true });
      }

      // GPT MOTORS — consultas veiculares (Raio-X / CRLV-e / Débitos): faturamento, custo, margem
      case "gpt_stats": {
        const { data: cfg } = await admin.from("app_settings")
          .select("gpt_raiox_price, gpt_crlv_price, gpt_debitos_price").eq("id", 1).single();
        const prices: Record<string, number> = {
          raiox: Number((cfg as any)?.gpt_raiox_price || 0),
          crlv: Number((cfg as any)?.gpt_crlv_price || 0),
          debitos: Number((cfg as any)?.gpt_debitos_price || 0),
        };
        const COST: Record<string, number> = { raiox: 30, crlv: 20, debitos: 10 }; // custo GPT Motors
        const { data: cons } = await admin.from("gpt_consultas")
          .select("produto, placa, status, preco, faturado, created_at").order("created_at", { ascending: false });
        const { data: ords } = await admin.from("gpt_orders")
          .select("produto, placa, status, preco, origem, created_at").order("created_at", { ascending: false }).limit(50);
        const prod = ["raiox", "crlv", "debitos"];
        const stats = prod.map((p) => {
          const cs = (cons || []).filter((c: any) => c.produto === p);
          const ok = cs.filter((c: any) => c.status === "ok").length;
          const faturadas = cs.filter((c: any) => c.faturado).length;
          const receita = (ords || []).filter((o: any) => o.produto === p && o.status === "done").reduce((s: number, o: any) => s + Number(o.preco || 0), 0);
          const custo = faturadas * COST[p];
          return { produto: p, preco: prices[p], custo_unit: COST[p], consultas_ok: ok, faturadas, receita, custo, margem: receita - custo };
        });
        return json({
          ok: true, prices, cost: COST, stats,
          recent: (cons || []).slice(0, 30), orders: ords || [],
          totais: {
            consultas: (cons || []).filter((c: any) => c.status === "ok").length,
            receita: stats.reduce((s, x) => s + x.receita, 0),
            custo: stats.reduce((s, x) => s + x.custo, 0),
            margem: stats.reduce((s, x) => s + x.margem, 0),
          },
        });
      }

      case "gpt_set_prices": {
        const up: Record<string, number> = {};
        if (payload.raiox != null && !isNaN(Number(payload.raiox))) up.gpt_raiox_price = Number(payload.raiox);
        if (payload.crlv != null && !isNaN(Number(payload.crlv))) up.gpt_crlv_price = Number(payload.crlv);
        if (payload.debitos != null && !isNaN(Number(payload.debitos))) up.gpt_debitos_price = Number(payload.debitos);
        if (!Object.keys(up).length) return json({ error: "nada_pra_atualizar" }, 400);
        const { error } = await admin.from("app_settings").update(up).eq("id", 1);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 400);
  }
});
