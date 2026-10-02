// TotexCar — "CARRO DO DIA" no Canal do WhatsApp, 100% dentro de casa (sem n8n).
//
// O pg_cron chama 4x/dia (9h, 12h, 16h e 19h BRT) → a função escolhe um carro do marketplace (rotação: não repete quem
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
//
// STATUS (stories) DO WHATSAPP PESSOAL DO DONO — ?job=status [&tema=fipe] [&car=<id>] [&preview=1]
//   status_uazapi_url / status_uazapi_token → instância uazapi SÓ do Status (nunca envia mensagem;
//     o webhook dessa instância fica apagado e nenhuma função de envio enxerga esses campos)
//   status_dealership_id                   → só carros desta loja (Cardoso Veículos)
//   status_autopost                        → false = cron vira no-op
//   Publica a foto do carro com legenda curta (limite do Status: 656 caracteres) via /send/status.
//   Rotação própria (canal_posts.raw.tipo = "status"), 14 dias sem repetir. Cron: 10h e 18h BRT.

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
async function montaPost(settings: any, v: any, temaFipe = false, vouched = false): Promise<{ post: string; preco: string | null; link: string; foto: string }> {
  const nome = carNome(v) || "esse carro";
  const nomeAno = `${nome}${v.year ? ` ${v.year}` : ""}`;
  const precoNum = Number(v.price);
  const preco = precoNum > 0 ? `R$ ${precoNum.toLocaleString("pt-BR")}` : "";
  const loja = v?.dealership?.name || "";
  const appUrl = (settings?.app_url || "https://co-pilot.totexmotors.com").replace(/\/+$/, "");
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
  // no tema "Abaixo da FIPE" (19h) a abertura é sempre de oportunidade/urgência — é o post-hábito do canal
  const pool = temaFipe && abaixoFipe ? [aberturas[1], aberturas[4]] : aberturas;
  const abertura = pool[Math.floor(Math.random() * pool.length)];
  const nBullets = 3 + Math.floor(Math.random() * 3); // 3, 4 ou 5 — varia o tamanho da lista

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
    + `- pule UMA linha em branco e escreva 1 a 2 linhas apresentando o carro com entusiasmo (modelo e ano)\n`
    + `- a linha "Confira por que ele vai ser seu:" seguida de EXATAMENTE ${nBullets} itens começando com ✅ (um por linha). `
    + `MISTURE tipos diferentes — nunca só os fatos secos — e VARIE a cada post:\n`
    + `   • FATO vira benefício (use só o que aparece nos FATOS): câmbio, flex, km baixo, cor, abaixo da FIPE;\n`
    + `   • DESEJO/EMOÇÃO/METÁFORA: presença que chama atenção no semáforo, o prazer de dirigir, a viagem em família do Sul ao Norte sem medo, chegar com estilo, "foto não faz jus, ao vivo é outra conversa";\n`
    + (vouched
        ? `   • ESTADO (o lojista GARANTIU pessoalmente o estado deste carro): pode afirmar com vivacidade — pintura impecável de espelho, interior preservado e cheiroso, conservação acima da média.\n`
        : `   • ESTADO/CONSERVAÇÃO: fale SEMPRE como CONVITE, nunca como afirmação ("vem ver de pertinho que impressiona", "ao vivo é outra conversa", "bora conferir a lataria?"). É PROIBIDO afirmar pintura/interior/conservação como fato — você não viu este carro.\n`)
    + `- 1 linha final: toda a confiança da TotexMotors com a tradição da ${loja || "loja parceira"} 💎\n\n`
    + `REGRAS DURAS: use SOMENTE os fatos fornecidos — NUNCA invente motor, equipamento, consumo, potência ou qualquer número. `
    + `NUNCA mencione preço nem valores em R$. Responda SOMENTE com o texto do post.`;

  let corpo = "";
  try { corpo = await aiText(settings, sys, `FATOS DO ANÚNCIO:\n${fatos.join("\n")}`); } catch (e) { console.error("carro-do-dia ai:", e); }
  corpo = corpo.split("\n").filter((l) => !/R\$\s*\d/.test(l)).join("\n").trim();

  if (!corpo) {
    // banco de ✅ pro fallback sem IA: fatos reais + emoção/convite (embaralha e pega nBullets)
    const bullets: string[] = [];
    if (abaixoFipe) bullets.push("✅ Anunciado ABAIXO da tabela FIPE — oportunidade de verdade");
    if (Number(v.mileage) > 0) bullets.push(`✅ ${Number(v.mileage).toLocaleString("pt-BR")} km — ainda tem muita estrada boa pela frente`);
    if (v.transmission && /auto/i.test(String(v.transmission))) bullets.push("✅ Câmbio automático: conforto total no trânsito de todo dia");
    if (v.fuel || v.fuelType) bullets.push("✅ Flex: você escolhe gasolina ou etanol, sempre economizando");
    const evocativos = [
      "✅ Presença de sobra: chega no lugar e todo mundo olha",
      "✅ Pronto pra estrada: do Sul ao Norte sem pensar duas vezes",
      "✅ Feito pra família: espaço e conforto pra viagem inteira",
      "✅ Foto não faz jus — ao vivo é outra conversa, vem ver de pertinho",
      vouched ? "✅ Conservação acima da média: pintura de espelho e interior preservado" : "✅ Vem conferir a lataria de pertinho que impressiona",
      "✅ Aquele friozinho de dar a volta no quarteirão só pra dirigir mais um pouco",
    ];
    for (let i = evocativos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [evocativos[i], evocativos[j]] = [evocativos[j], evocativos[i]]; }
    bullets.push("✅ Procedência verificada e atendimento premium", ...evocativos);
    const fixas = [
      "Meus sensores detectaram nível máximo de carro dos sonhos! 🤖",
      "Meu radar de oportunidade acabou de apitar! 🚨",
      "Acabou de estacionar no estoque e já está roubando a cena! ✨",
      "Se você piscar, esse aqui vai embora... 👀",
    ];
    corpo = `${fixas[Math.floor(Math.random() * fixas.length)]}\n\n`
      + `Chegou ${nomeAno} no nosso estoque — daqueles que não ficam parados na vitrine!\n\n`
      + `Confira por que ele vai ser seu:\n${bullets.slice(0, nBullets).join("\n")}\n\n`
      + `Toda a confiança da TotexMotors com a tradição da ${loja || "nossa loja parceira"}! 💎`;
  }

  const marcaTag = v.brand ? ` #${String(v.brand).replace(/[^\p{L}\p{N}]/gu, "")}` : "";
  const chamadas = ["Não perde tempo, gente!", "Corre, que carro bom é peça única!", "Quem vê primeiro, leva!", "Bora ver de pertinho?"];
  // selo do post das 19h: números REAIS do anúncio (preço e FIPE vêm do marketplace)
  const selo = temaFipe && abaixoFipe ? `🔥 *ABAIXO DA FIPE* — a oportunidade do dia\n\n` : "";
  const linhaFipe = temaFipe && abaixoFipe
    ? `\n📉 Tabela FIPE: R$ ${fipeNum.toLocaleString("pt-BR")} — você paga *R$ ${(fipeNum - precoNum).toLocaleString("pt-BR")} abaixo*`
    : "";
  const post = selo + corpo
    + (preco ? `\n\n💰 Por apenas: ${preco}${linhaFipe}` : "")
    + `\n\n${chamadas[Math.floor(Math.random() * chamadas.length)]} Toca no link e é só apertar *enviar* na mensagem que já vem prontinha — te mostro tudo desse carro no WhatsApp 😉\n👉 ${link}`
    + `\n\n#TotexMotors #CarroDosSonhos #OfertaDaSemana${temaFipe && abaixoFipe ? " #AbaixoDaFipe" : ""}${marcaTag}`;
  return { post, preco: preco || null, link, foto: carFoto(v) };
}

