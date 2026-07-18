// TotexCar Co-pilot — ENDPOINT de WhatsApp Flows (data exchange criptografado)
// Fundação para flows DINÂMICOS: o Meta manda cada navegação de tela criptografada
// (RSA-OAEP SHA-256 na chave AES + AES-128-GCM no payload), a gente processa e devolve
// a próxima tela com dados AO VIVO. Resposta cifrada com a MESMA chave e IV com bits invertidos.
//
// Flow atendido (v1): RECOMPRA FIPE AO VIVO
//   MARCA → MODELO → ANO → RESULTADO (avaliação na hora: valor FIPE × % de recompra)
//   O "complete" da última tela chega no whatsapp-webhook (nfm_reply) e vira lead em buyback_requests.
//
// Chave privada: secret WA_FLOW_PRIVATE_KEY_B64 (PEM PKCS8 em base64).
// Pública correspondente: subida no número via /whatsapp_business_encryption.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import {
  SERVICE_TYPES, normalizeServiceType, isEmergencyService, dedupProviders,
  rankProviders, normalizePhone, searchViaSearchPreview, searchViaGooglePlaces,
} from "../_shared/radar-search.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRIVATE_KEY_B64 = Deno.env.get("WA_FLOW_PRIVATE_KEY_B64") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const FIPE = "https://parallelum.com.br/fipe/api/v1/carros";
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const parseBRL = (s: any) => Number(String(s || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;

// ---------------- criptografia (protocolo oficial dos Flows) ----------------
const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
function bytesToB64(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

let _privKey: CryptoKey | null = null;
async function privateKey(): Promise<CryptoKey> {
  if (_privKey) return _privKey;
  const pem = atob(PRIVATE_KEY_B64);
  const der = b64ToBytes(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  _privKey = await crypto.subtle.importKey("pkcs8", der, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  return _privKey;
}

async function decryptRequest(body: any): Promise<{ req: any; aesKey: CryptoKey; iv: Uint8Array } | null> {
  const encKey = b64ToBytes(body.encrypted_aes_key);
  const iv = b64ToBytes(body.initial_vector);
  const data = b64ToBytes(body.encrypted_flow_data);
  let rawAes: ArrayBuffer;
  try {
    rawAes = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, await privateKey(), encKey);
  } catch {
    return null; // chave não bate → 421 (Meta renova a pública)
  }
  const aesKey = await crypto.subtle.importKey("raw", rawAes, "AES-GCM", false, ["decrypt", "encrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, aesKey, data);
  return { req: JSON.parse(new TextDecoder().decode(plain)), aesKey, iv };
}

async function encryptResponse(resp: unknown, aesKey: CryptoKey, iv: Uint8Array): Promise<string> {
  const flipped = iv.map((b) => b ^ 0xff); // IV da resposta = bits invertidos do IV da requisição
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: flipped, tagLength: 128 }, aesKey, new TextEncoder().encode(JSON.stringify(resp)),
  );
  return bytesToB64(ct);
}

// ---------------- FIPE (mesma fonte da edge buyback) ----------------
async function fipeGet(path: string) {
  const res = await fetch(`${FIPE}${path}`);
  if (!res.ok) throw new Error(`FIPE ${res.status}`);
  return res.json();
}
// Dropdown do Flow aceita até 200 itens — filtro opcional digitado pelo usuário resolve marcas grandes
const cap200 = (arr: any[], filtro?: string) => {
  let list = arr;
  const f = String(filtro || "").trim().toLowerCase();
  if (f) list = arr.filter((x: any) => String(x.nome).toLowerCase().includes(f));
  return list.slice(0, 200).map((x: any) => ({ id: String(x.codigo), title: String(x.nome).slice(0, 30) }));
};

// ---------------- telas do flow GARAGEM TOTEX (estoque ao vivo do marketplace) ----------------
const MARKETPLACE = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mktVehicles(params: Record<string, string | number | undefined>, attempt = 0): Promise<any[]> {
  const u = new URL(`${MARKETPLACE}/api/vehicles`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if ((res.status === 429 || res.status === 503) && attempt < 3) { await sleep(350 * (attempt + 1)); return mktVehicles(params, attempt + 1); }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`marketplace_${res.status}`);
  return Array.isArray(d?.data) ? d.data : [];
}

const FAIXAS = [
  { id: "todas", title: "Qualquer preço" },
  { id: "0-50", title: "Até R$ 50 mil" },
  { id: "50-100", title: "R$ 50 a 100 mil" },
  { id: "100-200", title: "R$ 100 a 200 mil" },
  { id: "200-400", title: "R$ 200 a 400 mil" },
  { id: "400-", title: "Acima de R$ 400 mil" },
];
function faixaRange(id: string): { minPrice?: number; maxPrice?: number } {
  if (!id || id === "todas") return {};
  // compat com ids antigos ("50" = até 50 mil)
  if (!id.includes("-")) return { maxPrice: Number(id) * 1000 || undefined };
  const [min, max] = id.split("-");
  return {
    minPrice: Number(min) > 0 ? Number(min) * 1000 : undefined,
    maxPrice: max ? Number(max) * 1000 : undefined,
  };
}

function carRow(v: any) {
  const km = Number(v.mileage) > 0 ? `${Number(v.mileage).toLocaleString("pt-BR")} km` : "km n/i";
  const preco = v.price != null ? brl(Number(v.price)) : "consulte";
  return {
    id: String(v.id),
    title: `${v.brand || ""} ${v.model || ""}`.trim().slice(0, 30),
    description: `${v.year || ""} · ${km} · ${preco}`.slice(0, 100),
  };
}

async function garagemBusca(dealershipId: string | undefined, aviso = ""): Promise<any> {
  let marcas: any[] = [{ id: "todas", title: "Todas as marcas" }];
  try {
    const res = await fetch(`${MARKETPLACE}/api/vehicles/brands`);
    const d = await res.json().catch(() => []);
    const list = Array.isArray(d) ? d : (d?.data || []);
    marcas = marcas.concat(list.slice(0, 190).map((b: any) => {
      const nome = typeof b === "string" ? b : (b?.name || b?.brand || "");
      return { id: String(nome), title: String(nome).slice(0, 30) };
    }).filter((x: any) => x.id));
  } catch { /* segue só com "todas" */ }
  return { screen: "GBUSCA", data: { marcas, faixas: FAIXAS, aviso: aviso || " " } };
}

async function handleGaragem(req: any, dealershipId?: string): Promise<any> {
  const d = req.data || {};

  if (req.action === "INIT") return garagemBusca(dealershipId);

  if (req.action === "data_exchange") {
    if (req.screen === "GBUSCA") {
      const busca = String(d.busca || "").trim() || undefined;
      let vehicles = await mktVehicles({
        brand: d.marca && d.marca !== "todas" ? d.marca : undefined,
        ...faixaRange(String(d.faixa || "todas")),
        search: busca,
        limit: 10, dealershipId,
      });
      let resumo = `Encontrei ${vehicles.length} carro(s) pra você. Escolha um pra ver os detalhes:`;
      let faixaUsada = String(d.faixa || "todas");
      let marcaUsada = String(d.marca || "todas");
      let buscaUsada = String(d.busca || "");
      // BUSCA DE RESGATE: filtros zeraram? tenta a palavra-chave sozinha no estoque inteiro
      // (ex.: buscou Porsche numa faixa baixa) — melhor mostrar o que existe do que "nada".
      if (!vehicles.length && (busca || marcaUsada !== "todas")) {
        const termo = busca || String(d.marca || "");
        vehicles = await mktVehicles({ search: termo, limit: 10, dealershipId });
        if (vehicles.length) {
          resumo = `Não achei com esses filtros exatos, mas olha o que temos parecido no estoque:`;
          faixaUsada = "todas"; marcaUsada = "todas"; buscaUsada = termo;
        }
      }
      if (!vehicles.length) return garagemBusca(dealershipId, "Nenhum carro encontrado — tente outra marca ou palavra-chave, ou escolha Qualquer preço. 😉");
      return {
        screen: "GRESULT",
        data: {
          carros: vehicles.map(carRow),
          resumo,
          marca: marcaUsada, faixa: faixaUsada, busca: buscaUsada,
        },
      };
    }
    if (req.screen === "GRESULT") {
      const vehicles = await mktVehicles({
        brand: d.marca && d.marca !== "todas" ? d.marca : undefined,
        ...faixaRange(String(d.faixa || "todas")),
        search: String(d.busca || "").trim() || undefined,
        limit: 30, dealershipId,
      });
      const v = vehicles.find((x: any) => String(x.id) === String(d.carro));
      if (!v) return garagemBusca(dealershipId, "Esse carro acabou de sair do estoque. Faça uma nova busca. 🙏");
      const km = Number(v.mileage) > 0 ? `${Number(v.mileage).toLocaleString("pt-BR")} km` : "km não informado";
      const abaixoFipe = v.fipePrice && Number(v.price) < Number(v.fipePrice) ? " · 🔥 Abaixo da FIPE" : "";
      return {
        screen: "GDETALHE",
        data: {
          titulo: `${v.brand || ""} ${v.model || ""} ${v.version || ""}`.trim().slice(0, 80),
          preco: v.price != null ? brl(Number(v.price)) : "Consulte",
          corpo: `Ano ${v.year || "n/i"} · ${km}${abaixoFipe}. Toque em "Tenho interesse" que a loja entra em contato com você, ou veja as fotos no site.`,
          url: `${MARKETPLACE}/veiculo/${v.id}`,
          vid: String(v.id),
        },
      };
    }
  }

  return garagemBusca(dealershipId);
}

// ---------------- telas do flow RADAR DE SERVIÇOS ----------------
// Achar oficina/borracharia/guincho perto do motorista, dentro do WhatsApp.
// NÃO É CRM: estabelecimento é opção de serviço, não lead.
//
// ⚠️ ORÇAMENTO DE TEMPO: o Meta corta a requisição do endpoint por volta de 10s.
// A busca ao vivo medida em produção leva ~8s — perto demais do limite. Por isso:
//   1) tenta CACHE (consulta ao banco, milissegundos);
//   2) só então busca ao vivo, com trava de RADAR_TIMEOUT_MS;
//   3) estourou? devolve a tela RESPERA e o agente manda o resultado no chat.
// Melhor avisar com elegância do que deixar o formulário quebrar na cara do cliente.
const RADAR_TIMEOUT_MS = 6500;

// Telas do radar — usadas no roteamento. Precisa ser lista exata porque a tela
// RESULTADO (flow da Recompra) também começa com "R".
const RADAR_SCREENS = new Set(["RBUSCA", "RRESULT", "RDETALHE", "RESPERA"]);

const ORDENS = [
  { id: "balanced", title: "Melhor combinação" },
  { id: "nearest", title: "Mais perto" },
  { id: "best_rated", title: "Melhor avaliado" },
  { id: "mobile_service", title: "Que vai até mim" },
];

function radarBusca(localPadrao = "", aviso = ""): any {
  return {
    screen: "RBUSCA",
    data: {
      servicos: Object.entries(SERVICE_TYPES).map(([id, def]) => ({ id, title: def.label.slice(0, 30) })),
      ordens: ORDENS,
      local_padrao: localPadrao,
      aviso: aviso || " ",
    },
  };
}

// linha da lista: nome + os sinais objetivos que ajudam a escolher
function lugarRow(p: any, idx: number) {
  const sinais: string[] = [];
  if (p.rating != null) sinais.push(`⭐ ${Number(p.rating).toFixed(1)}${p.review_count ? ` (${p.review_count})` : ""}`);
  if (p.provider_status === "parceiro_totex") sinais.push("Parceiro Totex");
  if (p.open_24h) sinais.push("24h");
  if (p.mobile_service) sinais.push("vai até você");
  if (p.distance_km != null) sinais.push(`${p.distance_km} km`);
  return {
    id: String(idx),
    title: String(p.name).slice(0, 30),
    description: (sinais.join(" · ") || "Resultado público").slice(0, 100),
  };
}

async function handleRadar(req: any, userId?: string): Promise<any> {
  const d = req.data || {};

  if (req.action === "INIT") {
    let local = "";
    if (userId) {
      const { data: veh } = await admin.from("accounts").select("cidade")
        .eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle();
      local = String(veh?.cidade || "");
    }
    return radarBusca(local);
  }

  if (req.action === "data_exchange") {
    if (req.screen === "RBUSCA") {
      const serviceType = normalizeServiceType(d.servico);
      const def = SERVICE_TYPES[serviceType];
      const local = String(d.local || "").trim();
      if (!local) return radarBusca("", "Preciso saber onde você está pra procurar. 📍");

      const { data: cfg } = await admin.from("app_settings")
        .select("openai_api_key, radar_cache_hours, radar_search_provider, google_places_api_key")
        .eq("id", 1).single();

      // 1) CACHE — rápido e suficiente na maioria das vezes
      const horas = Number(cfg?.radar_cache_hours || 72);
      const desde = new Date(Date.now() - horas * 3600_000).toISOString();
      const { data: cached } = await admin.from("discovered_providers").select("*")
        .eq("category", def.label).gte("last_checked_at", desde)
        .ilike("city", `%${local.split(/[,\-]/)[0].trim()}%`).limit(30);

      let brutos: any[] = [];
      if (cached && cached.length >= 3) {
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
        // 2) AO VIVO com trava de tempo
        const usarPlaces = cfg?.radar_search_provider === "google_places" && !!cfg?.google_places_api_key;
        const busca = usarPlaces
          ? searchViaGooglePlaces(cfg!.google_places_api_key!, { serviceType, locationText: local, limit: 6 })
          : searchViaSearchPreview(cfg?.openai_api_key || "", { serviceType, locationText: local, limit: 6 });
        const resultado: any = await Promise.race([
          busca,
          new Promise((r) => setTimeout(() => r({ __timeout: true }), RADAR_TIMEOUT_MS)),
        ]);
        if (resultado?.__timeout) {
          // 3) estourou: o agente assume no chat (flow_token carrega o pedido)
          return {
            screen: "RESPERA",
            data: {
              titulo: "Estou procurando 🔎",
              corpo: `Achar ${def.label.toLowerCase()} em ${local} está demorando um pouco mais que o normal. Fecha aqui que eu te mando as melhores opções no chat em instantes.`,
            },
          };
        }
        brutos = resultado?.providers || [];
      }

      // parceiros do ecossistema ganham SELO, não posição
      const { data: lojas } = await admin.from("users")
        .select("dealership").eq("role", "dealer").not("dealership", "is", null);
      const partnerNames = [...new Set((lojas || []).map((l: any) => String(l.dealership)))];

      const ranked = rankProviders(dedupProviders(brutos), {
        mode: String(d.ordem || "balanced") as any,
        emergency: isEmergencyService(serviceType),
        partnerNames,
      }).slice(0, 6);

      if (!ranked.length) {
        return radarBusca(local, `Não achei ${def.label.toLowerCase()} em ${local}. Tente outra região ou categoria parecida.`);
      }

      // guarda os resultados desta busca pra próxima tela (o Flow não mantém estado grande)
      const { data: busca } = await admin.from("service_searches").insert({
        user_id: userId || null, query: def.label, service_type: serviceType,
        location_text: local, filters: { canal: "flow", ordem: d.ordem || "balanced" },
        result_count: ranked.length, sources: ["flow"], ok: true,
      }).select().single();

      if (busca?.id) {
        for (const p of ranked) {
          const externalId = p.external_id || (normalizePhone(p.phone) || p.name.toLowerCase().replace(/\s+/g, "-"));
          const { data: up } = await admin.from("discovered_providers").upsert({
            external_source: p.source, external_id: externalId,
            name: p.name, normalized_name: p.name.toLowerCase().trim(),
            category: def.label, provider_status: p.provider_status,
            phone: p.phone, phone_normalized: normalizePhone(p.phone),
            whatsapp: p.whatsapp, website: p.website, address: p.address,
            city: p.city, state: p.state, rating: p.rating, review_count: p.review_count,
            service_attributes: {
              open_24h: p.open_24h, mobile_service: p.mobile_service,
              supports_ev: p.supports_ev, supports_hybrid: p.supports_hybrid,
            },
            last_checked_at: new Date().toISOString(),
          }, { onConflict: "external_source,external_id" }).select().single();
          if (up?.id) {
            await admin.from("provider_search_results").upsert({
              search_id: busca.id, provider_id: up.id, rank_score: p.rank_score,
              rank_position: p.rank_position, matched_reasons: p.matched_reasons,
            }, { onConflict: "search_id,provider_id" });
          }
        }
      }

      return {
        screen: "RRESULT",
        data: {
          lugares: ranked.map(lugarRow),
          resumo: `Achei ${ranked.length} ${ranked.length === 1 ? "opção" : "opções"} de ${def.label.toLowerCase()} em ${local}.`,
          servico: serviceType, local, ordem: String(d.ordem || "balanced"),
          sid: String(busca?.id || ""),
        },
      };
    }

    if (req.screen === "RRESULT") {
      // recupera a busca gravada e pega o escolhido pela posição
      const sid = String(d.sid || "");
      const idx = Number(d.lugar);
      if (!sid) return radarBusca(String(d.local || ""), "Perdi o resultado da busca. Vamos procurar de novo? 🙏");

      const { data: rows } = await admin.from("provider_search_results")
        .select("provider_id, rank_position, matched_reasons, distance_km, discovered_providers(*)")
        .eq("search_id", sid).order("rank_position");
      const escolhido: any = (rows || [])[idx];
      const p: any = escolhido?.discovered_providers;
      if (!p) return radarBusca(String(d.local || ""), "Não consegui abrir esse estabelecimento. Tente de novo. 🙏");

      const tel = normalizePhone(p.phone);
      const zap = normalizePhone(p.whatsapp) || tel;
      const destino = p.address
        ? encodeURIComponent(`${p.name} ${p.address}`)
        : p.latitude != null ? `${p.latitude},${p.longitude}` : encodeURIComponent(p.name);
      const parceiro = p.provider_status === "parceiro_totex";

      return {
        screen: "RDETALHE",
        data: {
          titulo: String(p.name).slice(0, 80),
          selo: parceiro ? "✅ Parceiro Totex" : "Resultado público",
          nota: p.rating != null
            ? `⭐ ${Number(p.rating).toFixed(1)}${p.review_count ? ` · ${p.review_count} avaliações` : ""}`
            : "Sem nota pública encontrada",
          endereco: String(p.address || "Endereço não informado").slice(0, 120),
          porque: (escolhido?.matched_reasons || []).join(" · ").slice(0, 120) || " ",
          aviso: parceiro
            ? "Parceiro do ecossistema Totex. Confirme preço e prazo direto com a loja."
            : "Encontrado em fonte pública. Confirme preço e disponibilidade direto com o estabelecimento — a Totex não credencia nem garante o serviço.",
          tem_zap: !!zap,
          tem_site: !!p.website,
          maps_uri: `https://www.google.com/maps/search/?api=1&query=${destino}`,
          zap_uri: zap ? `https://wa.me/55${zap}` : "https://wa.me/",
          site_uri: String(p.website || "https://totexmotors.com"),
          pid: String(p.id),
          sid,
        },
      };
    }
  }

  return radarBusca();
}

// ---------------- telas do flow RECOMPRA ----------------
async function handleRecompra(req: any): Promise<any> {
  const d = req.data || {};

  if (req.action === "INIT") {
    const marcas = await fipeGet("/marcas");
    return { screen: "MARCA", data: { marcas: cap200(marcas) } };
  }

  if (req.action === "data_exchange") {
    if (req.screen === "MARCA") {
      const res = await fipeGet(`/marcas/${encodeURIComponent(d.marca)}/modelos`);
      const marcas = await fipeGet("/marcas");
      const marcaNome = (marcas.find((m: any) => String(m.codigo) === String(d.marca)) || {}).nome || "";
      return { screen: "MODELO", data: { modelos: cap200(res?.modelos || [], d.filtro), marca: String(d.marca), marca_nome: String(marcaNome) } };
    }
    if (req.screen === "MODELO") {
      const anos = await fipeGet(`/marcas/${encodeURIComponent(d.marca)}/modelos/${encodeURIComponent(d.modelo)}/anos`);
      return { screen: "ANO", data: { anos: cap200(anos), marca: String(d.marca), marca_nome: String(d.marca_nome || ""), modelo: String(d.modelo) } };
    }
    if (req.screen === "ANO") {
      const p = await fipeGet(`/marcas/${encodeURIComponent(d.marca)}/modelos/${encodeURIComponent(d.modelo)}/anos/${encodeURIComponent(d.ano)}`);
      const fipeValue = parseBRL(p?.Valor);
      const { data: s } = await admin.from("app_settings").select("buyback_fipe_pct").eq("id", 1).single();
      const pct = Number(s?.buyback_fipe_pct ?? 90);
      const offer = Math.round(fipeValue * pct) / 100;
      const titulo = `${p?.Marca || ""} ${p?.Modelo || ""} ${p?.AnoModelo || ""}`.trim();
      return {
        screen: "RESULTADO",
        data: {
          titulo,
          oferta: brl(offer),
          corpo: `Tabela FIPE: ${brl(fipeValue)} (código ${p?.CodigoFipe || "-"}). Oferta de recompra de até ${pct}% da FIPE, sujeita a vistoria e estado de conservação.`,
          marca_nome: String(p?.Marca || d.marca_nome || ""),
          modelo_nome: String(p?.Modelo || ""),
          ano_nome: String(p?.AnoModelo || ""),
          combustivel: String(p?.Combustivel || ""),
          fipe_code: String(p?.CodigoFipe || ""),
          fipe_value: String(fipeValue),
          offer_value: String(offer),
          pct: String(pct),
        },
      };
    }
  }

  // BACK ou tela desconhecida → volta pro início
  const marcas = await fipeGet("/marcas");
  return { screen: "MARCA", data: { marcas: cap200(marcas) } };
}

// ---------------- servidor ----------------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  let body: any = {};
  try { body = await req.json(); } catch { return new Response("bad request", { status: 400 }); }

  const dec = await decryptRequest(body).catch(() => null);
  if (!dec) return new Response("", { status: 421 }); // pede refresh da chave pública

  const { req: flowReq, aesKey, iv } = dec;
  let resp: any;
  try {
    if (flowReq.action === "ping") {
      resp = { data: { status: "active" } };
    } else {
      // roteia pelo flow_token ("garagem" ou "garagem:{dealershipId}" = estoque escopado por loja)
      // e pelas telas (fallback pra flows enviados sem token). Default: recompra.
      const token = String(flowReq.flow_token || "");
      const screen = String(flowReq.screen || "");
      if (token.startsWith("garagem") || screen.startsWith("G")) {
        const dealershipId = token.includes(":") ? token.split(":")[1] : undefined;
        resp = await handleGaragem(flowReq, dealershipId);
      // ⚠️ NÃO usar screen.startsWith("R"): a tela RESULTADO da RECOMPRA também
      // começa com R e seria sequestrada pelo radar. Lista explícita.
      } else if (token.startsWith("radar") || RADAR_SCREENS.has(screen)) {
        // token "radar:{userId}" → usa a cidade salva do motorista como padrão
        const userId = token.includes(":") ? token.split(":")[1] : undefined;
        resp = await handleRadar(flowReq, userId);
      } else {
        resp = await handleRecompra(flowReq);
      }
    }
  } catch (e) {
    console.error("wa-flow-endpoint erro:", e);
    // devolve a tela inicial com lista vazia em vez de quebrar o formulário
    resp = { screen: "MARCA", data: { marcas: [] } };
  }

  const encrypted = await encryptResponse(resp, aesKey, iv);
  return new Response(encrypted, { status: 200, headers: { "Content-Type": "text/plain" } });
});
