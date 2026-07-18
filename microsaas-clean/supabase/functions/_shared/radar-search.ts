// TotexCar Co-pilot — RADAR DE SERVIÇOS: camada de busca, dedup, cache e ranking.
//
// NÃO É CRM: aqui não existe lead, prospect, negócio, pipeline ou abordagem
// comercial. Estabelecimento é OPÇÃO DE SERVIÇO pro motorista escolher.
//
// Herdado do módulo de prospecção do CRM (só a parte útil):
//  - formato normalizado do parser do Google Maps (nome/categoria/telefone/
//    endereço/nota/avaliações/site)
//  - dedup por chave de fonte, telefone, domínio e nome+coordenadas
//  - log de custo/duração por chamada de API (inclusive quando falha)
// Descartado de propósito: Firecrawl raspando o Google Maps (ToS + custo por
// busca num recurso de consumidor) e todo o diagnóstico comercial.
//
// Fonte de dados: gpt-4o-search-preview (mesmo motor do Modo Viagem/car-spec).
// Google Places entra como segundo provider quando houver chave no /admin.

// Custo ESTIMADO por busca, gravado em service_searches.cost para dar
// visibilidade de gasto (mesma ideia do prospeccao_uso_api do CRM).
// É estimativa, não fatura: o valor real varia com os tokens da resposta.
// gpt-4o-search-preview cobra a busca embutida + os tokens gerados.
export const CUSTO_ESTIMADO_SEARCH_PREVIEW = 0.03;
export const CUSTO_ESTIMADO_GOOGLE_PLACES = 0.017;

export type ProviderStatus = "publico" | "parceiro_totex" | "assistencia_contratada";

export interface RawProvider {
  name: string;
  category?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  review_count?: number | null;
  open_now?: boolean | null;
  opening_hours?: unknown;
  mobile_service?: boolean | null;
  open_24h?: boolean | null;
  supports_ev?: boolean | null;
  supports_hybrid?: boolean | null;
  distance_km?: number | null;
  source: string;
  external_id?: string | null;
}

export interface RankedProvider extends RawProvider {
  provider_id?: string;
  provider_status: ProviderStatus;
  rank_score: number;
  rank_position: number;
  matched_reasons: string[];
  last_checked_at: string;
}

// ---------------------------------------------------------------------------
// Categorias de serviço automotivo (substitui o vocabulário de nicho comercial
// do parser antigo: salão/clínica/restaurante → oficina/borracharia/guincho)
// ---------------------------------------------------------------------------
export const SERVICE_TYPES: Record<string, { label: string; termos: string[]; emergencia?: boolean }> = {
  oficina:       { label: "Oficina mecânica", termos: ["oficina mecânica", "auto center", "mecânica"] },
  freios:        { label: "Freios e suspensão", termos: ["freios", "suspensão", "auto center"] },
  autoeletrica:  { label: "Autoelétrica", termos: ["autoelétrica", "auto elétrica"] },
  bateria:       { label: "Baterias", termos: ["bateria automotiva", "loja de baterias"] },
  pneus:         { label: "Pneus", termos: ["pneus", "borracharia", "auto center"] },
  borracharia:   { label: "Borracharia", termos: ["borracharia"], emergencia: true },
  chaveiro:      { label: "Chaveiro automotivo", termos: ["chaveiro automotivo"], emergencia: true },
  vidros:        { label: "Vidros", termos: ["vidraçaria automotiva", "troca de vidro automotivo"] },
  ar_condicionado: { label: "Ar-condicionado", termos: ["ar condicionado automotivo"] },
  funilaria:     { label: "Funilaria e pintura", termos: ["funilaria e pintura", "lanternagem"] },
  estetica:      { label: "Estética e lavagem", termos: ["estética automotiva", "lava rápido"] },
  vistoria:      { label: "Vistoria", termos: ["vistoria veicular", "vistoria cautelar"] },
  guincho:       { label: "Guincho / reboque", termos: ["guincho 24 horas", "reboque"], emergencia: true },
  socorro:       { label: "Socorro mecânico", termos: ["socorro mecânico 24 horas", "mecânico móvel"], emergencia: true },
  eletrico_hibrido: { label: "Elétricos e híbridos", termos: ["oficina carro elétrico", "especializada híbrido"] },
};

