# Calendário do Carro — motor de datas e toques garantidos

> Especificação do item 5 do plano de retenção: transformar todas as datas do carro
> (fixas e projetadas) numa espinha dorsal de contato mensal confiável. Recorrência não
> precisa ser diária — precisa ser CONFIÁVEL. É a fonte de insights do compositor proativo.
> Versão 1 — 2026-07-19. Relacionado: `MODULO-PROATIVO-TOTEXCAR.md`,
> `GAMIFICACAO-SCORE-CUIDADO.md`, `PROGRAMA-SELO-TOTEX-RECOMPRA.md`.
>
> **⚠️ CORREÇÕES da revisão técnica 2026-07-22 (v1.1, Claude Code):**
> 1. **Não construir sistema paralelo:** o cron `car-expiration-alerts` JÁ calcula quase todos
>    esses eventos (docs, parcela+boleto, multa 5/3/1/0, assinatura/cortesia, aniversário,
>    radar). O gerador do §4.2 deve ser um REFACTOR: o cron alimenta `car_calendar` e passa a
>    ler dela — nunca duas fontes da verdade. Migrar alerta por alerta, mantendo o dedup do
>    `notification_log`.
> 2. **`accounts.uf`/`cidade` JÁ existem** (migração radar_servicos, 2026-07-22) — o §3 só
>    precisa do seed da tabela `ipva_calendario` e de perguntar a UF a quem não preencheu.
> 3. A página `/calendario` (§4.5) é opcional na 1ª entrega — começar pelo card no Dashboard
>    + tool `meu_calendario` (maior valor por esforço); a página vem depois.

---

## 1. Conceito

Hoje os alertas são disparos isolados por evento (IPVA, licenciamento, parcela, multa).
O Calendário unifica tudo num **motor de datas** com três tipos:

| Tipo | Exemplos | Fonte |
|---|---|---|
| **Fixas legais** | IPVA (por final de placa + estado), licenciamento, seguro, CNH | cadastro + tabela estadual |
| **Recorrentes do contrato** | parcela do financiamento (com o boleto certo — já existe), assinatura/cortesia | `financiamentos`, Asaas |
| **Projetadas por uso real** | revisões por km (óleo, filtros, pneus…), tanque/tendência de consumo | hodômetro + km médio/dia |

E duas **sazonais do ecossistema**: aniversário de compra do carro (pós-venda já existe) e
campanhas de feriado (Modo Viagem, revisão pré-estrada — gancho pra loja).

**Saída:** no máximo 1 toque proativo consolidado por semana por usuário (o compositor escolhe
o insight principal; o resto vira "também na sua semana:" em 1 linha).

---

## 2. Projeção de revisões por km (o diferencial técnico)

```
km_medio_dia = (hodometro_atual − hodometro_90d_atrás) / dias_decorridos
data_projetada(item) = hoje + (km_restante_item / km_medio_dia) dias
```
- Recalcular a cada hodômetro novo; suavizar outliers (mediana móvel de 3 medições).
- Fallback sem histórico: 40 km/dia (dono comum) / 250 km/dia (PRO).
- Janela de alerta por item: avisar quando faltarem **~1.000 km OU 15 dias** (o que vier
  primeiro), reforço em ~300 km/5 dias. Prazo de multa segue os marcos 5/3/1/0 já existentes.
- O plano de revisões (itens + intervalos) vem da ficha técnica quando houver; senão, padrão:
  óleo 10.000 km/12 m · filtro de ar 15.000 · velas 30.000 (flex) · correia 50.000 ·
  pneus 40.000 · alinhamento 10.000. Tabela `maintenance_reminders` JÁ existe — estender com
  `projected_date` e `source` (ficha|padrao).

---

## 3. Tabela IPVA por estado (dado que falta hoje)

- Tabela `ipva_calendario (uf, final_placa, mes_vencimento, parcelas)` — seed com o calendário
  oficial por UF (atualizar 1×/ano, revisão manual). Sem a UF do usuário: perguntar 1× no
  onboarding ou no primeiro alerta ("seu IPVA é de que estado?") e gravar em `accounts.uf`.
- Licenciamento: mês = final da placa (regra nacional) — mesma tabela.

---

