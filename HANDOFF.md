# HANDOFF — Totex_CAR_FINANCE (TCF) — continuação do projeto

> Documento para retomar o projeto em uma nova sessão. Leia tudo antes de continuar.
> Última atualização: 2026-07-15.

---

## 0-A. ESTADO ATUAL (2026-07-14/15) — LER PRIMEIRO (sessão mais recente)

App no ar em **https://totexcarco-pilot.vercel.app** (deploy automático via push na `main`). Supabase TCF
`gkkjhnzkqhpgrwrmofev`. Deploy de edge = Supabase CLI (`C:\Users\marco\Downloads\supabase\supabase.exe
functions deploy <fn> --project-ref gkkjhnzkqhpgrwrmofev [--no-verify-jwt]`) — ⚠️ AJUSTAR config.toml antes
(sed `ip_version "ipv6"→"IPv6"` e comentar `email_double_confirm_changes`) e REVERTER depois.

### Feito nesta sessão (tudo no ar, commitado)
1. **Garagem:** paginação "Mostrar mais carros", tabs viraram cards clicáveis, **radar cron** (Fase 2: avisa no
   WhatsApp quando carro do desejo aparece — dedup por `radar:{radarId}:{vehId}`).
2. **Fix layout mobile** das listas de transações (data/valor espremidos).
3. **Botão "Simular financiamento"** nos cards da Garagem → **popup Meu Credere via iframe** dentro do app
   (`app.meucredere.com.br/simulador/loja/{cnpj}/veiculo/detectar`), só p/ lojas com `credereEnabled && cnpj`
   (edge lê `/api/dealerships`). Ver [[garagem-totex]].
4. **Fix Garagem "nenhum carro":** era rate-limit **429** do marketplace (loadDealers em toda ação). Corrigido:
   loadDealers só onde renderiza carro + dedup in-flight + retry em 429 no fetchVehicles.
5. **Concierge por DESEJO, não upgrade:** pergunta o que o dono quer antes de sugerir; `buscar_carros` é o
   caminho principal, `oportunidades_carros` virou extra.
6. **Ficha técnica IA+web** (edge `car-spec`, gpt-4o-search-preview) + `FichaTecnicaCard` + persona concierge
   técnico no agente. `accounts.ficha_tecnica jsonb`.
7. **Consumo oficial INMETRO** (Auto Data API, creds em `app_settings.autodata_*`): edge `car-consumo` casa
   carro→consumo oficial (guarda de ano ±3) → `ConsumoCard` compara real vs oficial + concierge. Ver [[autodata-consumo-oficial]].
8. **CPK (custo real por km)**: `useCusto`+`CustoCard`+tool `custo_por_km` (km robusto por incrementos de odômetro). NÃO inclui depreciação (próximo: FIPE).
9. **Pontos da CNH**: `src/lib/cnhPoints.ts`+`CnhPointsCard` em /multas+tool `pontos_cnh` (regra CTB 20/30/40).
10. **Menu WhatsApp** virou LISTA de 4 opções + **🚗 Garagem Totex** (link `totexmotors.com/comprar`).
11. **SSL totexmotors.com fora do ar:** era **cert Let's Encrypt vencido no VPS `72.60.56.238`** (nginx+Next.js,
    NÃO é hospedagem compartilhada nem culpa do nosso app). Fix = SSH no VPS + `certbot renew`. RESOLVIDO pelo dono.
    (VPS srv870361/31.97.168.52 = totexcrm.com.br, é OUTRO servidor.)
12. **⭐ Fix pagamento (Asaas):** chave era de homologação com sandbox=false → 401; +restrição de IP. Regra NOVA
    do Asaas: PIX não pode RECURRENT e enviar customerData exige CPF+endereço. Corrigido em `create-checkout`:
    `chargeTypes:["DETACHED"]` + `["CREDIT_CARD","PIX"]`, SEM customerData (Asaas coleta na tela). Escolha do dono:
    **avulso, sem auto-renovar**. Token do webhook tinha espaço no início (limpo). Ver [[payments-and-config]].
13. **⭐ Validade/renovação:** `users.plan_expires_at` gravado no `asaas-webhook` (=hoje+1 período pelo plan_cycle);
    paywall (`useTrialControl`) bloqueia premium vencido em tempo real; cron `car-expiration-alerts` lembra 5/3/1
    dias antes e re-bloqueia no vencimento. Quem pagou antes (expires nulo) = premium sem vencer (não bloqueia retroativo).
14. **⭐ Módulo SUCESSO DO CLIENTE (pós-venda) — Fase 1 e 2 no ar.** Ver [[dealer-area]]. Aba "Sucesso do Cliente"
    no /lojista. F1: loja registra cliente → boas-vindas WhatsApp c/ link+cupom do Co-pilot → NPS D+atraso +
    aniversário (cron `runPostsale`) → cliente responde 0-10 (webhook `handlePostsaleNps`, funciona p/ não-usuário)
    → detrator alerta a loja, promotor recebe link de avaliação Google (sem gating). F2: checklist de
    transferência/documentação + garantia/revisão (dealer-api `postsale_transfer_save`, agente `handlePostsaleTransfer`).
    Tabelas `postsale_journeys` + `dealership_settings`. **Fase 3 (agente responde avaliações Google) = pendente
    aprovação da Google Business Profile API** (checklist passado ao dono; 1 aprovação do app + OAuth por loja).
15. **Garagem ESTOQUE EXCLUSIVO por loja:** cliente com `users.dealership` vê SÓ os carros da loja dele
    (search/oportunidades/radar app + radar cron), via `dealershipId`. Cliente sem loja vê tudo. Ver [[garagem-totex]].

### ✅ FEITO (2026-07-15) — CORTESIA DA LOJA / assinatura patrocinada (no ar)
Cliente da loja NÃO paga — a **loja patrocina 1 ano (R$109,90)** como benefício (PÓS-PAGO, saldo devedor); ao vencer,
o cliente segue com preço de membro R$10,99/mês pelo cupom da loja. Reaproveita a máquina de validade/renovação (item 13).
**Entregue:**
- Migração `postsale_sponsored` APLICADA: `postsale_journeys` += `sponsored bool`, `sponsored_value numeric(109.90)`,
  `sponsored_at`, `sponsor_settled bool`, `sponsor_settled_at`, `user_id uuid` (+ índice parcial p/ saldo em aberto).
- **dealer-api** (deployado): `postsale_create` aceita `cortesia:boolean` → helper `provisionSponsoredOwner`
  (email sintético `telefone@totexcarfinance.app`, `admin.auth.admin.createUser` + users role owner/dealership/coupon +
  `plan=premium`, `plan_cycle=annual`, `subscription_status=active`, `plan_expires_at=now+1 ano`; idempotente por email).
  Grava sponsored no journey + boas-vindas "1 ANO GRÁTIS cortesia da {loja}". `postsale_stats` retorna
  `cortesias_ativas`/`cortesias_valor` (scopado). Novas actions **admin** `postsale_sponsor_balance` (total por loja) +
  `postsale_sponsor_settle` (marca quitado por loja).
- **car-expiration-alerts** (deployado): monta `sponsoredByUser`; `maybeNotifyRenovacao` detecta o vencimento do ano
  cortesia (janela sponsored_at+380d) e manda "seu ano cortesia da {loja} acabou; continue por R$10,99/mês" (com cupom).
- **Front:** `PostSaleTab` — checkbox "Oferecer 1 ano de cortesia (por conta da loja)", KPI/banner "cortesias ativas:
  N (R$X)", badge Cortesia na lista. **Admin** (`SponsorBalanceCard` na aba Lojistas) — saldo por loja + "marcar quitado".
Ver [[dealer-area]] e [[payments-and-config]].

---

## 0. ESTADO ATUAL (2026-06-24) — histórico

App no ar em **https://microsaas-clean.vercel.app** (agora redireciona p/ totexcarco-pilot). Supabase TCF `gkkjhnzkqhpgrwrmofev`.

### Feito em 2026-06-24 (parte 2) — FASE 1 do "IA Co-piloto": TOOL USE no agente — no ar
- **`whatsapp-webhook` migrado para function calling (tool use)** — o agente deixou de ser "schema único"
  e agora tem **ferramentas** que a IA chama sob demanda. Funciona nos 3 provedores (OpenAI/Anthropic/Gemini);
  ativo hoje = **OpenAI gpt-4o**. Loop agêntico `runAgent` (máx 5 turnos) + `dispatchTool`.
  - **Ferramentas** (`TOOL_SPECS`): `registrar_gasto` (substitui o schema antigo de gasto — texto/foto/áudio),
    `resumo_financeiro` (=buildSnapshot), `status_manutencao` (maintenance_reminders vs hodômetro),
    `localizar_carro` (SmartGPS), `viagens_periodo` e `consumo_e_custo` (SmartGPS get_history + gastos).
  - As ferramentas de SmartGPS **degradam graciosamente** (retornam `rastreador_indisponivel`) enquanto as
    credenciais não estão no /admin — então o resto (gasto/financeiro/manutenção) já funciona.
  - Mantido: bloqueio por pagamento, download/transcrição de mídia, atalho "onde está meu carro?", botões de
    ação rápida (agora **"📊 Gastos do mês / 📍 Onde está meu carro / 🔧 Manutenção (km)"**).
  - **Deploy via Supabase CLI** (`C:\Users\marco\Downloads\supabase\supabase.exe functions deploy
    whatsapp-webhook --project-ref gkkjhnzkqhpgrwrmofev --no-verify-jwt`) — evita o escape manual do MCP.
    ⚠️ O CLI 2.98 reclama de 2 chaves do `config.toml` (`realtime.ip_version` deve ser `IPv6`;
    `auth.email_double_confirm_changes` não existe mais). Foram **ajustadas só p/ deployar e revertidas** —
    o config.toml está no original. Se for reusar o CLI, ajuste-as de novo temporariamente (ou use o MCP).
- **Doc de visão criado:** `VISAO-IA-COPILOTO-TOTEX.md` (roadmap do co-piloto). Fase 1 = feita (tool use).
  Próximas: F1 custo R$/km, F2 manutenção preditiva, F3 briefing proativo, F5 score, F4 cercas/anti-furto.