// candidatos do dia, ranqueados: nunca repete os últimos 14 dias; abaixo da FIPE e recém-chegado
// na frente. Devolve uma lista — se a foto do 1º estiver morta, o post tenta o próximo.
// categoria de carroceria (compacto) — pra casar carro↔grupo temático da Comunidade
const CAT_KW: Record<string, string[]> = {
  suv: ["cross", "rav4", "sw4", "compass", "renegade", "commander", "tracker", "trailblazer", "creta", "tucson", "kicks", "captur", "duster", "t-cross", "tcross", "taos", "tiguan", "nivus", "pulse", "territory", "ecosport", "hr-v", "hrv", "cr-v", "crv", "wr-v", "wrv", "asx", "outlander", "haval", "evoque", "xc40", "xc60", "xc90", "2008", "3008", "seltos", "sportage", "sorento", "q3", "q5", "corolla cross", "suv"],
  picape: ["saveiro", "strada", "toro", "hilux", "ranger", "s10", "s-10", "amarok", "frontier", "l200", "triton", "montana", "oroch", "maverick", "courier", "ram", "gladiator", "picape", "pick-up", "pickup"],
  sedan: ["onix plus", "hb20s", "civic", "corolla", "sentra", "versa", "virtus", "jetta", "passat", "cruze", "prisma", "cronos", "siena", "logan", "fluence", "cerato", "elantra", "voyage", "cobalt", "sedan"],
  hatch: ["onix", "hb20", " gol", "up!", "polo", "fox", "golf", "argo", "mobi", "uno", "palio", "punto", "208", "207", "c3", "kwid", "sandero", "i30", "etios", "yaris", "fit", "hatch", "ka ", "fiesta", "focus"],
};
function catDe(v: any): string | null {
  const bt = String(v?.bodyType || v?.body || v?.category || "").toLowerCase();
  if (/suv|utilit/.test(bt)) return "suv";
  if (/picap|pick/.test(bt)) return "picape";
  if (/sed[aã]/.test(bt)) return "sedan";
  if (/hatch/.test(bt)) return "hatch";
  const s = ` ${String(v?.brand || "")} ${String(v?.model || "")} `.toLowerCase();
  for (const cat of ["suv", "picape", "sedan", "hatch"]) {
    if (CAT_KW[cat].some((k) => s.includes(k))) return cat;
  }
  return null;
}

