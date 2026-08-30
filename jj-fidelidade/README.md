# J.J Espetos — Cartão Fidelidade digital

Versão digital do cartão fidelidade físico da J.J Espetos (Av. Tenente Marques, 06 —
Polvilho, Cajamar): **compre 10 costelas no bafo ou 10 frangos e ganhe um almoço
completo grátis**. Um único arquivo (`index.html`), sem backend, sem instalação.

## O que tem dentro

**Aba "Meu Cartão" (cliente)**
- O cliente digita o código do cartão (ex.: `JJ-0001`) ou o telefone e vê o cartão dele,
  igual ao físico: 10 bolinhas, selo com o logo carimbado com animação.
- Quando completa a meta, o cartão "acende" e aparece o aviso de prêmio liberado para
  mostrar no balcão.

**Aba "Admin" (dono)**
- Protegida por PIN de 4 dígitos (inicial: `1234` — troque em Ajustes).
- Resumo: total de clientes, selos dados no mês, prêmios entregues.
- Clientes: busca por nome/código/telefone, cadastro com código automático (`JJ-0001`,
  `JJ-0002`…), dar +1 selo, desfazer selo, entregar prêmio (zera o cartão e conta no
  histórico), histórico de movimentos, excluir cliente.
- Ajustes: meta de selos (5–15), texto do prêmio, texto impresso no cartão, troca de PIN,
  **exportar/importar backup em JSON**.

## Como usar no dia a dia

1. Abra a página no celular do balcão e faça login no Admin com o PIN.
2. Cliente comprou costela/frango → busca o nome → **🔥 Dar +1 selo**.
3. Completou 10 → **🏆 Entregar prêmio e zerar cartão**.
4. O cliente pode abrir a mesma página no celular dele e ver o cartão pelo código/telefone.

## Como publicar

É um arquivo estático — serve em qualquer hospedagem:

- **Vercel/Netlify:** arraste a pasta `jj-fidelidade/` e pronto.
- **Teste local:** `npx http-server jj-fidelidade` e abra o endereço que aparecer.

## Limitações desta v1 (importante, sem enganação)

Os dados ficam no **localStorage do aparelho que usa a página**. Ou seja:

- O painel do dono funciona 100% no celular/tablet do balcão.
- O cliente só vê o cartão atualizado **no mesmo aparelho** onde os selos foram dados —
  em outro aparelho a página não compartilha dados (não há servidor).
- Por isso existe o backup em Ajustes: exporte o JSON de vez em quando.

**Evolução natural (v2):** trocar o localStorage por um Supabase (tabelas `customers` e
`stamp_events` + uma edge function), aí o cartão do cliente atualiza em qualquer
aparelho e dá para mandar o selo por WhatsApp. A estrutura do código já separa dados
(`load/save/makeCustomer`) da interface para essa troca ser simples.
