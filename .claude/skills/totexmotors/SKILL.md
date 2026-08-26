---
name: totexmotors
description: >-
  Cérebro operacional do ecossistema TotexMotors / TotexCar Co-pilot (assistente
  de carro no WhatsApp + vitrine + CRM TotexGest + marketplace totexmotors.com).
  Use SEMPRE que a sessão for mexer neste projeto: editar a edge function
  whatsapp-webhook ou qualquer função Supabase, o fluxo de venda (#vender
  Express/Vitrine), a vitrine/estoque, o agendamento, o brinde de 30 dias, a
  integração com o CRM, os painéis (/admin, /lojista), ou pensar
  estratégia/growth (Canal+Comunidade no WhatsApp, intermediação). Carrega o
  mapa de arquitetura, as convenções de deploy (com o "orphan commit" do merge),
  as regras do WhatsApp/Meta e o posicionamento do produto.
---

# TotexMotors / TotexCar Co-pilot — Skill operacional

Leia isto ANTES de mexer no projeto. É o mapa destilado. O log histórico completo
(sessão a sessão) está em `HANDOFF.md` (raiz) — consulte para detalhes que não
estejam aqui. As visões de produto estão em `VISAO-*.md`.

## 1. O que é (modelo mental)

**TotexCar Co-pilot** é um assistente de carro que vive **no WhatsApp** (não é app
que a pessoa precisa baixar). Faz parte do ecossistema **TotexMotors**, do stand
**Cardoso Veículos / Cardoso Prime** num shopping. Peças:

- **Co-pilot (WhatsApp):** cuida do carro do dono (gastos, consumo, manutenção por
  km, multas, IPVA/licenciamento, cofre de documentos "ArquivoZap", Modo Viagem,
  Radar de Serviços) E é concierge de compra/venda de carro (vitrine do estoque real).
- **Vitrine / Garagem Totex:** cards de carros do estoque real (marketplace) enviados
  no próprio chat.
- **Venda ("#vender"):** o dono avalia o carro (FIPE) e escolhe **Venda Express**
  (à vista, grupo de repasse, até 48h) ou **Venda Vitrine** (a loja anuncia; prazo
  20/45/90; quanto mais tempo, mais recebe). Valor por **MARGEM**, nunca "% da FIPE".
- **Agendamento:** marca avaliação presencial + sessão de fotos no estúdio (2 unidades:
  Cardoso Veículos/Carapicuíba e Cardoso Prime/Alphaville).
- **Presente do Stand:** quem escaneia o QR ganha 30 dias grátis do Co-pilot.
- **Painéis:** `/admin` (rede) e `/lojista` (loja) — funil do stand, margens, parceiros.

### Filosofia (guia toda decisão de produto)
- **WhatsApp-first, velocidade e praticidade.** A pessoa quer resolver rápido; nada de
  enrolação. Se digitou um carro, mande os cards; se não tem, diga direto que não tem.
- **Neurociência HONESTA.** Cria desejo com verdade (utilidade real, foto boa vende mais,
  ancoragem de prazo), nunca com promessa falsa. Ex.: valores da vitrine sempre marcados
  como "validados mediante avaliação formal".