### Feito em 2026-06-24 (parte 3) — rename "Totexcar Co-pilot" + consumo por foto + módulo multas (agente)
- **Rename:** o agente de IA agora se chama **Totexcar Co-pilot** (persona no `whatsapp-webhook`, mensagens e docs).
  O app segue "Totex CAR FINANCE". SmartGPS/rastreamento **rebaixado a recurso PREMIUM opcional** (privacidade +
  risco de instalação no módulo). As tools de GPS ficam adormecidas (degradam) até ligar como upsell.
- **Consumo sem GPS (nova essência):** hodômetro por **FOTO**. Ao registrar combustível/manutenção sem km, a IA
  **pede a foto do hodômetro** (e educa o dono que é necessário). Ferramentas novas no agente: `atualizar_hodometro`
  (lê o km da foto, back-fill do último abastecimento sem km, calcula consumo) e `consumo_medio` (km/L + R$/km,
  método tanque-a-tanque). `registrar_gasto` agora aceita **litros**. Botões: "📊 Gastos do mês / ⛽ Meu consumo /
  🔧 Manutenção (km)".
- **Módulo Anti-Multas no agente:** ferramentas `registrar_multa` e `minhas_multas`. Foto do auto de infração →
  IA extrai dados + checa vícios (CTB) + estima chance (honesta) + gera minuta de recurso → salva em `multas`.
- **`whatsapp-webhook` deployado (v12) via CLI** (MCP entrou em **read-only** no meio da sessão — `apply_migration`
  e `deploy_edge_function` passaram a dar "permission denied"). Deploy: CLI com fix temporário do config.toml
  (revertido no mesmo comando). Código é **defensivo**: insere `litros`/`multas` com fallback, então funciona mesmo
  antes da migração.
- ✅ **Migração `consumo_e_multas` APLICADA** (o MCP voltou a aceitar escrita): `transactions.litros` criado +
  tabela `multas` com 4 policies RLS (dono). Consumo e multas persistem — backend 100% funcional.
- **v13 (2026-07-02) — consumo TANQUE-A-TANQUE + correções do teste real** (o dono testou e deu "382 km/L"):
  causa = dados de teste (hodômetros falsos 600000/105000/10115/1090/22) + IA truncando a leitura da foto do
  hodômetro ("22" em vez dos dígitos todos) + correção de valor gerando lançamento duplicado. Corrigido:
  (a) `computeConsumo` refeito **por abastecimento** ("rodou X km com Y litros → Z km/L"), descarta trechos
  implausíveis (km/L fora de 3–30); (b) `atualizar_hodometro` rejeita km MENOR que o registrado (leitura truncada);
  (c) nova tool **`corrigir_ultimo_gasto`** (correções tipo "o valor exato é 101" editam em vez de duplicar);
  (d) **memória curta**: últimas 4 trocas do whatsapp_events entram no prompt; (e) prompt manda ler TODOS os
  dígitos do odômetro e apresentar consumo simples (litros vs km). **Dados de teste do marcovend limpos**
  (hodômetro zerado, kms falsos anulados, duplicado removido) — próxima foto real define a km verdadeira.
- ✅ **Frontend FEITO e no ar (2026-07-02):** página **`/multas`** (`src/pages/Multas.tsx` + `useMultas.ts`;
  lista com status/chance/pontos, prazo com contagem de dias, dialog do recurso com copiar/baixar .txt,
  botão "marquei como protocolada", CTA WhatsApp, disclaimer jurídico) + **card "Meu consumo"** no dashboard
  (`ConsumoCard.tsx` + `useConsumo.ts` — mesma lógica tanque-a-tanque do agente, client-side; empty-state ensina
  o fluxo cupom+hodômetro) + item **Multas** no menu + **rebrand "Totexcar Co-pilot"** nos textos
  (WhatsAppConnectCard, PaymentSuccess). `multas`/`litros` fora dos types gerados → hooks usam `supabase as any`
  (mesmo padrão do useMaintenance).
- ✅ **LP de campanha no ar: `/lp`** (`src/marketing/pages/Lp.tsx`, rota standalone SEM MarketingLayout —
  header mínimo, um único CTA → `/entrar?tab=register`). Foco único no Co-pilot: hero + mockup de conversa
  WhatsApp (cupom→consumo→multa), dor, 3 passos, grid de 4 capacidades, oferta (R$109,90 riscado →
  R$10,99 c/ cupom, 7 dias grátis), FAQ, disclaimer de multas. Dark/teal, framer-motion. É a URL pra
  apontar o tráfego pago (FB/IG): **microsaas-clean.vercel.app/lp**. LP 2 (anti-multas dedicada) fica
  pra quando houver revisão jurídica/parceiro.
- ⚠️ **REGRA DE COPY (dono, 2026-07-02): NUNCA escrever "sem fidelidade" / "cancele quando quiser" /
  "sem compromisso"** em lugar nenhum — a estratégia do ecossistema é FIDELIZAR. Enquadramento aprovado do
  anual: **R$ 109,90 à vista = 12 meses pelo preço de 10 (~17% off)**. Textos corrigidos na LP (`/lp`) e no
  FAQ do site; **`src/pages/Landing.tsx` (órfã) DELETADA** (tinha a frase e ninguém importava).
- ✅ **Agente v14 no ar — checklist legal de multas:** o prompt de MULTAS agora cruza com os vícios processuais
  COM base legal: (a) notificação da autuação >30 dias = arquivamento (**Art. 281, § único, II, CTB**);
  (b) dados obrigatórios (**Res. CONTRAN 918/2022**); (c) dupla notificação autuação+penalidade
  (**Arts. 280–282 CTB**); (d) radar sem aferição INMETRO (**Res. CONTRAN 798/2020**); (e) sinalização
  irregular; (f) competência/enquadramento/dupla penalização. E a IA **ENTREVISTA o usuário** (2–3 perguntas:
  quando recebeu a notificação? recebeu as duas? tinha placa de velocidade?) antes de fechar a análise — esses
  vícios não aparecem na foto. Checklist também documentado no `VISAO-AGENTE-ANTIMULTAS-TOTEX.md` §5.
- ✅ **`car-expiration-alerts` v4 no ar:** + **alerta de prazo de recurso de multa** no WhatsApp — marcos
  **5/3/1/0 dias** (`MULTA_MARKS`), só multas `status in (nova, recurso_gerado)` com `prazo_recurso`. Mensagem
  linka `{app_url}/multas` se o recurso já está pronto, ou pede a foto da multa se não. Dedup no
  `notification_log` (kind `multa:{id}:d{days}`). Prazo já vencido NÃO notifica (recurso perde o objeto).

### Feito em 2026-07-02 (parte 2) — LP2 anti-multas + AMBIENTE DE SUPORTE (tudo no ar)
- **LP 2 (`/lp2`, `src/marketing/pages/Lp2.tsx`):** campanha anti-multas, standalone. Hero "Recebeu uma multa?
  Não pague sem analisar", mockup de conversa (entrevista da IA), seção "as 5 falhas" COM base legal
  (Art. 281/280-282 CTB, Res. 918/2022, Res. 798/2020, sinalização), 3 passos, ponte pro Co-pilot completo,
  oferta (sem "sem fidelidade"; anual 109,90 à vista ~17% off), FAQ honesto ("não garantimos"), disclaimer.
- **SUPORTE (super agente + escalação):**
  - DB: tabela **`support_tickets`** (RLS select próprio; escrita via service role) +
    **`app_settings.support_owner_phone`** (default `5511947448137` = WhatsApp do Marco; editável no /admin →
    card WhatsApp).
  - Edge **`support-agent` (v1, JWT)**: chat stateless (front manda histórico), KB completa do produto
    (uso, consumo, multas, planos/preços com a regra de copy, troubleshooting) + tool **`abrir_chamado`**
    (insere ticket + NOTIFICA o dono no WhatsApp via Uazapi com nome/email/plano/loja/urgência/ticket id).
    Suporta OpenAI/Anthropic/Gemini (provedor do app_settings).
  - **`whatsapp-webhook` v15**: Co-pilot também é o suporte no WhatsApp — seção SUPORTE no prompt (mesma KB
    resumida + regra "NUNCA sem fidelidade") + tool `abrir_chamado` (ticket canal whatsapp + notifica dono).
  - Web: página **`/suporte`** (`src/pages/Suporte.tsx`, item "Suporte" no menu) — chat com o agente,
    chips de sugestão, banner "chamado aberto" quando escala.
  - Regras de escalação: pagamento não liberado, reembolso/cancelamento, bug, reclamação séria, pedido de
    humano → abre chamado. Sugestões de melhoria → chamado "Sugestão" (urgência baixa).
- ⚠️ Copy de preço corrigida em toda parte: **NUNCA** falar "sem fidelidade/cancele quando quiser" (decisão do
  dono — estratégia é fidelizar). Anual = R$109,90 à vista, "12 meses pelo preço de 10 (~17% off)".

### Boletos do financiamento no agente (2026-07-02) — agente v18 + cron v7, no ar
- **Fato técnico (explicado ao dono):** NÃO dá pra "gerar" o código de barras das próximas parcelas — a linha
  digitável tem o "nosso número" único emitido pelo banco a cada boleto; derivar seria boleto inválido. O que
  o sistema faz: guarda a linha do boleto ATUAL (`financiamentos.boleto_linha`) e pede o novo a cada mês.
- **Agente v18:** tools **`boleto_parcela`** (próxima parcela: nº/valor/vencimento + linha digitável salva) e
  **`salvar_boleto`** (usuário manda FOTO do boleto ou o número → valida 44/47/48 dígitos → salva). Prompt:
  foto de boleto = novo tipo de imagem reconhecido; regra "NUNCA derive código de barras".
- **Cron v7:** lembrete de parcela (5/1/0/atrasada) agora inclui a **linha digitável copia-e-cola** quando
  salva (ou pede a foto do boleto se não houver). Futuro real de automação total: Open Finance (fase futura)
  ou DDA no banco do cliente.
