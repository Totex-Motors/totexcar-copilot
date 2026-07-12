# Visão — Modo Motorista PRO (Totex Care PRO)

> Documento de visão: abrir o segmento de **motoristas profissionais de aplicativo** (Uber, 99, inDriver,
> táxi, entregadores) no Totex CAR FINANCE / Totexcar Co-pilot, reaproveitando ~90% do que já existe.
> Versão 1 — 2026-07-02. Relacionado: `HANDOFF.md`, `VISAO-IA-COPILOTO-TOTEX.md`.

---

## 1. A tese

Para o dono comum, o módulo receita×despesa é ocioso (receita é esporádica). Para o **motorista de
aplicativo, o carro é um negócio** — e a única pergunta que importa é: **"quanto SOBROU?"**

O TCF já tem o lado do CUSTO inteiro (gastos por foto, consumo km/L real, manutenção, financiamento,
multas, alertas). Falta só o lado da RECEITA + o cálculo do lucro. É pouco código para um mercado de
**milhões de motoristas** no Brasil — e ninguém entrega "lucro por km" de forma simples no WhatsApp.

**Métricas-assinatura do PRO:** `lucro da semana` · `lucro por km` · `lucro por hora (informada)` · `custo/km`.

---

## 2. Segmentação e preços (decisão de produto)

Regra: **o preço segue o RELACIONAMENTO, não a funcionalidade.** O "Modo PRO" é um recurso de perfil;
o desconto é do ecossistema.

| Perfil | Origem | Plano | Preço |
|---|---|---|---|
| Dono comum | Cupom da loja | Totex Care (membro) | R$ 10,99/mês · anual R$ 109,90 à vista (12 pelo preço de 10) |
| Dono comum | Direto (sem cupom) | Totex Care | R$ 109,90/mês (âncora) |
| **Motorista de app** | LP própria (fora do ecossistema) | **Totex Care PRO** | **R$ 29,90/mês** · anual **R$ 299** à vista (12 pelo preço de 10) |
| **Cliente da loja que vira motorista** | Cupom da loja + ativa Modo PRO | Totex Care PRO (membro) | **R$ 10,99 — PRO INCLUSO** (Bônus Totex) |

### Por que PRO incluso pro membro (recomendação)
1. **Argumento de venda pra loja:** grande parte dos compradores de usados vai rodar de app. A loja vende:
   "comprando aqui, o app de gestão PRO de R$ 29,90 sai por R$ 10,99". O cupom fica mais valioso, sem custo real.
2. **Fecha o ciclo do ecossistema:** motorista roda 4–5x mais → troca de carro mais cedo → **Recompra FIPE
   / marketplace**. O km do PRO ainda indica a hora certa da loja oferecer a troca (lead quente no /lojista).
3. **Zero atrito:** virar PRO = responder "uso o carro pra trabalhar" (app ou WhatsApp). Sem novo checkout.

*Alternativa (não recomendada no lançamento):* add-on p/ membro (ex.: R$ 16,99 total). Gera receita extra,
mas enfraquece o pitch da loja. Reavaliar depois se o custo de IA do segmento pesar.

⚠️ Copy: **nunca** "sem fidelidade/cancele quando quiser". Anual sempre "12 meses pelo preço de 10 (~17% off)".
Narrativa do preço PRO: **"menos de uma corrida por mês pra saber quanto sobra de verdade"**.

---

## 3. Integrações com Uber/99 — a real (pesquisado em 2026-07)

- **Uber Driver API** (developer.uber.com/products/drivers): existe oficialmente, com `GET /partners/payments`
  (ganhos) e `/partners/trips`, autorizados pelo motorista via OAuth (Stride e Activehours usam nos EUA).
  **Acesso fechado** (application + aprovação), docs públicas antigas (2016–17), disponibilidade no Brasil
  incerta. **Ação: submeter a aplicação em paralelo — nunca bloquear o lançamento nisso.**
- **99/DiDi:** só existe API pública do **99Food** (lojistas). **Não há API de ganhos do motorista.** Sem
  perspectiva de integração oficial.
