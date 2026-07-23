# Programa Selo Totex — Recompra de até 90% da FIPE

> Documento de produto + implementação. Transforma o histórico registrado no Co-pilot em
> **dinheiro na troca**: quem cuida do carro e comprova (abastecimento, revisões, documentos)
> ganha o Selo Totex e a garantia de recompra por faixa da FIPE nas lojas parceiras.
> É a união de: histórico que vale dinheiro + gamificação + recompra FIPE + recorrência do lojista.
> Versão 1 — 2026-07-19. Relacionado: `HANDOFF.md`, `GAMIFICACAO-SCORE-CUIDADO.md`,
> `MODULO-PROATIVO-TOTEXCAR.md`, `VISAO-IA-COPILOTO-TOTEX.md` (F7 "vale vender?").
>
> **⚠️ CORREÇÕES/CONDIÇÕES da revisão técnica 2026-07-22 (v1.1, Claude Code):**
> 1. **Termo de adesão POR LOJA é pré-requisito de lançamento.** As faixas (82/85/87–90% da
>    FIPE) são compromisso FINANCEIRO do lojista, não da Totex. Sem adesão formal, a Totex
>    promete o que a loja pode não honrar. Implementar: `dealership_settings.selo_program`
>    (aceito_em, aceito_por, faixas_customizadas?) + flag no /lojista; a garantia só aparece
>    pro cliente cuja loja aderiu. **Copy SEMPRE "nas lojas participantes".**
> 2. **Decisões do dono ANTES de codar a Fase 4:** (a) validar as faixas com 1–2 lojas âncora;
>    (b) quem redige o termo (jurídico); (c) confirmar o nome "Selo Totex".
> 3. **Ordem de execução acordada (2026-07-22):** Fase 1 Proativo-IA → Fase 2 motor de pontos
>    SILENCIOSO + IR/MEI → Fase 3 Calendário → Fase 4 lançamento do Selo (este doc). O motor
>    acumula pontos desde a Fase 2 para o Selo nascer com histórico retroativo.
> 4. `accounts.uf`/`cidade` JÁ existem (migração radar_servicos) — o §7.1 não precisa criá-los.

---

## 1. A tese (uma frase)

**"Seu histórico vale dinheiro":** cada cupom, foto de hodômetro e revisão comprovada vira
ponto no Score de Cuidado; o Score define o Selo; o Selo define quanto a loja paga pelo
carro na troca — até 90% da FIPE. Sair do app = abandonar valor acumulado.

Por que funciona para os 3 lados:

| Lado | O que ganha |
|---|---|
| **Cliente** | Recompra garantida por faixa da FIPE + laudo digital do carro (vale em qualquer venda) + sensação de progresso |
| **Lojista** | Estoque qualificado com procedência verificada (gira mais rápido, vende mais caro) + leads quentes de troca + pós-venda automático que justifica os R$ 109,90/cliente/ano |
| **Totex** | Retenção (lock-in de dados), MRR da cortesia, transações no marketplace, diferencial que nenhum concorrente tem |

---

## 2. As faixas do Selo (parametrizáveis em `app_settings`)

O "até 90%" é **TETO, nunca piso**. A oferta final é da loja, após vistoria presencial.
O Selo garante o **MÍNIMO da faixa** *se a vistoria confirmar o histórico*.

| Selo | Requisito | Garantia na recompra (loja parceira) |
|---|---|---|
| — Sem selo | qualquer usuário | Avaliação normal (oferta livre da loja) |
| 🥉 **Bronze** | Score ≥ 300 + 3 meses de histórico ativo | Mínimo **82%** da FIPE |
| 🥈 **Prata** | Score ≥ 600 + 6 meses de histórico ativo | Mínimo **85%** da FIPE |
| 🥇 **Ouro** | Score ≥ 850 + 12 meses de histórico ativo | Mínimo **87%**, podendo chegar a **90%** |

**Bônus Troca em 12 meses (urgência):** quem solicita a recompra em até 12 meses após conquistar
o Selo Ouro tem direito ao **teto de 90%** (em vez do mínimo 87%) na primeira troca. É o gatilho
que acelera o giro do lojista — o verdadeiro objetivo do programa.

