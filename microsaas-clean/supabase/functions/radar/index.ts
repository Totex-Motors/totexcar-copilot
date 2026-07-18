// TotexCar Co-pilot — RADAR DE SERVIÇOS (edge, JWT)
//
// O motorista diz o que precisa; a gente pesquisa oficina/borracharia/guincho/
// chaveiro perto dele, compara e devolve 3-6 opções. Ele escolhe.
//
// NÃO É CRM: nada aqui vira lead, negócio, pipeline ou abordagem comercial.
// Estabelecimento descoberto = OPÇÃO DE SERVIÇO.
//
// Regra de consentimento (radar-servicos.md):
//  - PESQUISAR e COMPARAR dado público → livre, sem pedir autorização.
//  - COMPARTILHAR dado pessoal / pedir orçamento → exige consent_text explícito.
//
// Ações: search | contact_actions | record_action | quote | history
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import {
  SERVICE_TYPES, normalizeServiceType, isEmergencyService,
  dedupProviders, rankProviders, haversineKm, normalizePhone,
  searchViaSearchPreview, searchViaGooglePlaces,
  type RawProvider, type RankedProvider, type RankingMode,
} from "../_shared/radar-search.ts";

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

// Teto de buscas por usuário/hora. Cada busca ao vivo custa chamada de IA —
// sem isso, um loop no cliente vira conta de API.
const RATE_LIMIT_HORA = 20;