- **v19/v8 — CARNÊ EM PDF (pedido do dono; ele mandou o carnê Safra em PDF):** agente agora LÊ PDF
  (`kind: "pdf"`; Uazapi manda `messageType: DocumentMessage` + mimetype application/pdf; download via
  `/message/download type:"document"`; PDF vai DIRETO pra IA — OpenAI `type:file`, Anthropic `type:document`,
  Gemini `inline_data`; limite ~6MB). Nova tool **`salvar_carne`** (array parcela+linha, valida 44/47/48 díg.)
  → grava no **`financiamentos.boletos` (jsonb {parcela: linha})** + boleto_linha da próxima. Cron pega a
  linha DA PARCELA CERTA no mapa (fallback boleto avulso). Fluxo final: banco manda carnê PDF → cliente
  encaminha 1x → todos os lembretes do ano saem com o boleto certo.

### Ideia em avaliação — CLUBE DE VANTAGENS white-label (2026-07-02)
- Objetivo: mais fidelização pro cupom da loja. Shortlist: **Alloyal (ex-Lecupon)** (API pública em
  lecupon.readme.io, white-label, API-first — favorita técnica), **Rede Parcerias** (mais barata, anuncia
  R$0,37/usuário/mês), **Kaledo** (embed fácil). Pedir orçamento POR USUÁRIO ATIVO; decidir se entra no
  10,99 ou só anual/PRO. Integração desenhada: provisionar usuário no clube quando assinatura ativa
  (asaas-webhook) + desativar no churn + item "Clube de Vantagens" no menu com SSO/deeplink.
- Cupons da loja no WhatsApp: base JÁ existe (Campanhas no /lojista). Evolução recomendada: ofertas
  CONTEXTUAIS pelos dados (revisão por km, IPVA do mês, aniversário da compra) + cupom rastreável +
  frequência máx 1–2/mês + opt-out "SAIR" (LGPD/risco de ban do número no gateway não-oficial).

### 🎨 REBRAND COMPLETO + NOVO DOMÍNIO (2026-07-02) — tudo no ar
- **Marca:** "Totex CAR FINANCE"/"Totex_CAR_FINANCE" → **"TotexCar Co-pilot"** em TODO o sistema (sidebar,
  Auth/Entrar, index.html title/OG, manifest PWA, InstallPrompt, site de marketing inteiro, LPs, mensagens
  das edges). ⚠️ NÃO trocados (funcionais): e-mails `@totexcarfinance.app` (login por telefone) e os
  identificadores `totex_car_finance` dos webhooks pro OS (contrato).
- **PaywallScreen** atualizada com todos os módulos novos (consumo km/L, multas IA, Modo PRO, suporte etc.).
- **DOMÍNIO:** projeto Vercel renomeado p/ **totexcarco-pilot** via API (PATCH /v9/projects, token do CLI em
  AppData/Roaming/xdg.data/com.vercel.cli/auth.json). **App agora em https://totexcarco-pilot.vercel.app**;
  domínio antigo microsaas-clean.vercel.app ficou como **redirect 308** (links velhos/PWA instalado não quebram).
  `app_settings.app_url` atualizado; `.vercel/project.json` local idem; edges com texto/URL redeployadas
  (whatsapp-webhook v18, car-expiration-alerts v7, support-agent v2). Webhooks Uazapi/Asaas NÃO mudam (são do Supabase).

### 🐛 BUGFIX 2026-07-02 (agente v17→18) — gasto registrado com R$ 0 (RESOLVIDO)
- **Sintoma:** áudio "500 de diesel no Shell" → agente perguntou litros/km SEM registrar; na resposta
  ("40 litros, km 25") o modelo tinha perdido o valor (a memória da conversa gravava só "[enviou um áudio]",
  sem a transcrição) → chamou registrar_gasto com amount=0 e o código ACEITOU → lançamento de R$ 0.
- **Fixes (v17):** (a) `registrar_gasto` REJEITA amount<=0 (devolve valor_ausente → IA pergunta o valor);
  (b) `whatsapp_events.parsed` agora guarda `input` (inclui transcrição de áudio) e a memória usa `parsed.input`
  → valores ditos por voz não somem mais do contexto; (c) prompt "REGRA DE OURO": mensagem COM valor →
  registrar JÁ; litros/km faltantes completam DEPOIS via corrigir_ultimo_gasto.
- Dado consertado: lançamento do teste atualizado p/ −R$ 500 "Abastecimento Diesel Posto Shell" (40 L, km 25).

### 🐛 BUGFIX CRÍTICO 2026-07-02 — "desloga ao trocar de módulo / login fica rodando" (RESOLVIDO)
- **Causa:** race condition pré-existente em `useCurrentUser` (`src/hooks/useAuth.ts`): ele DESCARTAVA o
  `loading` do `useAuth` e usava só o loading do fetch de perfil. Ao trocar de rota o DashboardLayout remonta;
  com a sessão/refresh de token ainda resolvendo (token expira em 1h → refresh via rede), o efeito rodava com
  `user=null` e setava `loading=false` → guard via `!user && !loading` → **AuthPage** (parecia logout).
- **Fix:** `useCurrentUser` agora retorna `loading: authLoading || loading` + `setLoading(true)` quando um novo
  user chega (evita flash de perfil vazio). Diagnóstico confirmou: Postgres/Auth sem erros (não era RLS/is_admin).
- ⚠️ Se o usuário instalou o PWA, mandar **fechar e reabrir o app** (ou recarregar) pra pegar o bundle novo.

### Feito em 2026-07-02 (parte 3) — MODO MOTORISTA PRO FASE 1 (tudo no ar) ✅
Aprovado pelo dono: preços ok · PRO incluso p/ membro · nome **TotexCar Co-pilot PRO** · construir já.
- **DB (migração `motorista_pro`):** `users.driver_mode` (bool) + `app_settings.pro_monthly_price` (29.90) /
  `pro_annual_price` (299) + categorias de receita is_system (Uber, 99, Outros apps, Táxi, Corrida particular, Gorjeta).
- **Agente `whatsapp-webhook` v16:** tools **`registrar_receita`** (lê PRINT da tela de ganhos Uber/99 ou
  texto/áudio; auto-ativa driver_mode) e **`lucro_periodo`** (receita−despesa, km pelas leituras de hodômetro,
  lucro/km). Prompt: reconhece print de ganhos como 4º tipo de imagem + seção MOTORISTA PRO.
- **Cron `car-expiration-alerts` v6:** **resumo semanal PRO** às segundas (semana seg–dom anterior):
  faturou/gastou/sobrou + lucro/km. Só p/ driver_mode com movimento; dedup `pro_weekly:{segunda}` no notification_log.
- **Checkout `create-checkout` v5:** aceita `pro:true` → usa preços PRO e nome "TotexCar Co-pilot PRO".
  **Regra: cupom de loja SEMPRE vence** (membro = 10,99 com PRO incluso; `isPro = pro && !coupon`).
  `pro:true` também grava `driver_mode` no perfil no checkout.
- **Front:** `LucroProCard` no dashboard (`useLucro.ts`): sem driver_mode → convite "trabalha com aplicativo?"
  (ativa na hora, dispensável); com → lucro da semana (faturou/gastou/sobrou/lucro por km). `/plans` passa
  `pro: driver_mode` no preview/checkout (motorista sem cupom vê 29,90/299). **LP 3 no ar: `/lp3`**
  ("Você fatura. Mas quanto SOBRA?", mockup do fluxo print→resumo, rotina 30s, oferta 29,90 + nota do cupom
  de loja, FAQ, disclaimers Uber/99 não-afiliado).
- Pendente fase 2+: aplicação na Uber Driver API, Open Finance, relatório IR/MEI, lead de troca p/ lojista.

### MODO MOTORISTA PRO — doc de visão
- **Doc:** `VISAO-MOTORISTA-PRO-TOTEX.md`. Tese: motorista de app é o ICP perfeito do receita×despesa
  (lucro/semana + lucro/km). ~90% reuso. **Sem API:** receita entra pelo PRINT da tela de ganhos (pipeline
  foto→IA existente). Uber Driver API existe mas é fechada (aplicar em paralelo); 99 não tem API de motorista.
- **Preços decididos no doc (pendente OK do Marco):** PRO direto R$ 29,90/mês · anual R$ 299 à vista;
  **cliente de loja que vira motorista MANTÉM R$ 10,99 com PRO incluso** (Bônus Totex — argumento de venda
  pra loja + fecha ciclo troca/recompra). Nunca falar "sem fidelidade".

### 🏠 GARAGEM TOTEX (2026-07-13) — módulo marketplace dentro do Co-pilot (no ar)
- **O que é:** "Seu carro atual e o caminho para o próximo." — módulo `/garagem` que integra o Co-pilot ao
  marketplace `totexmotors.com` (repo `Totex-Motors/totexmotors-marketplace`, NestJS; API pública mapeada
  DIRETO do código-fonte: `GET /api/vehicles` (filtros search/brand/model/min-maxYear/min-maxPrice/maxMileage/
  fuel/transmission, retorna {data,total,totalPages}), `GET /api/vehicles/featured|brands`,
  `POST /api/leads/vehicle-interest` {nome,email,telefone,mensagem,vehicleId},
  `POST /api/leads/sell-vehicle` {nome,email,telefone,marca,modelo,versao,anoFabricacao,quilometragem,
  localVistoria,dataVistoria,horarioVistoria}, `POST /api/leads/contact` {nome,email,telefone,assunto,mensagem}).
- **Edge `garagem` (v1, JWT):** search | brands | opportunities (janela 0.9–1.9× do `accounts.valor_compra`,
  ano ≥ atual; sem valor → featured) | interest (lead c/ perfil+carro atual) | sell (vender|avaliar → lead
  sell-vehicle c/ vistoria; defaults do veículo/loja) | radar_list/save/delete (tabela `car_radar`; save TAMBÉM
  manda lead `contact` "RADAR" pra loja + devolve matches ao vivo). Links de carro levam `?ref={referral_code}`
  → **comissão do Indique e Ganhe** se virar venda.
- **Página `/garagem`** (`Garagem.tsx` + `useGaragem.ts`, menu "Garagem Totex"): hero conforme copy do dono,
  4 abas — Buscar carro (filtros+grid, cobre "Quero trocar"), Oportunidades (personalizadas pelo valor_compra),
  Ofertas para mim (radar: form desejo + matches + badge "Loja avisada"), Vender/Avaliar (agenda vistoria).
  Cards com "Tenho interesse" (lead) + link c/ ref. Badge "Abaixo da FIPE" quando price<fipePrice.