"Histórico ativo" = pelo menos 1 registro válido (abastecimento/hodômetro/revisão) por mês no
período. Buraco no histórico não zera o Score, mas trava a subida de Selo (ver decaimento no
doc de gamificação).

**Chaves em `app_settings`:** `selo_bronze_score` (300), `selo_prata_score` (600),
`selo_ouro_score` (850), `selo_bronze_fipe_min` (0.82), `selo_prata_fipe_min` (0.85),
`selo_ouro_fipe_min` (0.87), `selo_ouro_fipe_max` (0.90), `selo_ouro_troca12m_fipe` (0.90).

---

## 3. Regras de validação (o que conta e o que desconta)

O detalhamento do motor de pontos está em `GAMIFICACAO-SCORE-CUIDADO.md`. Aqui, as **regras
de negócio** que o motor aplica:

### 3.1 Abastecimento (a rotina que segura a recorrência — não é manutenção)
- Abastecimento registrado **com foto do cupom + hodômetro** = pontuação cheia.
- **Nunca deixar secar / não viver na reserva:** a ficha técnica tem a capacidade do tanque.
  Abastecimento com litros ≥ 90% da capacidade = "rodou até o limite" → penalidade leve;
  3+ ocorrências no trimestre = penalidade maior + toque educativo do agente
  ("andar na reserva danifica a bomba de combustível — e pesa no seu Selo").
- **Consistência km/L:** consumo calculado fora da faixa plausível (vs. INMETRO e histórico
  do próprio carro) = registro não pontua e fica flagado para revisão. Anti-fraude.
- **Anti-retroatividade:** cupom com data > 7 dias vale metade dos pontos. Impede o "dump"
  de cupons antigos na véspera da venda.

### 3.2 Plano de revisões (o acompanhamento que você pediu)
- O sistema monta o **plano de revisões do carro** automaticamente: base = ficha técnica
  (intervalo por km/tempo do fabricante quando houver) ou padrão 10.000 km / 12 meses por item
  (óleo, filtros, velas, correia, freios, pneus, alinhamento).
- **Projeção por uso real:** com o km médio/dia do dono, o sistema projeta a DATA de cada
  revisão ("seu óleo vence ~12/09") — alimenta o Calendário e o proativo.
- Revisão comprovada = **foto da nota com CNPJ da oficina** (o OCR lê e valida). Em loja/oficina
  **parceira Totex** vale mais (verificação cruzada com o /lojista).
- Revisão vencida sem comprovação = Score congela no teto do Selo atual (não sobe até regularizar).

### 3.3 Documentos e responsabilidade
- IPVA/licenciamento/seguro em dia (o cron de vencimentos já sabe as datas): ponto por quitação
  registrada no prazo.
- Multas: registrar e resolver (pagamento ou recurso no prazo) pontua; acumular multa vencida
  sem ação congela o Score.

### 3.4 Decaimento (o Selo é um compromisso vivo)
- Dono comum: 60 dias sem registro → aviso; 90 dias → Score começa a decair e o Selo congela.
- Motorista PRO: 45 dias sem registro → mesma regra (ele roda todo dia; sumiu = parou de cuidar
  ou parou de registrar — os dois importam).

---

## 4. A matemática da margem (por que a loja paga 90% sem perder)

A conta que convence o lojista (usar na apresentação):

1. **Carro com laudo verificado gira mais rápido e vende mais caro.** Procedência comprovada
   (histórico de revisões + abastecimentos + km auditado) dá prêmio típico de 3–8% sobre a FIPE
   no varejo e reduz o tempo de pátio. A loja compra a 87–90% e revende a 95–100%+ da FIPE com
   o Selo exposto no anúncio. **Margem bruta 8–13%** vs. 5–8% de um carro sem histórico —
   com MENOS risco de "pepino" (o Score expõe negligência: reserva frequente, revisão atrasada).
