// RESPOSTA DE TEXTO DA IA, sem ferramentas — pra quem não passa pelo agente completo (ex.: lead sem cadastro
// no meio da ficha de venda). Usa o provedor/modelo configurado em app_settings. Lança erro se a IA não responder.
export async function iaTexto(sb: any, sys: string, user: string, maxTokens = 500): Promise<string> {
  const { data: s } = await sb.from("app_settings").select("ai_provider, ai_model, openai_api_key, anthropic_api_key, gemini_api_key").eq("id", 1).single();
  const provider = s?.ai_provider || "anthropic";
  const model = s?.ai_model || (provider === "openai" ? "gpt-4o" : provider === "gemini" ? "gemini-2.5-flash" : "claude-opus-4-8");
  const key = provider === "openai" ? s?.openai_api_key : provider === "gemini" ? s?.gemini_api_key : s?.anthropic_api_key;
  if (!key) throw new Error("ia_nao_configurada");
  const ctrl = AbortSignal.timeout(25_000);
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${key}` }, signal: ctrl,
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    return (await res.json()).choices?.[0]?.message?.content?.trim() || "";
  }
  if (provider === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctrl,
      body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: user }] }] }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    return ((await res.json()).candidates?.[0]?.content?.parts?.map((x: any) => x.text).join("") || "").trim();
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, signal: ctrl,
    body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  return (((await res.json()).content || []).find((b: any) => b.type === "text")?.text || "").trim();
}