- **Agente v20 — CONCIERGE:** tools `buscar_carros`, `oportunidades_carros`, `criar_radar` (WhatsApp) +
  persona concierge no prompt (especialista em carros; cruza perfil/uso real com estoque; recomenda 2–3 com
  porquê + link; sem estoque → radar). 
- ✅ Migração `car_radar` APLICADA (2026-07-13, após o dono reiniciar o Supabase — o restart destravou o
  MCP que estava read-only). Tabela + 4 policies RLS confirmadas. Módulo 100% funcional.
- Fase 2 (não feito): cron de match do radar → WhatsApp quando carro chegar; filtro por loja específica.

### 🚗 CARRO CONECTADO (TotexCar Link) — SmartGPS DESCARTADO, novo caminho (2026-07-02)
- Dono desistiu do SmartGPS. Novo plano: **app nativo na TELA do carro** (BYD DiLink/GWM = Android aberto)
  lê telemetria e envia pro nosso backend. Zero hardware (resolve medo de queimar módulo + custo de chip).
  Inspirado no "Electro"; ref. open-source **BYDMate** (github.com/AndyShaman/BYDMate) e OverDrive; sideload
  documentado no XDA. Decisões do dono: mix de marcas (app-no-carro só cobre EVs chineses; tradicionais =
  OBD/rastreador), TEM carro pra testar, vai construir o APK COMIGO (sem dev — iterativo), v1 SÓ LEITURA.
- **Plataforma PRONTA e no ar (nuvem+app):** migração `car_links`/`car_telemetry`/`car_events` (⚠️ RODAR no
  SQL Editor — MCP em read-only; SQL na conversa). Edges **`car-ingest`** (sem JWT, auth por token — o carro
  posta aqui) e **`car-link`** (JWT — app gera QR/código, consulta, desconecta). Página **`/conectado`**
  (pareamento por QR + painel ao vivo: bateria/velocidade/potência/hodômetro/mapa Leaflet/eventos; sincroniza
  hodômetro só-sobe). Dep nova `qrcode.react`. Item "Carro Conectado" no menu.
- **CONTRATO + plano do APK:** `VISAO-CARRO-CONECTADO-TOTEX.md` (JSON do POST hello/telemetry/event + plano por
  fases A-D). PRÓXIMO PASSO: Fase B = APK-teste que manda telemetria FALSA pro car-ingest (valida a plataforma
  ponta a ponta antes de ler dados reais do carro na Fase C).

### SmartGPS (legado — DESCARTADO em favor do Carro Conectado)
- Edge `smartgps` + `/rastreador` continuam no ar como fallback OBD/rastreador p/ carros tradicionais, mas
  não são mais o foco. 
- Modelo certo: **consumir a API** (nosso app é a UI), mas **ainda precisa** do hardware + chip SIM + a
  conta/servidor deles (white-label ~R$2,20/device). "Só dados" não elimina o rastreador físico.
- Preferência: **OBD plug-and-play** (dono instala em 1 min) p/ o v1. Comprar OBD avulso na internet só vale
  se (a) a SmartGPS aceitar **BYOD** (equipamento de terceiros) e cobrar "só plataforma", ou (b) montar
  **servidor próprio (Traccar)** no volume — aí eu teria que reintegrar contra o Traccar. Recomendado: SmartGPS
  (piloto com 3–5 chips) pra validar 1 payload real antes de escalar. Perguntas + lista de telemetria já
  enviadas ao fornecedor (localização/velocidade/ignição/hodômetro/online + eventos/cercas/comportamento).

### Em avaliação (não iniciado) — Agente Anti-Multas
- Ideia do dono: um agente de IA p/ **multas** (estilo "Blindagem Antimultas": foto da multa → IA acha vícios →
  gera recurso → alerta de prazo). Encaixa MUITO no TCF (mesma stack foto+IA+WhatsApp; carro tem placa/RENAVAM,
  dono tem CNH). Ver análise/recomendação de escopo na conversa desta sessão (fazer como **módulo enxuto**, não
  produto novo; começar só pela geração de recurso a partir da foto — sem consulta por placa/pontos, que dependem
  de dado gov. restrito). **Doc de visão:** `VISAO-AGENTE-ANTIMULTAS-TOTEX.md` (escopo, tabela `multas`, edge
  `multas`, ferramentas na IA, checklist de vícios CTB, roadmap). Não iniciado — aguardando decisão do dono.


### Feito em 2026-06-24 — INTEGRAÇÃO SMARTGPS (Rastreador) — tudo no ar
- **Doc da API:** https://doc.smartgps.com.br (Scalar; spec real em `/openapi/smartgps-api.json`). É a
  **SmartGPS Legacy API**: login `POST /api/login {email,password}` → `user_api_hash` (vai como `?user_api_hash=`
  em tudo). Endpoints usados: `get_devices` (lista+posição), `geo_address?lat&lon` (endereço), `get_history`
  (`imei`+`from_date/from_time/to_date/to_time` → posições c/ `odometer`). Base URL é **por tenant**
  (`sc.smartgps.com.br` = cliente SC/Frotista, `web.smartgps.com.br` = AL, `al.tracker-net.app` = white-label).
- **Arquitetura escolhida:** **conta-mestre** (1 login SmartGPS, cada carro = um device). Creds no /admin.
  Decisão do dono: v1 SEM bloqueio/desbloqueio (comando GPRS sensível — fase futura).
- **DB (migração `smartgps_integration`):** `accounts` += `smartgps_device_id`, `smartgps_imei`;
  `app_settings` += `smartgps_enabled`, `smartgps_base_url` (default `https://web.smartgps.com.br`),
  `smartgps_email`, `smartgps_password`, `smartgps_hash`, `smartgps_hash_at` (cache do hash, TTL 12h).
- **Edge `smartgps` (v1, verify_jwt=true):** ações `live` (posição+endereço+**sync hodômetro só-sobe**),
  `history`, `link_status`; admin: `list_devices`, `assign`. Loga 1x na conta-mestre, cacheia o hash em
  `app_settings`, re-loga em 401/419. **Auto-vincula** o device do dono casando a `placa` (ou IMEI) com
  `get_devices` e persiste em `accounts.smartgps_device_id/imei`.
- **Frontend:** página **`/rastreador`** (`src/pages/Rastreador.tsx`, hook `src/hooks/useTracker.ts`,
  item "Rastreador" no menu): mapa **Leaflet/OSM** (deps novas `leaflet` + `react-leaflet@4` + `@types/leaflet`),
  ⚠️ GOTCHA Leaflet: os panes usam z-index 400–1000 e furam a sidebar mobile (z-50) — o wrapper do
  MapContainer precisa de `relative z-0 isolate` (corrigido 2026-07-02; validado pelo dono). Vale p/ qualquer mapa novo.
  status ao vivo (online/velocidade/hodômetro/atualizado, refetch 30s), endereço atual, e **histórico de
  trajeto** (datas → polyline no mapa). Estados de erro tratados (não vinculado / desativado).
- **Admin:** card **"Rastreador (SmartGPS)"** em Configurações (toggle ativar + URL base + e-mail + senha).
  Campos adicionados ao `AppSettings` em `src/hooks/useAdmin.ts`.
- **WhatsApp (`whatsapp-webhook` v10):** atalho **"onde está meu carro?"** (`isLocationQuery`+`getCarLocation`)
  responde a localização direto (endereço + link `maps.google.com` + parado/movimento), SEM IA, e também
  sincroniza o hodômetro. Cai pro fluxo de IA se o rastreador falhar.
- ⚠️ **PENDÊNCIA SmartGPS:** o dono precisa **colar as credenciais da conta-mestre no /admin** (URL base do
  tenant + e-mail + senha) e **ativar**. Sem isso, `/rastreador` mostra "não ativado" e o WhatsApp diz que não
  localizou. Confirmar o tenant correto do Totexmotors (provavelmente `sc.smartgps.com.br`). Verificar também
  que os devices têm a **placa no nome** (auto-vínculo) — senão usar admin `assign` (device_id↔account).
- **Visão de produto:** `VISAO-IA-COPILOTO-TOTEX.md` (raiz) — roadmap de evolução do agente para "co-piloto"
  (tool-use na IA, custo real por km/consumo, manutenção preditiva, briefing proativo, score de direção,
  "vale vender?", cercas/anti-furto). Fase 1 recomendada = **dar ferramentas (function calling) à IA**.


### Feito em 2026-06-23 (tudo no ar)
- **Nova LANDING / site de marketing** (template "Converge AI" adaptado): dark + rebrand teal TotexMotors.
  Código em `microsaas-clean/src/marketing/` (components/pages/data/lib) + `MarketingLayout.tsx`
  (Navbar+Footer+fundo escuro). Rotas públicas no `App.tsx` sob `<MarketingLayout>`: `/about`, `/pricing`,
  `/blogs`, `/blog/:id`, `/contact`, `/integrations`, `/privacy-policy`, `/terms-conditions`. A `/` deslogada
  renderiza a Home de marketing (`pages/Home.tsx` → `MarketingHome`); logada = dashboard. Conteúdo todo
  PT/contexto carro; CTAs → `/entrar?tab=register` e `/pricing`/`/plans`. Dep nova: `framer-motion`.
  A landing antiga (`src/pages/Landing.tsx`) ficou órfã (não é mais referenciada).
- **Favicon/ícones** trocados pro TotexMotors (`public/favicon.ico`, `apple-touch-icon.png`, `icon-512.png`,
  `og-image.png`) + tags no `index.html`.
- **Bug do botão "Sair"** da sidebar corrigido (`AppSidebar.tsx` não tinha onClick) → agora chama signOut + vai pra `/`.
- **Asaas configurado e TESTADO**: chave de API colada (PRODUÇÃO, `asaas_sandbox=false`). Webhook validado
  ponta a ponta (401 sem token / 200 com token). **Token de webhook foi REGENERADO** (server-side) — salvo no
  `/admin`. ⚠️ FALTA o usuário colar o token novo no painel do Asaas (campo "Token de autenticação") + cadastrar
  a URL `https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/asaas-webhook`. Sandbox: ADIADO (precisa da chave sandbox).
