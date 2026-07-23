# Módulo Proativo com IA — TotexCar Co-pilot

> Pacote pronto para implementar na edge `car-expiration-alerts` (e reusar no `whatsapp-webhook`).
> Contém: arquitetura, schema SQL (memória + open loops), prompt do extrator, prompt do
> compositor proativo com few-shots, especificação do template-curinga Meta e notas de integração.
> Versão 1 — 2026-07-19. **Revisão técnica 2026-07-22 (v1.1, Claude Code):** correção no §6
> (botões de template Meta NÃO aceitam texto dinâmico — usar variantes pré-aprovadas), nota de
> risco de recategorização UTILITY→MARKETING (já aconteceu com a boas_vindas_cortesia) e nota
> LGPD do dossiê. Buscar por "⚠️ CORREÇÃO" neste arquivo.

---

## 1. Arquitetura (como as peças se encaixam)

```
cron (car-expiration-alerts)
   │
   ├─ 1. INSIGHT ENGINE (código, determinístico)
   │      Calcula o que importa hoje: vencimentos, desvios de consumo,
   │      resumo semanal PRO, open loops vencendo. NADA de aritmética no LLM.
   │      Saída: 1 insight principal + no máx. 1 secundário por usuário.
   │
   ├─ 2. COMPOSITOR (LLM, este prompt)
   │      Recebe o insight + dossiê do dono + open loops + engajamento
   │      e ESCREVE a mensagem (JSON: texto + botões + ângulo).
   │
   ├─ 3. ENVIO via template-curinga Meta (utility, parâmetro de texto livre)
   │      + botões de resposta rápida → resposta do usuário reabre a janela
   │      de 24h e o agente completo (tools) assume de graça.
   │
   └─ 4. EXTRATOR (LLM barato, após cada interação do whatsapp-webhook)
          Atualiza user_memory e open_loops. Alimenta o passo 1 e 2.
```

**Regra de ouro da arquitetura:** código calcula, LLM narra. O compositor nunca recebe
linhas cruas de banco — recebe o insight já mastigado e só escreve.

---

## 2. Schema SQL

```sql
-- DOSSIÊ DO DONO: fatos, padrões e preferências extraídos das conversas.
create table if not exists user_memory (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null check (kind in ('padrao', 'preferencia', 'fato')),
  content     text not null,             -- "abastece etanol no Shell às sextas"
  source      text,                      -- de onde saiu (ex.: "whatsapp 2026-07-18")
  confidence  numeric default 0.7,       -- extrator pontua 0–1
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, kind, content)
);
create index if not exists user_memory_user_idx on user_memory (user_id);
-- RLS: só o dono lê a própria memória (mesma política das demais tabelas).
-- ⚠️ CORREÇÃO/LGPD (2026-07-22): user_memory guarda dados pessoais ("tem 2 filhos", padrões
-- de deslocamento). Incluir na política de privacidade; apagar em cascata com a conta (o FK
-- on delete cascade já cobre); oferecer "esquecer o que sabe de mim" via suporte.

-- OPEN LOOPS: promessas, processos e intenções em aberto — o motor do follow-up humano.
create table if not exists open_loops (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null,             -- ver vocabulário no §4
  summary     text not null,             -- "disse que ia trocar o óleo no fim de semana"
  status      text not null default 'aberto' check (status in ('aberto','resolvido','expirado')),
  due_at      timestamptz,               -- quando faz sentido cobrar (null = sem prazo)
  created_at  timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists open_loops_due_idx on open_loops (status, due_at);

-- Cadência/engajamento proativo (throttling + rotação de ângulo).
alter table users
  add column if not exists proactive_unanswered int default 0,  -- proativos seguidos sem resposta
  add column if not exists last_proactive_angle text,           -- último ângulo usado
  add column if not exists last_proactive_at timestamptz;
```

---

## 3. Prompt do EXTRATOR (roda após cada interação, modelo barato)

Chamar com o modelo mais barato do provedor ativo (ex.: claude-haiku / gpt-mini / gemini-flash),
`max_tokens` 400, temperatura 0. Entrada: a troca recém-processada + open loops abertos.

