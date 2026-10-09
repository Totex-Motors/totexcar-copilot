// TotexCar Co-pilot — ROTEIRO DIA A DIA do Modo Viagem (lugares REAIS, estilo app de viagem).
// Busca atrações no destino pelo Google Places (New) conforme os interesses, escolhe as melhores
// (nota × volume de avaliações), agrupa por proximidade e distribui pelos dias com horário sugerido.
// Diferencial nosso: cada dia traz os km de carro e o combustível com o consumo REAL do cliente.
// Sem IA aqui (determinístico e barato): a IA só escreve o texto do plano por cima.
// Custo aproximado por roteiro: 2–3 Text Search (~R$0,19 cada) + fotos (~R$0,04 cada, até 10).

export interface Parada {
  nome: string;
  categoria: string | null;
  nota: number | null;
  avaliacoes: number | null;
  foto: string | null;
  endereco: string | null;
  horario: string | null;        // funcionamento do dia (texto), quando houver
  maps_url: string | null;
  descricao: string | null;
  lat: number | null;
  lng: number | null;
  inicio: string;                // "09:00"
  fim: string;                   // "11:30"
  km_do_anterior: number | null; // estimativa de estrada a partir da parada anterior
}
export interface DiaRoteiro {
  dia: number;
  titulo: string;
  paradas: Parada[];
  km_carro: number;              // total estimado do dia (ida entre paradas)
  combustivel: number | null;    // R$ estimado do dia com o consumo real
  dica: string | null;
}

export const INTERESSES: Record<string, { label: string; queries: string[]; duracaoH: number }> = {
  praia:       { label: "Praia e natureza",   queries: ["melhores praias em {d}", "cachoeiras e trilhas em {d}", "mirantes em {d}"], duracaoH: 3 },
  gastronomia: { label: "Gastronomia",        queries: ["melhores restaurantes em {d}", "comida típica em {d}"], duracaoH: 1.5 },
  cultura:     { label: "Cultura e história", queries: ["pontos turísticos históricos em {d}", "museus e centro histórico em {d}"], duracaoH: 1.5 },
  aventura:    { label: "Aventura",           queries: ["trilhas e passeios de aventura em {d}", "passeio de barco em {d}"], duracaoH: 3 },
  familia:     { label: "Com crianças",       queries: ["passeios para crianças em {d}", "parques e aquários em {d}"], duracaoH: 2 },
  descanso:    { label: "Descanso",           queries: ["lugares tranquilos para relaxar em {d}", "pôr do sol em {d}"], duracaoH: 2 },
};
const PADRAO = ["praia", "cultura", "gastronomia"];

export function normalizarInteresses(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : String(raw || "").split(/[,;/]/);
  const out: string[] = [];
  for (const x of arr) {
    const s = String(x || "").toLowerCase().trim();
    if (!s) continue;
    const k = Object.keys(INTERESSES).find((key) => s.includes(key) || INTERESSES[key].label.toLowerCase().includes(s))
      || (/natureza|cachoeira|trilha|mar|sol/.test(s) ? "praia" : /comida|restaurante|gastro/.test(s) ? "gastronomia" : /hist|museu|igreja|cultura/.test(s) ? "cultura" : /crian|fam[ií]lia|kids/.test(s) ? "familia" : /relax|descans|sossego/.test(s) ? "descanso" : /radical|aventura|barco|mergulho/.test(s) ? "aventura" : null);
    if (k && !out.includes(k)) out.push(k);
  }
  return out.length ? out.slice(0, 3) : PADRAO;
}

type Lugar = Omit<Parada, "inicio" | "fim" | "km_do_anterior"> & { id: string; score: number; interesse: string };

async function textSearch(apiKey: string, textQuery: string, max = 8): Promise<any[]> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.editorialSummary,places.photos,places.regularOpeningHours.weekdayDescriptions,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery, languageCode: "pt-BR", regionCode: "BR", maxResultCount: max }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) { console.error("places roteiro", res.status, (await res.text()).slice(0, 160)); return []; }
    return (await res.json())?.places || [];
  } catch (e) { console.error("places roteiro:", String((e as any)?.message || e).slice(0, 160)); return []; }
}

// URL da foto SEM a chave (skipHttpRedirect devolve a URL pública do googleusercontent)
async function fotoUrl(apiKey: string, photoName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=900&skipHttpRedirect=true&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json())?.photoUri || null;
  } catch { return null; }
}