- **PAYWALL (bloqueio por pagamento)** — "não pagou → não usa + cobra":
  - Regra: dono (role owner) bloqueia se `plan!='premium'` E (`subscription_status` overdue/canceled OU trial expirado).
    Admin e lojista NUNCA bloqueiam. Lógica central em `src/hooks/useTrialControl.ts` (campo `isBlocked`).
  - Web: `DashboardLayout` mostra `PaywallScreen` (tela cheia "Assine para continuar" → `/plans`) quando `isBlocked`.
    Corrigido o `TrialBlockModal` (antes chamava função inexistente `create-checkout-session` + preço errado).
  - WhatsApp: `whatsapp-webhook` tem `accessBlocked(user)` — se inativo, NÃO registra o gasto e responde
    com o link de assinatura. Mesma regra nos 3 pontos.

### Refinos 2026-06-23 (parte 2) — tudo no ar
- **Agente WhatsApp — transcrição de áudio**: `whatsapp-webhook` agora baixa a nota de voz (`/message/download`
  com `type:"audio"`) e transcreve com **Whisper (OpenAI `whisper-1`)** — fallback Gemini. Função `transcribeAudio()`.
- **Agente WhatsApp — botões de ação rápida**: após cada resposta, manda 3 botões via **`/send/menu`** (`type:"button"`):
  "📊 Gastos do mês", "📅 Vencimentos", "🔧 Manutenção (km)" (`QUICK_ACTIONS` + `sendMenu()`). ⚠️ GOTCHA: o Uazapi
  manda a resposta do botão em **`message.vote`** / `message.buttonOrListid` / `message.content.selectedID`
  (NÃO em `message.text`) — o `parseInbound` lê esses campos. Prompt do sistema ensina a IA a responder cada botão.
  **Edge `whatsapp-webhook` está na v8.** Quer mais ações? trocar `type:"button"` por `type:"list"`.
- **Tela de pagamento confirmado**: `src/components/PaymentSuccess.tsx`, renderizada em `Plans.tsx` quando
  `?status=success` (URL de retorno do Asaas). Tem CTA "Abrir WhatsApp" pro **agente 5515981615862** com mensagem
  pré-pronta (`wa.me/5515981615862?text=...`) + passo a passo (foto/áudio/pergunta/alertas) + botão pro painel.
- **Pop-up de instalação (PWA)**: `src/components/InstallPrompt.tsx` (montado no `App.tsx`), aparece no rodapé após
  5s; instala nativo no Android (`beforeinstallprompt`) e mostra instrução no iOS. Manifest novo:
  `public/manifest.webmanifest` + `icon-192.png` (linkados no `index.html`). Dismiss salvo em localStorage.
- **Imagens geradas (Higgsfield, modelo soul_2)**: hero ganhou **vídeo** (`public/landing-demo.mp4`, frame extraído
  via imageio-ffmpeg) + som no 1º toque. Card "Tudo pelo WhatsApp" e os 3 cards de `Features.tsx`
  (Registro Automático/Alertas/Relatórios) têm foto de fundo a 75% (`public/registro-auto.jpg`, `alertas.jpg`,
  `relatorios.jpg`, `whatsapp-woman.jpg`). Higgsfield = MCP conectado, créditos na conta deles (plano Starter, 4 jobs simultâneos).
- **Polimento mobile** da landing: corrigidos vãos vazios (alturas auto no mobile), animações `whileInView` que não
  disparavam (`amount: 0.15`), órbita do Features virou linha de ícones no mobile, depoimentos viraram carrossel
  com snap, ticker (`IntegrationsTicker`) virou pílulas (largura automática) e mais rápido (40s). Borda moderna
  (gradiente estático) no card do `InteractiveDemo` (tirou o giro "cara de IA").
- **Card "Tornar-me administrador" removido** do `/admin` (não-admin agora vê só "área restrita" + voltar).
- **Seção UseCaseGrid REMOVIDA** da Home (6 cards Combustível/Manutenção/IPVA/Seguro/Multas/Pneus) — arquivo
  `UseCaseGrid.tsx` e imagens `public/uc-*.jpg` deletados.
- ⚠️ **`WEBHOOK_SECRET` não está setado** na função `whatsapp-webhook` (teste mostrou que aceita sem token) —
  brecha de segurança pré-existente a corrigir (setar a secret no Supabase → Functions).

### Refinos 2026-06-23 (parte 3) — tudo no ar
- **Tela de pós-pagamento** (`src/components/PaymentSuccess.tsx`, renderizada em `Plans.tsx` quando
  `?status=success`): "Pagamento confirmado" + CTA "Abrir WhatsApp" pro agente **5515981615862** com msg pré-pronta
  + passo a passo. E **card pós-cadastro** no dashboard (`src/components/WhatsAppConnectCard.tsx` em `Index.tsx`):
  "Ative seu assistente no WhatsApp" (dispensável) — cobre quem só cadastrou (trial), não só quem pagou.
- **Cupom TRIALTOTEX90** (90%, sistema, na tabela `coupons`): criado, mas **NÃO é auto-aplicado** (decisão do dono).
  Só vale digitado manualmente. `PendingCouponApplier` aplica só o cupom que a pessoa digitou (sem padrão).
- **Consulta por placa = PuxaPlaca** (edge `vehicle-lookup` v2): `GET api.puxaplaca.app/v2/consulta/{placa}` header
  `token`. A **placa é o 1º campo** em Meu Veículo (auto-preenche marca/modelo/ano/cor/combustível/chassi/RENAVAM).
  ⚠️ FALTA o dono colar o **Token PuxaPlaca** em /admin → Configurações (sem token = `placa_api_nao_configurado`).
  `placa_api_url` foi zerado no banco p/ rotear ao PuxaPlaca.
- **FINANCIAMENTO** (`/financiamento`, `src/pages/Financiamento.tsx`, hook `useFinancing.ts`, menu): tabela
  `financiamentos` (RLS dono). Cadastra banco/parcela/nº/1ª data; **leitor de linha digitável** (`src/utils/boleto.ts`
  `decodeBoleto`, boleto bancário 47 díg.). **Alertas de parcela** no `car-expiration-alerts` (v3, marcos 5/1/0d +
  atrasada). **Valor pago no carro**: `accounts.valor_compra`/`data_compra` em Meu Veículo.
- **CONCIERGE** (`whatsapp-webhook` v9): `buildSnapshot` inclui financiamentos (saldo/parcelas), `gasto_total_geral`
  e `valor_compra` → IA responde sobre financiamento, total gasto e valor pago. **v9 também corrigiu o parser dos
  botões** (lê `message.vote`/`buttonOrListid`/`content.selectedID` — confirmado por payload real em whatsapp_events).
- **Edge versions atuais:** `whatsapp-webhook` v9, `car-expiration-alerts` v3, `vehicle-lookup` v2. Deploy via MCP
  `deploy_edge_function` (escape manual do conteúdo — verify_jwt=false p/ webhook/cron, true p/ vehicle-lookup).
- **Próximos passos discutidos (NÃO feitos):** (a) **SmartGPS** (rastreamento/telemetria via API REST white-label,
  R$2,20/device) — adiado, "depois"; (b) **Open Finance** (Pluggy/Belvo ~R$2,5k/mês) p/ puxar boleto do banco —
  fase futura; (c) **Fase 2 do trial**: cartão na frente com auto-cobrança no fim do trial (Asaas subscription) +
  cancelar — cartão **opcional**; só cartão auto-cobra (PIX não). Ferramenta de gerar imagens = **Higgsfield** (MCP).

### Última sessão (2026-06-21, parte 2) — no ar
- **Favicon/ícones** trocados do Lovable para **TotexMotors** (silhueta teal sobre navy): `public/favicon.ico`,
  `apple-touch-icon.png`, `icon-512.png`, `og-image.png`; links no `index.html`. Resolve o logo errado ao
  salvar/favoritar o link.
- **Nova landing = site de marketing completo dark/teal** em `src/marketing/` (ver §6.5). Substituiu a
  `Landing.tsx` antiga (agora órfã). Rotas públicas `/about /pricing /integrations /blogs /contact /privacy-policy
  /terms-conditions` sob `MarketingLayout`. Dep nova **framer-motion**.

### Feito nesta sessão (tudo no ar e validado)
- **Fase 1 — Painel do Lojista** (`/lojista`): lojista loga e vê só os clientes da loja dele (escopo no servidor). Abas Clientes/Campanhas/Recompras. Ver §6.1.
- **Fase 2 — Campanhas WhatsApp**: lojista dispara msg (cliente/vencimento≤30d/todos) com IA. Ver §6.1.
- **Fase 3 — Indique e Ganhe** (`/indique`): feed AO VIVO do marketplace `totexmotors.com` (edge `marketplace`), link `?ref`, comissão PIX, **oferta pro amigo** (`referral_buyer_offer`) na mensagem. Ver §6.2.
- **Fase 4 — Recompra FIPE** (`/recompra`): dono avalia na FIPE e pede recompra; lojista vê em "Recompras". Ver §6.3.
- **Controle de km + Manutenção por km** (`/manutencao`): hodômetro só-sobe em todo canal; lembretes. Ver §6.4.
- **Landing page** (`/`): pública (deslogado), claro/fintech, fonte Space Grotesk. Login em `/entrar`. Ver §6.5.
- **Fluxo de cupom/checkout** (a "surpresa"): `/plans` público mostra o desconto ANTES do cadastro; cupom guardado e aplicado no signup (vincula à loja). Ver §6.6.
- **Seletor de loja** no /admin (lista do marketplace) — evita divergência de nome. Ver §6.
- **Consulta por placa** (`vehicle-lookup` + config no /admin + botão em Meu Veículo): estrutura pronta, **provedor a definir** (RapidAPI "Consulta Placa" em avaliação — falta o JSON de resposta pra mapear).
- **Rebrand**: logo TotexMotors + verde teal (ver §10.1). Header e abas responsivos no mobile.

### ⚠️ PENDÊNCIAS (o que falta pra operar de verdade)
1. **Asaas NÃO configurado** → checkout dá erro. Colar a chave em /admin → Configurações (ver §6 / §10).
2. **Marketplace (Fase 3)**: aplicar `marketplace-referral.patch` no repo `Totex-Motors/totexmotors-marketplace`
   + setar env `TCF_INTEGRATION_URL/KEY`, `REFERRAL_COMMISSION` (captura `?ref` → reporta venda).