## 4. Implementação (Claude Code)

### 4.1 Banco
```sql
create table if not exists car_calendar (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  account_id  uuid references accounts(id),
  kind        text not null,     -- ipva|licenciamento|seguro|cnh|parcela|revisao|assinatura|
                                 -- cortesia|aniversario_compra|prazo_multa|sazonal
  label       text not null,     -- "IPVA 2026", "Troca de óleo"
  due_date    date not null,
  projected   boolean default false,  -- true = data projetada por km (recalcula)
  source_id   text,              -- id da origem (financiamento id, reminder id, multa id)
  amount      numeric,           -- quando houver (parcela, IPVA)
  status      text default 'pendente',  -- pendente|quitado|vencido
  meta        jsonb default '{}',
  unique (user_id, kind, label, due_date)   -- idempotência do gerador
);
create index on car_calendar (user_id, due_date, status);
```

### 4.2 Gerador (job semanal, dentro de `car-expiration-alerts`)
1. Para cada usuário ativo: sincroniza datas fixas (placa/UF, financiamento, assinatura,
   multas) → upsert em `car_calendar`.
2. Recalcula `projected_date` das revisões por km (fórmula §2) → atualiza `due_date` +
   `projected=true`.
3. Marca `vencido` o que passou sem quitação (alimenta congelamento do Score).

### 4.3 Seletor de insight semanal (antes do compositor)
```
1. candidatos = eventos com due_date nos próximos 15 dias (ou vencidos ≤ 7 dias)
2. prioridade: segurança/prazo legal (multa, licenciamento) > dinheiro (parcela, IPVA)
   > cuidado (revisão projetada) > relacionamento (aniversário, cortesia)
3. insight principal = top 1; secundário = top 2 SE mesmo tema ou combinar naturalmente
4. se nada nos 15 dias → sem toque de calendário (o compositor pode usar extrato do Score,
   open loop ou sazonal — nunca inventar assunto)
5. dedup em notification_log: `calendar:{kind}:{due_date}`
```

### 4.4 Agente — tool `meu_calendario`
```json
{"name":"meu_calendario",
 "description":"Próximas datas do carro: vencimentos (IPVA, licenciamento, seguro, CNH, parcelas) e revisões projetadas por km. Use para 'o que vence?', 'tá tudo em dia?', 'quando é minha próxima revisão?'.",
 "parameters":{"type":"object","properties":{"dias":{"type":"number","description":"janela, default 60"}}}}
```
Prompt (trecho a adicionar no system):
```text
CALENDÁRIO: para "o que vence?", "está tudo em dia?", "próxima revisão" → use meu_calendario.
Apresente em ordem de data, com os dias restantes ("IPVA em 12 dias"). Revisões projetadas
por km: deixe claro que é projeção pelo SEU ritmo de uso ("se mantiver seus ~40 km/dia").
Se estiver tudo em dia por 60+ dias, diga isso de forma leve e ofereça 1 cuidado preventivo
do plano de revisões. NUNCA invente data nem valor — veio da tool ou não existe.
```

### 4.5 Frontend
- Página **`/calendario`:** linha do tempo 90 dias (datas fixas com valor + revisões
  projetadas com "~"), badge de status, botão "quitei" (registra e pontua no Score).
- Card Dashboard: "Próximo vencimento: IPVA em 12 dias — R$ 1.850".

### 4.6 Critérios de aceite
- [ ] Gerador roda 2× seguidas sem duplicar linhas (unique constraint).
- [ ] Projeção de óleo muda quando o ritmo de uso muda (testar com km/dia dobrado).
- [ ] Sem eventos em 15 dias = nenhum toque de calendário enviado.
- [ ] Máximo 1 proativo de calendário/semana/usuário (dedup).
- [ ] "Quitei" na parcela/revisão atualiza status E pontua no Score no mesmo minuto.

---

## 5. Métricas
- % de usuários com ≥1 toque de calendário/mês que interagem (meta: 50%).
- Quitações registradas no prazo antes vs. depois (prova de valor pro Selo).
- Revisões feitas ANTES do vencimento projetado (cuidado preventivo = selo forte).
- Zero reclamação de "spam" (se subir, revisar o seletor — nunca a frequência por usuário).