2. **R$ 109,90/cliente/ano é o CAC mais barato que existe.** Um lead qualificado de portal
   custa dezenas de reais e não compra nada; aqui o lojista recebe: cliente fidelizado,
   aviso de "hora de trocar" (km alto + Selo alto + tempo de carro) e estoque de recompra
   com laudo pronto.
3. **Proteção da loja:** a garantia do Selo é condicionada à vistoria presencial confirmar o
   histórico. Divergência material (km adulterado, dano estrutural, leilão) anula a garantia —
   cláusula explícita no termo do programa.
4. **A Totex nunca compra carro.** A operação de compra/venda é 100% da loja. A Totex vende
   a infraestrutura de confiança (dados + selo + canal).

---

## 5. Recorrência para o lojista (o "todo mundo ganha")

A cortesia patrocinada (R$ 109,90/ano) JÁ existe. O que falta é o lojista **ver o retorno
todo mês**. Entregar na aba do /lojista uma **Central de Valor**:

- Selos ativos da carteira (quantos Bronze/Prata/Ouro);
- **"Prontos para troca":** clientes com Selo Prata/Ouro + km alto + tempo de carro ≥ X
  (lead quente, com botão de campanha WhatsApp em 1 clique — motor de campanhas já existe);
- Recompras fechadas originadas pelo Selo e margem estimada informada pela loja;
- Extrato: "seus R$ 109,90 renderam Y leads e Z recompras este ano".

---

## 6. Ação de marketing ("Seu histórico vale dinheiro")

1. **Na entrega do carro (o momento mágico):** o vendedor entrega o "livro digital do carro" —
   QR que instala o Co-pilot já vinculado à loja, com a frase: *"A partir de hoje, cada cuidado
   que você tiver com este carro vale dinheiro na sua próxima troca aqui."* (Atualizar
   `APRESENTACAO-CORTESIA-LOJISTA.pdf` com essa página.)
2. **Adesivo físico do Selo** no vidro (custo de centavos): "Este carro tem Selo Totex de
   Procedência" — marketing ambulante e prova social na revenda.
3. **Primeiro tanque = rito de iniciação:** no primeiro abastecimento registrado, o agente
   responde: "Pronto! Você começou a construir o valor do seu carro. Selo Bronze: faltam X pontos."
4. **Extrato mensal do Score no WhatsApp** (via compositor proativo): Score, Selo, o que falta
   pro próximo, e o valor em R$ ("seu Selo já garante R$ 4.300 a mais na troca" = FIPE × (mínimo
   do Selo − avaliação base)). **Sempre em R$, nunca só em pontos.**
5. **LP própria (`/selo`)** + seção nas LPs existentes; Flow de adesão no WhatsApp.
6. **Campanha sazonal do lojista:** "Mês da Troca Garantida — seu Selo vale até 90% da FIPE"
   via motor de campanhas, segmentando Prontos para troca.

---

## 7. Implementação (Claude Code)

### 7.1 Banco
```sql
create table if not exists care_score_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  account_id uuid references accounts(id),
  kind       text not null,        -- abastecimento | hodometro | revisao | documento |
                                   -- multa_resolvida | streak_bonus | reserva_penalty |
                                   -- retroativo_half | decay | inconsistencia_flag
  points     int not null,         -- + ou −
  meta       jsonb default '{}',   -- ex.: {"litros":40,"tanque_cap":55,"cnpj":"..."}
  created_at timestamptz default now()
);
create index on care_score_events (user_id, created_at);

alter table users
  add column if not exists care_score int default 0,
  add column if not exists care_tier text default 'none',   -- none|bronze|prata|ouro
  add column if not exists care_tier_at timestamptz,        -- quando conquistou o selo atual
  add column if not exists care_last_activity date,
  add column if not exists care_frozen boolean default false; -- congelado (revisão/decay)

-- termo de aceite do programa (LGPD + condições da garantia)
alter table users add column if not exists selo_terms_accepted_at timestamptz;
```

### 7.2 Edge functions
- **`care-score`** (nova, JWT): ações `recompute` (soma eventos, aplica tier, grava em users),
  `statement` (extrato mensal p/ WhatsApp/app), `fipe_value` (cruza tier × FIPE do carro →
  faixa garantida em R$). Chamar `recompute` a partir das tools `registrar_gasto`,
  `atualizar_hodometro` e do upload de revisão (hook no `whatsapp-webhook`, após gravar).