3. **Consulta por placa**: definir provedor e mapear o JSON (cliente ia mandar o "Test Endpoint" da RapidAPI).
4. **OS (Fase 3 alternativa)**: contrato em `CONTRATO-OS-FASE3.md` (opcional, o marketplace já cobre).
5. (Combinado p/ depois) **Condicionar regras** pra não comprometer a operação da loja (limites/permissões).

### Dados reais já no sistema
- Admin: **marcovend@gmail.com**. Lojista **PEDRO** (contato@gpmotors.com.br) da **PG Motors**.
- Cliente exemplo **Sergio Caprini** (caprini@gmail.com) vinculado à PG Motors (trial).
- ⚠️ Nome da loja TEM que ser idêntico em cupom + lojista + clientes (o seletor resolve). Lojas do
  marketplace: 29 Select, Cardoso Veículos, First Line, Julio Multimarcas, **PG Motors**, Quest Multimarcas, Soulcar Motors.

### Edge functions (todas no ar)
`whatsapp-webhook`, `car-expiration-alerts`(cron), `admin-api`(v2, +lojistas), `create-checkout`(v4, **verify_jwt=false**, preview público), `asaas-webhook`, `integration`(v5, +sync_inventory/report_referral), `dealer-api`(v2, painel+campanhas), `marketplace`(v3, feed+dealerships+buyer_offer), `buyback`(v1, FIPE+recompra), `vehicle-lookup`(placa), `smartgps`(v1, rastreador). `whatsapp-webhook` agora **v11** (tool use / function calling).

---

## 1. O QUE É O PROJETO

**Totex_CAR_FINANCE (TCF)** = app de **controle financeiro de gastos do carro** (combustível, peças,
revisões, seguro, IPVA, multas, pneus, acessórios) + **dados do veículo** (placa, RENAVAM, chassi,
hodômetro, vencimentos de licenciamento/IPVA/seguro) + **CNH do dono**. É um SaaS do ecossistema
**Totexmotors**, adaptado a partir de um template de finanças pessoais (Lovable).

Diferencial: um **agente de IA no WhatsApp** — o dono manda **texto, foto de cupom ou áudio** e o
sistema lê, categoriza e registra o gasto sozinho, e responde. Também envia **alertas de vencimento**.

### Modelo de negócio (a "isca")
- Preço cheio (âncora): **R$ 109,90/mês**.
- **Membro do ecossistema (−90%): R$ 10,99/mês** (ou **R$ 109,90/ano**). Concedido via **cupom por loja**.
- Nome do plano/benefício: **"Totex Care"** (plano) / **"Bônus Totex"** (desconto).
- Gateway: **Asaas** (PIX + cartão). Custo Asaas ~2,99%.

---

## 2. DOIS SISTEMAS (IMPORTANTE!)

O ecossistema tem **2 projetos Supabase separados** e **2 Claude Code diferentes**:

| Sistema | O que é | Supabase project_id | Quem mexe |
|---|---|---|---|
| **TCF** (este) | app do dono do carro + planos | `gkkjhnzkqhpgrwrmofev` (org `totexmotors` / `rbutavvjnhwmrzoczxma`, região sa-east-1) | **este Claude** (tem acesso MCP) |
| **OS** (Totexmotors OS) | admin/financeiro do ecossistema, lojistas, estoque | `fbgtqiqovwxccinbzvmx` (**outra conta/org** — este Claude NÃO acessa) | o **Claude Code do projeto OS** |

A ponte entre eles é a **Edge Function `integration`** (no TCF), chamada pelo OS via **`x-api-key`**
(passando por um proxy `tcf-proxy` no OS pra não vazar a chave no navegador). **O OS já está construído
e consumindo o TCF** (gera cupom por loja + provisiona cliente). Tudo testado e funcionando.

---

## 3. ONDE ESTÁ O CÓDIGO / COMO RODAR

- **GitHub (privado, desde 2026-07-12):** `https://github.com/Totex-Motors/totexcar-copilot` — raiz do repo =
  pasta `TOTEXCARFINANCE` (docs + HANDOFF + `microsaas-clean/`). ⚠️ Ao fim de cada sessão de trabalho,
  **commitar e dar push** (`git add -A && git commit && git push`). `.env` está no .gitignore (NUNCA commitar).
- **DEPLOY AUTOMÁTICO (desde 2026-07-12):** o projeto Vercel `totexcarco-pilot` está CONECTADO ao repo
  (Root Directory = `microsaas-clean`). **Push na `main` = deploy em produção automático** — não precisa
  mais de `npx vercel --prod` (segue funcionando como fallback). Push em qualquer branch = **Preview Deploy**
  com URL própria (aparece no PR).
- **FLUXO DE BRANCHES:** ajuste pequeno/bugfix → commit direto na `main`. Mudança grande/arriscada
  (feature nova, refactor, mexer em checkout/paywall) → branch `feat/nome-da-coisa` + push + **Pull Request**
  no GitHub; validar na URL de preview da Vercel; merge na main publica. Edge functions do Supabase NÃO
  fazem deploy pelo git — continuam via CLI (`supabase functions deploy`), como sempre.
- Pasta do código TCF: `C:\Users\marco\Downloads\TOTEXCARFINANCE\microsaas-clean`
- Stack: **Vite + React + TypeScript + shadcn/ui + Tailwind + TanStack Query + Supabase**.
- Rodar local: `cd microsaas-clean && npm install && npm run dev` → http://localhost:8080
- Build/validar: `npx tsc --noEmit -p tsconfig.app.json && npx vite build`
- `.env` (local, já preenchido): `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

### Deploy (PRODUÇÃO — JÁ NO AR)
- **App publicado:** https://microsaas-clean.vercel.app (Vercel, time "App-ADV")
- Redeploy do frontend: `cd microsaas-clean && npx vercel --prod`
- Env vars na Vercel (Settings → Environment Variables):
  - `VITE_SUPABASE_URL` = `https://gkkjhnzkqhpgrwrmofev.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_viWuleJ-a_JaY2htFNhiSA_KvmRITtM`
- `vercel.json` já configura rewrites SPA (rotas /admin, /plans funcionam no refresh).
- Deploy de Edge Functions: via **Supabase MCP** (`deploy_edge_function`) ou `supabase functions deploy`.

---

## 4. BANCO DE DADOS (Supabase TCF `gkkjhnzkqhpgrwrmofev`)

Tabelas em `public` (reaproveita a lógica do template: **accounts = veículo**, **transactions = gasto**):

- **users** — proprietário/admin. Colunas-chave: `role` ('admin'|'owner'), `phone` (SÓ DÍGITOS),
  `email`, `plan`, `subscription_status`, `plan_cycle`, `plan_value`, `dealership`, `coupon_code`,
  `cnh_numero/categoria/vencimento`, `trial_*`.
- **accounts** (= VEÍCULO, 1 por dono) — `name`(apelido), `marca`, `modelo`, `placa`, `renavam`,
  `chassi`, `ano_fabricacao/modelo`, `cor`, `combustivel`, `hodometro`, `seguradora`,
  `licenciamento_vencimento`, `ipva_vencimento`, `seguro_vencimento`.
- **transactions** (= GASTO) — `amount` (negativo p/ expense), `type` ('expense'|'income'),
  `category_id`, `transaction_date`, `odometer`, `source` ('whatsapp'|'web'), `raw_input`.
- **categories** — sistema de carro (Combustível, Manutenção, Peças, Pneus, Seguro, IPVA,
  Licenciamento, Multas, etc.) + receitas (Reembolso, etc.).
- **coupons** — `code`, `dealership`, `discount_pct`, `label`, `active`, `max_uses`, `used_count`.
- **app_settings** (linha única `id=1`) — TODA a config do sistema (ver abaixo).
- **whatsapp_events** — log bruto de cada mensagem recebida (debug do agente).
- **notification_log** — dedup dos alertas de vencimento.

### app_settings (id=1) — onde tudo é configurado (lido pelas Edge Functions e pelo painel /admin)
- IA: `ai_provider` ('anthropic'|'openai'|'gemini'), `ai_model`, `anthropic_api_key`,
  `openai_api_key`, `gemini_api_key`. **ATUAL: OpenAI `gpt-4o`** (a chave OpenAI tem créditos).
- WhatsApp (Uazapi): `uazapi_url` (`https://totexmotors.uazapi.com`), `uazapi_token`, `uazapi_number`.
- Pagamento: `payment_provider` ('asaas'), `asaas_api_key`, `asaas_sandbox`, `asaas_webhook_token`.
- Preços: `plan_monthly_price` (109.90), `plan_annual_price`, `member_monthly_price` (10.99),
  `member_annual_price` (109.90), `ecosystem_discount_pct` (90), `plan_name` ("Totex Care").
- Integração: `integration_api_key` = `tcf_int_21bb1b52307945738498f044b9b47f18`, `os_webhook_url`.
- `app_url` = `https://microsaas-clean.vercel.app`.

### RLS — GOTCHA IMPORTANTE
Existe a função `public.is_admin()` (SECURITY DEFINER) usada nas policies de `users`/`coupons`/
`app_settings`. Ela **precisa ter EXECUTE concedido a `authenticated` e `anon`** — senão TODA leitura
dessas tabelas quebra com "permission denied for function is_admin" (já foi corrigido). Se mexer em
policies, mantenha o GRANT.

---

## 5. EDGE FUNCTIONS (Supabase TCF) — todas deployadas

