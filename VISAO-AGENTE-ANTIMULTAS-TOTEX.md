# Visão — Agente Anti-Multas Totex ("Blindagem de Multas")

> Documento de visão de produto: um módulo de IA no Totex_CAR_FINANCE (TCF) que analisa multas de trânsito
> a partir da foto, aponta vícios e gera um recurso pronto pra protocolar — reaproveitando a stack que já existe
> (foto → IA → WhatsApp). Versão 1 — 2026-06-24. Relacionado: `HANDOFF.md`, `VISAO-IA-COPILOTO-TOTEX.md`.

---

## 1. A tese

Existe um mercado quente de "blindagem antimultas" (ex.: blindagemantimultas.com): foto da multa → IA acha
falhas → monta a defesa → protege a CNH. **O que torna isso atraente pro Totex não é o mercado — é que já
temos 90% da máquina pronta.** É a MESMA capacidade do leitor de cupom (foto → IA), aplicada a outro documento.

| O anti-multas precisa | O TCF já tem |
|---|---|
| Ler documento por foto | ✅ pipeline foto→IA (cupom) |
| IA conversacional (tool use) | ✅ agente WhatsApp Fase 1 |
| Canal com o cliente | ✅ WhatsApp + app |
| Dados do carro/condutor | ✅ placa, RENAVAM, **CNH** (nº/categoria/vencimento) |
| Categoria financeira | ✅ "Multas" já existe |
| Cobrança | ✅ Asaas + planos |

Para nós é um **módulo**, não um produto novo. Custo marginal baixo, forte diferencial e 100% on-brand (carro).

---

## 2. Princípio: UM fluxo, bem feito (evitar dispersão)

No domínio jurídico, meia-boca destrói confiança. **Não** clonar o menu inteiro da concorrência. Entregar
**um fluxo impecável** e deixar o resto (que depende de dado governamental restrito) para fases posteriores.

### 2.1 v1 — o único fluxo a construir
1. Dono manda **foto da multa** (WhatsApp ou app).
2. IA **lê o auto de infração** e extrai: órgão, nº do auto, data/hora, local, enquadramento (art. CTB),
   valor, pontos, placa, prazo de recurso.
3. IA **checa vícios comuns** (checklist CTB, §5) e classifica a chance (baixa/média/alta) com honestidade.
4. IA **gera a minuta do recurso** (Defesa Prévia / JARI) pronta pra protocolar, em PDF.
5. Sistema **registra a multa** (categoria Multas) e cria **alerta de prazo** pra recorrer.

### 2.2 O que NÃO fazer no v1 (fase 2 — depende de dado gov. restrito, validar antes)
- ❌ **Consulta de multas por placa** → SNE/Detran exige login gov.br; sem API aberta confiável. Alguns
  provedores de placa trazem *débitos* — verificar cobertura/custo antes de prometer.
- ❌ **Pontos na CNH / suspensão automática** → dado do condutor no gov.br; no máximo o dono informa.
- ❌ Indicação de condutor, protocolo automático no órgão, gestão de recursos de terceiros.

---

## 3. Como a IA faz (arquitetura — reuso da Fase 1)

Mesma base de tool use do `whatsapp-webhook`. Adicionar **ferramentas** e uma **base de conhecimento do CTB**
no prompt (não precisa RAG no v1 — um checklist estruturado resolve).

| Ferramenta (nova) | O que faz | Fonte |
|---|---|---|
| `analisar_multa` | recebe os campos lidos da foto, aponta vícios + chance | prompt + checklist CTB |
| `gerar_recurso` | monta a minuta (defesa prévia/JARI) e devolve texto/PDF | template + dados da multa |
| `registrar_multa` | grava em `multas` + cria alerta de prazo | banco |
| `minhas_multas` | lista as multas e status do recurso | banco |

Fluxo no agente: foto → a IA (visão) extrai os dados → chama `analisar_multa` → se o dono quer recorrer,
chama `gerar_recurso` → `registrar_multa`. Tudo dentro do loop agêntico que já existe.

---

## 4. Peças a construir

- **DB — tabela `multas`:** `user_id`, `account_id`, `orgao`, `auto_numero`, `data_infracao`, `local`,
  `enquadramento` (art. CTB), `descricao`, `valor`, `pontos`, `placa`, `prazo_recurso` (data), `gravidade`,
  `chance` (baixa/media/alta), `status` (nova/recurso_gerado/protocolada/deferida/indeferida), `recurso_texto`,
  `created_at`. RLS: dono gerencia as próprias.
