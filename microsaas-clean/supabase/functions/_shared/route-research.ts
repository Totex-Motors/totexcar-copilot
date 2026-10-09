// TotexCar Co-pilot — pesquisa de rota EM TEMPO REAL (Modo Viagem)
// Usa a busca web da OpenAI (Responses API, ver _shared/websearch.ts) para
// levantar os fatos frescos da rota: distância, pedágios ATUAIS praça a praça, balsa/travessia
// obrigatória (preço e fila), condições da estrada. O texto volta pro compositor do plano
// como FONTE DA VERDADE dos custos de rota — nada de chutar pedágio.
import { openaiWebSearch } from "./websearch.ts";

// Pesquisa AO VIVO de onde ficar e onde comer no destino: hospedagem bem avaliada por faixa
// de preço + restaurantes/bares imperdíveis. Nomes REAIS com reputação atual — nunca inventados.
export async function pesquisarLugares(openaiKey: string, destino: string, perfil?: string): Promise<string | null> {
  if (!openaiKey || !destino) return null;
  const prompt = `Pesquise AGORA na web sobre "${destino}" (Brasil) e responda em português do Brasil, direto e factual${perfil ? `, considerando o perfil de viagem "${perfil}"` : ""}:

1. ONDE FICAR: 4 a 6 hospedagens BEM AVALIADAS atualmente (hotéis/pousadas), separadas por faixa — econômica, intermediária e charme/premium. Para cada uma: nome, bairro/região, por que é boa (nota/reputação). Se encontrar diária aproximada ATUAL, cite; senão, NÃO invente preço.
2. MELHOR REGIÃO pra se hospedar (e qual evitar, se houver).
3. ONDE COMER E BEBER: 4 a 6 restaurantes/bares imperdíveis e bem avaliados, com o prato/experiência típica de cada um.
4. 2-3 passeios/atrações que valem a pena no destino.

Só cite lugares que você ENCONTROU na pesquisa (reputação real) — nada inventado. Cite as fontes no final.`;

  const r = await openaiWebSearch(openaiKey, prompt);
  if (!r.ok) { console.error("pesquisarLugares falhou:", r.status, r.error); return null; }
  return r.text || null;
}

export async function pesquisarRota(openaiKey: string, origem: string, destino: string): Promise<string | null> {
  if (!openaiKey || !destino) return null;
  const prompt = `Pesquise AGORA na web e responda em português do Brasil, direto e factual (sem enrolação), sobre a viagem DE CARRO de "${origem || "São Paulo/SP"}" até "${destino}" (Brasil):

1. MELHOR ROTA e distância total em km (ida), citando as rodovias (ex.: Castello Branco, Tamoios).
2. PEDÁGIOS no trajeto: liste praça a praça com o VALOR ATUAL de cada uma (carro de passeio) e o TOTAL da ida. Se houver tag/pedágio free-flow, cite.
3. BALSA/TRAVESSIA obrigatória ou recomendada no destino (ex.: balsa São Sebastião–Ilhabela): preço ATUAL para carro, se pedestre paga, tempo médio de fila em alta temporada e se dá pra agendar/comprar antecipado (cite o site oficial).
4. Condições/dicas atuais da rota (obras, trechos de serra, neblina, horários a evitar).
5. Estimativa de tempo de viagem (ida).

Se algum valor não for encontrado, diga explicitamente "não encontrei valor atual" — NÃO invente. Cite as fontes no final.`;

  const r = await openaiWebSearch(openaiKey, prompt);
  if (!r.ok) { console.error("pesquisarRota falhou:", r.status, r.error); return null; }
  return r.text || null;
}

