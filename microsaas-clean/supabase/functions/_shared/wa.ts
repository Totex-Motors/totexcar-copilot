// TotexCar Co-pilot — Transporte de WhatsApp DUAL PROVIDER
// Provider "uazapi" (não-oficial, legado) OU "meta" (API oficial / Cloud API do BM).
// A escolha vem de app_settings.wa_provider — dá pra virar a chave no /admin sem redeploy.
//
// Regra de ouro da API oficial: mensagem INICIADA PELO NEGÓCIO (cron, boas-vindas, campanha)
// só sai por TEMPLATE aprovado no BM. Resposta dentro da janela de 24h (o cliente falou antes)
// pode ser texto livre/interativa. Por isso este módulo expõe:
//   waSendText     → texto livre (usar SÓ em resposta a mensagem do cliente)
//   waSendMenu     → texto + menu interativo (idem, só em resposta)
//   waSendTemplate → template aprovado (usar em TODA mensagem iniciada pelo negócio);
//                    no provider uazapi, renderiza o texto equivalente e envia normal.

export type WaSettings = {
  wa_provider?: string | null;          // "uazapi" (default) | "meta"
  uazapi_url?: string | null;
  uazapi_token?: string | null;
  meta_wa_token?: string | null;        // token permanente (system user) do BM
  meta_wa_phone_id?: string | null;     // Phone Number ID (não é o número!)
  meta_wa_verify_token?: string | null; // verify token do webhook (você inventa)
  meta_waba_id?: string | null;         // WhatsApp Business Account ID (gestão de templates)
};

const GRAPH = "https://graph.facebook.com/v21.0";

export function waProvider(s: WaSettings): "meta" | "uazapi" {
  return String(s?.wa_provider || "").toLowerCase() === "meta" ? "meta" : "uazapi";
}

export async function loadWaSettings(supabase: any): Promise<WaSettings> {
  const { data } = await supabase.from("app_settings")
    .select("wa_provider, uazapi_url, uazapi_token, meta_wa_token, meta_wa_phone_id, meta_wa_verify_token, meta_waba_id")
    .eq("id", 1).single();
  return data || {};
}

const onlyDigits = (s: any) => String(s || "").replace(/\D/g, "");