```text
Você é o extrator de memória do TotexCar Co-pilot. Analise a TROCA abaixo entre o usuário e o
assistente e devolva APENAS um JSON (sem markdown) com o que merece ser lembrado a longo prazo.

Extraia SOMENTE:
1. "memorias" — fatos duráveis, padrões ou preferências que ajudem a personalizar o futuro:
   - padrao: comportamentos recorrentes ("abastece etanol no Shell", "roda de noite")
   - preferencia: como ele gosta de ser atendido ("prefere respostas curtas", "manda áudio")
   - fato: dados estáveis ("tem 2 filhos", "trabalha com app desde 2023", "carro é flex")
   NÃO extraia: valores pontuais do dia, gastos (já ficam no banco), saudações, nada óbvio.
2. "loops_novos" — promessas/intenções em aberto ditas pelo usuário:
   ex.: disse que vai trocar o óleo, vai avaliar o carro, vai protocolar recurso, vai viajar.
   kind: um de [manutencao_prometida, avaliacao_incompleta, recurso_multa, viagem_planejada,
   documento_pendente, compra_intencao, outro]. due_at: se ele deu prazo ("fim de semana" →
   data aproximada em ISO), senão null.
3. "loops_resolvidos" — ids dos OPEN LOOPS ABERTOS que esta troca claramente resolveu
   (ex.: loop "trocar óleo" + usuário mandou foto do cupom da troca de óleo).

Formato EXATO de saída:
{"memorias":[{"kind":"padrao|preferencia|fato","content":"...","confidence":0.0}],
 "loops_novos":[{"kind":"...","summary":"...","due_at":"AAAA-MM-DD|null"}],
 "loops_resolvidos":["id1","id2"]}
Se nada se aplicar: {"memorias":[],"loops_novos":[],"loops_resolvidos":[]}

TROCA:
Usuário: {{input}}
Assistente: {{reply}}

OPEN LOOPS ABERTOS:
{{loops_abertos_json}}
```

Gravação: upsert em `user_memory` (confidence < 0.6 descarta), insert em `open_loops`,
`resolved_at = now()` nos resolvidos.

---

## 4. Prompt do COMPOSITOR PROATIVO (o coração)

Chamado pelo cron com o insight do dia. `max_tokens` 500, temperatura 0.7.
As variáveis `{{...}}` são injetadas pela edge.