// PEDÁGIOS direto do texto da pesquisa (rede de segurança): a IA às vezes deixa a lista vazia mesmo
// com a pesquisa trazendo praça a praça. Lê linhas tipo "- **Osasco** no km 8: R$ 4,20".
export function extrairPedagios(pesquisa: string | null): { praca: string; valor: number }[] {
  if (!pesquisa) return [];
  const bloco = (() => {
    const i = pesquisa.search(/ped[aá]gio/i);
    if (i < 0) return pesquisa;
    const fim = pesquisa.slice(i).search(/\n\s*(\*\*|#+)?\s*3\.|balsa|travessia|tempo de viagem/i);
    return fim > 0 ? pesquisa.slice(i, i + fim) : pesquisa.slice(i);
  })();
  const out: { praca: string; valor: number }[] = [];
  for (const bruta of bloco.split("\n")) {
    const linha = bruta.replace(/\*\*/g, "").replace(/__/g, "");
    if (!/^\s*[-•*\d]/.test(linha) || !/R\$/.test(linha)) continue;
    const m = /R\$\s*([\d.]+,\d{2}|\d+(?:[.,]\d+)?)/i.exec(linha);
    if (!m) continue;
    const antes = linha.slice(0, m.index).replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "");
    const nome = antes.replace(/\s*(?:\(|no km|km\s*\d).*$/i, "").replace(/[\s:–-]+$/, "").trim();
    const valor = Number(m[1].replace(/\./g, "").replace(",", "."));
    if (!nome || !(valor > 0) || valor > 200 || /total/i.test(nome)) continue;
    out.push({ praca: nome, valor: Math.round(valor * 100) / 100 });
  }
  return out.slice(0, 15);
}

// ---- CONSUMO DO VEÍCULO (cadeia de fontes) ----
// real (tanque-a-tanque) > oficial INMETRO (Auto Data: cidade_gasolina/estrada_gasolina/
// referencia_media — ⚠️ NÃO é estrada_kml, bug que deixava o Modo Viagem "sem dados") >
// ficha técnica (texto tipo "18,8 km/L (gasolina)") > estimativa pela categoria.
// Retorna também a FONTE, pra IA sempre dizer de onde veio o número.
export function consumoDoVeiculo(veh: any, realKmL: number | null): { kml: number | null; fonte: string } {
  if (Number(realKmL) > 0) return { kml: Number(realKmL), fonte: "real (medido pelos abastecimentos dele)" };

  const of = veh?.consumo_oficial || {};
  const ficha = veh?.ficha_tecnica || {};
  const fichaKmL = (): number | null => {
    for (const campo of [ficha.consumo_estrada, ficha.consumo_cidade]) {
      const m = String(campo || "").replace(",", ".").match(/(\d+(?:\.\d+)?)\s*km\s*\/?\s*l/i);
      if (m && Number(m[1]) >= 3 && Number(m[1]) <= 30) return Number(m[1]);
    }
    return null;
  };

  // HÍBRIDO/PHEV: o ciclo INMETRO só-combustão SUBESTIMA muito (ex.: Tank 300 PHEV dá 7,6
  // no PBE e ~18,8 no uso real) → pra híbrido, a ficha técnica vem primeiro.
  const hibrido = /phev|h[íi]brid|hev\b/i.test(`${of.match || ""} ${ficha.combustivel || ""} ${veh?.combustivel || ""} ${veh?.modelo || ""}`)
    || Number(of.autonomia_km) > 0;
  if (hibrido) {
    const f = fichaKmL();
    if (f) return { kml: f, fonte: "ficha técnica do modelo (híbrido — o ciclo INMETRO subestima)" };
  }

  const oficial = Number(of.referencia_media) || Number(of.estrada_gasolina) || Number(of.cidade_gasolina)
    || Number(of.estrada_etanol) || Number(of.cidade_etanol)
    || Number(of.estrada_kml) || Number(of.rodovia_kml) || Number(of.cidade_kml); // chaves legadas
  if (oficial > 0) return { kml: oficial, fonte: "oficial INMETRO" };

  // ficha técnica guarda texto ("18,8 km/L (gasolina) / 14,1 km/L (etanol)") → pega o 1º número
  {
    const f = fichaKmL();
    if (f) return { kml: f, fonte: "ficha técnica do modelo" };
  }

  // último recurso: estimativa honesta pela categoria/combustível
  const cat = `${ficha.categoria || ""} ${veh?.modelo || ""}`.toLowerCase();
  const diesel = /diesel/i.test(String(veh?.combustivel || ficha.combustivel || ""));
  let est: number | null = null;
  if (/picape|pickup/.test(cat)) est = diesel ? 10 : 8.5;
  else if (/suv/.test(cat)) est = diesel ? 10.5 : 10;
  else if (/sed[aã]/.test(cat)) est = 12;
  else if (/hatch|compacto/.test(cat)) est = 12.5;
  return est ? { kml: est, fonte: "estimativa pela categoria do carro (aproximada)" } : { kml: null, fonte: "desconhecido" };
}