// opts.dealershipId → só carros daquela loja (Status da Cardoso). opts.canal="status" → rotação
// separada da do Canal (um carro pode sair no Canal hoje e no Status amanhã, sem se atrapalharem).
async function escolheCarros(forcarId?: string, temaFipe = false, cats?: string[] | null, opts?: { dealershipId?: string; canal?: "canal" | "status" }): Promise<any[]> {
  if (forcarId) {
    try {
      const res = await fetch(`${MKT}/api/vehicles/${encodeURIComponent(forcarId)}`, { headers: { Accept: "application/json" } });
      const v = res.ok ? await res.json() : null;
      return v?.id ? [v] : [];
    } catch { return []; }
  }
  let lote: any[] = [];
  try {
    const filtroLoja = opts?.dealershipId ? `&dealershipId=${encodeURIComponent(opts.dealershipId)}` : "";
    const res = await fetch(`${MKT}/api/vehicles?limit=500${filtroLoja}`, { headers: { Accept: "application/json" } });
    const d = await res.json();
    lote = Array.isArray(d?.data) ? d.data : [];
  } catch { return []; }
  const desde = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
  const soStatus = opts?.canal === "status";
  const filtroTipo = soStatus ? "&raw->>tipo=eq.status" : "&or=(raw->>tipo.is.null,raw->>tipo.neq.status)";
  const recentes = await sbSelect(`canal_posts?posted_at=gte.${desde}${filtroTipo}&select=car_id`);
  const jaPostados = new Set(recentes.map((r: any) => r.car_id));
  let cands = lote.filter((v: any) => v?.id && Number(v.price) > 0 && carFoto(v));
  if (cats?.length) {
    const soCat = cands.filter((v: any) => cats.includes(catDe(v) as string));
    if (soCat.length) cands = soCat; // sem nenhum do tema, degrada pro estoque geral
  }
  const novos = cands.filter((v: any) => !jaPostados.has(v.id));
  if (novos.length) cands = novos; // se o estoque inteiro já rodou, recomeça a rotação
  if (temaFipe) {
    // post das 19h: só quem está de fato abaixo da tabela; sem nenhum, degrada pro ranking normal
    const soFipe = cands.filter((v: any) => Number(v.fipePrice) > 0 && Number(v.price) < Number(v.fipePrice));
    if (soFipe.length) cands = soFipe;
  }
  const semanaAtras = Date.now() - 7 * 24 * 3600_000;
  const ranqueados = cands.map((v: any) => {
    const abaixoFipe = Number(v.fipePrice) > 0 && Number(v.price) < Number(v.fipePrice);
    const recem = v.createdAt && new Date(v.createdAt).getTime() > semanaAtras;
    return { v, score: (abaixoFipe ? 2 : 0) + (recem ? 1 : 0) + Math.random() };
  }).sort((a: any, b: any) => b.score - a.score);
  return ranqueados.map((r: any) => r.v).slice(0, 5);
}