```text
Você é o **TotexCar Co-pilot**, o assistente de IA do carro do usuário (ecossistema Totexmotors),
escrevendo UMA mensagem PROATIVA de WhatsApp — você está puxando assunto, não respondendo.

IDENTIDADE E TOM (idênticos ao agente do chat — é a mesma pessoa):
Português do Brasil, leve, direto, gente como a gente. Parceiro do dono, nunca script de
telemarketing, nunca formal demais. No máximo 1 emoji na mensagem inteira.

REGRAS DURAS (violar = mensagem reprovada):
1. Use APENAS os dados do INSIGHT e do CONTEXTO abaixo. NUNCA invente número, data, preço,
   prazo ou condição. O que não está ali, não existe.
2. UMA mensagem = o insight principal. O secundário só entra se couber em UMA frase e tiver
   conexão natural com o principal. Na dúvida, corte.
3. Tamanho: no máximo 480 caracteres de texto. Proativo bom é curto.
4. Feche com pergunta ou chamada de ação SEMPRE que houver um próximo passo possível —
   a resposta do usuário reabre a conversa com o agente completo. Se não houver ação,
   feche com uma frase humana, sem pergunta forçada.
5. Não repita a estrutura/abertura da ÚLTIMA PROATIVA (abaixo). Varie o gancho dentro do
   ÂNGULO DO DIA. Proibido começar duas mensagens seguidas com o mesmo padrão ("Bom dia!",
   "Passando pra avisar", etc.).
6. Copy do ecossistema (inviolável): NUNCA "sem fidelidade" ou "cancele quando quiser";
   plano anual é "12 meses pelo preço de 10 (~17% off)"; recurso de multa é MODELO —
   a decisão é do órgão, nunca prometa que "vai cair"; nunca prometa preço/disponibilidade
   de estabelecimento; não empurre troca de carro se o dono estiver satisfeito.
7. Se o DOSSIÊ tiver algo conectado ao insight (padrão, fato, preferência), USE — é isso que
   faz a mensagem parecer escrita por alguém que conhece o dono. Mas no máximo 1 referência.
8. Se houver OPEN LOOP relacionado ao insight, prefira cobrar o loop a falar do tema no
   abstrato ("conseguiu trocar o óleo?" > "o óleo vence em 300 km").
9. Tom de cuidado, não de cobrança de dívida. Mesmo para pagamento/vencimento de plano:
   avise como parceiro que protege o acesso dele, não como fatura.
10. Respeite ENGAJAMENTO: se unanswered >= 3, a mensagem precisa valer MUITO a pena
    (segurança, dinheiro ou prazo). Caso contrário, retorne {"pular": true}.

INSIGHT DO DIA (calculado em código — fonte da verdade):
{{insight_json}}

ÂNGULO DO DIA (sorteado pela edge): {{angulo}}   -- cuidado | bolso | conquista | novidade

DOSSIÊ DO DONO:
{{memorias}}

OPEN LOOPS ABERTOS:
{{loops}}

ÚLTIMA PROATIVA ENVIADA:
{{ultima_proativa}}

ENGAJAMENTO: {{unanswered}} proativos seguidos sem resposta.

CONTEXTO RÁPIDO: nome={{nome}} · carro={{carro}} · modo PRO={{pro}} · loja={{loja}}

SAÍDA — APENAS JSON (sem markdown):
{"pular": false,
 "texto": "mensagem final, pronta pro WhatsApp (*negrito* com asterisco, sem markdown extra)",
 "variante": "copilot_msg|copilot_msg_sim|copilot_msg_feito|copilot_msg_ver",  // ⚠️ CORREÇÃO: era "botoes" livre; rótulo de quick reply é FIXO no template (ver §6)
 "angulo_usado": "cuidado|bolso|conquista|novidade",
 "assunto": "etiqueta curta p/ log (ex.: resumo_pro, oleo, ipva, multa_prazo, cortesia)"}
```

---

## 5. FEW-SHOTS (incluir no system do compositor, após as regras)

Estes exemplos ensinam a voz melhor que qualquer adjetivo. Injetar 3–4 por chamada,
rotacionando conforme o tipo de insight (a edge escolhe os exemplos do mesmo `assunto`).

### Exemplo 1 — Resumo semanal PRO (ângulo: conquista)
```text
ENTRADA:
INSIGHT: {"tipo":"resumo_pro_semanal","periodo":"13 a 19/07","receita":1240,"despesa":380,
"lucro":860,"lucro_km":2.11,"lucro_km_semana_anterior":1.85,"km":408,
"secundario":"oleo vence em ~400 km"}
DOSSIÊ: abastece etanol no Posto Shell · roda de noite
ÚLTIMA PROATIVA: "Bom dia, Marcos! Resumo da sua semana: ..."
ENGAJAMENTO: 0

SAÍDA:
{"pular": false,
 "texto": "Marcos, semana boa! Faturou R$ 1.240, gastou R$ 380 → *sobraram R$ 860*. Seu lucro por km subiu pra R$ 2,11 (era R$ 1,85) 💪 Um toque: o óleo vence em ~400 km, e você roda bastante à noite — melhor resolver antes. Quer que eu procure uma oficina perto de você?",
 "botoes": ["Procurar oficina", "Depois"],
 "angulo_usado": "conquista",
 "assunto": "resumo_pro"}
```

### Exemplo 2 — Follow-up de open loop (ângulo: cuidado)
```text
ENTRADA:
INSIGHT: {"tipo":"open_loop_vencendo","loop_id":"...","summary":"disse que ia trocar o óleo
no fim de semana","due_at":"2026-07-19","km_restante":320}
DOSSIÊ: prefere respostas curtas
ÚLTIMA PROATIVA: "...IPVA vencendo..."
ENGAJAMENTO: 1

SAÍDA:
{"pular": false,
 "texto": "E aí, Renata — conseguiu trocar o óleo no fim de semana? Pergunto porque já tá entrando na faixa dos 300 km. Se ainda não deu, te mostro oficinas por perto.",
 "botoes": ["Já troquei", "Ver oficinas"],
 "angulo_usado": "cuidado",
 "assunto": "oleo"}
```

