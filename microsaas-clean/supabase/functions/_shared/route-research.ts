// TotexCar Co-pilot — pesquisa de rota EM TEMPO REAL (Modo Viagem)
// Usa o gpt-4o-search-preview (OpenAI com busca web embutida, mesmo motor do car-spec) para
// levantar os fatos frescos da rota: distância, pedágios ATUAIS praça a praça, balsa/travessia
// obrigatória (preço e fila), condições da estrada. O texto volta pro compositor do plano
// como FONTE DA VERDADE dos custos de rota — nada de chutar pedágio.

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
      console.error("pesquisarLugares falhou:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const d = await res.json();
    return d?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("pesquisarLugares erro:", e);
    return null;
  }
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
      console.error("pesquisarRota falhou:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const d = await res.json();
    const texto = d?.choices?.[0]?.message?.content?.trim() || "";
    return texto || null;
  } catch (e) {
    console.error("pesquisarRota erro:", e);
    return null;
  }
}