// a foto está viva? valida na MESMA url que a uazapi vai baixar (weserv devolve o 404 da origem)
const fotoNormalizada = (foto: string) =>
  `https://images.weserv.nl/?url=${encodeURIComponent("ssl:" + foto.replace(/^https?:\/\//i, ""))}&w=1280&output=jpg&q=85`;
async function fotoViva(fotoJpg: string): Promise<boolean> {
  try {
    const res = await fetch(fotoJpg, { headers: { Range: "bytes=0-99" } });
    return res.ok;
  } catch { return false; }
}

// o lojista garantiu pessoalmente o estado deste carro? (marcado no painel → tabela car_vouch)
// enquanto o painel não existe, a tabela fica vazia e isto sempre devolve false (= convite, o padrão)
async function isVouched(carId: string): Promise<boolean> {
  try {
    const r = await sbSelect(`car_vouch?car_id=eq.${encodeURIComponent(carId)}&select=car_id&limit=1`);
    return !!r?.[0];
  } catch { return false; }
}

// POST DE CAPTAÇÃO "quanto vale seu carro" (tema=vale) — não usa carro; dirige pro /vale.
// Alimenta o funil grátis a partir do Canal (topo de funil do playbook).
function montaPostVale(settings: any): { post: string; link: string } {
  const appUrl = (settings?.app_url || "https://co-pilot.totexmotors.com").replace(/\/+$/, "");
  const link = `${appUrl}/vale`;
  const aberturas = [
    "Você sabe QUANTO vale o seu carro hoje? 🤔",
    "Antes de vender ou trocar: descubra o valor real do seu carro 👇",
    "Tá pensando em trocar de carro? Começa sabendo quanto o seu vale 🚗",
    "Curiosidade que vale dinheiro: quanto o seu carro vale na FIPE agora? 💰",
  ];
  const ab = aberturas[Math.floor(Math.random() * aberturas.length)];
  const post = `${ab}\n\nÉ *grátis* e leva 10 segundos: digita a *placa* e o valor na *tabela FIPE* aparece na hora. Sem cadastro.\n\n👉 ${link}\n\nE se quiser, a gente ainda te avisa todo mês se ele valorizar ou cair. 🔔\n\n#TotexMotors #QuantoVale #TabelaFIPE`;
  return { post, link };
}

