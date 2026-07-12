# Visão — IA Co-piloto Totex

> Documento de visão de produto: transformar o agente de WhatsApp do Totex_CAR_FINANCE (TCF) de um
> "registrador de gastos reativo" em um **co-piloto do carro** — que cruza **finanças + telemetria
> (SmartGPS) + dados do veículo** e **age** pelo dono.
> Versão 1 — 2026-06-24. Relacionado: `HANDOFF.md`, doc SmartGPS em https://doc.smartgps.com.br.

---

## 1. A tese

O TCF já sabe **quanto** o carro custa (gastos, financiamento, IPVA/seguro/licenciamento, FIPE/recompra).
A SmartGPS sabe **como e onde** o carro é usado (posição, km real, viagens, ignição, velocidade, cercas,
eventos, sensores). Hoje esses dois mundos não conversam, e a IA só responde quando provocada.

**O co-piloto une os dois e fica proativo.** O dono não pergunta "quanto gastei?" — o agente avisa
*"você rodou 280 km essa semana (R$190 de combustível), a troca de óleo vence em ~300 km e o IPVA em 5 dias."*

Diferencial de mercado: nenhum app de "gastos do carro" tem telemetria; nenhum rastreador comum entende
finanças. O Totex tem os dois + um agente de IA no WhatsApp.

---

## 2. Como a IA "aprende" (arquitetura — importante)

Com Claude, a alavanca **não é fine-tuning**. É:

1. **Contexto enriquecido (snapshot):** os dados certos no prompt do sistema (já fazemos isso em
   `whatsapp-webhook` → `buildSnapshot`). Expandir com telemetria.
2. **Ferramentas (function calling / tool use):** dar à IA *funções que ela chama sob demanda* para buscar
   dado vivo (localização, viagens, consumo, status de manutenção). Hoje o snapshot é estático — a IA não
   consegue "ir buscar". Com tools, ela raciocina e consulta.
3. **Memória conversacional:** opcional — guardar o histórico recente do chat por telefone para continuidade.
4. **Avaliação (evals):** um conjunto de perguntas/respostas-alvo para medir qualidade a cada mudança de
   prompt (não é treino, é teste de regressão).

> Fine-tuning só faria sentido muito mais à frente, com volume grande de conversas rotuladas, e mesmo assim
> tool-use costuma render mais. **Foco: tools + snapshot + evals.**

### 2.1 As ferramentas do co-piloto (proposta)
Funções expostas à IA (implementadas como ações na edge, reaproveitando `smartgps` e o banco):

| Ferramenta | O que retorna | Fonte |
|---|---|---|
| `localizar_carro` | endereço, lat/lng, parado/movimento, link do mapa | SmartGPS `get_devices`+`geo_address` |
| `viagens_periodo(de,até)` | nº de viagens, km, tempo em movimento, mapa | SmartGPS `get_history` (segmentado por ignição) |
| `consumo_e_custo(de,até)` | km rodados, R$/km, km/L (se sensor), gasto combustível | SmartGPS + `transactions` |
| `status_manutencao` | itens por km, "faltam X km", vencidos | `maintenance_reminders` + hodômetro |
| `resumo_financeiro` | gasto mês, total geral, financiamento, vencimentos | `transactions`/`financiamentos`/`accounts` |
| `eventos_recentes` | cercas, ignição fora de hora, excesso de velocidade | SmartGPS `get_events`/`get_alerts` |
| `valor_de_mercado` | FIPE + oferta de recompra da loja | edge `buyback` |

---

## 3. Catálogo de funcionalidades

Cada item: **o que é → dado-fonte → o que a IA faz → esforço**.
Esforço: 🟢 baixo (1 edge/ajuste) · 🟡 médio (cron/UI) · 🔴 alto (depende de tenant/legal).

### F1 — Custo real por km + consumo 🟢🟡
- **Dado:** odômetro/histórico (SmartGPS) + gastos de Combustível (`transactions`) + sensor de combustível
  (`get_sensors`, se o tenant tiver).
- **IA:** *"Custou R$1,12/km esse mês (8% acima da sua média)."* / detecção de desvio de combustível
  ("comprou 40L, tanque subiu 25L").
- **Por que importa:** métrica que ninguém entrega; vira manchete de marketing.

### F2 — Manutenção preditiva 🟢
- **Dado:** hodômetro automático (já sincroniza) + `maintenance_reminders` (já existe).
- **IA:** alerta proativo *"faltam 300 km pra troca de óleo"*; responde "estou em dia?".
- **Extra:** espelhar com `services/{device_id}` da SmartGPS (revisões no lado dela).

### F3 — Agente proativo / briefing 🟡
- **Dado:** telemetria + vencimentos + financiamento + manutenção (fusão).
- **IA:** mensagem diária/semanal no WhatsApp (estende o cron `car-expiration-alerts`).
- **Exemplo:** *"Bom dia! Carro em casa ✅. Essa semana: IPVA em 5 dias, óleo em ~300 km, 280 km rodados (R$190 combustível)."*
- **Por que importa:** retenção + efeito "uau"; é o que justifica a mensalidade.

