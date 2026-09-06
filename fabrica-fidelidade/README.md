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
| `clientes/jj-espetos.manifest.json` | Cliente **básico** (a J.J): um selo, uma recompensa. O modelo mais simples. |
| `clientes/moura-alfaiataria.manifest.json` | Cliente **premium** (Clube Moura): mesmo motor, com níveis, indicação, catálogo de recompensas e ledger ligados. |
| `clientes/assets/moura-referencia-visual.png` | Arte aprovada da Moura, referência de design do template premium. |

## Básico × Premium — um motor só, capacidades opcionais

O campo `tier` do manifesto escolhe o perfil:

- **`basico`** (ex.: J.J) — um selo (`carimbo`), uma meta, uma recompensa. Nada mais liga.
- **`premium`** (ex.: Moura) — o mesmo motor, com interruptores opcionais no bloco
  `capabilities`: catálogo de recompensas, níveis (Member/Select/Black), indicação com
  anti-fraude, missões e ledger auditável. O `unit` renomeia o selo (na Moura vira
  "Signature").

**Importante:** premium **não** é outro sistema. É o mesmo motor lendo mais campos do
manifesto. Cada capacidade nova nasce como um interruptor reutilizável — todo cliente
premium futuro pode ligar — nunca como código de um cliente só. Foi por isso que a
Moura **não** foi construída como o app Next.js separado que um rascunho externo
sugeriu: dois códigos seriam o fim do padrão. Ganhamos as boas ideias (ledger, níveis,
indicação) dentro do nosso motor.

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

## Fase 1 (feita) — o motor lê a marca do manifesto

O app (`../jj-fidelidade/index.html`) agora tem um bloco `brand` dentro de
`settings` (nome, sigla, iniciais do selo, prefixo do código, endereço, cores de
acento). Todo texto/logo/cor de marca que era fixo no código passou a ser lido desse
bloco, com os valores da J.J como padrão — **sem manifesto, o app fica idêntico ao de
hoje**. Um cliente básico novo troca só esse bloco (via nuvem por tenant) e o mesmo
motor já mostra a marca dele. Falta ainda ligar cada tenant a um deploy próprio
(as tags `<head>`/og são definidas no deploy de cada loja).

Próximas fases: **2** — um agente monta o manifesto a partir de 5 perguntas;
**3** — a fábrica completa.