const DISCLAIMER_PUBLICO =
  "Resultado público: telefone, horário e nota vieram de fontes públicas e podem estar desatualizados. " +
  "Confirme preço, disponibilidade e condições direto com o estabelecimento. A Totex não credencia nem garante o serviço.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);
  const userId = ud.user.id;

  let p: any = {};
  try { p = await req.json(); } catch { /* body vazio */ }
  const action = String(p.action || "search");

  try {
    const { data: settings } = await admin.from("app_settings")
      .select("openai_api_key, radar_enabled, radar_cache_hours, radar_default_radius, radar_search_provider, google_places_api_key")
      .eq("id", 1).single();

    if (settings?.radar_enabled === false) return json({ error: "radar_desativado" }, 503);

    // ---------------------------------------------------------------- SEARCH
    if (action === "search") {
      // rate limit por usuário
      const desde = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await admin.from("service_searches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).gte("created_at", desde);
      if ((count ?? 0) >= RATE_LIMIT_HORA) {
        return json({ error: "rate_limit", message: "Muitas buscas na última hora. Tente de novo em alguns minutos." }, 429);
      }

      const serviceType = normalizeServiceType(p.service_type);
      const def = SERVICE_TYPES[serviceType];
      const radiusKm = Number(p.radius_km) > 0 ? Number(p.radius_km) : Number(settings?.radar_default_radius || 15);
      const limite = Math.min(Math.max(Number(p.limit) || 6, 3), 10);
      const lat = typeof p.latitude === "number" ? p.latitude : null;
      const lon = typeof p.longitude === "number" ? p.longitude : null;

      // perfil do carro (compatibilidade EV/híbrido no ranking)
      const { data: veh } = await admin.from("accounts").select("*")
        .eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle();
      const combustivel = String(veh?.combustivel || "").toLowerCase();
      const isEv = /elétric|eletric|ev\b/.test(combustivel);
      const isHybrid = /híbrid|hibrid/.test(combustivel);
      const carro = veh ? `${veh.marca || ""} ${veh.modelo || ""} ${veh.ano_modelo || ""}`.trim() : null;

      // localização: texto do pedido > última cidade que ele informou
      const locationText = String(p.location_text || veh?.cidade || "").trim();
      // lembra pra não perguntar de novo na próxima busca
      if (p.location_text && veh?.id && String(p.location_text).trim() !== String(veh?.cidade || "")) {
        await admin.from("accounts").update({ cidade: String(p.location_text).trim() }).eq("id", veh.id);
      }
      if (!locationText && (lat == null || lon == null)) {
        return json({
          ok: false, error: "localizacao_ausente",
          message: "Preciso saber onde você está para procurar. Me diga a cidade ou o bairro.",
          service_type: serviceType, service_label: def.label,
        }, 200);
      }

      const t0 = Date.now();
      const emEmergencia = isEmergencyService(serviceType) || p.emergency === true;

      // ---- CACHE: reaproveita estabelecimentos já descobertos ----
      // Volta só o que foi verificado dentro da janela (campos voláteis envelhecem).
      const cacheHoras = Number(settings?.radar_cache_hours || 72);
      const cacheDesde = new Date(Date.now() - cacheHoras * 3600_000).toISOString();
      let cacheHit = false;
      let brutos: RawProvider[] = [];
      const fontes: string[] = [];
      let custo = 0;
      let erroBusca: string | null = null;

      let q = admin.from("discovered_providers").select("*")
        .eq("category", def.label).gte("last_checked_at", cacheDesde).limit(40);
      if (locationText) q = q.ilike("city", `%${locationText.split(/[,\-]/)[0].trim()}%`);
      const { data: cached } = await q;

      if (cached && cached.length >= 3) {
        cacheHit = true;
        fontes.push("cache");
        brutos = cached.map((c: any) => ({
          name: c.name, category: c.category, phone: c.phone, whatsapp: c.whatsapp,
          website: c.website, address: c.address, city: c.city, state: c.state,
          latitude: c.latitude, longitude: c.longitude, rating: c.rating,
          review_count: c.review_count, open_now: null,
          open_24h: c.service_attributes?.open_24h ?? null,
          mobile_service: c.service_attributes?.mobile_service ?? null,
          supports_ev: c.service_attributes?.supports_ev ?? null,
          supports_hybrid: c.service_attributes?.supports_hybrid ?? null,
          source: c.external_source, external_id: c.external_id,
        }));
      } else {
        // ---- BUSCA AO VIVO ----
        const usarPlaces = settings?.radar_search_provider === "google_places" && !!settings?.google_places_api_key;
        const r = usarPlaces
          ? await searchViaGooglePlaces(settings!.google_places_api_key!, {
              serviceType, latitude: lat, longitude: lon, locationText, radiusKm, limit: limite,
            })
          : await searchViaSearchPreview(settings?.openai_api_key || "", {
              serviceType, locationText, vehicle: carro, radiusKm, limit: limite,
            });
        brutos = r.providers;
        custo += r.cost;
        erroBusca = r.error;
        fontes.push(usarPlaces ? "google_places" : "search_preview");
      }

      // ---- dedup ----
      let lista = dedupProviders(brutos);

      // ---- distância (quando temos as duas pontas) ----
      if (lat != null && lon != null) {
        lista = lista.map((x) => ({
          ...x,
          distance_km: x.latitude != null && x.longitude != null
            ? haversineKm(lat, lon, x.latitude, x.longitude) : null,
        }));
      }

      // ---- parceiros Totex: as lojas do ecossistema ganham SELO, não posição ----
      const { data: lojas } = await admin.from("users")
        .select("dealership").eq("role", "dealer").not("dealership", "is", null);
      const partnerNames = [...new Set((lojas || []).map((l: any) => String(l.dealership)))];

      // ---- ranking ----
      const mode = (String(p.mode || "balanced") as RankingMode);
      let ranked: RankedProvider[] = rankProviders(lista, {
        mode, radiusKm, isEv, isHybrid, emergency: emEmergencia, partnerNames,
      }).slice(0, limite);

      // ---- ampliação progressiva do raio quando não achou nada ----
      let raioAmpliado: number | null = null;
      if (ranked.length === 0 && !cacheHit && !erroBusca && locationText) {
        const raioMaior = radiusKm * 2;
        const r2 = await searchViaSearchPreview(settings?.openai_api_key || "", {
          serviceType, locationText, vehicle: carro, radiusKm: raioMaior, limit: limite,
        });
        custo += r2.cost;
        if (r2.providers.length) {
          raioAmpliado = raioMaior;
          fontes.push("search_preview:raio_ampliado");
          ranked = rankProviders(dedupProviders(r2.providers), {
            mode, radiusKm: raioMaior, isEv, isHybrid, emergency: emEmergencia, partnerNames,
          }).slice(0, limite);
        }
      }

      // ---- persiste busca + resultados (auditoria do ranking) ----
      const { data: busca } = await admin.from("service_searches").insert({
        user_id: userId, vehicle_id: veh?.id || null,
        query: String(p.query || p.service_type || def.label),
        service_type: serviceType, location_text: locationText || null,
        latitude: lat, longitude: lon, radius_km: raioAmpliado || radiusKm,
        filters: { mode, open_now: p.open_now ?? null, emergency: emEmergencia },
        result_count: ranked.length, sources: fontes, cost: custo,
        duration_ms: Date.now() - t0, ok: !erroBusca, error: erroBusca,
      }).select().single();

      // upsert dos estabelecimentos + vínculo com a busca
      const comId: RankedProvider[] = [];
      for (const prov of ranked) {
        const externalId = prov.external_id || `${normalizePhone(prov.phone) || prov.name.toLowerCase().replace(/\s+/g, "-")}`;
        const { data: up } = await admin.from("discovered_providers").upsert({
          external_source: prov.source, external_id: externalId,
          name: prov.name, normalized_name: prov.name.toLowerCase().trim(),
          category: def.label, provider_status: prov.provider_status,
          phone: prov.phone, phone_normalized: normalizePhone(prov.phone),
          whatsapp: prov.whatsapp, website: prov.website,
          address: prov.address, city: prov.city, state: prov.state,
          latitude: prov.latitude, longitude: prov.longitude,
          rating: prov.rating, review_count: prov.review_count,
          service_attributes: {
            open_24h: prov.open_24h, mobile_service: prov.mobile_service,
            supports_ev: prov.supports_ev, supports_hybrid: prov.supports_hybrid,
          },
          last_checked_at: new Date().toISOString(),
        }, { onConflict: "external_source,external_id" }).select().single();

        // links prontos (rota/ligar/WhatsApp) — só ABREM o canal; nada é
        // enviado e nenhum dado do motorista é compartilhado aqui.
        const tel = normalizePhone(prov.phone);
        const zap = normalizePhone(prov.whatsapp) || tel;
        const destino = prov.address
          ? encodeURIComponent(`${prov.name} ${prov.address}`)
          : prov.latitude != null ? `${prov.latitude},${prov.longitude}` : encodeURIComponent(prov.name);
        const uris = {
          call_uri: tel ? `tel:+55${tel}` : null,
          whatsapp_uri: zap ? `https://wa.me/55${zap}` : null,
          maps_uri: `https://www.google.com/maps/search/?api=1&query=${destino}`,
          website_uri: prov.website || null,
        };

        if (up?.id) {
          comId.push({ ...prov, ...uris, provider_id: up.id });
          if (busca?.id) {
            await admin.from("provider_search_results").upsert({
              search_id: busca.id, provider_id: up.id,
              distance_km: prov.distance_km ?? null,
              rank_score: prov.rank_score, rank_position: prov.rank_position,
              matched_reasons: prov.matched_reasons,
            }, { onConflict: "search_id,provider_id" });
          }
        } else {
          comId.push({ ...prov, ...uris });
        }
      }

      return json({
        ok: true,
        search_id: busca?.id || null,
        service_type: serviceType,
        service_label: def.label,
        emergencia: emEmergencia,
        location_text: locationText || null,
        raio_km: raioAmpliado || radiusKm,
        raio_ampliado: raioAmpliado,
        cache: cacheHit,
        fontes,
        total: comId.length,
        providers: comId,
        disclaimer: DISCLAIMER_PUBLICO,
        erro_busca: erroBusca,
        instrucao: comId.length
          ? "Apresente de 3 a 6 opções com nome, distância (se houver), nota e o porquê de cada uma (matched_reasons). Identifique SEMPRE se é resultado público ou parceiro Totex. NUNCA invente preço, disponibilidade, garantia ou tempo de chegada — o que não veio, diga 'não informado'. Termine com UMA próxima ação clara (abrir rota, ligar ou chamar no WhatsApp). Não peça autorização pra ter pesquisado."
          : "Nenhum estabelecimento encontrado. Explique que a busca não achou resultado confiável, ofereça ampliar a região ou tentar uma categoria equivalente. NÃO invente estabelecimento.",
      });
    }

    // ------------------------------------------------------- CONTACT ACTIONS
    // Só devolve LINKS. Não envia mensagem, não compartilha nada.
    if (action === "contact_actions") {
      const { data: prov } = await admin.from("discovered_providers")
        .select("*").eq("id", String(p.provider_id)).maybeSingle();
      if (!prov) return json({ error: "prestador_nao_encontrado" }, 404);

      const tel = normalizePhone(prov.phone);
      const zap = normalizePhone(prov.whatsapp) || tel;
      const destino = prov.address
        ? encodeURIComponent(`${prov.name} ${prov.address}`)
        : prov.latitude != null ? `${prov.latitude},${prov.longitude}` : encodeURIComponent(prov.name);

      return json({
        ok: true,
        provider: { id: prov.id, name: prov.name, provider_status: prov.provider_status },
        call_uri: tel ? `tel:+55${tel}` : null,
        whatsapp_uri: zap ? `https://wa.me/55${zap}` : null,
        maps_uri: `https://www.google.com/maps/search/?api=1&query=${destino}`,
        website_uri: prov.website || null,
        aviso: "Links para VOCÊ iniciar o contato. Nada foi enviado ao estabelecimento e nenhum dado seu foi compartilhado.",
      });
    }

    // --------------------------------------------------------- RECORD ACTION
    // Telemetria de produto (o motorista abriu a rota/telefone). NÃO é CRM:
    // não cria cadastro do motorista no estabelecimento.
    if (action === "record_action") {
      const permitidas = ["viewed", "opened_route", "opened_phone", "opened_whatsapp", "opened_website", "requested_quote"];
      const tipo = String(p.action_type || "");
      if (!permitidas.includes(tipo)) return json({ error: "action_type_invalido" }, 400);

      await admin.from("driver_provider_actions").insert({
        user_id: userId, vehicle_id: p.vehicle_id || null,
        search_id: p.search_id || null, provider_id: String(p.provider_id),
        action_type: tipo, metadata: p.metadata || {},
      });
      return json({ ok: true });
    }

    // ----------------------------------------------------------------- QUOTE
    // EFEITO EXTERNO: exige consentimento explícito + lista dos dados que vão.
    if (action === "quote") {
      const consent = String(p.consent_text || "").trim();
      const shared: string[] = Array.isArray(p.shared_fields) ? p.shared_fields : [];
      const ids: string[] = Array.isArray(p.provider_ids) ? p.provider_ids : [];

      if (consent.length < 10) {
        return json({
          error: "consentimento_ausente",
          message: "Preciso da sua autorização explícita antes de enviar qualquer pedido. Diga o que posso compartilhar e com quem.",
        }, 400);
      }
      if (!shared.length) return json({ error: "shared_fields_ausente", message: "Preciso saber QUAIS dados posso compartilhar." }, 400);
      if (!ids.length || ids.length > 4) return json({ error: "provider_ids_invalido" }, 400);

      const { data: qr, error } = await admin.from("provider_quote_requests").insert({
        user_id: userId, vehicle_id: p.vehicle_id || null,
        service_type: normalizeServiceType(p.service_type),
        provider_ids: ids, details: p.details || {},
        shared_fields: shared, consent_text: consent, status: "pending",
      }).select().single();
      if (error) return json({ error: "falha_ao_registrar", detalhes: error.message }, 500);

      for (const pid of ids) {
        await admin.from("driver_provider_actions").insert({
          user_id: userId, provider_id: pid, action_type: "requested_quote",
          search_id: p.search_id || null, metadata: { quote_id: qr.id },
        });
      }

      // Fase 1: o pedido fica REGISTRADO com o consentimento; o disparo ao
      // estabelecimento entra na Fase 2 (canal por parceiro + opt-out).
      return json({
        ok: true, quote_id: qr.id, status: "pending",
        dados_compartilhados: shared,
        message: "Pedido de orçamento registrado com sua autorização. Enquanto o envio automático não está ativo, use o WhatsApp/telefone para falar direto — assim você controla o que conta.",
      });
    }

    // --------------------------------------------------------------- HISTORY
    if (action === "history") {
      const { data: buscas } = await admin.from("service_searches")
        .select("id, service_type, location_text, result_count, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      return json({ ok: true, buscas: buscas || [] });
    }

    return json({ error: "acao_desconhecida", acoes: ["search", "contact_actions", "record_action", "quote", "history"] }, 400);
  } catch (e) {
    console.error("radar erro:", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
