# Playbook — Canal + Comunidade do WhatsApp → Co-pilot → Intermediação

> Camada de **distribuição** (topo de funil) do ecossistema TotexMotors.
> Versão visual (pra divulgar): https://claude.ai/code/artifact/ae68e862-ab20-4627-9006-2939e7ee26e6
> Contexto do produto: ver skill `.claude/skills/totexmotors/SKILL.md` e `HANDOFF.md`.

## A tese
O consumidor está autônomo: pesquisa sozinho, desconfia do vendedor, quer resolver rápido
("eu mesmo faço, sem pagar pra ninguém"). Em vez de brigar com isso, **entregamos esse
sentimento** (informação simples no WhatsApp, no ritmo dele) e cobramos a **intermediação
barata por fechar o negócio**. É o "TikTok Shopping" aplicado a carro — a TotexMotors no
meio do caminho, unindo comprador e vendedor. A jogada: estar onde a multidão está, dar
autonomia + **sensação de ganho**, e monetizar fechando pras duas pontas (não empurrando).

## O funil (cada etapa tem 1 papel)
1. **📣 Canal do WhatsApp** (topo/atração) — broadcast, seguidores ilimitados, zero spam.
2. **👥 Comunidade / grupos temáticos** (meio) — a pessoa se auto-seleciona; audiência quente.
3. **🔗 CTA** (ponte) — todo post/mensagem abre a conversa com o gatilho certo (`#vender`, carro, avaliação).
4. **🤖 Co-pilot + Vitrine** (conversão autônoma) — o "vendedor que não tira o couro".
5. **🤝 Intermediação** (receita) — fecha venda (repasse/vitrine) ou compra (Indique); comissão barata; lead no CRM TotexGest.

## A decisão: Canal + Comunidade, NÃO "grupos soltos + disparo"
- **Arriscado:** disparo em massa viola as regras da Meta → **número banido**; grupo trava em 1024
  e vira spam; grupo aleatório = audiência fria. Se cai o número, cai vitrine, CRM, leads — tudo.
- **Durável:** **Canal** (broadcast oficial, ilimitado, sem spam) + **Comunidade** (grupos por tema
  sob 1 guarda-chuva). Audiência quente e segmentada; número protegido.

## Montagem 1 — o Canal (vitrine ao vivo)
- **Identidade:** "TotexMotors · Ofertas & Avaliação", foto = logo, descrição com 1 promessa + link do Co-pilot. Tom de parceiro, não de vendedor.
- **O que postar (rodízio):** carro do dia; abaixo da FIPE; "quanto vale o seu?" (`#vender`); bastidor do estúdio; prova real (vendido em X dias, com autorização).
- **Ritmo:** 1–2 posts/dia em horário de pico; **1 CTA só** por post → link do Co-pilot.

## Montagem 2 — a Comunidade (grupos certos)
- **CORE (convertem):** SUVs & Picapes · Sedans & Hatches até 80k · Oportunidades/Repasse (abaixo da FIPE, à vista).
- **ÍMÃS (tráfego car-adjacent, nunca aleatório):** "Quanto vale seu carro" (avaliação grátis → lead) · "Radar de Serviços" (oficina/guincho/parceiros com desconto).
- **Regra de ouro:** nos grupos de oferta, **só admin posta** (vira mural); nos ímãs, deixa a conversa rolar e o Co-pilot atende. Sempre com a hashtag que puxa pro atendimento.

## O pulo do gato — o link que abre o Co-pilot pronto
- `wa.me/55SEUNUMERO?text=%23vender` (abre já querendo vender); carro específico → vitrine naquele carro; avaliação → fluxo FIPE direto.
- **Já resolvido:** quando o WhatsApp não repõe o texto do gatilho no re-scan, o Co-pilot **reconhece quem volta** e re-engaja (o link funciona mesmo no re-scan).

## A receita — as duas pontas ganham
- **Vendedor:** Venda Express (à vista, repasse ≤48h) ou Vitrine (loja anuncia; mais prazo → recebe mais). Ganho na margem. Já pronto no `#vender`.
- **Comprador:** vitrine + Co-pilot (acha/compara/decide sozinho) + Indique e Ganhe. Comissão barata por fechar.
- **Guardrail:** a parte **fiscal/tributária** da intermediação precisa passar pelo contador antes de escalar. A tecnologia está pronta; o enquadramento é decisão de vocês + contador.