// LEGENDA DO STATUS (stories): curta, sem IA (o Status some em 24h e o limite é 656 caracteres).
// Quem vê é contato pessoal do dono → tom de dono de loja, não de robô. Preço e link por código.
const STATUS_MAX = 600;
async function montaStatus(settings: any, v: any, temaFipe = false): Promise<{ post: string; preco: string | null; link: string; foto: string }> {
  const nome = carNome(v) || "esse carro";
  const nomeAno = `${nome}${v.year ? ` ${v.year}` : ""}`;
  const precoNum = Number(v.price);
  const preco = precoNum > 0 ? `R$ ${precoNum.toLocaleString("pt-BR")}` : "";
  const fipeNum = Number(v.fipePrice);
  const abaixoFipe = fipeNum > 0 && precoNum > 0 && precoNum < fipeNum;
  const loja = v?.dealership?.name || "Cardoso Veículos";
  const cidade = v?.dealership?.city || v?.city || "";
  const appUrl = (settings?.app_url || "https://co-pilot.totexmotors.com").replace(/\/+$/, "");
  const code = await ofertaCode(String(v.id));
  const link = code ? `${appUrl}/o/${code}` : `${SB}/functions/v1/oferta?c=${encodeURIComponent(String(v.id))}`;

  const specs: string[] = [];
  if (Number(v.mileage) > 0) specs.push(`${Number(v.mileage).toLocaleString("pt-BR")} km`);
  if (v.transmission) specs.push(String(v.transmission));
  if (v.fuel || v.fuelType) specs.push(String(v.fuel || v.fuelType));
  if (v.color) specs.push(String(v.color));

  const recem = v.createdAt && new Date(v.createdAt).getTime() > Date.now() - 7 * 24 * 3600_000;
  const aberturas = temaFipe && abaixoFipe
    ? ["🔥 Abaixo da FIPE na loja hoje", "🚨 Oportunidade do dia na Cardoso", "📉 Esse está abaixo da tabela"]
    : recem
      ? ["✨ Acabou de chegar na loja", "🆕 Novidade no estoque da Cardoso", "🚗 Chegou hoje e já está na vitrine"]
      : ["🚗 Olha esse que está na loja", "👀 Destaque do estoque da Cardoso", "💎 Carro bom pra quem vê primeiro"];
  const ab = aberturas[Math.floor(Math.random() * aberturas.length)];
  const linhaFipe = abaixoFipe ? `\n📉 FIPE R$ ${fipeNum.toLocaleString("pt-BR")} — R$ ${(fipeNum - precoNum).toLocaleString("pt-BR")} abaixo` : "";

  let post = `${ab}\n\n*${nomeAno}*`
    + (specs.length ? `\n${specs.join(" · ")}` : "")
    + (preco ? `\n\n💰 ${preco}${linhaFipe}` : "")
    + `\n📍 ${loja}${cidade ? ` · ${cidade}` : ""}`
    + `\n\nQuer ver mais fotos ou agendar uma visita? Toca no link que eu te atendo no WhatsApp 👇\n${link}`;
  if (post.length > STATUS_MAX) post = post.replace(/\nQuer ver mais fotos[^\n]*\n/, "\n👇 ");
  return { post, preco: preco || null, link, foto: carFoto(v) };
}

