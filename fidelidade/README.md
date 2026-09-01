# fidelidade — página de vendas (no ar)

Página de vendas do **Cartão Fidelidade digital** (produto por Totex), com os
3 planos por nº de clientes e os botões levando pro WhatsApp. É um site estático
de um arquivo (`index.html`), sem backend.

## No ar

Deployada como projeto próprio na Vercel pelo workflow
`.github/workflows/deploy-fidelidade.yml`, a cada push na `main` que mude
`fidelidade/` (ou manualmente por `workflow_dispatch`). O endereço-alvo é
**https://totexfidelidade.vercel.app** (se o subdomínio estiver livre; senão a
Vercel escolhe um sufixo e a URL sai no log do deploy).

## Botões

- **Planos → checkout (Asaas):** os botões "Assinar …" (`a.co[data-plan]`) chamam a
  edge function pública `fidelidade-checkout` (Supabase, projeto do Co-pilot) e
  redirecionam pro checkout do Asaas (PIX + cartão). Se a chamada falhar, caem no
  WhatsApp. O retorno `?status=success|cancel` mostra um banner. O pagamento cai no
  Asaas com `externalReference` `fidelidade:<plano>:<ciclo>` e a ativação do cartão da
  loja é **manual** (o webhook do Co-pilot ignora essa referência).
- **Trial / dúvidas → WhatsApp:** "Começar grátis" (topo) e a linha abaixo dos planos
  abrem o WhatsApp **(11) 94744-8137** com mensagem pronta (`a.wa[data-msg]`).
- **Guia:** link no topo e botão em "Como funciona" abrem `guia.html` (como o dono
  administra e como o cliente usa).
- Navegação do topo por âncoras (`#como-funciona`, `#recursos`, `#planos`).

## guia.html

Página standalone de ajuda (mesma identidade), escrita à mão — parte "Para você, dono"
(entrar no Admin, cadastrar, dar selo, indicação, prêmio, QR/cartaz, ranking, ajustes) e
"Para o seu cliente" (abrir o cartão, juntar selos, indicar, resgatar) + FAQ.

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
