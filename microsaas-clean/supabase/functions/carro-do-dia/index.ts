// TotexCar — "CARRO DO DIA" no Canal do WhatsApp, 100% dentro de casa (sem n8n).
//
// O pg_cron chama 2x/dia → a função escolhe um carro do marketplace (rotação: não repete quem
// saiu nos últimos 14 dias; prioriza abaixo da FIPE e recém-chegados) → escreve a legenda no
// estilo da marca (mesmo motor do botão "Post ✨": IA só na parte criativa, preço e link por
// código) → publica FOTO + legenda no Canal via uazapi.
//
// REGRA ALTO-FALANTE vs COFRE: quem posta é o número NÃO-oficial (admin do canal, descartável).
// O número oficial do Co-pilot (Meta) NUNCA toca em API não-oficial.
//
// Config em app_settings (id=1):
//   canal_uazapi_url / canal_uazapi_token → instância uazapi do número que é admin do canal
//   canal_newsletter_id                   → id do canal (xxxxx@newsletter)
//   canal_autopost                        → false = o cron vira no-op (liga quando testar)
//
// Jobs (?job=):  post (padrão, publica e loga em canal_posts) | preview (gera e devolve JSON,
// não publica) | discover (varre endpoints da uazapi atrás do id do canal).  ?car=<id> força carro.
// Protegida por ?secret= (mesmo WEBHOOK_SECRET dos outros crons). Deploy com verify_jwt=false.

const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";
const MKT = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const sbHeaders = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };
async function sbSelect(path: string): Promise<any[]> {
  const res = await fetch(`${SB}/rest/v1/${path}`, { headers: sbHeaders });
  return res.ok ? await res.json() : [];
}
async function sbInsert(table: string, row: unknown): Promise<boolean> {
  const res = await fetch(`${SB}/rest/v1/${table}`, {
    method: "POST", headers: { ...sbHeaders, prefer: "return=minimal" }, body: JSON.stringify(row),
  });
  return res.ok;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// "Honda Civic Civic Sedan EX" → "Honda Civic Sedan EX"
function carNome(v: any): string {
  const brand = String(v?.brand || "").trim(), model = String(v?.model || "").trim(), ver = String(v?.version || "").trim();
  const dup = model && ver.toLowerCase().startsWith(model.toLowerCase());
  return [brand, dup ? "" : model, ver].filter(Boolean).join(" ").trim();
}
const carFoto = (v: any) => {
  const imgs = Array.isArray(v?.images) ? v.images : [];
  return (imgs.find((i: any) => i?.isPrimary) || imgs[0])?.url || "";
};

// mesmo provedor de IA das outras funções (app_settings)
async function aiText(s: any, sys: string, user: string, maxTokens = 600): Promise<string> {
  const provider = s?.ai_provider || "anthropic";
  const model = s?.ai_model || "claude-opus-4-8";
  const key = provider === "openai" ? s?.openai_api_key : provider === "gemini" ? s?.gemini_api_key : s?.anthropic_api_key;
  if (!key) throw new Error("ai_key_not_configured");
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    return ((await res.json()).choices?.[0]?.message?.content || "").trim();
  }
  if (provider === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: user }] }] }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    return (((await res.json()).candidates?.[0]?.content?.parts || []).map((x: any) => x.text).join("") || "").trim();
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  return (((await res.json()).content || []).find((b: any) => b.type === "text")?.text || "").trim();
}

const codeAlfabeto = "abcdefghijklmnopqrstuvwxyz0123456789";
const novoCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => codeAlfabeto[b % 36]).join("");
async function ofertaCode(carId: string): Promise<string | null> {
  const ex = await sbSelect(`oferta_links?car_id=eq.${encodeURIComponent(carId)}&select=code&limit=1`);
  if (ex?.[0]?.code) return ex[0].code;
  for (let i = 0; i < 4; i++) {
    const code = novoCode();
    if (await sbInsert("oferta_links", { code, car_id: carId })) return code;
  }
  return null;
}

