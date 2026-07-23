# Gamificação — Motor do Score de Cuidado

> Especificação técnica do motor de pontos, anti-fraude, streaks e placares que alimentam o
> Selo Totex (`PROGRAMA-SELO-TOTEX-RECOMPRA.md`). Gamificação aqui NÃO é badge vazio:
> **todo ponto converte em R$ na recompra** — é dinheiro gamificado, não jogo.
> Versão 1 — 2026-07-19. Relacionado: `MODULO-PROATIVO-TOTEXCAR.md`, `CALENDARIO-DO-CARRO.md`.
>
> **⚠️ CORREÇÕES da revisão técnica 2026-07-22 (v1.1, Claude Code):**
> 1. **Capacidade do tanque:** a regra "secou o tanque" (litros ≥ 90% da capacidade) depende
>    da capacidade vinda da `ficha_tecnica` — que nem todo carro tem preenchida. **Degradar
>    graciosamente:** sem capacidade conhecida, NÃO aplicar a penalidade (nunca penalizar com
>    dado incerto). O `car-spec` pode buscar a capacidade quando gerar a ficha.
> 2. **Timing estratégico:** o motor de pontos deve entrar em produção CEDO, acumulando em
>    SILÊNCIO (sem UI/marketing), para que o Selo já tenha histórico quando o programa lançar
>    — essencial pro penhasco da conversão da cortesia (vence a partir de meados de 2027).
>    Lançamento do programa = Fase 4 do plano (ver HANDOFF).
> 3. **Ranking PRO por cidade:** hoje a base PRO é pequena — percentil de cidade sem massa
>    vira ruído ("top 100% de 2 motoristas"). Gate: só exibir ranking com ≥ 20 motoristas na
>    cidade; antes disso, comparar com a MÉDIA do próprio usuário.

---

## 1. Princípios

