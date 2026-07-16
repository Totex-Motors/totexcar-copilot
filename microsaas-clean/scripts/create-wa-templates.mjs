// TotexCar Co-pilot — cria os 21 templates do WhatsApp OFICIAL (Meta) via Graph API
// Em vez de colar um por um no WhatsApp Manager. Mantém paridade com o registry
// supabase/functions/_shared/wa.ts (mesmos nomes, corpos e ordem de variáveis).
//
// USO:
//   node scripts/create-wa-templates.mjs <WABA_ID> <TOKEN>            → cria todos (pula existentes)
//   node scripts/create-wa-templates.mjs <WABA_ID> <TOKEN> --status   → lista status de aprovação
//
// Também aceita env: WABA_ID / META_WA_TOKEN. Node 18+ (fetch nativo).

const GRAPH = "https://graph.facebook.com/v21.0";

const WABA_ID = process.argv[2] || process.env.WABA_ID || "";
const TOKEN = process.argv[3] || process.env.META_WA_TOKEN || "";
const STATUS_ONLY = process.argv.includes("--status");

if (!WABA_ID || !TOKEN) {
  console.error("Uso: node scripts/create-wa-templates.mjs <WABA_ID> <TOKEN> [--status]");
  process.exit(1);
}

// name → { category, body, example: valores de exemplo na ordem {{1}}..{{n}} }
// ⚠️ Espelho de _shared/wa.ts — se mudar lá, mude aqui.
const TEMPLATES = {
  // ===================== UTILIDADE =====================
  vencimento_documento: {
    category: "UTILITY",
    body: "🔔 Lembrete TotexCar Co-pilot: {{1}} {{2}} ({{3}}). Precisa de ajuda? É só responder por aqui.",
    example: ["o IPVA de Onix 2020", "vence em 7 dias", "25/07/2026"],
  },
  parcela_financiamento: {
    category: "UTILITY",
    body: "🔔 Parcela {{1}} do financiamento {{2}}, de {{3}}, {{4}} ({{5}}). {{6}}",
    example: ["12/48", "Safra", "R$ 1.250,00", "vence HOJE", "20/07/2026", "Linha digitável (copia e cola): 23793381286000782713695000063305999580000125000"],
  },
  prazo_recurso_multa: {
    category: "UTILITY",
    body: "⚖️ O prazo para recorrer de {{1}} {{2}} ({{3}}). {{4}}",
    example: ["excesso de velocidade (R$ 195,23)", "termina em 3 dias", "22/07/2026", "Seu recurso já está PRONTO no app: https://totexcarco-pilot.vercel.app/multas"],
  },
  assinatura_vencendo: {
    category: "UTILITY",
    body: "🔔 Sua assinatura do TotexCar Co-pilot vence {{1}} ({{2}}). Renove para não perder o acesso: {{3}}",
    example: ["em 3 dias", "20/07/2026", "https://totexcarco-pilot.vercel.app/plans"],
  },
  assinatura_vencida: {
    category: "UTILITY",
    body: "⚠️ Sua assinatura do TotexCar Co-pilot venceu. Para continuar registrando gastos, consumo e usando o assistente, renove em: {{1}}",
    example: ["https://totexcarco-pilot.vercel.app/plans"],
  },
  cortesia_vencendo: {
    category: "UTILITY",
    body: "🔔 Seu ano de cortesia do TotexCar Co-pilot, oferecido pela {{1}}, termina {{2}} ({{3}}). Continue com o preço de membro de R$ 10,99/mês: {{4}}",
    example: ["Cardoso Veículos", "amanhã", "15/07/2027", "https://totexcarco-pilot.vercel.app/plans?coupon=CARDOSO90"],
  },
  cortesia_vencida: {
    category: "UTILITY",
    body: "⚠️ Seu ano de cortesia do TotexCar Co-pilot, oferecido pela {{1}}, chegou ao fim. Continue com tudo (gastos, consumo, revisões e multas) por R$ 10,99/mês, preço de membro: {{2}}",
    example: ["Cardoso Veículos", "https://totexcarco-pilot.vercel.app/plans?coupon=CARDOSO90"],
  },
  resumo_pro_semanal: {
    category: "UTILITY",
    body: "📊 Resumo PRO da semana ({{1}}): faturou {{2}}, gastou {{3}}, resultado {{4}}. {{5}} Mande os prints de ganhos e os cupons que eu cuido do resto! 🚗",
    example: ["07/07/2026 a 13/07/2026", "R$ 2.380,00", "R$ 940,00", "sobrou R$ 1.440,00", "🛣️ 1.240 km rodados, lucro de R$ 1,16 por km."],
  },
  nps_pesquisa: {
    category: "UTILITY",
    body: "Oi {{1}}! Aqui é da {{2}}. 🙂 De 0 a 10, o quanto você recomendaria a {{2}} a um amigo? Responda só com o número. Sua resposta ajuda demais! 🙏",
    example: ["Renata", "Cardoso Veículos"],
  },
  boas_vindas_cortesia: {
    category: "UTILITY",
    body: "Olá {{1}}! 🎉 Obrigado por comprar seu {{2}} na {{3}}. Sua conta no TotexCar Co-pilot foi ativada com 1 ANO DE CORTESIA da loja: gastos, consumo, revisões, multas e mais, direto neste WhatsApp. Responda esta mensagem para começar. 🚗",
    example: ["Renata", "Nivus", "Cardoso Veículos"],
  },
  transferencia_concluida: {
    category: "UTILITY",
    body: "✅ Boa notícia, {{1}}! A transferência de propriedade do seu {{2}} foi concluída pela {{3}}. Documentação em dia! Qualquer dúvida, é só responder por aqui. 🎉",
    example: ["Renata", "Nivus", "Cardoso Veículos"],
  },
  garantia_vencendo: {
    category: "UTILITY",
    body: "🛡️ A garantia do seu {{1}} (na {{2}}) vence {{3}} ({{4}}). Aproveite para fazer uma revisão ou checagem antes de vencer.",
    example: ["Nivus", "Cardoso Veículos", "em 10 dia(s)", "26/07/2026"],
  },
  revisao_proxima: {
    category: "UTILITY",
    body: "🔧 A próxima revisão do seu {{1}} está chegando ({{2}}). Agende com a {{3}} para manter tudo em dia. 🚗",
    example: ["Nivus", "22/07/2026", "Cardoso Veículos"],
  },
  transferencia_pendente_loja: {
    category: "UTILITY",
    body: "📄 Pós-venda {{1}}: a transferência de propriedade do cliente {{2}} ({{3}}) está pendente há {{4}} dias. Vale acompanhar para não travar. 🙏",
    example: ["Cardoso Veículos", "Renata Parentel", "Nivus", "18"],
  },
  alerta_nps_loja: {
    category: "UTILITY",
    body: "⚠️ Alerta de pós-venda {{1}}: o cliente {{2}} avaliou a experiência com nota {{3}}. Contato: {{4}}. Vale um contato rápido para recuperar. 📞",
    example: ["Cardoso Veículos", "Renata Parentel", "4", "11980292779"],
  },
  chamado_suporte: {
    category: "UTILITY",
    body: "🆘 Chamado de suporte ({{1}}): {{2}}, plano {{3}}. Assunto: {{4}}. Resumo: {{5}}. Ticket: {{6}}",
    example: ["ALTA", "João · joao@email.com · 11999998888", "premium (active)", "Pagamento não liberado", "Pagou por PIX há 2h e segue bloqueado", "a1b2c3d4"],
  },
  pedido_recompra_loja: {
    category: "UTILITY",
    body: "🚗 Pedido de recompra na {{1}}: {{2}} avaliou o {{3}} pela tabela FIPE e pediu recompra por {{4}}. Contato: {{5}}. Veja os detalhes no Painel do Lojista.",
    example: ["Cardoso Veículos", "Renata Parentel", "VW Nivus 2022", "R$ 98.500,00 (89% da FIPE R$ 110.674,00)", "11980292779"],
  },
  // ===================== MARKETING =====================
  convite_copilot_loja: {
    category: "MARKETING",
    body: "Olá {{1}}! 🎉 Obrigado por comprar {{2}} na {{3}}. Como nosso cliente, você tem acesso ao TotexCar Co-pilot, o assistente do seu carro no WhatsApp (gastos, consumo, revisões, multas e mais), com um bônus especial. Ative em: {{4}}",
    example: ["Renata", "seu Nivus", "Cardoso Veículos", "https://totexcarco-pilot.vercel.app/entrar?tab=register&coupon=CARDOSO90"],
  },
  radar_match: {
    category: "MARKETING",
    body: "🎯 Radar Totex: apareceu um carro que combina com o que você procura ({{1}}): {{2}} por {{3}}. Veja: {{4}} — Gostou? Responda que eu aviso a loja do seu interesse na hora. 😉",
    example: ["Fiat Argo", "Fiat Argo Drive 1.3 2022, 45.000 km", "R$ 72.900", "https://totexmotors.com/veiculo/abc123?ref=XYZ"],
  },
  aniversario_compra: {
    category: "MARKETING",
    body: "🎉 Faz 1 ano que você comprou seu {{1}} na {{2}}! Obrigado pela confiança. Precisando de qualquer coisa com o carro, é só chamar. E se pensar em trocar, a gente te ajuda. 🚗",
    example: ["Nivus", "Cardoso Veículos"],
  },
  campanha_loja: {
    category: "MARKETING",
    body: "Olá {{1}}! Mensagem da {{2}}: {{3}} Para não receber novidades da loja, responda SAIR.",
    example: ["Renata", "Cardoso Veículos", "A revisão do seu carro está com 20% de desconto esta semana. Agende já!"],
  },
};

