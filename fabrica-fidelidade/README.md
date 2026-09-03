# Fábrica de Templates — Cartão Fidelidade

Esta pasta é o **alicerce do padrão**. A ideia em uma frase:

> **Um motor que nunca muda + um manifesto que muda por cliente.**

O app da J.J (`../jj-fidelidade/`) e a edge function (`jj-fidelidade`) são o **motor** —
iguais para todo comércio. Cada comércio novo ganha só um **manifesto**: um arquivo
JSON que descreve a marca, os textos, o plano e a regra do cartão. Nenhuma linha de
código nova por cliente.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `manifest.schema.json` | A **régua**. Todo manifesto de cliente tem que obedecer a ela. É o que impede a bagunça. |
| `clientes/jj-espetos.manifest.json` | O primeiro cliente (a J.J), descrito no formato-padrão. É o modelo para os próximos. |

## Como um cliente novo nasce

1. Copie `clientes/jj-espetos.manifest.json` para `clientes/<novo-cliente>.manifest.json`.
2. Troque os valores: `tenant`, `brand`, `copy`, `plan`, `goal`, `reward`, `rule`, `channels`.
3. O `engine` fica quase igual (é o motor). Pronto — é um cliente novo.

O dono do negócio não programa nada: ele só decide esses valores.

## A regra de ouro (a única "teoria" que importa)

Quando um cliente pedir algo, faça **uma pergunta**:

> *"Isso é um texto ou regra que cabe num campo do manifesto (→ todo cliente pode ter),
> ou é código novo?"*

- **Campo do manifesto** → tranquilo, faz parte do padrão.
- **Código novo** → decide-se com cuidado se vira um campo novo do manifesto (aí *todos*
  passam a poder ter) ou se não entra. **Nunca** vira código solto num cliente só.

## Segurança — o que NÃO fica no manifesto

Os segredos (**PIN do dono, PIN do balcão, chave da nuvem**) **não** entram no
manifesto. Eles vivem no Supabase, por cliente. O manifesto só guarda um *ponteiro*
(o bloco `secrets`, que diz onde estão e quais são — nunca os valores). Assim o
manifesto é seguro de versionar no git e de mostrar num pitch.

## Como validar um manifesto

O `manifest.schema.json` é um JSON Schema. Qualquer validador (ex.: a biblioteca
`ajv`) confirma se um manifesto está dentro do padrão antes de ir pro ar. É o "gate"
da fábrica: manifesto fora da régua não passa.

---

Próximas fases (quando quiser): **1** — o motor lê o manifesto por cliente; **2** — um
agente monta o manifesto a partir de 5 perguntas; **3** — a fábrica completa. Esta pasta
é a Fase 0 e não altera nada do que já está no ar.