export function normalizeServiceType(input?: string | null): string {
  const s = String(input || "").toLowerCase().trim();
  if (!s) return "oficina";
  if (SERVICE_TYPES[s]) return s;
  const alias: Record<string, string> = {
    battery: "bateria", baterias: "bateria",
    tire: "pneus", tires: "pneus", pneu: "pneus",
    tow: "guincho", reboque: "guincho",
    locksmith: "chaveiro", mechanic: "oficina", workshop: "oficina",
    brakes: "freios", freio: "freios", suspensao: "freios",
    glass: "vidros", vidro: "vidros",
    ac: "ar_condicionado", "ar-condicionado": "ar_condicionado",
    pintura: "funilaria", lanternagem: "funilaria",
    lavagem: "estetica", "lava-rapido": "estetica",
    ev: "eletrico_hibrido", hibrido: "eletrico_hibrido",
  };
  if (alias[s]) return alias[s];
  for (const [key, def] of Object.entries(SERVICE_TYPES)) {
    if (def.termos.some((t) => s.includes(t) || t.includes(s))) return key;
  }
  return "oficina";
}

export const isEmergencyService = (t: string) => !!SERVICE_TYPES[normalizeServiceType(t)]?.emergencia;

// ---------------------------------------------------------------------------
// Normalizações (base do dedup)
// ---------------------------------------------------------------------------
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2); // tira DDI
  return d.length >= 8 ? d : null;
}