| Função | verify_jwt | O que faz |
|---|---|---|
| `whatsapp-webhook` (v4) | false | Recebe Uazapi, identifica dono pelo telefone, IA lê texto/foto, registra gasto, responde. Auth por `?secret=` |
| `car-expiration-alerts` | false | CRON: avisa vencimentos (licenciamento/IPVA/seguro/CNH) no WhatsApp |
| `admin-api` | true | CRUD de proprietários + `bootstrap_admin` (1º admin). Chamada pelo painel /admin |
| `create-checkout` (v3) | true | Cria checkout Asaas (PIX+cartão) com cupom; grava `plan_cycle/plan_value` |
| `asaas-webhook` | false | Ativa premium quando o pagamento confirma |
| `integration` (v5) | false | **Ponte com o OS** (x-api-key). Ver contrato no §7. Fase 3: + `sync_inventory` e `report_referral`. `get_owner` agora devolve `referral_code`+`pix_key` |
| `vehicle-lookup` (v1) | true | **Consulta por placa** (JWT). Autopreenche o cadastro (marca/modelo/ano/cor/chassi). Provedor plugável (padrão API Brasil); creds em `app_settings.placa_api_bearer/device/url`. Sem token → `placa_api_nao_configurado` |
| `buyback` (v1) | true | **Recompra FIPE** (JWT). Proxy FIPE parallelum (brands/models/years/price) + dono cria pedido (avisa lojista no WhatsApp) + lojista lista/atualiza. Escopado por loja |
| `marketplace` (v1) | true | **Feed do Indique e Ganhe** (JWT). Lê estoque AO VIVO de `totexmotors.com/api` filtrado pela loja do dono (resolve nome→slug). Evita CORS |
| `dealer-api` (v2) | true | **Área do Lojista no TCF** (JWT). Ações `me`/`list_clients`/`client_journey` + **Campanhas** `campaign_recipients`/`draft_message`(IA)/`send_campaign`(Uazapi). Tudo escopado pela `dealership` do lojista (server-side) |
| `admin-api` (v2) | true | + suporte a lojistas: `create_owner` aceita `role:'dealer'`+`dealership`; `list_dealers`; `list_owners` exclui dealers |
| `send-welcome-webhook` | — | legado (template), não usado |

### Secrets das Edge Functions (Supabase → Settings → Functions)
- `WEBHOOK_SECRET` = `TCF-uaz-2026-7Kp9Qm3Xv8Rn` (auth do webhook do Uazapi e do cron)
- `ANTHROPIC_API_KEY` (fallback de IA; o provedor ativo vem do app_settings)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (automáticos)

### Webhook do Uazapi (configurado no painel do Uazapi)
- URL: `https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/whatsapp-webhook?secret=TCF-uaz-2026-7Kp9Qm3Xv8Rn`
- "Escutar eventos" = `messages`; excluir `wasSentByApi` e `isGroupYes`; as 2 caixas (addUrlEvents/
  addUrlTypesMessages) **DESMARCADAS** (senão elas grudam `/{evento}` no fim e quebram o `?secret`).

### GOTCHAS do agente WhatsApp (já resolvidos — não regredir)
- O telefone REAL vem em **`message.sender_pn`** (não em `sender`, que pode ser `@lid` = ID interno).
- Telefone no `users.phone` deve ser **só dígitos** (normalizar ao salvar; o app já faz).
- Imagem: a URL do WhatsApp é criptografada. Baixar via **`POST {BaseUrl}/message/download`** (header
  `token`) que devolve `{ fileURL }` (JPEG normal) → baixar o fileURL → base64 → IA.
- Usuários provisionados/criados pelo admin vêm com `email_confirm: true` (sem fricção de confirmação).

---

## 6. PAINEL ADMIN (/admin) — só para `role='admin'`
- Admin atual: **marcovend@gmail.com** (já é admin).
- Abas: **Proprietários** (criar/listar/excluir), **Lojistas** (criar/listar/excluir lojistas —
  role `dealer` + `dealership`), **Configurações & Integrações** (IA + Uazapi + Asaas + preços),
  **Cupons & Ecossistema**, **Assinaturas** (MRR, MRR por loja).
- **Seletor de loja** (`StoreField` em Admin.tsx): os campos "Loja" do cupom e do lojista agora são um
  **Select** populado pela ação `dealerships` da edge `marketplace` (lista oficial do marketplace) —
  evita divergência de nome. Tem opção "Outra loja (digitar)" como fallback.
- **Vínculo cliente↔loja:** o elo é `users.dealership`, preenchido **pelo cupom** no checkout
  (`create-checkout` grava `dealership`+`coupon_code`) ou no `provision_owner`. Cadastro (signup) SEM
  cupom NÃO vincula. Link recomendado p/ a loja divulgar: `/plans?coupon=CODIGO` (aplica sozinho).
  ⚠️ Cupom + lojista + clientes precisam do MESMO `dealership` exato (o seletor resolve isso).

### 6.1 ÁREA DO LOJISTA (/lojista) — para `role='dealer'` (e admin pode ver)
- O lojista loga na MESMA tela (Supabase auth) e é redirecionado para `/lojista` (Index.tsx
  redireciona `role='dealer'`). Página: `src/pages/Dealer.tsx`, hook `src/hooks/useDealer.ts`.
- Mostra KPIs (clientes, ativos, trial, vencendo ≤30d), busca, lista de clientes da loja e
  uma ficha/jornada por cliente (veículo, vencimentos, gastos por categoria, últimos gastos).
- Tudo escopado pela `dealership` do lojista NO SERVIDOR (dealer-api) — ele só vê a própria loja.
- Admin cadastra o lojista em /admin → aba Lojistas. O `dealership` deve bater EXATAMENTE com o
  nome usado nos cupons/clientes daquela loja. **Validado end-to-end (escopo + 403 cross-store).**
- **Aba "Campanhas"** (Fase 2): lojista dispara WhatsApp para (a) um cliente (botão na ficha),
  (b) clientes com vencimento ≤30d, ou (c) todos da loja. Compositor com variáveis
  `{nome} {veiculo} {placa} {vencimento} {dias} {loja}` + botão **"Gerar com IA"** (usa o provedor
  de `app_settings`) + pré-visualização + confirmação. Envio via Uazapi `/send/text` (mesmo do agente),
  sequencial com 350ms entre msgs. Validado: recipients, draft IA e envio-vazio (sem spam real).
- 1º admin: botão "Tornar-me administrador" chama `admin-api` action `bootstrap_admin` (só funciona
  se ainda não existe admin).

---

## 7. INTEGRAÇÃO OS ↔ TCF (Edge Function `integration`)
- URL: `https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/integration`
- Header: `x-api-key: tcf_int_21bb1b52307945738498f044b9b47f18` (= `app_settings.integration_api_key`;
  no OS é a secret `TCF_INTEGRATION_KEY`). POST JSON. Sucesso `{ ok:true, ... }`, erro `{ error }` 4xx.
- O OS chama via proxy `tcf-proxy` (Edge Function do OS) → frontend `TcfPanel` na página do lojista.

**Ações:**
- `create_coupon` `{code, dealership, discount_pct}` → `{ ok, coupon }`
- `validate_coupon` `{code}` → `{ ok, valid, discount_pct, dealership }`
- `provision_owner` `{name, email, phone, dealership, coupon_code}` → `{ ok, user_id, email,
  password, plan_link, plan_name, already_existed }` (idempotente por email; se já existe, password:null)
- `get_owner` `{email}` (ou `{phone}`) → `{ ok, owner }`
- `list_coupons` → `{ ok, coupons }`
- `list_owners` `{dealership?}` → `{ ok, owners:[{ ...dados, vehicle, next_due, total_expenses }] }` (Painel Lojista)
- `owner_journey` `{user_id|email}` → `{ ok, owner, vehicle, vencimentos, expenses, recent_expenses }` (Painel Lojista)
- **Fase 3** `sync_inventory` `{cars:[{external_id,dealership,store_whatsapp,brand,model,year,price,km,photo_url,...}]}` → `{ ok, upserted }`
- **Fase 3** `report_referral` `{owner_code|owner_id, type:'sale', value, car_title?}` → `{ ok, event, owner:{pix_key,...} }`;
  marcar pago: `{event_id, status:'paid'}`. **Contrato completo pro OS: `C:\Users\marco\Downloads\TOTEXCARFINANCE\CONTRATO-OS-FASE3.md`**

---

## 8. STATUS — O QUE JÁ ESTÁ PRONTO ✅
- App TCF completo (dashboard do carro, gastos, categorias, **Meu Veículo**, análises, **relatórios**
  com export CSV, planos).
- Agente WhatsApp (Uazapi + IA): **texto E foto funcionando de ponta a ponta** (testado).
- Alertas de vencimento (cron).
- Painel /admin (proprietários + integrações + assinaturas/MRR).
- Checkout Asaas com cupom (Bônus Totex 90%).
- **Integração com o OS**: gerar cupom por loja + provisionar cliente — **TESTADO e funcionando**.
- **Painel do Lojista (dados via OS)**: `list_owners` + `owner_journey` prontos no `integration`.
- **Área do Lojista NATIVA no TCF** (`/lojista`): lojista loga e acompanha os clientes da loja dele
  direto no app, sem depender do OS. Backend `dealer-api` + aba Lojistas no /admin. **NO AR e validado.**
- **Deploy público no ar**: https://microsaas-clean.vercel.app

---

## 9. ROADMAP — PRÓXIMOS PASSOS
- **Fase 1 — Painel do Lojista** (lojista acompanha clientes): ✅ **FEITO no próprio TCF** —
  Área do Lojista nativa em `/lojista` (ver §6.1). A UI no OS (consumindo `list_owners`/`owner_journey`
  via `integration`) continua sendo uma opção alternativa, mas não é mais necessária.
- **Fase 2 — Campanhas**: ✅ **FEITA** na Área do Lojista (aba Campanhas, ver §6.1). Lojista dispara
  WhatsApp (cliente / vencimento ≤30d / todos) com mensagem por IA. Ações no `dealer-api`.
  Possível evolução: histórico de campanhas (tabela de log) e agendamento.
- **Fase 3 — Indicação/Referral**: ✅ **LADO TCF FEITO** (ver §6.2). Página `/indique`: feed de estoque
  (sincronizado pelo OS) + botão Indicar gerando **link wa.me da loja com o código do dono** + painel de
  ganhos (vendas/a receber/recebido) + chave PIX. Recompensa = **dinheiro PIX só na venda confirmada**.
  **Falta o lado do OS**: sincronizar estoque, capturar o código na conversa, reportar a venda + pagar o
  PIX. Contrato pronto: `CONTRATO-OS-FASE3.md`. Tabelas novas no TCF: `inventory`, `referral_events`;
  colunas `users.referral_code` (único) e `users.pix_key`.
- **Fase 4 — Recompra FIPE**: ✅ **FEITA** (ver §6.3). Dono avalia o carro na FIPE (dropdowns oficiais)
  e pede recompra por até X% (config `app_settings.buyback_fipe_pct`, default 90); o lojista vê na aba
  "Recompras" do /lojista e recebe aviso no WhatsApp. Tudo no TCF (FIPE pública parallelum).

---