// posta o conteúdo do TEMA num grupo (não-oficial/uazapi). cat: suv|sedan|picape|hatch|oportunidade|vale|radar
async function postaGrupo(cfg: any, uazUrl: string, uazToken: string, waId: string, cat: string): Promise<{ ok: boolean; tipo: string; detalhe: string }> {
  const c = (cat || "").toLowerCase();
  const hdr = { "content-type": "application/json", token: uazToken };

  if (c === "vale") {
    const p = montaPostVale(cfg);
    const r = await fetch(`${uazUrl}/send/text`, { method: "POST", headers: hdr, body: JSON.stringify({ number: waId, text: p.post }) });
    return { ok: r.ok, tipo: "vale", detalhe: (await r.text()).slice(0, 300) };
  }
  if (c === "radar") {
    const txt = `🛠️ *Radar de Serviços TotexMotors*\n\nPrecisa de oficina, guincho, revisão ou troca de óleo? A gente te indica parceiro de confiança, muitos com desconto. É só chamar o Co-pilot 👉 https://wa.me/5511963786699?text=${encodeURIComponent("#com radar")}`;
    const r = await fetch(`${uazUrl}/send/text`, { method: "POST", headers: hdr, body: JSON.stringify({ number: waId, text: txt }) });
    return { ok: r.ok, tipo: "radar", detalhe: (await r.text()).slice(0, 300) };
  }

  // temas de CARRO: escolhe pela categoria e posta 1 carro (imagem)
  const temaFipe = c === "oportunidade" || c === "repasse";
  const cats = c === "suv" ? ["suv", "picape"] : c === "sedan" ? ["sedan", "hatch"] : ["picape", "hatch"].includes(c) ? [c] : null;
  const carros = await escolheCarros(undefined, temaFipe, cats);
  for (const carro of carros) {
    const fotoJpg = fotoNormalizada(carFoto(carro));
    if (!(await fotoViva(fotoJpg))) continue;
    const gerado = await montaPost(cfg, carro, temaFipe, await isVouched(String(carro.id)));
    const r = await fetch(`${uazUrl}/send/media`, { method: "POST", headers: hdr, body: JSON.stringify({ number: waId, type: "image", file: fotoJpg, text: gerado.post }) });
    if (r.ok) { await sbInsert("canal_posts", { car_id: carro.id, code: gerado.link.split("/o/")[1] || null, ok: true, raw: { grupo: waId, cat: c } }); return { ok: true, tipo: `carro:${carNome(carro)}`, detalhe: "" }; }
  }
  return { ok: false, tipo: "carro", detalhe: "sem carro publicável do tema" };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (WEBHOOK_SECRET && url.searchParams.get("secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const job = (url.searchParams.get("job") || "post").toLowerCase();

  const cfg = (await sbSelect(
    "app_settings?id=eq.1&select=app_url,ai_provider,ai_model,anthropic_api_key,openai_api_key,gemini_api_key,canal_uazapi_url,canal_uazapi_token,canal_newsletter_id,canal_autopost,comunidade_grupos,status_uazapi_url,status_uazapi_token,status_autopost,status_dealership_id&limit=1",
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

  // DESCOBERTA dos grupos (@g.us) — pra o dono colar os ids em app_settings.comunidade_grupos[].wa_id
  if (job === "grupos_discover") {
    if (!uazUrl || !uazToken) return json({ error: "canal_uazapi_url/token não configurados" }, 400);
    const tent: { path: string; status: number | string; corpo: string }[] = [];
    const cand: [string, string, unknown?][] = [
      ["GET", "/group/list"], ["GET", "/group/getAllGroups"], ["POST", "/group/list", {}], ["GET", "/chats?limit=300"],
    ];
    for (const [metodo, path, body] of cand) {
      try {
        const res = await fetch(`${uazUrl}${path}`, { method: metodo, headers: { "content-type": "application/json", token: uazToken }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        tent.push({ path, status: res.status, corpo: (await res.text()).slice(0, 3500) });
      } catch (e) { tent.push({ path, status: "erro", corpo: String(e) }); }
    }
    return json({ dica: "pegue o id @g.us de cada grupo e cole em app_settings.comunidade_grupos[].wa_id, com o campo cat (suv|sedan|picape|hatch|oportunidade|vale|radar)", tentativas: tent });
  }

  // AUTO-POST POR GRUPO (não-oficial): posta o conteúdo do tema em cada grupo com wa_id configurado.
  // ?grupo=<id@g.us>&cat=<tema> posta num grupo específico (teste/manual).
  if (job === "grupos") {
    if (!uazUrl || !uazToken) return json({ ok: false, error: "uazapi não configurado" }, 400);
    if (!cfg.canal_autopost) return json({ ok: true, skipped: "canal_autopost desligado" });
    const grupos = Array.isArray(cfg.comunidade_grupos) ? cfg.comunidade_grupos : [];
    const oneGrupo = url.searchParams.get("grupo");
    const oneCat = url.searchParams.get("cat");
    const alvos = oneGrupo
      ? [{ wa_id: oneGrupo, cat: oneCat || "oportunidade", nome: "manual" }]
      : grupos.filter((g: any) => g && g.wa_id).map((g: any) => ({ wa_id: g.wa_id, cat: g.cat || "oportunidade", nome: g.nome || g.wa_id }));
    if (!alvos.length) return json({ ok: true, tema: "grupos", enviados: 0, nota: "nenhum grupo com wa_id em comunidade_grupos (use ?grupo=<id>&cat=<tema> ou preencha o wa_id)" });
    const resultados: any[] = [];
    for (const g of alvos) {
      try { const r = await postaGrupo(cfg, uazUrl, uazToken, g.wa_id, g.cat); resultados.push({ grupo: g.nome, cat: g.cat, ...r }); }
      catch (e) { resultados.push({ grupo: g.nome, ok: false, detalhe: String(e) }); }
    }
    return json({ ok: resultados.some((r) => r.ok), tema: "grupos", enviados: resultados.filter((r) => r.ok).length, resultados });
  }

  const tema = (url.searchParams.get("tema") || "").toLowerCase();

  // STATUS DO WHATSAPP PESSOAL DO DONO — só carros da loja configurada, instância própria do Status.
  if (job === "status") {
    const stUrl = String(cfg.status_uazapi_url || "").replace(/\/+$/, "");
    const stToken = String(cfg.status_uazapi_token || "");
    const lojaId = String(cfg.status_dealership_id || "");
    const preview = url.searchParams.get("preview") === "1";
    const temaFipeSt = tema === "fipe";
    if (!lojaId) return json({ ok: false, error: "status_dealership_id não configurado" }, 400);
    const cands = await escolheCarros(url.searchParams.get("car") || undefined, temaFipeSt, null, { dealershipId: lojaId, canal: "status" });
    if (!cands.length) return json({ ok: false, error: "sem_carro_elegivel_da_loja" }, 404);
    if (preview) {
      const carro = cands[0];
      const g = await montaStatus(cfg, carro, temaFipeSt);
      return json({ ok: true, preview: true, tema: "status", carro: `${carNome(carro)} ${carro.year || ""}`.trim(), car_id: carro.id, loja: carro?.dealership?.name || null, chars: g.post.length, ...g });
    }
    if (!cfg.status_autopost) return json({ ok: true, skipped: "status_autopost desligado" });
    if (!stUrl || !stToken) return json({ ok: false, error: "status_uazapi_url/token não configurados" }, 400);
    const pulados: string[] = [];
    for (const carro of cands) {
      const nomeC = `${carNome(carro)} ${carro.year || ""}`.trim();
      const fotoJpg = fotoNormalizada(carFoto(carro));
      if (!(await fotoViva(fotoJpg))) {
        pulados.push(nomeC);
        await sbInsert("canal_posts", { car_id: carro.id, ok: false, raw: { tipo: "status", detalhe: "foto morta na origem — carro pulado" } });
        continue;
      }
      const g = await montaStatus(cfg, carro, temaFipeSt);
      let ok = false, detalhe = "";
      try {
        const res = await fetch(`${stUrl}/send/status`, {
          method: "POST", headers: { "content-type": "application/json", token: stToken },
          body: JSON.stringify({ type: "image", file: fotoJpg, text: g.post }),
        });
        detalhe = (await res.text()).slice(0, 1000); ok = res.ok;
      } catch (e) { detalhe = String(e); }
      await sbInsert("canal_posts", { car_id: carro.id, code: g.link.split("/o/")[1] || null, ok, raw: { tipo: "status", tema: temaFipeSt ? "fipe" : "dia", detalhe: detalhe.slice(0, 500) } });
      console.log(`carro-do-dia status: ${ok ? "publicado" : "FALHOU"} — ${nomeC} — ${detalhe.slice(0, 200)}`);
      if (ok) return json({ ok, tema: "status", carro: nomeC, car_id: carro.id, pulados, ...g });
      pulados.push(nomeC);
    }
    return json({ ok: false, tema: "status", error: "nenhum candidato publicável", pulados }, 502);
  }

  // tema=vale → post de captação "quanto vale seu carro" (dirige pro /vale). Não depende de carro.
  if (tema === "vale") {
    const p = montaPostVale(cfg);
    if (job === "preview") return json({ ok: true, preview: true, tema: "vale", ...p });
    if (!cfg.canal_autopost) return json({ ok: true, skipped: "canal_autopost desligado" });
    if (!uazUrl || !uazToken || !cfg.canal_newsletter_id) return json({ ok: false, error: "uazapi/newsletter não configurados" }, 400);
    let ok = false, detalhe = "";
    try {
      const res = await fetch(`${uazUrl}/send/text`, {
        method: "POST", headers: { "content-type": "application/json", token: uazToken },
        body: JSON.stringify({ number: cfg.canal_newsletter_id, text: p.post }),
      });
      detalhe = (await res.text()).slice(0, 1000); ok = res.ok;
    } catch (e) { detalhe = String(e); }
    await sbInsert("canal_posts", { car_id: null, ok, raw: { tema: "vale", detalhe: detalhe.slice(0, 500) } });
    console.log(`carro-do-dia tema=vale: ${ok ? "publicado" : "FALHOU"} — ${detalhe.slice(0, 200)}`);
    return json({ ok, tema: "vale", ...p });
  }

  // tema=fipe → o post das 19h ("🔥 Abaixo da FIPE"): seleção e selo próprios
  const temaFipe = tema === "fipe";

  // candidatos ranqueados (preview usa o 1º; post tenta os próximos se a foto estiver morta)
  const candidatos = await escolheCarros(url.searchParams.get("car") || undefined, temaFipe);
  if (!candidatos.length) return json({ error: "sem_carro_elegivel" }, 404);

  if (job === "preview") {
    const carro = candidatos[0];
    const gerado = await montaPost(cfg, carro, temaFipe, await isVouched(String(carro.id)));
    return json({ ok: true, preview: true, carro: `${carNome(carro)} ${carro.year || ""}`.trim(), car_id: carro.id, ...gerado });
  }

  // POST de verdade: exige config completa + autopost ligado (cron roda sempre; aqui é o portão)
  if (!cfg.canal_autopost) return json({ ok: true, skipped: "canal_autopost desligado" });
  if (!uazUrl || !uazToken || !cfg.canal_newsletter_id) {
    return json({ ok: false, error: "uazapi/newsletter não configurados" }, 400);
  }

  const pulados: string[] = [];
  for (const carro of candidatos) {
    const nomeC = `${carNome(carro)} ${carro.year || ""}`.trim();
    // foto validada ANTES de gastar IA — na mesma URL que a uazapi vai baixar (12h de hoje
    // falhou exatamente assim: anúncio com imagem morta na origem → uazapi 404)
    const fotoJpg = fotoNormalizada(carFoto(carro));
    if (!(await fotoViva(fotoJpg))) {
      pulados.push(nomeC);
      await sbInsert("canal_posts", { car_id: carro.id, ok: false, raw: { detalhe: "foto morta na origem — carro pulado" } });
      continue;
    }
    const gerado = await montaPost(cfg, carro, temaFipe, await isVouched(String(carro.id)));
    let ok = false, detalhe = "";
    try {
      const res = await fetch(`${uazUrl}/send/media`, {
        method: "POST", headers: { "content-type": "application/json", token: uazToken },
        body: JSON.stringify({ number: cfg.canal_newsletter_id, type: "image", file: fotoJpg, text: gerado.post }),
      });
      detalhe = (await res.text()).slice(0, 1000);
      ok = res.ok;
    } catch (e) { detalhe = String(e); }
    await sbInsert("canal_posts", { car_id: carro.id, code: gerado.link.split("/o/")[1] || null, ok, raw: { detalhe: detalhe.slice(0, 500) } });
    console.log(`carro-do-dia: ${ok ? "publicado" : "FALHOU"} — ${nomeC} — ${detalhe.slice(0, 200)}`);
    if (ok) return json({ ok, carro: nomeC, car_id: carro.id, pulados, ...gerado });
    pulados.push(nomeC); // envio falhou: tenta o próximo candidato
  }
  return json({ ok: false, error: "nenhum candidato publicável", pulados }, 502);
});