- **Edge `multas`** (JWT): ações `analisar` (foto/dados → vícios), `gerar_recurso` (PDF), `list`, `update_status`.
  Reusa a config de IA do `app_settings` (mesmo provedor). Geração de PDF do recurso (ex.: HTML→PDF).
- **`whatsapp-webhook`:** adicionar as ferramentas acima ao `TOOL_SPECS`; detectar que a foto é uma multa
  (a própria IA distingue cupom × auto de infração) → roteia pro fluxo de multa.
- **Frontend `/multas`:** lista de multas (valor, pontos, prazo, status), upload de foto, ver/baixar o recurso
  em PDF, botão "gerar recurso". Item no menu.
- **Alertas (cron `car-expiration-alerts`):** incluir **prazo de recurso** (ex.: faltam 3 dias) no WhatsApp.
- **Base de conhecimento CTB:** checklist de vícios + artigos + modelos de recurso (arquivo versionado).

---

## 5. Checklist de vícios COM BASE LEGAL (implementado no agente v14)

Falhas processuais padronizadas na lei brasileira que a IA cruza a cada multa. Para as que não aparecem
na foto do auto, a IA **entrevista o usuário** (2–3 perguntas curtas) antes de fechar a análise:

| # | Vício | Base legal | Como a IA verifica |
|---|---|---|---|
| a | Notificação da autuação fora do prazo (30 dias → arquivamento) | **Art. 281, § único, II, CTB** | Pergunta quando recebeu a notificação e compara com a data da infração |
| b | Erro/ausência de dados obrigatórios do auto | **Res. CONTRAN 918/2022** | Confere placa/marca/modelo/cor, local, data/hora, enquadramento, órgão/agente na foto |
| c | Ausência de dupla notificação (autuação + penalidade) | **Arts. 280–282 CTB** | Pergunta se recebeu as duas notificações ou só a cobrança |
| d | Radar sem aferição válida do INMETRO / equipamento não identificado | **Res. CONTRAN 798/2020 + INMETRO** | Procura nº do equipamento e data de aferição no auto; orienta exigir o certificado |
| e | Sinalização irregular/ausente (fiscalização de velocidade) | Res. CONTRAN (sinalização prévia) | Pergunta se havia placa de velocidade no trecho |
| f | Competência do órgão p/ a via; erro de enquadramento; dupla penalização | CTB | Analisa órgão × tipo de via e o enquadramento |

> ⚠️ Curar com um despachante/advogado. A IA **sugere** com base no checklist; a decisão é do órgão.

---

## 6. Roadmap

| Fase | Entrega | Esforço |
|---|---|---|
| **1** | Foto → análise de vícios + minuta de recurso (PDF) + registrar multa + alerta de prazo | 🟡 |
| **2** | `/multas` no app (lista, upload, PDF, status) | 🟡 |
| **3** | Consulta de multas por placa (SE houver provedor viável) + pontos informados pelo dono | 🔴 (validar dado) |
| **4** | Parceria despachante/advogado (revisão + protocolo) como upsell | 🟡 (negócio) |

---

## 7. Modelo de negócio

- **Módulo dentro do Totex** (recomendado) — reuso máximo; pode virar produto/marca separada depois.
- Monetização: **plano superior** ("Totex Care+") ou **por recurso gerado**; upsell do protocolo via parceiro.

---

## 8. Riscos e cuidados

- **Expectativa**: "73% derrubadas" é marketing; a taxa real é bem menor e varia. Comunicar
  **"recurso bem fundamentado / aumenta suas chances"**, nunca garantia. Protege a marca.
- **Jurídico**: é quase serviço advocatício. Posicionar como **"modelo de recurso gerado por IA"** com aviso
  de que a decisão é do órgão; para o pago, ter **despachante/advogado parceiro** (blindagem + upsell).
- **Precisão da IA**: alucinação em citação de lei é grave — usar checklist fechado + revisão humana no tier pago.
- **Dado gov. restrito**: não prometer consulta por placa/pontos até validar fonte real.

---

## 9. Métricas de sucesso

- Nº de multas analisadas / recursos gerados por mês.
- Conversão pro plano superior (Care+) a partir do módulo.
- % de donos que usam ≥1x; NPS do recurso gerado.
- (fase 4) taxa de deferimento dos recursos protocolados via parceiro.