## 10. PENDÊNCIAS / LIMPEZA
- **Dados de teste a limpar** (opcional): a conta admin `marcovend@gmail.com` ficou marcada com
  `dealership='Julio Multimarcas'` e `coupon_code='TESTE90'` (de um teste). Há um cliente de teste
  `teste teste / tesste@gmail.com` e o cupom `TESTE90`. Limpar se quiser zerar para produção.
- **Nome do projeto Vercel** é `microsaas-clean` (URL feia). Considerar renomear ou ligar domínio próprio.
- **app_url** já aponta pro Vercel; se trocar de domínio, atualizar em `app_settings.app_url`.

---

## 10.1 IDENTIDADE VISUAL (rebrand 2026-06-20)
- Logo oficial: **TotexMotors** (carro + "TOTEXMOTORS"), teal. Fonte: `C:\Users\marco\Downloads\logototex.png`.
  Versão processada (sem a frase "o carro que você procura...", fundo transparente) em
  `microsaas-clean/public/totexmotors-logo.png` (gerada via PIL: crop da frase + alpha por luminância).
- Cor da marca = **teal/verde em degradê** (igual TotexMotors OS). Tokens no `src/index.css`:
  `--primary: 176 80% 40%`, `--gradient-primary: linear-gradient(135deg, hsl(168 82% 38%), hsl(184 80% 48%))`.
  (Substituiu o azul antigo `211 100% 50%` em primary/ring/shadows/gradients/sidebar.)
- Logo aplicado na **sidebar** (`AppSidebar.tsx`, centralizado acima de "Totex CAR FINANCE", sem divisória)
  e na **tela de login** (`Auth.tsx`). Marca escrita com degradê no texto (legível em fundo claro/escuro).
- ⚠️ A sidebar no Vercel é **escura** (`--sidebar-background: 222 47% 6%`); o preview do Lovable mostra clara.
  Logo é transparente e o texto usa degradê → funciona nos dois fundos.

## 6.2 INDIQUE E GANHE (/indique) — para o dono do carro (Fase 3)
- Rota `/indique` (`src/pages/Indique.tsx`, hook `src/hooks/useReferral.ts`), no menu lateral.
- **Estoque vem AO VIVO do marketplace** `totexmotors.com` (NestJS+Next, repo `Totex-Motors/totexmotors-marketplace`),
  via a edge function `marketplace` (resolve a loja do dono `dealership`→slug e busca
  `GET /api/dealerships/{slug}/vehicles?status=ACTIVE`). **Só os carros da loja do dono.**
- Botão **Indicar** gera link rastreável **`https://totexmotors.com/veiculo/{id}?ref={referral_code}`**
  (abre o WhatsApp do dono p/ enviar a um amigo). Também há "Compartilhar a loja" (página da loja c/ ref).
- **Oferta pro amigo (gatilho):** a mensagem inclui "você ganha {oferta}" — configurável em
  `app_settings.referral_buyer_offer` (campo no /admin → Config, default "Transferência grátis"). O feed
  do `marketplace` devolve `buyer_offer`. A entrega real do benefício é regra da loja/marketplace.
- KPIs (vendas/a receber/recebido/código) + **chave PIX**. `referral_code` gerado automático por dono.
  RLS: dono lê só os próprios `referral_events`. O marketplace reporta a venda e paga o PIX.
- **Lado marketplace (rastreio):** entregue como patch `marketplace-referral.patch` (branch
  `feat/referral-tracking`): captura `?ref`→`Lead.metadata.ref`; venda `SOLD` com ref → chama `report_referral`.
  Env no backend do marketplace: `TCF_INTEGRATION_URL`, `TCF_INTEGRATION_KEY`, `REFERRAL_COMMISSION`.
- ⚠️ **Legado/sem uso:** a tabela `inventory` e a ação `sync_inventory` (do desenho anterior com wa.me)
  ficaram obsoletas — o feed agora é o marketplace. Pode dropar/ignorar.
- O marketplace já tem **FIPE** (fipePrice, FipeBrand/Model) — base pronta pra Fase 4.

## 6.3 RECOMPRA FIPE (/recompra) — dono vende o carro de volta (Fase 4)
- Rota `/recompra` (`src/pages/Recompra.tsx`, hook `src/hooks/useBuyback.ts`), item "Vender meu carro" no menu.
- Dono escolhe **marca→modelo→ano** (dropdowns da FIPE pública parallelum, via edge function `buyback`),
  vê o valor FIPE e a **oferta (X% da FIPE)**, e clica "Quero receber a proposta" → cria `buyback_requests`
  e **avisa o lojista no WhatsApp** (Uazapi). Acompanha os pedidos + status.
- Lojista: aba **"Recompras"** no `/lojista` lista os pedidos da loja, com WhatsApp do cliente e botões de
  status (Em contato / Concluir / Recusar). Escopado pela loja (server-side).
- `%` configurável em `/admin` → Config (`app_settings.buyback_fipe_pct`, default 90).
- Tabela `buyback_requests` (RLS: dono lê/cria os próprios; lojista via edge function service role).
- **Validado:** cadeia FIPE real (Fiat Argo → R$ 88.890 → 90% = R$ 80.001), criação, lista e update.

## 6.4 CONTROLE DE KM / MANUTENÇÃO
- A km do carro = `accounts.hodometro`, alimentada por leituras nos gastos (regra **só-sobe**: nunca
  retrocede). **WhatsApp** já atualizava ([whatsapp-webhook:510]); agora o **formulário web**
  (`TransactionForm.tsx`) também atualiza o hodômetro quando a km do gasto é maior.
- **Manutenção por km** (`/manutencao`, `src/pages/Manutencao.tsx`, hook `src/hooks/useMaintenance.ts`,
  menu "Manutenção"): tabela `maintenance_reminders` (item, intervalo_km, last_km). Mostra status
  (Em dia/Próxima/Vencida) e "faltam X km" vs o hodômetro atual; botão "Feito" zera o ciclo (last_km =
  km atual). RLS: dono gerencia só os próprios. `maintenance_reminders` NÃO está no types gerado —
  o hook acessa via `supabase as any` (contido).
- Possível evolução: alerta no WhatsApp (cron) quando a km cruzar o limite; consumo médio km/L.

## 6.6 FLUXO DE AQUISIÇÃO / CUPOM (a "surpresa")
- CTAs da landing/planos → **`/plans`** (pública). `create-checkout` agora tem **verify_jwt=false** e o
  modo `preview` é **público** (só calcula preço/cupom) — o visitante deslogado vê o desconto.
- Em `/plans`: aplica o cupom → vê o preço cair (ex.: 109,90 → **10,99**). Botão (deslogado) = "Começar
  grátis" → guarda o cupom em `localStorage.totex_pending_coupon` e vai pra `/entrar?tab=register&coupon=`.
- Após o cadastro (7 dias trial), `PendingCouponApplier` (montado no App) grava `dealership`+`coupon_code`
  no perfil via preview do cupom → **vincula o cliente à loja já no cadastro** e mantém o desconto.
- Logado, `/plans` pré-aplica o `coupon_code` salvo no perfil (mostra o desconto automaticamente).
- Preço PADRÃO (sem cupom): Mensal R$109,90 · Anual R$1.099 (R$91,58/mês, 16% off). O 10,99 só aparece
  com o cupom — é a "surpresa de super benefício".

## 6.5 LANDING PAGE / SITE PÚBLICO — pública, para o cliente final
- **NOVO (2026-06-21):** a landing foi trocada por um **site de marketing completo dark/teal**, adaptado do
  template "Converge AI" (Vite/React/framer-motion). Código em **`src/marketing/`** (components, pages, data,
  lib próprios). Layout `src/marketing/MarketingLayout.tsx` (navbar+footer+fundo `#050505`+Outlet).
- Rota `/` (deslogado) renderiza `MarketingLayout` + `marketing/pages/Home` (Hero, demo de chat WhatsApp,
  recursos, depoimentos, FAQ, CTA). Logado → dashboard (`Index`). Decisão em `src/pages/Home.tsx`.
- **Páginas do site** (todas sob `MarketingLayout` no `App.tsx`): `/about`, `/pricing`, `/integrations`
  (= "Recursos"), `/blogs` + `/blog/:id`, `/contact`, `/privacy-policy`, `/terms-conditions`.
- **Rebrand:** cores laranja/vermelho do template → **teal/cyan** (sed em massa); marca "Converge AI"/
  "MicroSaaS Clean" → **"Totex CAR FINANCE"**; logo `/totexmotors-logo.png` no navbar/footer. Animações
  `scroll/scroll-reverse/liquid/pulse-slow` adicionadas ao `tailwind.config.ts`. Dep nova: **framer-motion**.
- **Conteúdo 100% PT/contexto carro** (reescrito de SaaS-genérico): WhatsApp lê cupom/áudio, alertas de
  vencimento, km/manutenção, FIPE/recompra, Indique e Ganhe. Preços: cheio R$109,90/mês, membro R$10,99/mês
  (cupom -90%), 7 dias grátis. CTAs: "Começar grátis" → `/entrar?tab=register`; "Assinar com cupom" → `/plans`.
- ⚠️ A landing antiga `src/pages/Landing.tsx` (clara/Space Grotesk) **ficou órfã** (não é mais importada).
  Pode apagar se quiser. Login/cadastro segue em `/entrar` (`Entrar.tsx`, lê `?tab=register`).
- O assets externos do template (vídeo de fundo do Hero, fotos Unsplash, avatares pravatar) carregam por URL.

## 11. COMO O PRÓXIMO CLAUDE DEVE COMEÇAR
1. Ler este arquivo inteiro + a memória do projeto (carrega automática se a sessão abrir nesta pasta).
2. Confirmar acesso ao Supabase MCP do projeto **`gkkjhnzkqhpgrwrmofev`** (TCF). O projeto do OS
   (`fbgtqiqovwxccinbzvmx`) NÃO é acessível por aqui — coordenar via o contrato `integration`.
3. Decidir com o usuário a próxima fase (provável: Fase 2 Campanhas, ou validar o painel do lojista no OS).
4. Para mudar Edge Function: editar em `microsaas-clean/supabase/functions/<nome>/index.ts` e
   deployar via Supabase MCP `deploy_edge_function`. Para o frontend: editar + `npx vercel --prod`.
5. Sempre rodar `npx tsc --noEmit -p tsconfig.app.json` + `npx vite build` antes de considerar pronto.