- **Desintermediação a favor do cliente.** O consumidor está autônomo ("eu mesmo resolvo,
  não quero pagar o vendedor"). A gente ENTREGA esse sentimento e cobra a **intermediação
  barata** por fechar o negócio — as duas pontas ganham. Une comprador e vendedor.
- **Escopo inviolável:** o Co-pilot só fala do mundo do carro/ecossistema. Off-topic =
  recusa simpática de 1 frase + redireciona.

## 2. Norte estratégico de GROWTH (a "camada de cima" que faltava)

O motor (Co-pilot/vitrine/CRM) está pronto; falta **distribuição** (topo de funil).
Direção: **Canal + Comunidade do WhatsApp → Co-pilot → vitrine → intermediação**.

- **Use CANAL (broadcast 1→muitos) + COMUNIDADE (grupos temáticos), NÃO "grupos
  aleatórios com disparo em massa"** — disparo em massa queima o número na Meta e traz
  audiência fria. Canal não tem esse risco; Comunidade organiza os grupos.
- Cada peça de conteúdo termina com um CTA que cai no Co-pilot (link wa.me com hashtag).
- A intermediação (comissão por fechar, barata) é o modelo de receita que une as pontas.
- Regra: ideia só vale se faz o cliente parar e pensar "por que NÃO usar isso?" — tem que
  ser atrativa e dar sensação de ganho. Sem ficção; sempre operável.

Entregáveis planejados nesta ordem: **(1) esta skill → (2) Playbook Canal+Comunidade
→ (3) Piloto de 1 funil com métrica real.**

## 3. Arquitetura

| Camada | Onde |
|---|---|
| App web + edge functions | `microsaas-clean/` (React+Vite; `supabase/functions/`) |
| Supabase do Co-pilot | projeto **gkkjhnzkqhpgrwrmofev** (DB + edge functions + crons) |
| Marketplace (estoque) | **totexmotors.com** — repo SEPARADO. APIs: `/api/vehicles`, `/api/dealerships` |
| CRM | **TotexGest** — projeto Supabase SEPARADO (mztfyavuclqzivywkaeu); endpoint `receive-lead` |
| WhatsApp | Meta Cloud API (número do Co-pilot = `app_settings.meta_wa_phone_id`) |

- **Front (`src/pages/`):** Home, Auth, Dealer (/lojista), Admin, Garagem, Recompra,
  Manutencao, Multas, Viagem, Servicos, Selo, Indique, Reports, etc.
- **Config viva em `app_settings` (id=1):** `app_url`, `meta_wa_phone_id`,
  `buyback_prazos`/`buyback_express` (margens padrão da rede), `crm_lead_url`/`crm_lead_key`
  (CRM), etc. Margem por loja: tabela `dealer_sell_config`.

### Edge functions principais (`microsaas-clean/supabase/functions/`)
- **whatsapp-webhook** — o CÉREBRO (roteador + agente IA + todos os fluxos). ~3800 linhas.
- **wa-flow-endpoint** — endpoint dos **Meta Flows** (avaliação FIPE ao vivo, Radar, Viagem, NPS).
- **dealer-api** / **admin-api** — backends dos painéis (/lojista e /admin).
- **car-expiration-alerts** — crons: alertas de vencimento (diário) e **nudges do stand**
  (`?job=stand_nudge`, horário).
- **feirao-automacao**, **viagem**, **radar**, **marketplace**, **support-agent**, outras.
- Compartilhado em `_shared/` (ex.: `wa.ts` = helpers do WhatsApp; `radar-search.ts`).

### Eventos (tabela `whatsapp_events`, campo `kind`)
`stand_lead` (#stand), `stand_sell` (#vender), `stand_gift` (brinde enviado),
`sell_pending` (estado do fechamento de venda), `agenda_pending` (estado do agendamento).
O estado dos fluxos vive no `parsed` desses eventos (máquinas de estado por passo).

## 4. WhatsApp / Meta — regras que SEMPRE mordem

- **Listas interativas (`waSendMenu`):** ≤10 linhas; título ≤24 chars; **o título tocado
  volta como texto inbound** (é assim que o roteador casa a escolha).
- **Imagens: SEMPRE por MEDIA ID via `imageMediaId()`** — nunca confie na URL. A Meta rejeita
  na ENTREGA (erro 131053, silencioso) quando o host serve Content-Type inválido:
  `image/jpg` (blob BNDV/Julio) e WebP falham. `imageMediaId` baixa os bytes e re-hospeda
  com o MIME certo (sniff por magic bytes; WebP→PNG). Cache em `wa_media_cache` (25d).
- **Janela de 24h (customer service):** dentro da janela, texto livre; fora, só template
  (pago). Notificações proativas (nudges, alertas) respeitam isso.
- **Meta Flows:** as telas são JSON no Flow Builder do Meta. **NÃO dá pra editar o JSON do
  Meta por aqui** — eu ENTREGO o JSON alterado pro dono colar. Labels de TextInput ≤20 chars.
- **Busca de carro tolerante:** `carMatchesQuery()` (Levenshtein + sem acento + parcial) —
  "mustange"→Mustang. Vale na vitrine (`standVitrine`) E no `buscar_carros` do agente.

## 5. Roteador do whatsapp-webhook (precedência)

O `Deno.serve` despacha de cima pra baixo; o 1º handler que retorna `true` vence.
- **Fase A — respostas de Flow:** garagem_lead, radar, viagem_plano, recompra (FIPE), NPS.
- **Fase B — ANTES do lookup de usuário (funciona p/ não-cadastrado):** `#vender`
  (handleStandSell) → escolha modalidade/prazo → `#agendar` (handleAgenda) → **ativar brinde**
  (handleStandActivate) → "Ver mais/Nova busca" (handleStandVerMais) → busca pós-"Nova busca"
  (handleStandSearch) → `#stand` (handleStandLead) → NPS/transferência.
- **Fase C — usuário cadastrado:** menu rápido, atalhos de Flow (recompra/garagem/radar/viagem),
  "quero o painel", e por fim o **agente IA** (`runAgent`, 30+ ferramentas: registrar_gasto,
  consumo, manutenção, multas, ArquivoZap, buscar_carros, planejar_viagem, radar, fiscal…).
- **Não-usuário do stand:** `handleStandFollowup` re-engaja (vitrine/vender/ativar).

### Brinde de 30 dias (importante)
`sendStandGift` (dedup por `stand_gift`) manda card + botão "Ativar 30 dias grátis".
Ativação: `handleStandActivate` (gate = `stand_gift`, exige a palavra "ativar") →
`activateStandTrial` (cria conta email sintético `@totexcarfinance.app`, sem senha,
`trial_ends_at` +30d). O trigger de banco `handle_new_user` também concede 30d se houver
`stand_lead` OU `stand_sell` <90d. **Vale para #stand E #vender.**

### CRM (TotexGest)
`pushToTotexgest()` no `finalizeSellLead` (e no agendamento) faz `POST` pro `receive-lead`
com header `x-api-key`. Payload: `name, phone, source=totexcar-copilot, utm_source=whatsapp,
utm_campaign, subject, notes/message/description, custom{...}`. **Awaited** (fire-and-forget
via waitUntil era cortado no teardown do isolate). O lado do CRM registra como nota/atividade.

## 6. Deploy — o passo a passo (e a armadilha)

Fluxo padrão: **editar → commit → push na branch → PR → merge → push na main deploya sozinho.**

- **Deploy das edge functions:** `.github/workflows/deploy-functions.yml` (Supabase CLI v1
  pinado 1.226.4, `--no-verify-jwt`). Dispara no **push na main** (paths `functions/**`) e por
  **workflow_dispatch** (input `function`, default `whatsapp-webhook`). Front: `deploy.yml` (Vercel).
- **⚠️ ARMADILHA "orphan commit" (já mordeu PRs #17, #20, #24):** às vezes o merge do GitHub
  usa um head ANTIGO do PR → seu último commit fica órfão (não entra na main, não deploya).
  **SEMPRE, depois do merge, confira:** `git log --format='%H %P' -1 origin/main` — o **2º
  parent** tem que ser o SHA que você pushou. Se não for → `git cherry-pick <sha órfão>` numa
  branch limpa da main → novo PR → merge → reconfira.
- **Migrations de DB:** aplicar via `mcp__supabase__apply_migration` no projeto
  gkkjhnzkqhpgrwrmofev (o repo não roda migração no deploy). Config/secrets de runtime que não
  dá pra setar por MCP vão em `app_settings` (só service role lê).
- **Confirmar deploy verde:** `mcp__github__actions_list`/`actions_get` (conclusion=success) e,
  se quiser certeza do código no ar, `mcp__supabase__get_edge_function` + grep no arquivo salvo.
- **Logs:** `mcp__supabase__query_logs` — `source='function_logs'` traz o `console.*` (erros e
  `META DELIVERY FAIL`); `function_edge_logs` é o gateway HTTP.

### Convenções de git desta sessão
- Trabalhar na branch designada; PR pra `main`; nunca pushar direto em outra branch sem ok.
- Fuso do Brasil = UTC-3 (sem horário de verão); quiet hours calculadas em BRT.
- **Nunca** colocar identificador de modelo em commit/PR/código. Rodapé de commit com
  co-author "Claude Opus 4.8" + linha Claude-Session (padrão da sessão).
- Posts no GitHub levam o rodapé de atribuição.

## 7. Guardrails (não negociáveis)
- **Honestidade com o cliente:** nada de enganar. Valores "a validar" ficam marcados.
- **Nada de conselho fiscal definitivo** ("sou seu copiloto, não seu contador"); a parte
  fiscal/tributária da intermediação precisa de validação de contador.
- **Escopo:** só mundo do carro/ecossistema.
- **Privacidade:** a loja vê engajamento/tipo de ação do cliente, nunca o conteúdo das conversas.

## 8. Docs de referência (raiz do repo)
`HANDOFF.md` (log histórico completo, sessão a sessão — a fonte da verdade dos detalhes),
`VISAO-IA-COPILOTO-TOTEX.md`, `VISAO-MOTORISTA-PRO-TOTEX.md`, `VISAO-MODO-VIAGEM-TOTEX.md`,
`VISAO-AGENTE-ANTIMULTAS-TOTEX.md`, `VISAO-CARRO-CONECTADO-TOTEX.md`,
`PROGRAMA-SELO-TOTEX-RECOMPRA.md`, `CALENDARIO-DO-CARRO.md`, `GAMIFICACAO-SCORE-CUIDADO.md`,
`MODULO-PROATIVO-TOTEXCAR.md`, `RELATORIO-IR-MEI.md`, `TEMPLATES-WHATSAPP-META.md`,
`CONTRATO-OS-FASE3.md`.