// legenda estilo Lu — idêntica ao botão "Post ✨" do painel (abertura sorteada + contextualizada;
// a IA nunca vê o preço; linha com R$ escrita pela IA é descartada)
async function montaPost(settings: any, v: any): Promise<{ post: string; preco: string | null; link: string; foto: string }> {
  const nome = carNome(v) || "esse carro";
  const nomeAno = `${nome}${v.year ? ` ${v.year}` : ""}`;
  const precoNum = Number(v.price);
  const preco = precoNum > 0 ? `R$ ${precoNum.toLocaleString("pt-BR")}` : "";
  const loja = v?.dealership?.name || "";
  const appUrl = (settings?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
  const code = await ofertaCode(String(v.id));
  const link = code ? `${appUrl}/o/${code}` : `${SB}/functions/v1/oferta?c=${encodeURIComponent(String(v.id))}`;

  const fatos: string[] = [`Carro: ${nomeAno}`];
  if (Number(v.mileage) > 0) fatos.push(`Quilometragem: ${Number(v.mileage).toLocaleString("pt-BR")} km`);
  if (v.transmission) fatos.push(`Câmbio: ${v.transmission}`);
  if (v.fuel || v.fuelType) fatos.push(`Combustível: ${v.fuel || v.fuelType}`);
  if (v.color) fatos.push(`Cor: ${v.color}`);
  const fipeNum = Number(v.fipePrice);
  const abaixoFipe = fipeNum > 0 && precoNum > 0 && precoNum < fipeNum;
  if (abaixoFipe) fatos.push("Está anunciado ABAIXO da tabela FIPE");

  const aberturas = [
    `humor de assistente/robô, como a Lu do Magalu (ex.: "Meus sensores detectaram nível MÁXIMO de carro dos sonhos! 🤖")`,
    `radar de oportunidade apitando (ex.: "Meu radar de oportunidade apitou agora há pouco... 🚨")`,
    `pergunta emocional que conecta com o sonho (ex.: "Sabe aquele sonho de subir num SUV potente e só dirigir?")`,
    `celebração de recém-chegado (ex.: "Acabou de estacionar no estoque e já está roubando a cena! ✨")`,
    `provocação amiga de urgência (ex.: "Se você piscar, esse aqui vai embora...")`,
    `convite de amigo próximo contando novidade (ex.: "Chega mais, que hoje a novidade é daquelas! 😍")`,
    `"algoritmo aprovou" (ex.: "Meu algoritmo da felicidade aprovou esse aqui com nota 10! ✅")`,
    `cena do dia a dia com o carro (ex.: "Imagina chegar na sexta, entrar nele e esquecer a semana...")`,
  ];
  const abertura = aberturas[Math.floor(Math.random() * aberturas.length)];

  const sys = `Você é a alma da TotexMotors! Seu estilo é inspirado na Lu do Magalu: sempre útil, muito animada, `
    + `usa emojis de forma inteligente e trata o cliente como um amigo próximo. Você não vende só carros; vende a `
    + `realização de um sonho e a segurança de uma grande marca.\n\n`
    + `Escreva SÓ o corpo criativo de um post de Canal do WhatsApp sobre o carro dos FATOS, exatamente nesta estrutura `
    + `(sem preço, sem link, sem hashtags — o sistema completa depois):\n`
    + `- 1 linha de abertura magnética NESTE ângulo (crie a sua, não copie o exemplo; PROIBIDO usar "para tudo" ou "olha essa nave"): ${abertura}\n`
    + `  A abertura DEVE ser contextualizada NESTE carro específico — pense no perfil dele (SUV híbrido premium = sofisticação, `
    + `silêncio, economia; picape = trabalho e força; hatch = cidade e economia; esportivo = emoção) e escreva algo que SÓ faria `
    + `sentido pra esse carro. PROIBIDO frase genérica que serviria pra qualquer produto ou fora do universo automotivo `
    + `(ex.: "tecnologia na palma da sua mão").\n`
    + `- 1 a 2 linhas apresentando o carro com entusiasmo (modelo e ano)\n`
    + `- a linha "Confira por que ele vai ser seu:" seguida de 3 itens começando com ✅, cada um transformando um fato `
    + `em benefício real (ex.: câmbio automático → conforto total no trânsito)\n`
    + `- 1 linha final: toda a confiança da TotexMotors com a tradição da ${loja || "loja parceira"} 💎\n\n`
    + `REGRAS DURAS: use SOMENTE os fatos fornecidos — NUNCA invente motor, equipamento, consumo ou qualquer número. `
    + `Se faltar fato técnico, os ✅ podem falar de procedência verificada, atendimento premium e de ver tudo pelo WhatsApp. `
    + `NUNCA mencione preço nem valores em R$. Responda SOMENTE com o texto do post.`;

  let corpo = "";
  try { corpo = await aiText(settings, sys, `FATOS DO ANÚNCIO:\n${fatos.join("\n")}`); } catch (e) { console.error("carro-do-dia ai:", e); }
  corpo = corpo.split("\n").filter((l) => !/R\$\s*\d/.test(l)).join("\n").trim();

  if (!corpo) {
    const bullets: string[] = [];
    if (abaixoFipe) bullets.push("✅ Anunciado ABAIXO da tabela FIPE — oportunidade de verdade");
    if (Number(v.mileage) > 0) bullets.push(`✅ ${Number(v.mileage).toLocaleString("pt-BR")} km — ainda tem muita estrada boa pela frente`);
    if (v.transmission && /auto/i.test(String(v.transmission))) bullets.push("✅ Câmbio automático: conforto total no trânsito de todo dia");
    bullets.push("✅ Procedência verificada e atendimento premium", "✅ Você vê tudo pelo WhatsApp, sem sair de casa");
    const fixas = [
      "Meus sensores detectaram nível máximo de carro dos sonhos! 🤖",
      "Meu radar de oportunidade acabou de apitar! 🚨",
      "Acabou de estacionar no estoque e já está roubando a cena! ✨",
      "Se você piscar, esse aqui vai embora... 👀",
    ];
    corpo = `${fixas[Math.floor(Math.random() * fixas.length)]}\n`
      + `Chegou ${nomeAno} no nosso estoque — daqueles que não ficam parados na vitrine!\n\n`
      + `Confira por que ele vai ser seu:\n${bullets.slice(0, 3).join("\n")}\n\n`
      + `Toda a confiança da TotexMotors com a tradição da ${loja || "nossa loja parceira"}! 💎`;
  }

  const marcaTag = v.brand ? ` #${String(v.brand).replace(/[^\p{L}\p{N}]/gu, "")}` : "";
  const chamadas = ["Não perde tempo, gente!", "Corre, que carro bom é peça única!", "Quem vê primeiro, leva!", "Bora ver de pertinho?"];
  const post = corpo
    + (preco ? `\n\n💰 Por apenas: ${preco}` : "")
    + `\n\n${chamadas[Math.floor(Math.random() * chamadas.length)]} Toca no link e é só apertar *enviar* na mensagem que já vem prontinha — te mostro tudo desse carro no WhatsApp 😉\n👉 ${link}`
    + `\n\n#TotexMotors #CarroDosSonhos #OfertaDaSemana${marcaTag}`;
  return { post, preco: preco || null, link, foto: carFoto(v) };
}

// escolhe o carro do dia: nunca repete os últimos 14 dias; abaixo da FIPE e recém-chegado na frente
async function escolheCarro(forcarId?: string): Promise<any | null> {
  if (forcarId) {
    try {
      const res = await fetch(`${MKT}/api/vehicles/${encodeURIComponent(forcarId)}`, { headers: { Accept: "application/json" } });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }
  let lote: any[] = [];
  try {
    const res = await fetch(`${MKT}/api/vehicles?limit=200`, { headers: { Accept: "application/json" } });
    const d = await res.json();
    lote = Array.isArray(d?.data) ? d.data : [];
  } catch { return null; }
  const desde = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
  const recentes = await sbSelect(`canal_posts?posted_at=gte.${desde}&select=car_id`);
  const jaPostados = new Set(recentes.map((r: any) => r.car_id));
  let cands = lote.filter((v: any) => v?.id && Number(v.price) > 0 && carFoto(v));
  const novos = cands.filter((v: any) => !jaPostados.has(v.id));
  if (novos.length) cands = novos; // se o estoque inteiro já rodou, recomeça a rotação
  const semanaAtras = Date.now() - 7 * 24 * 3600_000;
  let melhor: any = null, melhorScore = -1;
  for (const v of cands) {
    const abaixoFipe = Number(v.fipePrice) > 0 && Number(v.price) < Number(v.fipePrice);
    const recem = v.createdAt && new Date(v.createdAt).getTime() > semanaAtras;
    const score = (abaixoFipe ? 2 : 0) + (recem ? 1 : 0) + Math.random();
    if (score > melhorScore) { melhorScore = score; melhor = v; }
  }
  return melhor;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (WEBHOOK_SECRET && url.searchParams.get("secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const job = (url.searchParams.get("job") || "post").toLowerCase();

  const cfg = (await sbSelect(
    "app_settings?id=eq.1&select=app_url,ai_provider,ai_model,anthropic_api_key,openai_api_key,gemini_api_key,canal_uazapi_url,canal_uazapi_token,canal_newsletter_id,canal_autopost&limit=1",
  ))?.[0] || {};
  const uazUrl = String(cfg.canal_uazapi_url || "").replace(/\/+$/, "");
  const uazToken = String(cfg.canal_uazapi_token || "");

  // DESCOBERTA do id do canal: varre endpoints candidatos da uazapi e devolve o que respondeu
  if (job === "discover") {
    if (!uazUrl || !uazToken) return json({ error: "canal_uazapi_url/token não configurados" }, 400);
    const tentativas: { método: string; path: string; status: number | string; corpo: string }[] = [];
    const candidatos: [string, string, unknown?][] = [
      ["GET", "/newsletter"], ["GET", "/newsletter/list"], ["POST", "/newsletter/list", {}],
      ["GET", "/chats?limit=200"], ["POST", "/chat/find", { limit: 200 }],
    ];
    for (const [metodo, path, body] of candidatos) {
      try {
        const res = await fetch(`${uazUrl}${path}`, {
          method: metodo, headers: { "content-type": "application/json", token: uazToken },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const texto = (await res.text()).slice(0, 4000);
        tentativas.push({ método: metodo, path, status: res.status, corpo: texto });
      } catch (e) { tentativas.push({ método: metodo, path, status: "erro", corpo: String(e) }); }
    }
    return json({ dica: "procure o id terminado em @newsletter do canal Totex Motors", tentativas });
  }

  // escolhe o carro e monta o post (preview e post compartilham isso)
  const carro = await escolheCarro(url.searchParams.get("car") || undefined);
  if (!carro) return json({ error: "sem_carro_elegivel" }, 404);
  const gerado = await montaPost(cfg, carro);
  const resumo = { carro: `${carNome(carro)} ${carro.year || ""}`.trim(), car_id: carro.id, ...gerado };

  if (job === "preview") return json({ ok: true, preview: true, ...resumo });

  // POST de verdade: exige config completa + autopost ligado (cron roda sempre; aqui é o portão)
  if (!cfg.canal_autopost) return json({ ok: true, skipped: "canal_autopost desligado", ...resumo });
  if (!uazUrl || !uazToken || !cfg.canal_newsletter_id) {
    return json({ ok: false, error: "uazapi/newsletter não configurados", ...resumo }, 400);
  }
  let ok = false, detalhe = "";
  try {
    const res = await fetch(`${uazUrl}/send/media`, {
      method: "POST", headers: { "content-type": "application/json", token: uazToken },
      body: JSON.stringify({ number: cfg.canal_newsletter_id, type: "image", file: gerado.foto, text: gerado.post }),
    });
    detalhe = (await res.text()).slice(0, 1000);
    ok = res.ok;
  } catch (e) { detalhe = String(e); }
  await sbInsert("canal_posts", { car_id: carro.id, code: gerado.link.split("/o/")[1] || null, ok, raw: { detalhe: detalhe.slice(0, 500) } });
  console.log(`carro-do-dia: ${ok ? "publicado" : "FALHOU"} — ${resumo.carro} — ${detalhe.slice(0, 200)}`);
  return json({ ok, detalhe, ...resumo }, ok ? 200 : 502);
});
