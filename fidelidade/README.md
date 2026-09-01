# fidelidade — página de vendas (no ar)

Página de vendas do **Cartão Fidelidade digital** (produto por Totex), com os
3 planos por nº de clientes e os botões levando pro WhatsApp. É um site estático
de um arquivo (`index.html`), sem backend.

## No ar

Deployada como projeto próprio na Vercel pelo workflow
`.github/workflows/deploy-fidelidade.yml`, a cada push na `main` que mude
`fidelidade/` (ou manualmente por `workflow_dispatch`). O endereço-alvo é
**https://fidelidade.vercel.app** (se o subdomínio estiver livre; senão a Vercel
escolhe um sufixo e a URL sai no log do deploy).

## Botões

Todos os CTAs e os botões dos planos abrem o WhatsApp **(11) 94744-8137** com uma
mensagem pronta por plano (`a.wa[data-msg]` → link `wa.me` montado por um script
inline). A navegação do topo usa âncoras (`#como-funciona`, `#recursos`, `#planos`).

## De onde vem / como regenerar

A página **não é editada à mão** — é gerada a partir do design source em
`design-src/Main.dc.html` (a mesma fonte do canvas de design):

```
cd design-src
node build-fidelidade.mjs     # gera ../fidelidade/index.html
```

A imagem de compartilhamento (`og.jpg`, 1200×630) é gerada de `design-src/og.html`
via Playwright/Chromium (ver `og.html`). Para mudar copy, preço ou visual, edite
`Main.dc.html`, rode o build e faça commit.