const H = { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` };

async function listTemplates() {
  const all = [];
  let url = `${GRAPH}/${WABA_ID}/message_templates?fields=name,status,category,language,quality_score&limit=100`;
  while (url) {
    const res = await fetch(url, { headers: H });
    const j = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(j?.error || j));
    all.push(...(j.data || []));
    url = j.paging?.next || null;
  }
  return all;
}

async function createTemplate(name, t) {
  const hasVars = /\{\{\d+\}\}/.test(t.body);
  const body = {
    name,
    language: "pt_BR",
    category: t.category,
    // se o Meta discordar da categoria, aceita a recategorização em vez de rejeitar
    allow_category_change: true,
    components: [
      {
        type: "BODY",
        text: t.body,
        ...(hasVars ? { example: { body_text: [t.example] } } : {}),
      },
    ],
  };
  const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
    method: "POST", headers: H, body: JSON.stringify(body),
  });
  const j = await res.json();
  if (res.ok) return { ok: true, id: j.id, status: j.status, category: j.category };
  const msg = j?.error?.error_user_msg || j?.error?.message || JSON.stringify(j);
  const exists = /already exists|já existe/i.test(msg) || j?.error?.error_subcode === 2388023;
  return { ok: false, exists, error: msg };
}

const pad = (s, n) => String(s).padEnd(n);

if (STATUS_ONLY) {
  const list = await listTemplates();
  console.log(`\nTemplates na WABA ${WABA_ID}: ${list.length}\n`);
  console.log(pad("NOME", 30) + pad("CATEGORIA", 12) + pad("STATUS", 12) + "QUALIDADE");
  for (const t of list.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(pad(t.name, 30) + pad(t.category, 12) + pad(t.status, 12) + (t.quality_score?.score || "-"));
  }
  const ours = Object.keys(TEMPLATES);
  const missing = ours.filter((n) => !list.some((t) => t.name === n));
  if (missing.length) console.log(`\n⚠️ Faltando (${missing.length}): ${missing.join(", ")}`);
  else console.log("\n✅ Todos os 21 templates existem na WABA.");
  const notApproved = list.filter((t) => ours.includes(t.name) && t.status !== "APPROVED");
  if (notApproved.length) console.log(`⏳ Aguardando aprovação: ${notApproved.map((t) => `${t.name}(${t.status})`).join(", ")}`);
  process.exit(0);
}

console.log(`\nCriando ${Object.keys(TEMPLATES).length} templates na WABA ${WABA_ID}...\n`);
let created = 0, skipped = 0, failed = 0;
for (const [name, t] of Object.entries(TEMPLATES)) {
  const r = await createTemplate(name, t);
  if (r.ok) { created++; console.log(`✅ ${pad(name, 30)} criado (${r.category}, status inicial: ${r.status})`); }
  else if (r.exists) { skipped++; console.log(`↩️  ${pad(name, 30)} já existe (pulado)`); }
  else { failed++; console.log(`❌ ${pad(name, 30)} FALHOU: ${r.error}`); }
  await new Promise((res) => setTimeout(res, 500)); // pacing (rate limit da Graph)
}
console.log(`\nResumo: ${created} criados · ${skipped} já existiam · ${failed} falharam`);
console.log(`Acompanhe a aprovação com: node scripts/create-wa-templates.mjs ${WABA_ID} <TOKEN> --status`);
if (failed) process.exit(2);