export function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(String(url).startsWith("http") ? String(url) : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

export function normalizeName(name?: string | null): string {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // sem acento
    .replace(/\b(ltda|me|epp|eireli|sa|s\/a|cia)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// distância em km (haversine — dispensa postgis no nosso volume)
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Deduplicação — ordem do radar-servicos.md:
// 1) id da fonte  2) telefone normalizado  3) domínio  4) nome + coords próximas
// Nunca mostrar o mesmo estabelecimento 2x porque veio de fontes diferentes.
// ---------------------------------------------------------------------------
export function dedupProviders(list: RawProvider[]): RawProvider[] {
  const out: RawProvider[] = [];
  const bySource = new Set<string>();
  const byPhone = new Set<string>();
  const byDomain = new Set<string>();

  for (const p of list) {
    if (!p?.name || String(p.name).trim().length < 3) continue;

    const srcKey = p.external_id ? `${p.source}:${p.external_id}` : null;
    const phone = normalizePhone(p.phone);
    const domain = extractDomain(p.website);
    const nome = normalizeName(p.name);

    if (srcKey && bySource.has(srcKey)) continue;
    if (phone && byPhone.has(phone)) continue;
    if (domain && byDomain.has(domain)) continue;

    // nome parecido a menos de 250m = mesmo lugar
    const duplicadoPorLocal = out.some((o) => {
      if (normalizeName(o.name) !== nome) return false;
      if (o.latitude == null || o.longitude == null || p.latitude == null || p.longitude == null) return true;
      return haversineKm(o.latitude, o.longitude, p.latitude, p.longitude) < 0.25;
    });
    if (duplicadoPorLocal) {
      // funde o que o duplicado tiver de melhor (telefone/site/nota)
      const alvo = out.find((o) => normalizeName(o.name) === nome);
      if (alvo) {
        alvo.phone ??= p.phone ?? null;
        alvo.website ??= p.website ?? null;
        alvo.rating ??= p.rating ?? null;
        alvo.review_count ??= p.review_count ?? null;
      }
      continue;
    }

    if (srcKey) bySource.add(srcKey);
    if (phone) byPhone.add(phone);
    if (domain) byDomain.add(domain);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ranking — pesos do PROMPT-PARA-CLAUDE:
// distância 25% · nota 20% · volume 15% · aberto 15% · compatibilidade 15% · contato 10%
// Comissão NÃO entra. Parceiro Totex não sobe no score — só ganha selo.
// ---------------------------------------------------------------------------
export type RankingMode =
  | "balanced" | "nearest" | "best_rated" | "open_now"
  | "mobile_service" | "confirmed_price" | "totex_partner";

export function rankProviders(
  list: RawProvider[],
  opts: {
    mode?: RankingMode;
    radiusKm?: number;
    isEv?: boolean;
    isHybrid?: boolean;
    emergency?: boolean;
    partnerNames?: string[];
  } = {},
): RankedProvider[] {
  const { mode = "balanced", radiusKm = 15, isEv, isHybrid, emergency, partnerNames = [] } = opts;
  const partners = new Set(partnerNames.map(normalizeName).filter(Boolean));
  const agora = new Date().toISOString();

  const scored = list.map((p) => {
    const reasons: string[] = [];

    // distância (mais perto = melhor); sem distância = neutro
    let sDist = 0.5;
    if (p.distance_km != null) {
      sDist = Math.max(0, 1 - p.distance_km / Math.max(radiusKm, 1));
      if (p.distance_km <= 3) reasons.push(`A ${p.distance_km} km de você`);
    }

    // nota
    let sRating = 0.5;
    if (p.rating != null) {
      sRating = Math.max(0, Math.min(1, (p.rating - 2.5) / 2.5));
      if (p.rating >= 4.5) reasons.push(`Nota ${p.rating.toFixed(1)} no Google`);
    }

    // volume de avaliações (log: 300 avaliações ≈ teto)
    let sVol = 0;
    if (p.review_count != null && p.review_count > 0) {
      sVol = Math.min(1, Math.log10(p.review_count + 1) / Math.log10(300));
      if (p.review_count >= 100) reasons.push(`${p.review_count} avaliações`);
    }

    // aberto agora / 24h
    let sOpen = 0.4;
    if (p.open_now === true) { sOpen = 1; reasons.push("Aberto agora"); }
    else if (p.open_now === false) sOpen = 0.1;
    if (p.open_24h) { sOpen = 1; reasons.push("Atende 24 horas"); }

    // compatibilidade com o carro / com a situação
    let sFit = 0.5;
    if ((isEv && p.supports_ev) || (isHybrid && p.supports_hybrid)) {
      sFit = 1; reasons.push("Atende elétrico/híbrido");
    } else if ((isEv || isHybrid) && p.supports_ev === false) {
      sFit = 0.15;
    }
    if (emergency && p.mobile_service) { sFit = Math.max(sFit, 0.9); reasons.push("Vai até você"); }

    // facilidade de contato
    let sContact = 0;
    if (p.phone) sContact += 0.5;
    if (p.whatsapp) { sContact += 0.4; reasons.push("Tem WhatsApp"); }
    if (p.website) sContact += 0.1;
    sContact = Math.min(1, sContact);

    let score =
      sDist * 0.25 + sRating * 0.20 + sVol * 0.15 + sOpen * 0.15 + sFit * 0.15 + sContact * 0.10;

    // modos alternativos: reordena o que o motorista pediu, sem esconder o resto
    if (mode === "nearest") score = sDist;
    else if (mode === "best_rated") score = sRating * 0.7 + sVol * 0.3;
    else if (mode === "open_now") score = sOpen * 0.7 + sDist * 0.3;
    else if (mode === "mobile_service") score = (p.mobile_service ? 1 : 0) * 0.7 + sDist * 0.3;
    else if (mode === "totex_partner") score = (partners.has(normalizeName(p.name)) ? 1 : 0) * 0.6 + score * 0.4;

    const status: ProviderStatus = partners.has(normalizeName(p.name)) ? "parceiro_totex" : "publico";

    return {
      ...p,
      provider_status: status,
      rank_score: Math.round(score * 1000) / 1000,
      rank_position: 0,
      matched_reasons: reasons,
      last_checked_at: agora,
    } as RankedProvider;
  });

  scored.sort((a, b) => b.rank_score - a.rank_score);
  scored.forEach((p, i) => { p.rank_position = i + 1; });
  return scored;
}

// ---------------------------------------------------------------------------
// FONTE: gpt-4o-search-preview (busca web ao vivo)
// Devolve JSON estruturado. O modelo é instruído a NÃO inventar: campo que
// não achou volta null — "não informado" é resposta válida, chute não é.
// ---------------------------------------------------------------------------
export async function searchViaSearchPreview(
  openaiKey: string,
  params: {
    serviceType: string;
    locationText: string;
    vehicle?: string | null;
    radiusKm?: number;
    limit?: number;
    openNow?: boolean;
  },
): Promise<{ providers: RawProvider[]; cost: number; durationMs: number; error: string | null }> {
  const t0 = Date.now();
  const tipo = normalizeServiceType(params.serviceType);
  const def = SERVICE_TYPES[tipo];
  const limite = Math.min(Math.max(params.limit ?? 6, 3), 10);

  if (!openaiKey || !params.locationText) {
    return { providers: [], cost: 0, durationMs: 0, error: "sem_chave_ou_localizacao" };
  }

  const prompt = `Pesquise AGORA na web estabelecimentos de "${def.label}" (${def.termos.join(", ")}) em ou perto de "${params.locationText}", Brasil${
    params.vehicle ? `, que atendam o veículo: ${params.vehicle}` : ""
  }.

Retorne de ${limite} a ${limite + 2} estabelecimentos REAIS que você encontrou na busca, como JSON válido puro (sem markdown, sem crase), no formato:
{"providers":[{
 "name":"nome do estabelecimento",
 "category":"tipo (ex.: auto center, borracharia)",
 "address":"endereço completo","city":"cidade","state":"UF",
 "phone":"telefone só dígitos com DDD, ou null",
 "whatsapp":"número do WhatsApp se divulgado, ou null",
 "website":"url do site, ou null",
 "rating":4.6, "review_count":312,
 "open_24h":true, "mobile_service":true,
 "supports_ev":null, "supports_hybrid":null,
 "source":"url ou nome da fonte onde você encontrou"
}]}

REGRAS ABSOLUTAS:
- Só inclua estabelecimento que você REALMENTE encontrou na pesquisa. Nunca invente nome, telefone ou endereço.
- Campo que você não encontrou = null. NÃO chute nota, número de avaliações, telefone nem horário.
- "open_24h" e "mobile_service" (atendimento móvel/vai até o cliente) só true se a fonte disser isso explicitamente; senão null.
- Não invente preço, garantia ou tempo de chegada — esses campos nem existem no formato.
- Priorize quem tem reputação verificável (nota e avaliações públicas).`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-search-preview",
        web_search_options: {},
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const txt = (await res.text()).slice(0, 200);
      return { providers: [], cost: 0, durationMs: Date.now() - t0, error: `OpenAI ${res.status}: ${txt}` };
    }

    const d = await res.json();
    let texto: string = d?.choices?.[0]?.message?.content?.trim() || "";
    // tolerante a cerca de código (mesmo tratamento do edge viagem)
    texto = texto.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = texto.indexOf("{");
    const b = texto.lastIndexOf("}");
    if (a >= 0 && b > a) texto = texto.slice(a, b + 1);

    let parsed: any = null;
    try { parsed = JSON.parse(texto); } catch {
      // a chamada foi feita e cobrada mesmo com resposta inútil — registra o gasto
      return { providers: [], cost: CUSTO_ESTIMADO_SEARCH_PREVIEW, durationMs: Date.now() - t0, error: "resposta_nao_json" };
    }

    const providers: RawProvider[] = (parsed?.providers || [])
      .filter((p: any) => p?.name)
      .map((p: any) => ({
        name: String(p.name).trim(),
        category: p.category ?? def.label,
        phone: normalizePhone(p.phone),
        whatsapp: normalizePhone(p.whatsapp),
        website: p.website ?? null,
        address: p.address ?? null,
        city: p.city ?? null,
        state: p.state ?? null,
        latitude: typeof p.latitude === "number" ? p.latitude : null,
        longitude: typeof p.longitude === "number" ? p.longitude : null,
        rating: typeof p.rating === "number" ? p.rating : null,
        review_count: typeof p.review_count === "number" ? p.review_count : null,
        open_now: null,                       // search-preview não confirma isso com segurança
        open_24h: p.open_24h === true ? true : null,
        mobile_service: p.mobile_service === true ? true : null,
        supports_ev: typeof p.supports_ev === "boolean" ? p.supports_ev : null,
        supports_hybrid: typeof p.supports_hybrid === "boolean" ? p.supports_hybrid : null,
        source: String(p.source || "web_search"),
        external_id: null,
      }));

    return { providers, cost: CUSTO_ESTIMADO_SEARCH_PREVIEW, durationMs: Date.now() - t0, error: null };
  } catch (e) {
    return { providers: [], cost: 0, durationMs: Date.now() - t0, error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// FONTE 2 (opcional): Google Places oficial — só liga se houver chave no /admin.
// Via legítima pra nota/avaliações/aberto-agora confiáveis.
// ---------------------------------------------------------------------------
export async function searchViaGooglePlaces(
  apiKey: string,
  params: { serviceType: string; latitude?: number | null; longitude?: number | null; locationText?: string; radiusKm?: number; limit?: number },
): Promise<{ providers: RawProvider[]; cost: number; durationMs: number; error: string | null }> {
  const t0 = Date.now();
  const tipo = normalizeServiceType(params.serviceType);
  const def = SERVICE_TYPES[tipo];
  const limite = Math.min(Math.max(params.limit ?? 6, 3), 10);

  try {
    const body: Record<string, unknown> = {
      textQuery: `${def.termos[0]} ${params.locationText || ""}`.trim(),
      languageCode: "pt-BR",
      regionCode: "BR",
      maxResultCount: limite,
    };
    if (params.latitude != null && params.longitude != null) {
      body.locationBias = {
        circle: {
          center: { latitude: params.latitude, longitude: params.longitude },
          radius: Math.min((params.radiusKm ?? 15) * 1000, 50000),
        },
      };
    }

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating," +
          "places.userRatingCount,places.nationalPhoneNumber,places.websiteUri," +
          "places.currentOpeningHours.openNow,places.primaryTypeDisplayName",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = (await res.text()).slice(0, 200);
      return { providers: [], cost: 0, durationMs: Date.now() - t0, error: `Places ${res.status}: ${txt}` };
    }

    const d = await res.json();
    const providers: RawProvider[] = (d?.places || []).map((p: any) => ({
      name: p?.displayName?.text || "",
      category: p?.primaryTypeDisplayName?.text || def.label,
      phone: normalizePhone(p?.nationalPhoneNumber),
      whatsapp: null,
      website: p?.websiteUri ?? null,
      address: p?.formattedAddress ?? null,
      city: null, state: null,
      latitude: p?.location?.latitude ?? null,
      longitude: p?.location?.longitude ?? null,
      rating: typeof p?.rating === "number" ? p.rating : null,
      review_count: typeof p?.userRatingCount === "number" ? p.userRatingCount : null,
      open_now: typeof p?.currentOpeningHours?.openNow === "boolean" ? p.currentOpeningHours.openNow : null,
      open_24h: null, mobile_service: null, supports_ev: null, supports_hybrid: null,
      source: "google_places",
      external_id: p?.id ?? null,
    })).filter((p: RawProvider) => p.name);

    // Places cobra por requisição (SKU Text Search) — registrado pra auditoria de custo
    return { providers, cost: CUSTO_ESTIMADO_GOOGLE_PLACES, durationMs: Date.now() - t0, error: null };
  } catch (e) {
    return { providers: [], cost: 0, durationMs: Date.now() - t0, error: String(e) };
  }
}
