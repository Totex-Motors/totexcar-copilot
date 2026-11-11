// FREE FLOW (pedágio sem cancela): a passagem é registrada por pórtico e o motorista tem que PAGAR depois
// (não há cobrança automática sem tag). Fonte: ANTT (gov.br/antt/pt-br/free-flow e notícias de 24/08 e
// 10/11/2026). Regras usadas aqui, sem inventar:
//  - prazo normal: 30 dias a partir do status "pendente de pagamento" (passagem em processamento ainda não tem prazo);
//  - consultar: app CNH do Brasil → Veículos → (carro) → Pedágio Eletrônico; pagar no canal da concessionária;
//  - quem tem tag válida paga automático.
// O Co-pilot NÃO descobre passagens sozinho: o motorista informa (ou manda a cobrança) e a Nina lembra.

export const COMO_CONSULTAR = "app CNH do Brasil → Veículos → seu carro → Pedágio Eletrônico (ou o site da concessionária)";
export const PRAZO_NORMAL_DIAS = 30;
export const LINK_ANTT = "https://www.gov.br/antt/pt-br/free-flow";

// trechos com pórticos EM OPERAÇÃO (lista da ANTT; autorizados/em implantação ficam de fora até começarem a cobrar)
const TRECHOS: { nome: string; re: RegExp }[] = [
  { nome: "Via Dutra (BR-116/SP), pórticos em Guarulhos/São Paulo", re: /\bdutra\b|\bbr[\s-]?116\b.*\b(sp|rj|rio|s[aã]o paulo|guarulhos)\b|presidente dutra/i },
  { nome: "Rio-Santos (BR-101/RJ), pórticos em Itaguaí, Mangaratiba e Paraty", re: /rio[\s-]?santos|\bbr[\s-]?101\b.*\b(rj|paraty|parati|mangaratiba|itagua[ií]|angra)\b|\b(paraty|parati|mangaratiba|itagua[ií])\b/i },
];
const MENCIONA = /free[\s-]?flow|sem cancela|p[oó]rtico|pedágio eletr[oô]nico|pedagio eletronico/i;

// O trajeto do plano de viagem passa por free flow? (pesquisa ao vivo + plano + origem/destino)
export function detectarFreeFlow(pesquisa: string | null, plano: any, origem?: string | null, destino?: string | null) {
  const texto = [pesquisa || "", JSON.stringify(plano?.rota || {}), JSON.stringify(plano?.pedagios || {}), plano?.titulo || "", origem || "", destino || ""].join("\n");
  const trechos = TRECHOS.filter((t) => t.re.test(texto)).map((t) => t.nome);
  const citado = MENCIONA.test(pesquisa || "") || MENCIONA.test(JSON.stringify(plano?.pedagios || {}));
  if (!trechos.length && !citado) return null;
  return {
    trechos: trechos.length ? trechos : ["trecho com pedágio sem cancela citado na pesquisa da rota"],
    orientacao: `Esse caminho tem pedágio FREE FLOW (sem cancela): a passagem é registrada pela placa e você paga depois. ` +
      `Sem tag, confira no ${COMO_CONSULTAR} e pague em até ${PRAZO_NORMAL_DIAS} dias depois que aparecer como "pendente de pagamento". ` +
      `Não pagar pode virar multa e pontos na CNH. Com tag válida, o pagamento é automático.`,
    fonte: LINK_ANTT,
  };
}
