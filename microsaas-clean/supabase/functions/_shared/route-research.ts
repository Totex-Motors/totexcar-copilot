// TotexCar Co-pilot — pesquisa de rota EM TEMPO REAL (Modo Viagem)
// Usa o gpt-4o-search-preview (OpenAI com busca web embutida, mesmo motor do car-spec) para
// levantar os fatos frescos da rota: distância, pedágios ATUAIS praça a praça, balsa/travessia
// obrigatória (preço e fila), condições da estrada. O texto volta pro compositor do plano
// como FONTE DA VERDADE dos custos de rota — nada de chutar pedágio.

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