- **Caminho que funciona HOJE (sem pedir permissão a ninguém): o PRINT da tela de ganhos.** O motorista
  manda o print (Uber/99/inDriver mostram dia/semana) no WhatsApp → a MESMA pipeline foto→IA do cupom lê e
  registra a receita. Funciona pra qualquer app, táxi de rua (áudio: "fiz 380 hoje"), particular.
- **Fase 2 — Open Finance** (Pluggy/Belvo, ~R$ 2,5k/mês): detecta os repasses Uber/99 no extrato → receita
  automática de verdade. Só com escala que pague.

---

## 4. Escopo Fase 1 (enxuto — ~90% reuso)

### O que já existe e se reaproveita
Pipeline foto→IA (cupom/print), transactions com `type income`, categorias de receita, módulo Análises
(receita×despesa — hoje ocioso), consumo km/L por foto do hodômetro, multas, alertas, suporte, Asaas.

### A construir
1. **Perfil:** `users.driver_mode` (boolean) + pergunta no onboarding/Meu Veículo/WhatsApp
   ("Você usa o carro pra trabalhar com aplicativo?").
2. **Categorias de receita:** Uber, 99, Outros apps, Táxi, Particular, Gorjeta (is_system).
3. **Agente (tool nova `registrar_receita`):** lê o **print de ganhos** (extrai app, período, valor) ou
   texto/áudio ("fiz 380 hoje na uber") → grava income. Prompt: reconhecer prints de ganhos como tipo novo
   de imagem (junto de cupom/hodômetro/multa).
4. **Resumo semanal PRO (cron, ex.: segunda 8h):** "Semana: faturou R$ X · gastou R$ Y → **sobrou R$ Z**
   · R$ W/km" no WhatsApp (estende `car-expiration-alerts` ou cron novo).
5. **Dashboard:** card **"Lucro da semana/mês"** (income − expense + lucro/km) visível quando `driver_mode`.
6. **Checkout:** plano PRO no `create-checkout` (`plan_cycle` pro_monthly/pro_annual) + preços em
   `app_settings` (`pro_monthly_price` 29.90, `pro_annual_price` 299). Cupom de loja segue mandando (membro
   = 10,99 com PRO incluso).
7. **LP 3 (`/lp3`):** "Quanto sobra DE VERDADE no fim da semana?" — mockup do resumo semanal, 3 passos
   (print dos ganhos + foto do cupom + foto do hodômetro), preço PRO, FAQ. Tráfego: público motorista de app.

### Fora da Fase 1
Integração oficial Uber (aguardar aplicação), Open Finance, R$/hora automático (exige jornada), múltiplos
carros por conta (frotista — outra fase), relatório IR/MEI (fase 2 fácil e valiosa: exportar receitas p/ carnê-leão).

---

## 5. Aquisição e sinergia com o ecossistema

- **Direto (LP3):** tráfego pago pro público motorista → paga R$ 29,90 (receita própria, sem cupom).
- **Pela loja:** material pro lojista vender o benefício ("leve o PRO por 10,99") na entrega do carro.
- **Sinergia de dados:** motorista PRO roda muito → aba do lojista pode sinalizar "cliente com km alto,
  hora de ofertar troca/recompra" (evolução do /lojista, fase 2).

## 6. Métricas de sucesso
- Assinantes PRO diretos (R$ 29,90) e MRR do segmento; ativações de driver_mode entre membros.
- % de motoristas que mandam print de ganhos ≥1x/semana; retenção PRO vs dono comum.
- Leads de troca gerados pra lojas (fase 2).

## 7. Riscos
- **Custo de IA** maior (mais mensagens/dia por usuário PRO) — monitorar; se pesar, reavaliar add-on p/ membro.
- **Precisão da leitura do print** (layouts mudam) — mesma robustez tolerante do leitor de cupom; pedir print
  da tela oficial de ganhos.
- **Expectativa de integração automática** ("conecta na Uber?") — copy honesta: registro por print em 5 segundos.

## 8. Decisões pendentes (Marco)
1. Preço PRO: R$ 29,90/mês + R$ 299 anual — ok?
2. PRO incluso pro membro do ecossistema (recomendado) ou add-on?
3. Nome público: "Totex Care PRO" / "Modo Motorista PRO" — ok?
4. Prioridade: construir Fase 1 agora ou depois das pendências de produção (Asaas/PuxaPlaca/domínio)?