// Meta rejeita parâmetro de template com quebra de linha / tab / 4+ espaços.
const cleanParam = (s: any) => String(s ?? "").replace(/[\n\r\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 1000);

// ---------------- envio: texto livre (resposta em janela de 24h) ----------------
export async function waSendText(s: WaSettings, phone: string, text: string): Promise<boolean> {
  const to = onlyDigits(phone);
  if (!to) return false;
  if (waProvider(s) === "meta") {
    return metaPost(s, { messaging_product: "whatsapp", to, type: "text", text: { body: String(text).slice(0, 4096), preview_url: true } });
  }
  return uazapiPost(s, "/send/text", { number: to, text });
}

// ---------------- envio: menu interativo (resposta em janela de 24h) ----------------
// Meta: lista interativa (até 10 opções, título ≤24 chars). Uazapi: /send/menu (list/button).
export async function waSendMenu(s: WaSettings, phone: string, text: string, choices: string[], footerText?: string): Promise<boolean> {
  const to = onlyDigits(phone);
  if (!to) return false;
  if (waProvider(s) === "meta") {
    const rows = choices.slice(0, 10).map((c, i) => ({ id: `qa_${i}`, title: String(c).slice(0, 24) }));
    const ok = await metaPost(s, {
      messaging_product: "whatsapp", to, type: "interactive",
      interactive: {
        type: "list",
        body: { text: String(text).slice(0, 4000) },
        ...(footerText ? { footer: { text: String(footerText).slice(0, 60) } } : {}),
        action: { button: "Selecione", sections: [{ title: "Ações rápidas", rows }] },
      },
    });
    // lista falhou (ex.: fora da janela)? tenta texto simples pra não perder a resposta
    return ok || waSendText(s, phone, text);
  }
  const asList = choices.length > 3;
  const ok = await uazapiPost(s, "/send/menu", { number: to, type: asList ? "list" : "button", text, choices, footerText: footerText || "" });
  return ok || uazapiPost(s, "/send/text", { number: to, text });
}

// ---------------- envio: TEMPLATE (mensagem iniciada pelo negócio) ----------------
// No meta envia o template aprovado; no uazapi renderiza o texto equivalente (registry abaixo).
export async function waSendTemplate(s: WaSettings, phone: string, name: string, params: any[]): Promise<boolean> {
  const to = onlyDigits(phone);
  if (!to) return false;
  const tpl = WA_TEMPLATES[name];
  if (!tpl) { console.error(`template desconhecido: ${name}`); return false; }
  const clean = params.map(cleanParam);
  if (waProvider(s) === "meta") {
    return metaPost(s, {
      messaging_product: "whatsapp", to, type: "template",
      template: {
        name, language: { code: "pt_BR" },
        components: clean.length ? [{ type: "body", parameters: clean.map((t) => ({ type: "text", text: t })) }] : [],
      },
    });
  }
  return uazapiPost(s, "/send/text", { number: to, text: tpl.render(clean) });
}

// ---------------- envio: IMAGEM com legenda (vitrine de carros; janela de 24h) ----------------
export async function waSendImage(s: WaSettings, phone: string, imageUrl: string, caption?: string): Promise<boolean> {
  const to = onlyDigits(phone);
  if (!to || !imageUrl) return false;
  if (waProvider(s) === "meta") {
    return metaPost(s, {
      messaging_product: "whatsapp", to, type: "image",
      image: { link: imageUrl, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
    });
  }
  // uazapi: /send/media (type image) — best-effort
  return uazapiPost(s, "/send/media", { number: to, type: "image", file: imageUrl, text: caption || "" });
}

// ---------------- envio: FLOW interativo (resposta em janela de 24h) ----------------
// Abre um formulário nativo (WhatsApp Flow). No uazapi (sem flows), cai no texto de fallback.
export async function waSendFlow(s: WaSettings, phone: string, opts: {
  body: string; cta: string; flowId: string; token?: string; header?: string; screen?: string; fallbackText?: string;
}): Promise<boolean> {
  const to = onlyDigits(phone);
  if (!to) return false;
  if (waProvider(s) === "meta") {
    return metaPost(s, {
      messaging_product: "whatsapp", to, type: "interactive",
      interactive: {
        type: "flow",
        ...(opts.header ? { header: { type: "text", text: opts.header.slice(0, 60) } } : {}),
        body: { text: opts.body.slice(0, 1024) },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_id: opts.flowId,
            flow_cta: opts.cta.slice(0, 30),
            ...(opts.token ? { flow_token: opts.token } : {}),
            ...(opts.screen
              ? { flow_action: "navigate", flow_action_payload: { screen: opts.screen } }
              : { flow_action: "data_exchange" }),
          },
        },
      },
    });
  }
  return waSendText(s, phone, opts.fallbackText || opts.body);
}

// ---------------- transporte bruto ----------------
async function metaPost(s: WaSettings, body: unknown): Promise<boolean> {
  const token = s.meta_wa_token || "";
  const phoneId = s.meta_wa_phone_id || "";
  if (!token || !phoneId) { console.error("Meta WA não configurado (token/phone_id)"); return false; }
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) { console.error("Meta send falhou:", res.status, await res.text()); return false; }
    return true;
  } catch (e) { console.error("Erro Meta send:", e); return false; }
}