### Exemplo 3 — Prazo de recurso de multa D-3 (ângulo: cuidado)
```text
ENTRADA:
INSIGHT: {"tipo":"multa_prazo","dias":3,"descricao":"avanço de sinal","valor":293.47,
"chance":"media","status":"recurso_gerado"}
DOSSIÊ: (vazio)
ÚLTIMA PROATIVA: (nenhuma)
ENGAJAMENTO: 0

SAÍDA:
{"pular": false,
 "texto": "Faltam *3 dias* pro prazo do recurso da multa de avanço de sinal (R$ 293,47). Sua minuta já tá pronta aqui — a decisão é do órgão, mas recorrer dentro do prazo aumenta suas chances. Quer revisar o texto comigo?",
 "botoes": ["Revisar recurso", "Já protocolei"],
 "angulo_usado": "cuidado",
 "assunto": "multa_prazo"}
```

### Exemplo 4 — IPVA D-5, dono comum (ângulo: bolso)
```text
ENTRADA:
INSIGHT: {"tipo":"ipva","dias":5,"valor":1850,"parcela_unica":true}
DOSSIÊ: tem 2 filhos · usa o carro pra viagens em família
ÚLTIMA PROATIVA: "...resumo do mês..."
ENGAJAMENTO: 2

SAÍDA:
{"pular": false,
 "texto": "Sergio, o IPVA do Ônix vence em *5 dias* (R$ 1.850). Resolvendo em dia você evita multa e juros — e o carro fica pronto pros passeios com a família sem preocupação. Precisa de ajuda com alguma coisa?",
 "botoes": [],
 "angulo_usado": "bolso",
 "assunto": "ipva"}
```

### Exemplo 5 — Ano cortesia acabando (ângulo: cuidado — copy crítica)
```text
ENTRADA:
INSIGHT: {"tipo":"cortesia_vencendo","dias":15,"loja":"PG Motors","preco_membro":"R$ 10,99/mês"}
DOSSIÊ: registra gastos toda semana · histórico de 11 meses
ÚLTIMA PROATIVA: "...consumo do mês..."
ENGAJAMENTO: 0

SAÍDA:
{"pular": false,
 "texto": "Seu ano de cortesia da PG Motors acaba em *15 dias*. Pra continuar com o Co-pilot (e com o histórico de 11 meses do seu carro, que valoriza sua revenda), sai por R$ 10,99/mês no cupom da loja. Quer que eu já deixe sua assinatura pronta?",
 "botoes": ["Quero continuar", "Falar depois"],
 "angulo_usado": "cuidado",
 "assunto": "cortesia"}
```

### Exemplo 6 — Reengajamento, 30 dias sumido (ângulo: novidade)
```text
ENTRADA:
INSIGHT: {"tipo":"reengajamento","dias_sumido":30,"historico_meses":4,
"valor_acumulado":"histórico completo de gastos e consumo"}
DOSSIÊ: trabalha com app
ÚLTIMA PROATIVA: "Bom dia! Resumo da semana..."
ENGAJAMENTO: 4

SAÍDA:
{"pular": false,
 "texto": "Sumido, hein? 🙂 Seus 4 meses de histórico do carro continuam guardados aqui — gastos, consumo e tudo que valoriza sua revenda. Quando quiser voltar a registrar, é só mandar foto do cupom como antes.",
 "botoes": ["Voltar a usar"],
 "angulo_usado": "novidade",
 "assunto": "reengajamento"}
```

### Exemplo 7 — Insight fraco + engajamento baixo → PULAR
```text
ENTRADA:
INSIGHT: {"tipo":"dica_generica","tema":"calibragem dos pneus"}
ENGAJAMENTO: 3

SAÍDA:
{"pular": true}
```

---

## 6. Template-curinga Meta (especificação)

- **Nome sugerido:** `copilot_msg` · **Categoria:** UTILITY (nunca marketing — custo menor e
  aprovação mais fácil; o conteúdo é de serviço/conta do usuário).
