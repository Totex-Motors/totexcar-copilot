// TotexCar Co-pilot — Admin API (gestão de proprietários)
// Ações protegidas por papel admin. Usa service role para criar/excluir contas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { SERVICE_TYPES } from "../_shared/radar-search.ts";
import { publicarFlow, flowPublicado, RECOMPRA_V2_PREFIXO, FIPE_PREFIXO, FLOW_ENDPOINT } from "../_shared/flows.ts";
import fipeFlow from "../_shared/fipe-flow.json" with { type: "json" };
import recompraV2 from "../_shared/recompra-flow-v2.json" with { type: "json" };
import { loadWaSettings, waSendTemplate } from "../_shared/wa.ts";
import { falaPromete } from "../_shared/auditoria.ts";

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
      // FORMULÁRIO "AVALIAR MEU CARRO" (WhatsApp Flow) v2 — com o campo "Ou digite o modelo".
      // Publica na Meta (flow novo apontando pro wa-flow-endpoint); o webhook passa a usar sozinho.
      // FORMULÁRIO "CONSULTA FIPE" (qualquer carro): mesmo endpoint, token "fipe"
      case "flow_fipe_status":
      case "publicar_flow_fipe": {
        const { data: st } = await admin.from("app_settings").select("meta_wa_token, meta_waba_id").eq("id", 1).single();
        const tk = String(st?.meta_wa_token || "").trim(), waba = String(st?.meta_waba_id || "").trim();
        if (!tk || !waba) return json({ error: "meta_wa_token/meta_waba_id não configurados" }, 400);
        if (action === "flow_fipe_status") return json({ ok: true, flow_id: await flowPublicado(tk, waba, FIPE_PREFIXO) });
        const name = `${FIPE_PREFIXO}_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
        const r = await publicarFlow(tk, waba, name, fipeFlow, FLOW_ENDPOINT);
        return json(r, r.ok ? 200 : 502);
      }
      case "flow_recompra_status":
      case "publicar_flow_recompra": {
        const { data: st } = await admin.from("app_settings").select("meta_wa_token, meta_waba_id").eq("id", 1).single();
        const tk = String(st?.meta_wa_token || "").trim(), waba = String(st?.meta_waba_id || "").trim();
        if (!tk || !waba) return json({ error: "meta_wa_token/meta_waba_id não configurados" }, 400);
        if (action === "flow_recompra_status") return json({ ok: true, flow_id: await flowPublicado(tk, waba, RECOMPRA_V2_PREFIXO) });
        const name = `${RECOMPRA_V2_PREFIXO}_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
        const r = await publicarFlow(tk, waba, name, recompraV2, FLOW_ENDPOINT);
        return json(r, r.ok ? 200 : 502);
      }

      // TRATATIVAS PRA CONFERIR: o que o cliente respondeu aos avisos do Co-pilot, o que a Nina disse e o que
      // ela GRAVOU (parsed.acoes). "conferir" = disse que anotou/registrou e nada foi gravado. No histórico
      // anterior à auditoria só há os textos: marca como "possível" quando a fala promete.
      case "tratativas": {
        const dias = Math.min(60, Math.max(1, Number(payload.dias) || 30));
        const desde = new Date(Date.now() - dias * 86400000).toISOString();
        const [{ data: pro }, { data: inb }] = await Promise.all([
          admin.from("whatsapp_events").select("from_phone, created_at, parsed").eq("kind", "proativo").gte("created_at", desde).order("created_at", { ascending: false }).limit(2000),
          admin.from("whatsapp_events").select("id, from_phone, user_id, created_at, parsed").eq("status", "processed").gte("created_at", desde)
            .not("parsed->>input", "is", null).not("parsed->>reply", "is", null).order("created_at", { ascending: false }).limit(4000),
        ]);
        const k8 = (p: unknown) => String(p ?? "").replace(/\D/g, "").slice(-8);
        const avisos = new Map<string, { t: number; assunto: string; texto: string }[]>();
        for (const a of pro || []) {
          const k = k8(a.from_phone); if (!k) continue;
          (avisos.get(k) || avisos.set(k, []).get(k)!).push({ t: new Date(a.created_at).getTime(), assunto: String(a.parsed?.assunto || ""), texto: String(a.parsed?.texto || "") });
        }
        const porFone = new Map<string, any[]>();
        for (const m of inb || []) { const k = k8(m.from_phone); if (k) (porFone.get(k) || porFone.set(k, []).get(k)!).push(m); }
        const itens: any[] = [];
        for (const [k, msgs] of porFone) {
          msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          let ultimoAvisoUsado = 0;
          for (const m of msgs) {
            const t = new Date(m.created_at).getTime();
            const av = (avisos.get(k) || []).filter((a) => a.t < t && t - a.t < 72 * 3600_000).sort((a, b) => b.t - a.t)[0];
            const primeira = !!av && av.t !== ultimoAvisoUsado; // 1ª resposta depois daquele aviso
            if (av) ultimoAvisoUsado = av.t;
            const p = m.parsed || {};
            const temRegistro = Array.isArray(p.acoes);
            const situacao = p.conferido ? "conferida" : p.conferir ? "conferir" : !temRegistro && falaPromete(p.reply, p.input) ? "possivel" : "ok";
            if (situacao === "ok" && !primeira) continue; // conversa comum, sem aviso e sem suspeita: fora
            itens.push({
              id: m.id, quando: m.created_at, user_id: m.user_id, telefone: String(m.from_phone || ""), situacao, motivo: p.conferir_motivo || null,
              aviso: primeira ? { assunto: av!.assunto, texto: av!.texto.slice(0, 500), quando: new Date(av!.t).toISOString() } : null,
              cliente: String(p.input || "").slice(0, 700), nina: String(p.reply || "").slice(0, 900),
              acoes: temRegistro ? p.acoes : null,
            });
          }
        }
        const ids = [...new Set(itens.map((i) => i.user_id).filter(Boolean))];
        const nomes: Record<string, string> = {};
        for (let i = 0; i < ids.length; i += 200) {
          const { data: us } = await admin.from("users").select("id, name").in("id", ids.slice(i, i + 200));
          for (const u of us || []) nomes[u.id] = u.name || "";
        }
        const peso: Record<string, number> = { conferir: 0, possivel: 1, ok: 2, conferida: 3 };
        itens.sort((a, b) => peso[a.situacao] - peso[b.situacao] || new Date(b.quando).getTime() - new Date(a.quando).getTime());
        const conta = (s: string) => itens.filter((i) => i.situacao === s).length;
        const filtro = String(payload.filtro || "pendentes");
        const lista = itens.filter((i) => filtro === "todas" ? true : filtro === "avisos" ? !!i.aviso : i.situacao === "conferir" || i.situacao === "possivel");
        return json({ ok: true, dias, totais: { conferir: conta("conferir"), possivel: conta("possivel"), respostas_a_avisos: itens.filter((i) => i.aviso).length, conferidas: conta("conferida") },
          itens: lista.slice(0, 250).map((i) => ({ ...i, nome: i.user_id ? nomes[i.user_id] || null : null })) });
      }
      case "tratativa_conferida": {
        const id = String(payload.id || "");
        const { data: ev } = await admin.from("whatsapp_events").select("id, parsed").eq("id", id).maybeSingle();
        if (!ev) return json({ error: "nao_encontrada" }, 404);
        const { error } = await admin.from("whatsapp_events").update({ parsed: { ...(ev.parsed || {}), conferido: true, conferido_em: new Date().toISOString() } }).eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      // AVISO FREE FLOW (ANTT, prazo 16/11/2026): mensagem única pra base de motoristas, disparada pelo admin.
      // modo "previa" (quantos recebem + texto), "teste" (só pro telefone do admin), "enviar" (lotes de ~90 s;
      // o painel repete até acabar). Dedup no notification_log; envio que falhar volta pra fila.
      case "aviso_free_flow": {
        const KIND = "aviso:antt_free_flow_2026_11", DUE = "2026-11-16";
        const texto = String(payload.texto || "").replace(/\s+/g, " ").trim();
        const modo = String(payload.modo || "previa");
        const { data: us, error: eu } = await admin.from("users").select("id, phone, role").not("phone", "is", null);
        if (eu) throw eu;
        const alvo = (us || []).filter((u: any) => String(u.phone || "").replace(/\D/g, "").length >= 10 && u.role !== "dealer" && u.role !== "admin");
        const { data: ja } = await admin.from("notification_log").select("user_id").eq("kind", KIND);
        const feitos = new Set((ja || []).map((r: any) => r.user_id));
        const faltam = alvo.filter((u: any) => !feitos.has(u.id));
        if (modo === "previa") return json({ ok: true, total: alvo.length, ja_enviados: alvo.length - faltam.length, faltam: faltam.length });
        if (texto.length < 40 || texto.length > 900) return json({ error: "texto_invalido" }, 400);
        const wa = await loadWaSettings(admin);
        if (modo === "teste") {
          const { data: eu2 } = await admin.from("users").select("phone").eq("id", caller.id).single();
          if (!eu2?.phone) return json({ error: "admin_sem_telefone" }, 400);
          return json({ ok: await waSendTemplate(wa, String(eu2.phone), "copilot_msg", [texto]) });
        }
        if (modo !== "enviar") return json({ error: "modo_invalido" }, 400);
        const ini = Date.now();
        let enviados = 0, falhas = 0;
        for (const u of faltam) {
          if (Date.now() - ini > 90_000) break;
          const { error: dup } = await admin.from("notification_log").insert({ user_id: u.id, kind: KIND, due_date: DUE, channel: "whatsapp" });
          if (dup) continue; // outro clique já pegou esse
          const ok = await waSendTemplate(wa, String(u.phone), "copilot_msg", [texto]).catch(() => false);
          if (ok) {
            enviados++;
            await admin.from("whatsapp_events").insert({ from_phone: String(u.phone).replace(/\D/g, ""), user_id: u.id, kind: "proativo", status: "sent",
              raw: { proativo: true, aviso: "antt_free_flow" }, parsed: { assunto: "free_flow_antt", texto, variante: "copilot_msg" } });
          } else {
            falhas++;
            await admin.from("notification_log").delete().eq("user_id", u.id).eq("kind", KIND).eq("due_date", DUE);
          }
        }
        const restantes = faltam.length - enviados - falhas;
        console.log("aviso_free_flow", JSON.stringify({ enviados, falhas, restantes }));
        return json({ ok: true, enviados, falhas, restantes });
      }

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
          benefit_value: Math.min(5000, Math.max(0, Math.round(Number(String(b.benefit_value ?? "").replace(",", ".")) || 0))),
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