async function uazapiPost(s: WaSettings, path: string, body: unknown): Promise<boolean> {
  const url = String(s.uazapi_url || "").replace(/\/+$/, "");
  const token = s.uazapi_token || "";
  if (!url || !token) { console.error("Uazapi não configurado"); return false; }
  try {
    const res = await fetch(`${url}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", token }, body: JSON.stringify(body),
    });
    if (!res.ok) { console.error(`Uazapi ${path} falhou:`, res.status, await res.text()); return false; }
    return true;
  } catch (e) { console.error("Erro Uazapi:", e); return false; }
}

// ---------------- mídia (inbound Meta): media_id → base64 ----------------
export async function metaDownloadMedia(s: WaSettings, mediaId: string): Promise<{ data: string; media_type: string } | null> {
  const token = s.meta_wa_token || "";
  if (!token || !mediaId) return null;
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!meta.ok) { console.error("Meta media meta falhou:", meta.status, await meta.text()); return null; }
    const j = await meta.json();
    if (!j?.url) return null;
    const bin = await fetch(j.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!bin.ok) { console.error("Meta media download falhou:", bin.status); return null; }
    const mt = (bin.headers.get("content-type") || j.mime_type || "application/octet-stream").split(";")[0];
    const buf = new Uint8Array(await bin.arrayBuffer());
    let b = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) b += String.fromCharCode(...buf.subarray(i, i + CHUNK));
    return { data: btoa(b), media_type: mt };
  } catch (e) { console.error("Erro metaDownloadMedia:", e); return null; }
}

// ---------------- inbound Meta → formato normalizado do webhook ----------------
// Devolve null se o payload NÃO for da Cloud API (aí o webhook tenta o parser Uazapi).
export function parseMetaInbound(body: any): {
  provider: "meta"; fromMe: boolean; phone: string; kind: "text" | "image" | "audio" | "pdf" | "other";
  text: string; transcription: string; mediaId: string; mimetype: string; messageid: string;
  statusOnly: boolean; phoneNumberId: string; flowReply: Record<string, any> | null; isMenuReply: boolean;
} | null {
  if (body?.object !== "whatsapp_business_account") return null;
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId = String(value?.metadata?.phone_number_id || "");
  const m = value?.messages?.[0];
  if (!m) {
    // eventos de status (sent/delivered/read) ou outros — reconhecer e ignorar
    return { provider: "meta", fromMe: false, phone: "", kind: "other", text: "", transcription: "", mediaId: "", mimetype: "", messageid: "", statusOnly: true, phoneNumberId, flowReply: null, isMenuReply: false };
  }
  const phone = onlyDigits(m.from || "");
  const type = String(m.type || "");
  let kind: "text" | "image" | "audio" | "pdf" | "other" = "other";
  let text = "";
  let mediaId = "";
  let mimetype = "";
  let flowReply: Record<string, any> | null = null;
  if (type === "text") { kind = "text"; text = m.text?.body || ""; }
  else if (type === "image") { kind = "image"; mediaId = m.image?.id || ""; mimetype = m.image?.mime_type || "image/jpeg"; text = m.image?.caption || ""; }
  else if (type === "audio") { kind = "audio"; mediaId = m.audio?.id || ""; mimetype = m.audio?.mime_type || "audio/ogg"; }
  else if (type === "document") {
    mimetype = m.document?.mime_type || "";
    if (/pdf/i.test(mimetype)) { kind = "pdf"; mediaId = m.document?.id || ""; text = m.document?.caption || ""; }
  } else if (type === "interactive") {
    kind = "text";
    text = m.interactive?.list_reply?.title || m.interactive?.button_reply?.title || "";
    // Resposta de WhatsApp FLOW (formulário nativo): payload JSON em nfm_reply.response_json
    if (m.interactive?.type === "nfm_reply" && m.interactive?.nfm_reply?.response_json) {
      try { flowReply = JSON.parse(m.interactive.nfm_reply.response_json); } catch { /* payload inválido: ignora */ }
    }
  } else if (type === "button") { kind = "text"; text = m.button?.text || ""; }
  // toque em botão/lista/flow = ação intencional (não passa pelo debounce de mensagens picadas)
  const isMenuReply = type === "interactive" || type === "button";
  return { provider: "meta", fromMe: false, phone, kind, text: String(text), transcription: "", mediaId, mimetype, messageid: String(m.id || ""), statusOnly: false, phoneNumberId, flowReply, isMenuReply };
}

// Verificação do webhook (GET do Meta ao cadastrar a URL): responde o hub.challenge.
export function metaVerifyChallenge(url: URL, s: WaSettings): Response | null {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || !challenge) return null;
  if (token && s.meta_wa_verify_token && token === s.meta_wa_verify_token) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

// ---------------- REGISTRY DE TEMPLATES ----------------
// Fonte da verdade dos templates do BM. O corpo com {{n}} é o que se cadastra no gerenciador;
// render() é o fallback em texto pro provider uazapi (mesmos parâmetros, mesma ordem).
// Categorias: UTILITY (transacional) e MARKETING — separadas conforme regra do Meta.
type WaTemplate = { category: "UTILITY" | "MARKETING"; body: string; render: (p: string[]) => string };

export const WA_TEMPLATES: Record<string, WaTemplate> = {
  // ===================== UTILIDADE =====================
  vencimento_documento: {
    category: "UTILITY",
    body: "🔔 Lembrete TotexCar Co-pilot: {{1}} {{2}} ({{3}}). Precisa de ajuda? É só responder por aqui.",
    render: (p) => `🔔 Lembrete TotexCar Co-pilot: ${p[0]} ${p[1]} (${p[2]}). Precisa de ajuda? É só responder por aqui.`,
  },
  parcela_financiamento: {
    category: "UTILITY",
    body: "🔔 Lembrete do seu financiamento {{1}}: a parcela {{2}}, no valor de {{3}}, {{4}} ({{5}}). Sobre o boleto: {{6}} Se precisar de ajuda com o financiamento, é só responder esta mensagem. 🚗",
    render: (p) => `🔔 Lembrete do seu financiamento ${p[0]}: a parcela ${p[1]}, no valor de ${p[2]}, ${p[3]} (${p[4]}).\n\n${p[5]}`,
  },
  prazo_recurso_multa: {
    category: "UTILITY",
    body: "⚖️ Atenção ao prazo da sua multa: o período para recorrer de {{1}} {{2}} ({{3}}). Próximo passo: {{4}} Estou aqui para ajudar com o recurso, é só responder. 📄",
    render: (p) => `⚖️ O prazo para recorrer de ${p[0]} ${p[1]} (${p[2]}).\n\n${p[3]}`,
  },
  assinatura_vencendo: {
    category: "UTILITY",
    body: "🔔 Sua assinatura do TotexCar Co-pilot vence {{1}} ({{2}}). Renove em {{3}} para não perder o acesso ao seu assistente. 🚗",
    render: (p) => `🔔 Sua assinatura do TotexCar Co-pilot vence ${p[0]} (${p[1]}). Renove pra não perder o acesso:\n${p[2]}`,
  },
  assinatura_vencida: {
    category: "UTILITY",
    body: "⚠️ Sua assinatura do TotexCar Co-pilot venceu. Para continuar registrando gastos, consumo e usando o assistente, renove em {{1}} e volte a ficar em dia. 🚗",
    render: (p) => `⚠️ Sua assinatura do TotexCar Co-pilot venceu. Pra continuar registrando gastos, consumo e usar o assistente, é só renovar:\n${p[0]}`,
  },
  cortesia_vencendo: {
    category: "UTILITY",
    body: "🔔 Seu ano de cortesia do TotexCar Co-pilot, oferecido pela {{1}}, termina {{2}} ({{3}}). Continue com o preço de membro de R$ 10,99/mês renovando em {{4}} e siga com tudo em dia. 🚗",
    render: (p) => `🔔 Seu ano de cortesia do *TotexCar Co-pilot* (oferecido pela ${p[0]}) termina ${p[1]} (${p[2]}). Continue com o preço de membro, *R$ 10,99/mês*, e não perca o acesso:\n${p[3]}`,
  },
  cortesia_vencida: {
    category: "UTILITY",
    body: "⚠️ Seu ano de cortesia do TotexCar Co-pilot, oferecido pela {{1}}, chegou ao fim. Continue com tudo (gastos, consumo, revisões e multas) por R$ 10,99/mês, preço de membro, renovando em {{2}}. Até já! 🚗",
    render: (p) => `⚠️ Seu ano de cortesia do *TotexCar Co-pilot* (oferecido pela ${p[0]}) chegou ao fim. Você pode continuar com tudo — gastos, consumo, revisões e multas — por apenas *R$ 10,99/mês* (preço de membro):\n${p[1]}`,
  },
  resumo_pro_semanal: {
    category: "UTILITY",
    body: "📊 Resumo PRO da semana ({{1}}): faturou {{2}}, gastou {{3}}, resultado {{4}}. {{5}} Mande os prints de ganhos e os cupons que eu cuido do resto! 🚗",
    render: (p) => `📊 *Resumo PRO da semana* (${p[0]})\n\n💵 Faturou: ${p[1]}\n💸 Gastou: ${p[2]}\n✅ Resultado: *${p[3]}*\n${p[4]}\n\nBora pra mais uma semana! 🚗 (mande os prints de ganhos e os cupons que eu cuido do resto)`,
  },
  nps_pesquisa: {
    category: "UTILITY",
    body: "Oi {{1}}! Aqui é da {{2}}. 🙂 De 0 a 10, o quanto você recomendaria a {{2}} a um amigo? Responda só com o número. Sua resposta ajuda demais! 🙏",
    render: (p) => `Oi ${p[0]}! Aqui é da ${p[1]}. 🙂\nDe 0 a 10, o quanto você recomendaria a *${p[1]}* a um amigo?\nResponda só com o número (0 a 10). Sua resposta ajuda demais! 🙏`,
  },
  // Versão com WhatsApp FLOW (formulário nativo: nota 0-10 + comentário) — preferida no provider meta.
  // Botão "Avaliar agora" → Flow nps_pesquisa_flow (id na WABA). Resposta chega como nfm_reply no webhook.
  nps_pesquisa_flow: {
    category: "UTILITY",
    body: "Oi {{1}}! Aqui é da {{2}}. 🙂 Sua opinião vale muito pra gente: toque no botão abaixo e avalie sua experiência de compra em segundos. Obrigado! 🙏",
    render: (p) => `Oi ${p[0]}! Aqui é da ${p[1]}. 🙂\nDe 0 a 10, o quanto você recomendaria a *${p[1]}* a um amigo?\nResponda só com o número (0 a 10). Sua resposta ajuda demais! 🙏`,
  },
  boas_vindas_cortesia: {
    // criada como UTILITY mas o Meta RECATEGORIZOU p/ MARKETING (linguagem de presente/1 ano grátis)
    category: "MARKETING",
    body: "Olá {{1}}! 🎉 Obrigado por comprar seu {{2}} na {{3}}. Sua conta no TotexCar Co-pilot foi ativada com 1 ANO DE CORTESIA da loja: gastos, consumo, revisões, multas e mais, direto neste WhatsApp. Responda esta mensagem para começar. 🚗",
    render: (p) => `Olá ${p[0]}! 🎉 Muito obrigado por comprar seu ${p[1]} na ${p[2]}!\n\nComo presente de boas-vindas, você ganhou *1 ANO GRÁTIS* do *TotexCar Co-pilot* — seu assistente do carro no WhatsApp (gastos, consumo, revisões, multas e mais). É cortesia da ${p[2]}, você não paga nada! 🎁\n\nSua conta já está ativa. Responda esta mensagem para começar. 🚗`,
  },
  transferencia_concluida: {
    category: "UTILITY",
    body: "✅ Boa notícia, {{1}}! A transferência de propriedade do seu {{2}} foi concluída pela {{3}}. Documentação em dia! Qualquer dúvida, é só responder por aqui. 🎉",
    render: (p) => `✅ Boa notícia ${p[0]}! A *transferência de propriedade* do seu ${p[1]} foi concluída pela ${p[2]}. Documentação em dia! 🎉 Qualquer coisa, é só chamar por aqui.`,
  },
  garantia_vencendo: {
    category: "UTILITY",
    body: "🛡️ A garantia do seu {{1}} (na {{2}}) vence {{3}} ({{4}}). Aproveite para fazer uma revisão ou checagem antes de vencer.",
    render: (p) => `🛡️ A garantia do seu ${p[0]} (na ${p[1]}) vence ${p[2]} (${p[3]}). Aproveite pra fazer uma revisão/checagem antes de vencer.`,
  },
  revisao_proxima: {
    category: "UTILITY",
    body: "🔧 A próxima revisão do seu {{1}} está chegando ({{2}}). Agende com a {{3}} para manter tudo em dia. 🚗",
    render: (p) => `🔧 Sua próxima revisão do ${p[0]} está chegando (${p[1]}). Agende com a ${p[2]} pra manter tudo em dia. 🚗`,
  },
  transferencia_pendente_loja: {
    category: "UTILITY",
    body: "📄 Pós-venda {{1}}: a transferência de propriedade do cliente {{2}} ({{3}}) está pendente há {{4}} dias. Vale acompanhar para não travar. 🙏",
    render: (p) => `📄 *Pós-venda — ${p[0]}*\nA transferência de propriedade do cliente ${p[1]} (${p[2]}) está *pendente* há ${p[3]} dias. Vale acompanhar pra não travar. 🙏`,
  },
  alerta_nps_loja: {
    category: "UTILITY",
    body: "⚠️ Alerta de pós-venda {{1}}: o cliente {{2}} avaliou a experiência com nota {{3}}. Contato: {{4}}. Vale um contato rápido para recuperar. 📞",
    render: (p) => `⚠️ *Alerta de pós-venda — ${p[0]}*\nCliente ${p[1]} deu nota *${p[2]}* no NPS.\nContato: ${p[3]}\nVale um contato rápido pra recuperar. 📞`,
  },
  chamado_suporte: {
    category: "UTILITY",
    body: "🆘 Novo chamado de suporte com urgência {{1}} aberto no TotexCar Co-pilot. Cliente: {{2}}, plano {{3}}. Assunto: {{4}}. Resumo do caso: {{5}}. Número do ticket para acompanhamento: {{6}}. Responda o cliente assim que possível.",
    render: (p) => `🆘 SUPORTE TCF — chamado ${p[0]}\n\n👤 ${p[1]}\n💼 Plano: ${p[2]}\n\n📌 ${p[3]}\n${p[4]}\n\nTicket: ${p[5]}`,
  },
  pedido_recompra_loja: {
    category: "UTILITY",
    body: "🚗 Pedido de recompra na {{1}}: {{2}} avaliou o {{3}} pela tabela FIPE e pediu recompra por {{4}}. Contato: {{5}}. Veja os detalhes no Painel do Lojista.",
    render: (p) => `🚗 *Pedido de recompra — ${p[0]}*\n${p[1]} avaliou o ${p[2]} pela FIPE e pediu recompra por ${p[3]}.\nContato: ${p[4]}\nVeja os detalhes no Painel do Lojista.`,
  },
  // ===================== MARKETING =====================
  convite_copilot_loja: {
    category: "MARKETING",
    body: "Olá {{1}}! 🎉 Obrigado por comprar {{2}} na {{3}}. Como nosso cliente, você tem acesso ao TotexCar Co-pilot, o assistente do seu carro no WhatsApp (gastos, consumo, revisões, multas e mais), com um bônus especial. Ative em {{4}} e comece a cuidar do seu carro hoje mesmo. 🚗",
    render: (p) => `Olá ${p[0]}! 🎉 Muito obrigado por comprar ${p[1]} na ${p[2]}!\n\nComo nosso cliente, você ganhou acesso ao *TotexCar Co-pilot* — seu assistente do carro no WhatsApp (gastos, consumo, revisões, multas e mais), com um bônus especial:\n${p[3]}\n\nQualquer dúvida é só chamar por aqui. Boa estrada! 🚗`,
  },
  radar_match: {
    category: "MARKETING",
    body: "🎯 Radar Totex: apareceu um carro que combina com o que você procura ({{1}}): {{2}} por {{3}}. Veja: {{4}} — Gostou? Responda que eu aviso a loja do seu interesse na hora. 😉",
    render: (p) => `🎯 *Radar Totex* — apareceu um carro que combina com o que você procura (${p[0]}):\n\n${p[1]} por ${p[2]}\n${p[3]}\n\nGostou? Responda que eu aviso a loja do seu interesse na hora. 😉`,
  },
  aniversario_compra: {
    category: "MARKETING",
    body: "🎉 Faz 1 ano que você comprou seu {{1}} na {{2}}! Obrigado pela confiança. Precisando de qualquer coisa com o carro, é só chamar. E se pensar em trocar, a gente te ajuda. 🚗",
    render: (p) => `🎉 Faz 1 ano que você comprou seu ${p[0]} na ${p[1]}! Obrigado pela confiança. Precisando de qualquer coisa com o carro, é só chamar. E se pensar em trocar, a gente te ajuda. 🚗`,
  },
  campanha_loja: {
    category: "MARKETING",
    body: "Olá {{1}}! Mensagem da {{2}}: {{3}} Para não receber novidades da loja, responda SAIR.",
    render: (p) => `Olá ${p[0]}! Mensagem da ${p[1]}:\n\n${p[2]}`,
  },
};