### F4 — Segurança / anti-furto (cercas + eventos) 🔴
- **Dado:** `get_geofences`/`add_geofence`, `get_events`, `devices_was_in_geofence`.
- **IA:** *"⚠️ Seu carro saiu da cerca 'Casa' às 02:14"* / movimento com ignição desligada (reboque).
- **Nota:** eventos variam por tenant — validar payload real antes.

### F5 — Score de direção 🟡🔴
- **Dado:** velocidade no histórico + eventos de freada/aceleração (se o device reportar).
- **IA:** nota de direção mensal.
- **Conecta a:** desconto de **seguro** e melhor oferta de **recompra/FIPE** (carro bem cuidado).

### F6 — Relatório de viagens / reembolso 🟡
- **Dado:** `get_history` segmentado por ignição (viagens) + `device_stop_time` (tempo parado).
- **IA:** relatório de km para quem usa o carro no trabalho → categoria **Reembolso** (já existe no TCF).

### F7 — "Vale a pena vender?" 🟢
- **Dado:** FIPE/recompra (`buyback`) + custo acumulado (`transactions`) + km real + score.
- **IA:** *"Você já gastou R$X em manutenção nos últimos 12 meses; a loja recompra por R$Y. Vale avaliar."*
  (gancho natural pra Fase 4 Recompra e pro marketplace/Indique.)

### F8 — Bloqueio/desbloqueio (FUTURO, sensível) 🔴
- **Dado:** `send_gprs_command`.
- **Decisão atual:** **fora do v1** (jurídico/segurança). Reavaliar como ação **admin/lojista** primeiro.

---

## 4. Roadmap proposto

| Fase | Entrega | Itens | Esforço |
|---|---|---|---|
| **0 (feito)** | Rastreador básico | `/rastreador` ao vivo + histórico, sync hodômetro, "onde está meu carro?" | ✅ |
| **1** | **IA com ferramentas** | tool-use no `whatsapp-webhook` (F-tools §2.1) + snapshot enriquecido | 🟡 |
| **2** | **Custo & consumo** | F1 + F2 (manutenção preditiva) na IA e em `/rastreador` | 🟡 |
| **3** | **Co-piloto proativo** | F3 (briefing) + F6 (viagens/reembolso) | 🟡 |
| **4** | **Inteligência de valor** | F5 (score) + F7 ("vale vender?") ligando a recompra/seguro | 🟡🔴 |
| **5** | **Segurança** | F4 (cercas/eventos), e reavaliar F8 (bloqueio) p/ admin/lojista | 🔴 |

---

## 5. Esboço técnico da Fase 1 (tool-use)

- Migrar o `whatsapp-webhook` do schema de saída único (`add_expense`/`answer`/`need_info`) para **tool use**:
  a IA recebe a lista de ferramentas (§2.1) e, ao precisar de telemetria/consumo, **chama a função**; a edge
  executa (reusando a lógica do `smartgps` e queries do banco) e devolve o resultado pra IA concluir.
- Implementação: as ferramentas viram ações internas; a maioria já existe (localização, manutenção, snapshot).
  Acrescentar: segmentação de viagens (a partir de `get_history`) e cálculo de R$/km e km/L.
- Manter o fluxo atual de **registro de gasto** (texto/foto/áudio) — tool-use é aditivo.
- **Provedor:** Anthropic (Claude) suporta tool use nativo; OpenAI e Gemini também (manter os 3 caminhos do
  `callAI`). Default Anthropic.
- **Evals:** começar um arquivo de ~20 perguntas-alvo (localização, consumo, manutenção, vencimentos, "vale
  vender?") pra medir regressão a cada ajuste de prompt.

---

## 6. Pré-requisitos e riscos

- **Credenciais SmartGPS no `/admin`** (tenant + e-mail + senha) — sem isso nada de telemetria.
- **Validar payloads reais** (`get_devices`, `get_events`, `get_sensors`) — campos variam por tenant; só
  prometer F1/F4/F5 depois de confirmar o que o device entrega.
- **Custo de IA:** tool-use faz mais chamadas; monitorar. OpenAI/Anthropic conforme `app_settings`.
- **LGPD/jurídico:** localização e bloqueio são dados/ações sensíveis. Consentimento claro do dono; bloqueio
  fica para uma fase com regras (provavelmente admin/lojista, não o dono final).
- **Rate limits SmartGPS:** `get_conn` 30/min, `send_gprs_command` 10/min, `get_devices` 60/min — respeitar
  (cachear posição; não fazer polling agressivo).

---

## 7. Métricas de sucesso

- Engajamento: % de donos que usam o agente ≥1x/semana; nº de mensagens proativas abertas.
- Retenção: churn dos que ativam o rastreador vs os que não.
- Valor: nº de "vale vender?" que viram avaliação de recompra; consultas de consumo/custo por km.
- Qualidade da IA: taxa de acerto nos evals; quedas a cada deploy.
