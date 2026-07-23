# Relatório IR/MEI — Motorista PRO (spec de produção)

> Especificação pronta para produção do relatório fiscal do motorista de aplicativo.
> Utilidade recorrente OBRIGATÓRIA (12×/ano): o motorista MEI/autônomo precisa prestar contas
> — e nós já temos todos os dados. É o módulo que faz o PRO virar ferramenta de trabalho,
> não app de anotação.
> Versão 1 — 2026-07-19. Relacionado: `VISAO-MOTORISTA-PRO-TOTEX.md` ("fase 2 fácil e valiosa"
> — antecipada), `GAMIFICACAO-SCORE-CUIDADO.md`, `MODULO-PROATIVO-TOTEXCAR.md`.
>
> **⚠️ CORREÇÕES da revisão técnica 2026-07-22 (v1.1, Claude Code):**
> 1. **PDF:** o doc original diz "mesma lib do recurso de multa" — NÃO existe lib de PDF nas
>    edges (o recurso de multa é .txt gerado no front). Usar **pdf-lib** (funciona no Deno) ou
>    HTML minimalista; decidir na implementação.
> 2. **Envio pelo cron (dia 1º):** fora da janela de 24h a Meta NÃO aceita mensagem livre com
>    documento — precisa de **template UTILITY com header DOCUMENT** (mais 1 template a criar
>    via `scripts/create-wa-templates.mjs`, ex.: `relatorio_fiscal_mensal`). O envio sob
>    demanda (usuário pediu) cai na janela de sessão e usa documento normal.
> 3. **Limite MEI:** confirmar o valor vigente no ano do deploy (era R$ 81.000/ano; há
>    propostas de aumento em tramitação — por isso `app_settings.mei_limite_anual`).
> 4. Base PRO hoje é pequena — o retorno deste módulo é estratégico (retenção do PRO), não
>    volume imediato. Esforço baixo justifica mesmo assim.

---

## 1. O que entrega

| Relatório | Periodicidade | Conteúdo |
|---|---|---|
| **Mensal** | todo dia 1º (automático) + sob demanda | Receitas por app (Uber/99/outros), despesas por categoria, lucro, km rodados, R$/km. Formato carnê-leão: receita tributável do mês destacada |
| **Anual** | janeiro (automático) + sob demanda | Consolidado do ano p/ declaração: receita total, despesas dedutíveis, extrato por categoria + **acompanhamento do limite MEI** |
| **Extrato p/ contador** | sob demanda (PDF + CSV) | Todas as transações do período, categorizadas, com km |

**Disclaimer obrigatório em todos:** "Documento informativo gerado a partir dos seus registros.
Não substitui contador nem escrituração oficial. Confira antes de declarar."

**Limite MEI em `app_settings` (`mei_limite_anual`)** — valor default configurável; ⚠️ validar
o limite vigente no ano corrente antes do deploy (muda por lei). Alertas em 70% e 90% do limite.

---

## 2. Fluxos

### 2.1 Sob demanda (WhatsApp)
- Gatilhos: "relatório", "IR", "imposto de renda", "MEI", "carnê-leão", "extrato pra contador".
- Tool `relatorio_fiscal(periodo)` → gera PDF + CSV → envia PDF como documento no WhatsApp
  (Meta suporta `document`) + 1 mensagem-resumo humana:
  *"Abril fechado: faturou R$ 5.120, gastou R$ 1.940 → lucro R$ 3.180 em 2.150 km (R$ 1,48/km).
  O PDF completo tá aqui — é só repassar pro seu contador."*

### 2.2 Automático (cron dia 1º)
- Insight `{"tipo":"relatorio_mensal",...}` pro compositor proativo + anexo PDF.
- Só envia se o mês teve movimento (mesma regra do resumo semanal: sem movimento, não incomoda).

### 2.3 App
- Página **`/relatorios`** (menu, visível com `driver_mode`): seletor de período, cards
  (receita/despesa/lucro/km), botões PDF e CSV, histórico dos relatórios gerados.

---

## 3. Regras de cálculo (código — NUNCA no LLM)

- **Receita tributável (carnê-leão):** Σ `transactions.type='income'` do mês.
- **Despesas dedutíveis:** categorias ligadas ao trabalho (combustível, manutenção, pedágio,
  lavagem, seguro, parcela do financiamento, multas) — flag `dedutivel` na tabela de categorias
  (default true p/ as de carro; usuário pode desmarcar no app).
- **km do período:** max−min de `odometer` nas transações do período (mesma lógica do resumo
  semanal).
