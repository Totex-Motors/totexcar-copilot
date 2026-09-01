# design-src — página de vendas (canvas de design)

Fontes da **página de vendas dos 3 planos** do Cartão Fidelidade digital
(Grátis · Pro R$59 · Automação R$149), no visual brasa/carvão do plano de
negócio. Publicada como Claude Design canvas (editável + exporta PDF/PNG).

## Arquivos

- `Main.dc.html` — a landing page (um artboard): herói com mock do celular,
  a dor do papel, como funciona, recursos, planos, ROI, depoimento, FAQ e CTA.
- `canvas.json` — layout do canvas (frame 1200px, página em modo `flow`).

O `.html` gerado (o payload do editor, ~2.5MB) fica fora do git (`.gitignore`);
é regenerado a partir das fontes acima e publicado como Artifact.

## Regenerar / republicar

Via skill `/design` (helper `seed-canvas.mjs`): seeda uma cópia fresca do
payload com estes arquivos e republica no mesmo Artifact. Editar textos/preços
também dá pra fazer direto no canvas publicado e clicar em **Salvar**.
