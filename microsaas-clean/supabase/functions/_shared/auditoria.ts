// AUDITORIA DAS TRATATIVAS: a Nina só pode dizer que "anotou/registrou/atualizou" se uma ferramenta
// GRAVOU naquele turno. Cada resposta guarda as ações executadas (parsed.acoes) e, quando a fala promete
// e nada foi gravado, fica marcada pra conferência (parsed.conferir) — aparece no Admin → Tratativas.
export const FERRAMENTAS_QUE_GRAVAM = new Set([
  "registrar_gasto", "atualizar_hodometro", "corrigir_ultimo_gasto", "registrar_painel_entrega", "registrar_troca_oleo", "plano_troca_oleo",
  "registrar_multa", "registrar_pedagio", "pedagio_pago", "arquivar_documento", "criar_radar", "registrar_receita", "salvar_boleto", "salvar_carne",
  "abrir_chamado", "abrir_atendimento_loja", "pedir_orcamento",
]);
// fala que AFIRMA ter gravado/mudado algo (não inclui "te aviso antes", que é rotina)
export const RE_PROMESSA = /\b(anotei|anotado|anotada|registrei|registrado|registrada|atualizei|atualizado|atualizada|salvei|guardei|corrigi|corrigido|ajustei|ajustado|ja (mudei|alterei|arrumei)|pode deixar|deixa comigo|nao (vou|te) (mais )?(avis|lembr|cobr)\w*|paro de (te )?(avisar|lembrar|cobrar)|fic(a|ou) (anotado|registrado|salvo|guardado))\b/i;
const semAcento = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// só interessa quando a conversa é sobre DADO DO CARRO ou AVISO (preferência pessoal a memória guarda sozinha,
// em segundo plano — "anotei que você prefere ser chamado de Edu" é legítimo sem ferramenta)
export const RE_TEMA = /\b(km|quilometr\w*|hodometro|oleo|revis\w+|troca\w*|manutenc\w+|multa\w*|pedagio\w*|parcela\w*|boleto\w*|financiament\w*|ipva|licenciament\w*|seguro|vencim\w+|venc[ea]\w*|avis\w+|lembr\w+|cobr\w+|cnh|placa|gasto\w*|abastec\w+|gasolina|etanol|pneu\w*|bateria|garantia|transferenc\w*|document\w*)\b/;
export const ehTemaAuditado = (input: unknown, reply: unknown) => RE_TEMA.test(semAcento(`${input ?? ""} ${reply ?? ""}`));

export type Acao = { n: string; ok: boolean };
export function auditarResposta(reply: string, acoes: Acao[] | null | undefined, input?: string | null): { conferir: boolean; motivo: string | null } {
  const promete = RE_PROMESSA.test(semAcento(reply)) && ehTemaAuditado(input, reply);
  const lista = acoes || [];
  const gravou = lista.some((a) => a.ok && FERRAMENTAS_QUE_GRAVAM.has(a.n));
  const falhou = lista.filter((a) => !a.ok && FERRAMENTAS_QUE_GRAVAM.has(a.n)).map((a) => a.n);
  if (promete && !gravou) return { conferir: true, motivo: falhou.length ? `disse que gravou, mas a ação falhou (${falhou.join(", ")})` : "disse que anotou/registrou, mas nenhuma ação gravou" };
  return { conferir: false, motivo: null };
}
// histórico antigo (sem o registro das ações): só dá pra saber que a fala prometeu
export const falaPromete = (reply: unknown, input?: unknown) => RE_PROMESSA.test(semAcento(reply)) && ehTemaAuditado(input, reply);