- **MEI anual:** Σ income do ano corrente vs. `mei_limite_anual` → % + alertas.
- PDF: HTML→PDF (mesma lib do recurso de multa), layout 1 página por mês, tabela três-linhas,
  logo Totex, disclaimer no rodapé. CSV: `data,tipo,categoria,descricao,valor,km`.

---

## 4. Implementação (Claude Code)

### 4.1 Banco
```sql
alter table categories add column if not exists dedutivel boolean default true;
create table if not exists fiscal_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  periodo    text not null,        -- '2026-04' ou '2026'
  kind       text not null,        -- mensal|anual
  pdf_url    text, csv_url    text,
  totals     jsonb,                -- {receita,despesa,lucro,km,rs_km,mei_pct}
  created_at timestamptz default now(),
  unique (user_id, periodo, kind)
);
```
(PDFs em bucket Supabase Storage `reports`, URL assinada com expiração de 7 dias.)

### 4.2 Edge `fiscal-report` (nova, JWT + service-role p/ cron)
- Ações: `generate(user_id, periodo, kind)` → calcula (§3), renderiza PDF/CSV, sobe no
  Storage, grava `fiscal_reports`, retorna URLs + totais. Idempotente (upsert por unique).
- `send_whatsapp(user_id, periodo)` → chama generate + envia documento via `waSendDocument`
  (adicionar em `_shared/wa.ts`, espelhando `waSendImage`).

### 4.3 Tool do agente
```json
{"name":"relatorio_fiscal",
 "description":"Gera e envia o relatório fiscal do motorista (mensal ou anual): receitas por app, despesas dedutíveis, lucro, km e R$/km, em PDF e CSV. Use para: relatório, IR, imposto de renda, MEI, carnê-leão, extrato pra contador.",
 "parameters":{"type":"object","properties":{
   "periodo":{"type":"string","description":"AAAA-MM (mensal) ou AAAA (anual); default = mês anterior fechado"},
   "kind":{"type":"string","enum":["mensal","anual"],"default":"mensal"}},"required":[]}}
```

### 4.4 Prompt do agente (trecho)
```text
RELATÓRIO FISCAL (PRO): para "relatório", "IR", "MEI", "carnê-leão", "extrato pra contador" →
use relatorio_fiscal (default: mês anterior fechado; "do ano"/"declaração" → anual). Após enviar,
resuma em 2 linhas: lucro do período + R$/km. Explique com naturalidade que o documento serve
de base pro contador/carnê-leão, mas NUNCA dê conselho fiscal definitivo ("sou seu copiloto,
não seu contador — ele confirma os enquadramentos"). Se MEI passar de 70% do limite, avise
proativamente com cuidado: é informação que protege o motorista, não bronca.
```

### 4.5 Cron (dentro de `car-expiration-alerts`, dia 1º)
- Para cada `driver_mode=true` com movimento no mês anterior: `fiscal-report.generate` +
  insight pro compositor (mensagem humana + documento). Dedup: `fiscal:{AAAA-MM}` em
  `notification_log`.
- Janeiro: também o anual. Alertas MEI (70%/90%) entram como insight próprio quando cruzar.

### 4.6 Critérios de aceite
- [ ] PDF mensal bate com as transactions do período (teste com 3 meses distintos).
- [ ] Idempotente: gerar 2× o mesmo período não duplica linha nem reenvia WhatsApp.
- [ ] Mês sem movimento não gera envio automático.
- [ ] CSV abre no Excel com acentos corretos (UTF-8 BOM) e valores com vírgula decimal.
- [ ] Disclaimer em todos os documentos; prompt nunca dá conselho fiscal (eval com 5 casos).
- [ ] Documento chega no WhatsApp como PDF abrível no celular (testar Android + iOS).

---

## 5. Por que este módulo segura a recorrência do PRO
- É a única obrigação MENSAL recorrente da vida do motorista que nós resolvemos de graça com
  dados que ele já registra. Cancelar o PRO = voltar a montar planilha na mão.
- Gera o momento "contador" 1×/mês (alguém externo vê o valor do produto — indicação orgânica).
- Alimenta o Score (mês com relatório gerado = mês com histórico completo = Selo forte).

## 6. Métricas
- % de PROs que abrem/baixam o relatório mensal (meta: 60%).
- Retenção de PROs com ≥3 relatórios gerados vs. sem nenhum.
- Compartilhamentos ("meu contador pediu") via menção no WhatsApp — sinal de indicação.