## Medir (antes de escalar)
- **Alcance:** seguidores do Canal · membros por grupo.
- **Ativação:** cliques no CTA → conversas abertas.
- **Lead:** `#vender` e `#stand` por dia.
- **Fechamento:** agendamentos · vendas · comissão.
- A maioria já dá pra ler nos `whatsapp_events`; o Piloto fecha o loop.

## Lançamento — 4 primeiras semanas
1. **Montar:** Canal + Comunidade, grupos core + 1 ímã, links do Co-pilot; semear o Canal com 10–15 carros.
2. **Semear:** convidar a base da casa (clientes do stand, contatos, quem já falou com o Co-pilot). Sem comprar lista.
3. **Ativar:** ligar o ímã "quanto vale seu carro"; medir `#vender`; primeiros agendamentos/fechamentos.
4. **Ler e decidir:** cliques→conversas→leads→fechamento. O que converte, dobra; o que não, corta. Só aí escalar/replicar pra outras lojas.

## Estrutura da Comunidade (fase 1 — comece ENXUTO)
Comunidade criada: https://chat.whatsapp.com/LheuXvp88otLcadFBXWTi7
**Poucos grupos cheios > muitos vazios.** Começar com 4; abrir novos só quando um encher ~200+.

| Grupo | Papel | Quem posta |
|---|---|---|
| 📣 Avisos TotexMotors | carro do dia / abaixo da FIPE (ligado ao Canal) | só admin |
| 🔥 Oportunidades / Repasse | só abaixo da FIPE, à vista — urgência real | só admin |
| 🚗 SUVs, Picapes & Elétricos | o que mais gira; conversa liberada | todos |
| 💰 Vendo meu carro (avaliação grátis) | a ponta vendedora → alimenta o #vender | todos |

Ímãs de utilidade (dicas de dono, Radar de serviços) ficam pra fase 2, quando tiver gente.

## Estratégia de convite — "a escada" (objeção: "não quero mais grupo")
Ninguém quer grupo; as pessoas querem **vantagem com porta de saída**. Nunca venda "entre no
grupo"; venda **acesso antecipado**: *"Carro bom some em dias. Quem vê primeiro, compra. As
ofertas saem no grupo ANTES do anúncio."* (urgência honesta — carro usado é peça única.)

As 3 promessas anti-objeção (garantidas por estrutura, não por promessa):
1. 🔕 "Só 2 posts/dia, zero conversa" → grupo com **só admin posta**.
2. ⚡ "Só oportunidade de verdade" → curadoria (abaixo da FIPE / recém-chegado).
3. 🚪 "Sai com um toque, sem mágoa" → dizer isso NO convite desarma a resistência.

A escada (deixa a pessoa escolher o nível de compromisso; capture em algum degrau):
- 📣 **Canal** = compromisso mínimo ("só seguir, ninguém te vê").
- 👥 **Grupo** = vantagem ("vê as ofertas primeiro").
- 🤖 **Co-pilot 1:1** = zero grupo ("me diz o carro que te aviso quando chegar" — nosso diferencial).

Scripts por contexto (balcão, Canal/Instagram, pós-#vender, quem recusa grupo): a objeção nomeada
no convite ("sei que ninguém aguenta mais grupo; esse é mudo, 2 posts/dia, só oportunidade").

**No Co-pilot (implementado):** `offerComunidade()` — convite contextual 1x por telefone, disparado
só nos becos sem saída da vitrine (não achou / acabou o estoque), quando "ver primeiro" tem valor.
Link configurável em `app_settings.comunidade_link` (vazio = desligado).

## Alto-falante vs cofre (números)
- **Oficial (Meta) 5511963786699 = o Co-pilot (cofre).** NUNCA conectar em API não-oficial.
- **Não-oficial (TotexGest) = alto-falante dos grupos (descartável).** Postagens agendadas nos
  grupos próprios (2x/dia, audiência opt-in) = volume baixo, risco baixo. Se cair, troca o chip.
- Lição do mercado (DevZapp, R$197–697/mês): links de captação por origem e organização por tema
  valem copiar (do jeito seguro); criação de grupos em lote + disparo em massa NÃO (queima número).

## Minha parte (dev do Co-pilot) — sustentar o playbook
- Links prontos (deep-links `wa.me`) por tipo de post (vender, carro específico, avaliação).
- Rastreio de cliques nos eventos (cliques→conversa→lead sem planilha manual).
- Se precisar, gatilho novo tipo `#oferta <carro>` pro Canal, ligado à vitrine.
- Tudo isso vira o **Piloto (etapa 3):** 1 funil ponta-a-ponta com número real, antes de escalar.
