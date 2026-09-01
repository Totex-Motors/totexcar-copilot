# fidelidade — página de vendas (no ar)

Página de vendas do **Cartão Fidelidade digital** (produto por Totex) + guia de uso.
Visual **dark/futurista** (near-black + brasa neon, tipografia Space Grotesk, movimento:
partículas, glow, scroll-reveal, marquee, hover magnético). Sites estáticos, sem backend.

- **`index.html`** — a landing (herói, dor do papel, construção cortesia, como funciona,
  recursos, depoimento, planos com checkout, ROI, FAQ, CTA). Autorada à mão.
- **`guia.html`** — guia de uso no formato **telas numeradas**: um mock da tela do app
  (claro, como o dono vê) com **pinos numerados nos campos** e uma legenda ao lado
  explicando cada número. Telas: cadastro, ficha/dar selo, ajustes (dono) e o cartão
  (cliente) + FAQ.
- **`og.jpg`** — imagem de compartilhamento 1200×630 (brasa/carvão).

> As duas páginas são **mantidas à mão** (o motion/JS não passa por build). Edite o HTML
> direto e faça commit. O canvas de design em `design-src/` é o registro da versão clara
> anterior (histórico) — a versão no ar é a dark daqui.

## No ar

Deploy como projeto próprio na Vercel via `.github/workflows/deploy-fidelidade.yml`, a
cada push na `main` que mude `fidelidade/` (ou por `workflow_dispatch`). Endereço:
**https://totexfidelidade.vercel.app** (o `guia.html` fica em `/guia.html`).

## Botões

- **Planos → checkout (Asaas):** os botões "Assinar …" (`a.co[data-plan]`) chamam a edge
  function pública `fidelidade-checkout` e redirecionam pro checkout do Asaas (PIX +
  cartão). Se falhar, caem no WhatsApp. Retorno `?status=success|cancel` mostra um banner.
  Ativação do cartão da loja é **manual** (o webhook do Co-pilot ignora `fidelidade:*`).
- **Trial / dúvidas → WhatsApp** (11) 94744-8137 (`a.wa[data-msg]`).
- **Guia** no topo e num botão em "Como funciona".