1. **Ponto = R$.** Toda exibição de Score vem acompanhada do valor em reais ("seu Selo já
   garante R$ 4.300 a mais na troca"). Pontos abstratos não motivam; dinheiro motiva.
2. **Progresso visível a cada ação.** Registrar algo sem feedback de progresso é registro
   morto. Toda confirmação do agente traz o delta ("+10, faltam 40 pro Prata").
3. **Perder dói mais que ganhar.** Decaimento e congelamento comunicados com antecedência
   ("faltam 5 dias pra manter seu ritmo") — loss aversion a favor da recorrência.
4. **Sem farm.** Anti-fraude embutido no motor (abaixo) — o Selo só vale se a loja confiar.

---

## 2. Tabela de pontos (default — tudo em `app_settings`)

| Ação | Pontos | Limite/condição |
|---|---|---|
| Abastecimento c/ cupom + hodômetro | +10 | máx. +40/mês |
| Abastecimento só c/ cupom (ou só valor) | +5 | máx. +20/mês |
| Hodômetro atualizado no mês (foto ou digitado) | +10 | 1×/mês |
| Revisão/manutenção comprovada (nota c/ CNPJ) | +80 | por item do plano |
| Revisão em loja/oficina **parceira Totex** | +120 | substitui os +80 |
| Documento quitado no prazo (IPVA, licenc., seguro) | +30 | por evento |
| Multa resolvida no prazo (paga ou recurso protocolado) | +20 | por multa |
| Streak: 3 meses seguidos com ≥4 registros válidos | +50 | recorrente |
| Indicação que vira usuário ativo | +100 | por indicado |

| Penalidade | Pontos | Condição |
|---|---|---|
| "Secou o tanque" (litros ≥ 90% da capacidade) | −5 | por ocorrência |
| Reserva frequente (3+ no trimestre) | −15 | adicional, trimestral |
| Registro retroativo (cupom > 7 dias) | pontos ÷ 2 | automático |
| Inconsistência km/L (outlier anti-fraude) | 0 + flag | revisão manual |
| Decay: 90 dias sem atividade (dono) / 45 (PRO) | −50/semana | até o piso do Selo atual |
| Revisão vencida sem comprovação | congela subida | até regularizar |

**Faixas de Selo:** Bronze 300 · Prata 600 · Ouro 850 (+ meses de histórico ativo — ver doc
do programa). Chaves: `score_*` em `app_settings`, versionadas (mudança não retroativa).

---

## 3. Anti-fraude (o Selo só vale se a loja confiar)

1. **Consistência km/L:** ao registrar combustível com km, calcular consumo do trecho e
   comparar com (a) histórico do carro e (b) faixa INMETRO ±40%. Fora → `inconsistencia_flag`,
   não pontua, não bloqueia o registro (pode ser real), entra em fila de revisão no /admin.
2. **Anti-retroatividade:** `cupom.data < hoje − 7d` → metade dos pontos. Evita "dump" de
   cupons na véspera da venda.
3. **Hodômetro só-sobe:** já existe no sync — km menor que o anterior = não pontua e alerta.
4. **CNPJ da nota de revisão:** OCR extrai CNPJ; formato válido (14 dígitos + DV) obrigatório
   pra pontuar. Oficina parceira = match com base do /lojista → pontuação dobrada.
5. **Limite de ritmo:** máx. 1 abastecimento pontuado a cada 48h (ninguém enche o tanque
   3×/dia; motorista PRO: 1 a cada 24h).
6. **Vistoria final:** nenhuma pontuação substitui a vistoria presencial da loja na recompra —
   cláusula do programa. O Score define a FAIXA; a vistoria confirma.

---

## 4. Placares e rituais (a camada de recorrência)

### 4.1 Extrato mensal do Score (dia 1º, WhatsApp — via compositor proativo)
Insight entregue ao compositor (`MODULO-PROATIVO-TOTEXCAR.md`):
```json
{"tipo":"extrato_selo","score":640,"tier":"prata","delta_mes":+85,
 "faltam_ouro":210,"projecao_ouro_meses":4,
 "valor_garantido_rs":4300,"destaque":"2 revisões em dia e streak de 3 meses",
 "alerta":"óleo vence em ~600 km"}
```
Regra de copy: SEMPRE abrir com o valor em R$ ou a conquista; nunca com o número de pontos.

### 4.2 Ritual "Segunda do Lucro" (PRO) — upgrade do resumo semanal
O resumo semanal PRO ganha 1 linha de gamificação: posição no **ranking anônimo de R$/km da
cidade** ("você tá no top 30% dos motoristas de Curitiba") + delta do Score. Motorista de app
é competitivo por natureza — ranking é o gancho de abertura toda segunda.
- Tabela `pro_weekly_ranking`: materializada semanalmente pelo cron (cidade, user_id hash,
  lucro_km). Exibir apenas percentil — NUNCA nome/valor de terceiros.

### 4.3 Streaks com aviso de risco
- Aos 25 dias sem registro (com streak ativo): "seu streak de 3 meses quebra em 5 dias —
  vale +50 pontos e mantém seu ritmo pro Selo Ouro". Enviado pelo compositor (ângulo bolso).

### 4.4 Marcos comemorativos (uma vez cada)
- 1º abastecimento → rito de iniciação (ver doc do programa, §6.3).
- Mudança de Selo → mensagem especial + novo valor em R$ + (Ouro) "você pode trocar com
  garantia de até 90% da FIPE — válido por 12 meses a partir de hoje".

---

## 5. Implementação (Claude Code)

### 5.1 Motor (edge `care-score`, ação `recompute`)
```
gatilhos: registrar_gasto (combustível), atualizar_hodometro, registrar_revisao,
          quitação de documento (cron), resolução de multa, indicação (asaas-webhook)
fluxo:
 1. validar regras anti-fraude (§3) → define points e flags
 2. insert em care_score_events
 3. somar score = Σ events (com decay aplicado) → users.care_score
 4. aplicar faixas + meses de histórico ativo → users.care_tier (+ care_tier_at na mudança)
 5. se tier mudou OU marco atingido → enfileirar mensagem via compositor proativo
 6. atualizar care_last_activity
```
- Decay e streaks: job semanal dentro do `car-expiration-alerts` (já tem o padrão de dedup
  em `notification_log`).
- Idempotência: evento tem `meta.source_id` (id da transaction/upload) — reprocessar não
  duplica ponto.

### 5.2 Tool do agente `care_statement` (spec p/ TOOL_SPECS)
```json
{"name":"care_statement",
 "description":"Score de Cuidado do usuário: pontos, selo, o que falta pro próximo, valor garantido em R$ na recompra e últimos eventos. Use quando ele perguntar do Selo, pontos, 'quanto vale meu cuidado', progresso.",
 "parameters":{"type":"object","properties":{},"required":[]}}
```
Retorno: `{score, tier, tier_min_fipe, valor_garantido_rs, faltam_proximo, projecao, ultimos_eventos[5], alertas[]}`.

### 5.3 Prompt do agente (trecho — complemento do §7.3 do doc do programa)
```text
GAMIFICAÇÃO: o Score de Cuidado é DINHEIRO em formação — ao falar dele, traduza pra R$
sempre que possível (a tool já traz valor_garantido_rs). Confirmações de registro: 1 linha
de progresso só quando houver novidade relevante (subiu de Selo, entrou num marco, streak em
risco) — não repita placar em toda mensagem, vira ruído. Streak em risco: avise como parceiro
("seu streak quebra em 5 dias"), nunca como ameaça. Ranking PRO: cite só o percentil dele
("top 30% em Curitiba"), nunca dados de outros motoristas. Comemore marcos de verdade
(mudança de Selo merece entusiasmo; +10 pontos, não).
```

### 5.4 Frontend
- `/selo`: gauge do Score (0–1000), faixas Bronze/Prata/Ouro marcadas, extrato de eventos
  (ícone por tipo, +/−), card "vale R$ X na troca", CTA "Avaliar meu carro" (flow recompra).
- Dashboard: mini-card com tier + progresso (link p/ /selo).
- `/lojista` → Central de Valor: selos da carteira, prontos p/ troca, recompras com selo.

### 5.5 Critérios de aceite
- [ ] Reprocessar uma transação não duplica pontos (idempotência por `source_id`).
- [ ] Todos os limites (mês/ritmo) respeitados; teste com 5 abastecimentos no mesmo dia.
- [ ] Decay só até o piso do Selo atual (nunca derruba Selo já conquistado sem inatividade
      longa + aviso prévio registrado).
- [ ] Mudança de Selo dispara mensagem comemorativa em < 5 min.
- [ ] Extrato mensal chega dia 1º com valor em R$ correto (conferir conta FIPE × faixa).
- [ ] Evals: 8 cenários de conversa sobre Score/Selo no dataset dourado.

---

## 6. Métricas
- Registros válidos/usuário/mês (baseline vs. pós-Selo) — a métrica-mãe.
- % usuários com streak ≥ 3 meses; taxa de recuperação após aviso de quebra.
- Abertura do extrato mensal e do resumo PRO (comparar antes/depois do ranking).
- Flags de fraude por 100 usuários (se > 5, revisar limites).
- Correlação Selo × retenção D90 × conversão de cortesia (prova do modelo pro lojista).