- **`buyback`** (existente): na avaliação, ler `care_tier` + `care_tier_at` e aplicar a faixa
  garantida; exibir no resultado ("Seu Selo Ouro garante mínimo de 87% — oferta da loja: 89%");
  registrar `selo_aplicado` em `buyback_requests`.
- **Cron `car-expiration-alerts`:** adicionar checagem de decay (45/60/90 dias sem
  `care_last_activity`), streaks (bônus 3 meses) e o extrato mensal do Score (dia 1º),
  tudo passando pelo compositor proativo (`MODULO-PROATIVO-TOTEXCAR.md`).

### 7.3 Agente WhatsApp (prompt — trecho a adicionar)
```text
SELO TOTEX (seu histórico vale dinheiro): o usuário tem um Score de Cuidado que define o Selo
(Bronze/Prata/Ouro) e a garantia de recompra na loja parceira (mínimo de 82%/85%/87% da FIPE,
teto 90% — a oferta final é da loja após vistoria). Regras de copy: NUNCA prometa 90% fixo;
diga "até 90%, conforme seu Selo e a vistoria". Ao registrar abastecimento/revisão, confirme
e cite o progresso em 1 linha quando houver mudança relevante ("+10 pontos, faltam 40 pro
Selo Prata"). Se ele perguntar "quanto vale meu cuidado?", use a tool care_statement e
responda em R$: pontos → faixa garantida → valor a mais na troca. Se andar na reserva
(litros ≈ tanque cheio), eduque sem sermão: "quase secou o tanque — a bomba agradece se
você abastecer antes da reserva, e seu Selo também".
```
- **Tool nova `care_statement`:** retorna score, tier, pontos pro próximo tier, últimos eventos,
  valor garantido em R$ (FIPE × faixa), projeção "se mantiver o ritmo, Ouro em ~X meses".
- **Upload de revisão:** a IA já lê fotos — ensinar no prompt a reconhecer nota de serviço/
  revisão (extrair CNPJ, data, km, itens) e chamar `registrar_revisao` (pontua no Score).

### 7.4 App (frontend)
- Página **`/selo`:** selo atual (visual Bronze/Prata/Ouro), barra de progresso, extrato de
  pontos, "vale em R$", plano de revisões do carro com projeções, termo do programa.
- Card no Dashboard: "Seu carro vale R$ X na troca garantida" (maior motivador — home).
- Badge do Selo na página `/recompra` e no resultado da avaliação FIPE.

### 7.5 Critérios de aceite
- [ ] Registrar tanque cheio (cupom+hodômetro) pontua e atualiza `care_score` em tempo real.
- [ ] 3 abastecimentos "secando tanque" no trimestre geram penalidade + mensagem educativa.
- [ ] Cupom de 10 dias atrás vale metade; km/L absurdo não pontua e gera flag.
- [ ] Revisão com nota (CNPJ legível) pontua dobrado em oficina parceira.
- [ ] Decay automático após 90 dias (dono) / 45 dias (PRO) sem atividade, com aviso prévio.
- [ ] Avaliação de recompra exibe a faixa garantida do Selo e grava `selo_aplicado`.
- [ ] Extrato mensal chega no WhatsApp dia 1º em linguagem humana (compositor proativo).
- [ ] Central de Valor no /lojista lista "Prontos para troca" com botão de campanha.
- [ ] Copy nunca promete 90% fixo (teste de regressão de prompt nos evals).

---

## 8. Métricas do programa
- % de usuários com Selo Bronze+ em 90 dias (meta: 35% da base ativa).
- Registros/usuário/mês antes vs. depois do Selo (a métrica-mãe da recorrência).
- Retenção D90 de quem tem Selo vs. quem não tem.
- Recompras com `selo_aplicado` e margem média reportada pelas lojas.
- Renovação da cortesia pelo lojista no ano 2 (a prova do "todo mundo ganha").