export async function buscarAtracoes(apiKey: string, destino: string, interesses: string[], maxFotos = 10): Promise<Lugar[]> {
  const queries: { q: string; interesse: string }[] = [];
  for (const k of interesses) for (const q of INTERESSES[k].queries.slice(0, 2)) queries.push({ q: q.replace("{d}", destino), interesse: k });
  if (!queries.some((x) => /pontos tur/i.test(x.q))) queries.push({ q: `pontos turísticos em ${destino}`, interesse: interesses[0] });
  const resultados = await Promise.all(queries.slice(0, 5).map((x) => textSearch(apiKey, x.q).then((places) => places.map((p) => ({ p, interesse: x.interesse })))));
  const vistos = new Set<string>();
  const lugares: Lugar[] = [];
  for (const { p, interesse } of resultados.flat()) {
    const id = String(p?.id || "");
    if (!id || vistos.has(id)) continue;
    const nota = typeof p?.rating === "number" ? p.rating : null;
    const avals = typeof p?.userRatingCount === "number" ? p.userRatingCount : 0;
    if (nota != null && nota < 4.0) continue;            // só lugar bem avaliado
    if (avals < 30) continue;                             // volume mínimo pra confiar na nota
    vistos.add(id);
    lugares.push({
      id, interesse,
      nome: p?.displayName?.text || "", categoria: p?.primaryTypeDisplayName?.text || INTERESSES[interesse]?.label || null,
      nota, avaliacoes: avals, foto: p?.photos?.[0]?.name || null,
      endereco: p?.formattedAddress || null,
      horario: Array.isArray(p?.regularOpeningHours?.weekdayDescriptions) ? p.regularOpeningHours.weekdayDescriptions[0] || null : null,
      maps_url: p?.googleMapsUri || null,
      descricao: p?.editorialSummary?.text || null,
      lat: p?.location?.latitude ?? null, lng: p?.location?.longitude ?? null,
      score: (nota || 4) * Math.log10(avals + 10),
    });
  }
  lugares.sort((a, b) => b.score - a.score);
  // fotos só pros melhores (custo): a URL pública não carrega a chave
  const top = lugares.slice(0, maxFotos);
  await Promise.all(top.map(async (l) => { l.foto = l.foto ? await fotoUrl(apiKey, l.foto) : null; }));
  for (const l of lugares.slice(maxFotos)) l.foto = null;
  return lugares;
}

const toRad = (x: number) => (x * Math.PI) / 180;
function km(a: { lat: number | null; lng: number | null }, b: { lat: number | null; lng: number | null }): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3 * 10) / 10; // ×1,3 ≈ estrada vs. linha reta
}
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

// Distribui as atrações pelos dias: escolhe as melhores, encadeia por proximidade (vizinho mais
// próximo) e corta em dias de 3–4 paradas; cada dia alterna interesses pra não virar "só praia".
export function montarDias(
  lugares: Lugar[], dias: number, interesses: string[],
  carro: { custoPorKm: number | null; kml: number | null; precoLitro: number | null },
): DiaRoteiro[] {
  const nDias = Math.max(1, Math.min(7, Math.round(dias) || 2));
  const porDia = nDias <= 2 ? 4 : 3;
  const alvo = Math.min(lugares.length, nDias * porDia);
  if (!alvo) return [];
  // seleção balanceada por interesse (round-robin nas listas ordenadas por score)
  const filas = interesses.map((k) => lugares.filter((l) => l.interesse === k));
  const escolhidos: Lugar[] = [];
  const usados = new Set<string>();
  while (escolhidos.length < alvo) {
    let pegou = false;
    for (const f of filas) { const l = f.find((x) => !usados.has(x.id)); if (l) { usados.add(l.id); escolhidos.push(l); pegou = true; if (escolhidos.length >= alvo) break; } }
    if (!pegou) break;
  }
  for (const l of lugares) { if (escolhidos.length >= alvo) break; if (!usados.has(l.id)) { usados.add(l.id); escolhidos.push(l); } }
  // encadeia por proximidade a partir do melhor
  const ordem: Lugar[] = [escolhidos[0]];
  const resto = escolhidos.slice(1);
  while (resto.length) {
    const atual = ordem[ordem.length - 1];
    let bi = 0, bd = Infinity;
    resto.forEach((l, i) => { const d = km(atual, l) ?? 9999; if (d < bd) { bd = d; bi = i; } });
    ordem.push(resto.splice(bi, 1)[0]);
  }
  const custoKm = carro.custoPorKm && carro.custoPorKm > 0 ? carro.custoPorKm
    : (carro.kml && carro.kml > 0 && carro.precoLitro && carro.precoLitro > 0 ? carro.precoLitro / carro.kml : null);

  const out: DiaRoteiro[] = [];
  for (let d = 0; d < nDias; d++) {
    const fatia = ordem.slice(d * porDia, (d + 1) * porDia);
    if (!fatia.length) break;
    let hora = 9, kmDia = 0, ant: Lugar | null = null;
    const paradas: Parada[] = fatia.map((l) => {
      const dist = ant ? km(ant, l) : null;
      if (dist) { kmDia += dist; hora += Math.min(1.5, dist / 40); } // ~40 km/h em estrada de praia/serra
      const dur = INTERESSES[l.interesse]?.duracaoH ?? 2;
      const inicio = hhmm(hora); hora += dur; const fim = hhmm(hora); hora += 0.25;
      ant = l;
      const { id: _id, score: _s, interesse: _i, ...rest } = l;
      return { ...rest, inicio, fim, km_do_anterior: dist };
    });
    const principal = fatia.map((l) => l.nome).slice(0, 2).join(" e ");
    out.push({
      dia: d + 1, titulo: `Dia ${d + 1} · ${principal}`, paradas,
      km_carro: Math.round(kmDia), combustivel: custoKm ? Math.round(kmDia * custoKm * 100) / 100 : null,
      dica: kmDia > 60 ? "Dia com bastante estrada: abastece antes de sair e confere a calibragem." : null,
    });
  }
  return out;
}