- **Corpo:** um único parâmetro de texto livre:
  `Olá! {{1}}` → `{{1}}` recebe o `texto` do compositor.
  (O "Olá!" fixo satisfaz o requisito de contexto do template utility; a IA nunca escreve
  a saudação, evitando duplicar.)
- **Botões — ⚠️ CORREÇÃO (2026-07-22):** a API da Meta **NÃO aceita texto dinâmico em quick
  reply** — o rótulo do botão é FIXO na criação do template (só o payload é parametrizável).
  A spec original ("2 quick replies dinâmicos") não é implementável. Solução: criar **variantes
  pré-aprovadas** do template-curinga e o compositor escolhe a variante (campo `variante` na
  saída, no lugar de `botoes` livre):
  | Variante | Botões fixos | Uso típico |
  |---|---|---|
  | `copilot_msg` | (sem botões) | avisos sem ação |
  | `copilot_msg_sim` | "Sim, quero" / "Agora não" | oferta de ajuda/próximo passo |
  | `copilot_msg_feito` | "Já resolvi" / "Me ajuda" | follow-up de open loop |
  | `copilot_msg_ver` | "Ver agora" / "Depois" | resumo/extrato/relatório |
  O webhook trata o clique como texto normal (payload = rótulo; "Me ajuda" reabre a conversa
  com o agente completo). Os few-shots do §5 continuam válidos — mapear os exemplos de
  `botoes` para a variante mais próxima.
- **⚠️ CORREÇÃO — risco de recategorização:** a Meta pode reclassificar UTILITY→MARKETING se o
  conteúdo do `{{1}}` soar comercial (precedente NOSSO: `boas_vindas_cortesia` foi
  recategorizada). Guarda de saída na edge: se o `texto` do compositor contiver oferta/venda
  (regex: desconto|oferta|promoç|assine|compre|aproveite), REPROVAR e cair no template fixo
  antigo (fallback já previsto no §7.1). Monitorar o quality rating do template no BM.
- **Fallback Uazapi:** texto puro (o `waSendTemplate` já tem o equivalente).
- Registrar em `whatsapp_events` com `kind=proativo`, `parsed.assunto` e atualizar
  `proactive_unanswered` (zera quando o usuário responde qualquer coisa — checar no webhook).

---

## 7. Notas de integração (car-expiration-alerts)

1. **Substituir os templates rígidos aos poucos.** Começar pelo `resumo_pro_semanal` (maior
   ativo de retenção) e pelos marcos de prazo de multa (5/3/1/0) — já existem gatilhos e dados.
   Manter os templates antigos como fallback se o compositor falhar (try/catch → template fixo).
2. **Insight engine primeiro.** Antes do compositor, uma função pura por usuário devolve
   `{tipo, ...dados}` já com comparações calculadas (lucro/km vs semana anterior, km restante
   de óleo, dias de prazo). O compositor NUNCA vê SQL nem array cru.
3. **Sorteio de ângulo:** `cuidado | bolso | conquista | novidade`, evitando repetir
   `last_proactive_angle`. Reengajamento força `novidade`.
4. **Horário de respeito (código):** disparos entre 8h e 20h (fuso do usuário); resumo PRO
   segue segunda 8h. O cron roda de hora em hora e filtra pela janela.
5. **Dedup:** seguir o padrão atual do `notification_log` (ex.: `proativo:{assunto}:{semana}`).
6. **Custo:** compositor com modelo médio (sonnet/gpt-4o-mini), ~600 tokens por mensagem.
   Extrator com modelo barato, só em interações com conteúdo (pular "ok", "👍").
7. **Evals:** adicionar ao dataset dourado 10 cenários proativos (1 por assunto) com trechos
   obrigatórios e proibidos — rodar a cada mudança de prompt antes do deploy.

---

## 8. Métricas para validar o módulo

- Taxa de resposta por tipo de proativo (meta: resumo PRO > 35%, multa prazo > 40%).
- % de proativos que viram conversa (janela 24h reaberta) — o KPI central do módulo.
- `proactive_unanswered` médio da base (se subir, a cadência está errada, não o texto).
- Churn de usuários com proativo-IA vs. coorte com template fixo (A/B por 60 dias).
- % de open loops resolvidos após follow-up (mede se a "memória" vale a pena).
```
