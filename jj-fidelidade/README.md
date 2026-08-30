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

**QR codes**
- Na tela do cartão: QR que abre aquele cartão em outro celular (`?c=JJ-0001`).
- Na ficha do cliente (Admin): QR do cartão + "Imprimir QR deste cartão".
- Em Admin › Ajustes: **"Imprimir cartaz do balcão"** — cartaz A4 com o logo, QR e a regra
  da promoção, para o cliente escanear e cair direto na tela do cartão.
- O endereço usado nos QR é o "Endereço público do app" (Ajustes); vazio = o endereço atual.

**Envio por WhatsApp — modo grátis (padrão)**
- Sem custo de API: o app **abre o WhatsApp do próprio aparelho** com a mensagem do
  cartão prontinha (link `wa.me`) — é só tocar em enviar. Funciona ao cadastrar cliente
  com telefone e no botão "📲 Enviar cartão no WhatsApp" da ficha.
- **Envio automático por API é opcional e fica guardado para o futuro:** a edge function
  `jj-fidelidade` (em `microsaas-clean/supabase/functions/`, já deployada, formato
  uazapi) continua pronta. Se um dia contratar uma instância, preencha endpoint + chave
  em Admin › Ajustes › Avançado e cole a URL/token da instância via action `config`.
  Com os campos em branco (padrão), nada é chamado e nada é cobrado.

**Leitura de QR no balcão**
- Botão **📷** ao lado da busca (Admin › Clientes): abre a câmera, lê o QR do cartão do
  cliente (ou do convite) e abre a ficha direto — dar selo vira questão de segundos.
- Usa o leitor nativo do navegador (BarcodeDetector — Chrome/Android, que é o cenário
  do balcão); onde não houver suporte, o app avisa e a busca por código resolve.
- Os QR do app são gerados por biblioteca **embutida no próprio arquivo** (qrcode.js,
  MIT) — nada de CDN: funciona offline e em qualquer hospedagem.

**Gamificação de indicação (indique e ganhe +1 selo)**
- Todo cliente tem um **voucher de indicação** (o próprio código do cartão) na tela do
  cartão: código em destaque, QR e botão "Convidar pelo WhatsApp" com mensagem pronta.
- O amigo abre o link do convite (`?i=JJ-0001&n=Junior`) e vê a tela do voucher:
  "Junior te chamou pra comer na J.J!", com a regra — comprar 1 costela no bafo ou
  1 frango e mostrar a tela no balcão.
- No balcão, ao cadastrar o amigo (primeira compra), o campo **"Voucher de indicação"**
  valida o código e dá **+1 selo automático para quem indicou** (aparece no histórico
  como "🤝 +1 selo — indicou Fulano"; o novo cliente fica marcado "veio por indicação").
- Se o cartão de quem indicou já estiver cheio, o app avisa para resgatar o prêmio
  primeiro (o selo de indicação não passa da meta).
- **Aba "🏆 Ranking" no Admin:** pódio de quem mais indica (🥇🥈🥉, barra proporcional,
  total de indicações e quantas no mês), com o total de clientes novos vindos por
  indicação; tocar num nome abre a ficha do cliente.

**Clima de churrasqueira**
- **Bolinhas sem selo são braseiros acesos**: cada espaço vazio do cartão tem uma
  chama animada dançando dentro (3 camadas dessincronizadas + brilho pulsando) —
  dar o selo "conquista" o fogo, carimbando o adesivo do logo por cima. Gatilho
  visual de consumo: o cartão inteiro parece uma grelha esperando os espetos.
- Fogo animado na base da tela (canvas leve, ~60fps): chamas dançando, brasas
  voando e fumaça subindo, mais o logo com as chamas tremeluzindo. Pausa quando a
  aba fica oculta e vira um brilho parado para quem prefere menos animação
  (`prefers-reduced-motion`).

**Aba "Admin" (dono)**
- Protegida por PIN de 6 dígitos (definido pelo dono; o PIN da nuvem é a fonte da verdade).
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

## Onde está no ar

**https://jjespetos.vercel.app** — projeto próprio na Vercel, deployado pelo workflow
`.github/workflows/deploy-jj.yml` a cada push na main que mude `jj-fidelidade/`
(ou manualmente por workflow_dispatch). O endereço antigo
`totexcarco-pilot.vercel.app/jj/` redireciona pra cá preservando `?c=`/`?i=`.

Teste local: `npx http-server jj-fidelidade` e abra o endereço que aparecer.

## Banco de dados na nuvem (v2)

Os clientes e selos ficam salvos num **banco na nuvem** (Supabase, tabela `jj_state`,
via edge function `jj-fidelidade`):

- **Login do admin = sincronização**: o PIN é validado contra a nuvem e o estado
  completo é puxado; cada mudança (cadastro, selo, prêmio, ajustes) é gravada de
  volta automaticamente (badge "☁️ Dados sincronizados" no painel).
- **O cliente vê o cartão em qualquer aparelho**: a busca por código/telefone e a
  chegada por QR consultam a nuvem (`card_pull` — retorna só nome/código/selos do
  próprio cartão, sem telefone nem histórico de outros clientes).
- **Offline não trava**: sem internet o app segue no cache local (localStorage) e
  re-tenta a sincronização sozinho; o backup JSON dos Ajustes continua existindo.
- Proteções: chave do serviço + PIN do admin exigido para ler/gravar o estado
  completo (o PIN da nuvem é a fonte da verdade; trocar o PIN atualiza a nuvem).
- Modelo: blob único (1 balcão escreve, clientes só leem o próprio cartão) — o
  tamanho de uma churrascaria cabe com folga; se um dia houver múltiplos caixas
  simultâneos, o passo seguinte é quebrar em tabelas por cliente.
