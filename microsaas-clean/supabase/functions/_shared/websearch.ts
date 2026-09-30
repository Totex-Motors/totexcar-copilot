// Busca web da OpenAI via Responses API + ferramenta web_search.
// Substitui o antigo gpt-4o-search-preview (chat/completions), DESCONTINUADO pela OpenAI em 2025
// (retornava 404 model_not_found → toda busca voltava vazia). Motor do Radar de Serviços,
// Modo Viagem e ficha técnica (car-spec).
export async function openaiWebSearch(
  openaiKey: string,
  prompt: string,
  model = "gpt-4o-mini",
): Promise<{ ok: boolean; text: string; status?: number; error?: string }> {
  if (!openaiKey || !prompt) return { ok: false, text: "", error: "sem_chave_ou_prompt" };
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model, tools: [{ type: "web_search" }], input: prompt }),
    });
    if (!res.ok) return { ok: false, text: "", status: res.status, error: (await res.text()).slice(0, 200) };
    const d = await res.json();
    let text: string = typeof d?.output_text === "string" ? d.output_text : "";
    if (!text) {
      for (const it of (d?.output || [])) {
        if (it?.type === "message") for (const c of (it?.content || [])) if (c?.type === "output_text" && c?.text) text += c.text;
      }
    }
    return { ok: true, text: text.trim() };
  } catch (e) {
    return { ok: false, text: "", error: String((e as any)?.message || e) };
  }
}
