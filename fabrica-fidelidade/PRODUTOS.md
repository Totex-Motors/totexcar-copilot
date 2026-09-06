# Prateleira de produtos — o que a gente oferta

Cada "produto" abaixo é uma **capacidade do motor** que a gente liga por manifesto
(campo `capabilities`), sem código por cliente. É o cardápio comercial da fábrica:
o vendedor escolhe o que a loja quer, marca no manifesto, e o mesmo motor entrega.

Legenda de status: ✅ pronto no motor · 🚧 no roadmap (motor ainda não lê).

| Produto | O que é | Para quem | Como liga | Status |
|---|---|---|---|---|
| **Cartão fidelidade** | Selo por compra, meta e recompensa. A base. | Todos | `goal` + `reward` + `rule` | ✅ |
| **Trava de plano** | Limite de clientes (50 / 150 / ∞). | Todos | `plan` | ✅ |
| **Marca própria** | Nome, cores, logo, textos, prefixo do cartão. | Todos | `brand` | ✅ |
| **Acesso do balcão** | Dono + operador com senhas separadas. | Todos | `engine.roles` + `secrets` | ✅ |
| **Catálogo** | Cardápio/vitrine com preço e botão "Pedir no WhatsApp". | À la carte | `capabilities.catalog` | 🚧 |
| **Sorteios** | Cada selo vira número da sorte; a loja sorteia um prêmio. | À la carte | `capabilities.sorteios` | 🚧 |
| **Catálogo de recompensas** | Vários prêmios com custos diferentes (não só um). | Premium | `capabilities.rewardsCatalog` | 🚧 |
| **Níveis** | Member / Select / Black, com thresholds. | Premium | `capabilities.tiers` | 🚧 |
| **Indicação** | Link/QR por cliente; amigo compra → bônus; anti-fraude. | Premium | `capabilities.referral` | 🚧 |
| **Missões** | Campanhas que dirigem comportamento. | Premium | `capabilities.missions` | 🚧 |
| **Ledger** | Livro-razão auditável de cada selo. | Premium | `capabilities.ledger` | 🚧 |

## À la carte × premium

- **À la carte** (`catalog`, `sorteios`): podem ser vendidas para **qualquer** cliente,
  inclusive básico. Ex.: o Brasa Caipira é básico e já pediu catálogo + sorteios.
- **Premium** (`rewardsCatalog`, `tiers`, `referral`, `missions`, `ledger`): o bundle do
  `tier: "premium"` (ex.: Clube Moura).

## Como ofertar (roteiro de venda)

1. Mostra o **cartão fidelidade** (a base) — todo cliente leva.
2. Oferece **catálogo** (o cardápio dele no app) e **sorteios** (recorrência) como extras.
3. Para marcas maiores, apresenta o **pacote premium** (níveis + indicação + Signatures).

Cada "sim" do cliente é só um interruptor no manifesto — nunca um sistema novo.

## Regra de ouro (não esquecer)

Pedido novo de cliente → *"cabe num interruptor da prateleira?"* Se sim, liga. Se não,
vira um produto novo da prateleira (todos passam a poder ter) — nunca código solto de
um cliente só.
