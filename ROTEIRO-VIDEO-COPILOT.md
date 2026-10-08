# Roteiro de vídeo — TotexCar Co-pilot (apresentação pra clientes)

Vídeo curto pra mandar no WhatsApp de cliente (comprou carro na loja, lead do canal, cliente antigo).
Mostra o produto com as **telas reais**: conversa no WhatsApp + painel web. Feito pra rodar na skill
de motion (Remotion/motion) do Claude no terminal: cada cena tem tempo, asset, texto na tela, narração
e movimento. Os assets ficam em `video/assets/` (lista no fim).

## Regras do vídeo

| Item | Decisão |
|---|---|
| Formato principal | **9:16 vertical**, 1080×1920, 30 fps (WhatsApp, Status, Reels) |
| Duração | **75 s** (versão completa) e **30 s** (corte curto, no fim do arquivo) |
| Áudio | Narração em voz natural (pt-BR, tom de amigo que entende de carro) + trilha leve. **Legendas sempre**: 80% das pessoas assistem sem som no WhatsApp |
| Identidade | Fundo escuro `#0b0c0e`, destaque ciano `#2DD4BF`, branco `#ffffff`, cinza `#9aa0a6`. Título em **Gabarito 900 caixa alta**, frases em **Instrument Serif** (itálico leve), números em **Martian Mono** — é o mesmo sistema do site |
| Telas | Mockup de celular (moldura escura, cantos 48 px, sem marca) com a gravação do WhatsApp dentro. Telas web em moldura de navegador fina. Nunca tela crua esticada |
| Movimento | Pouco e preciso: zoom lento (1.00→1.06) nas telas, *slide-in* de 12 px nos textos, *highlight* ciano (retângulo arredondado, 2 px) em cima do elemento que a narração cita. Sem partículas, sem glitch |
| Ritmo | Corte a cada 3–5 s. Nenhuma tela parada mais de 5 s |
| CTA | Link `copilot.totexmotors.com` + número do WhatsApp em texto e QR nos 6 s finais |

## Estrutura (75 s)

```
0–5    Gancho (dor)                     texto grande, sem tela
5–12   O que é                          celular: conversa do Co-pilot
12–22  Foto da nota → gasto registrado  celular: foto da nota + resposta
22–30  Documentos e vencimentos         celular: CRLV + alerta de IPVA
30–38  Km e manutenção                  celular: foto do painel + "próxima troca"
38–46  Multas e Raio-X                  celular: multa analisada + web /historico
46–54  Radar de serviços                celular: "achar oficina" + web /servicos
54–62  Quanto vale / Garagem            web /vale + celular: oferta do canal
62–69  A etiqueta do para-brisa         foto real do adesivo + scan → ativa
69–75  Fechamento + CTA                 logo, link, QR, WhatsApp
```

## Cenas

### Cena 1 · 0:00–0:05 · Gancho
- **Visual:** fundo escuro. Três linhas entram uma por vez (slide-in 12 px, 150 ms cada):
  `NOTA DA OFICINA.` / `IPVA.` / `MULTA.` Depois, menor, em serif: *Onde você guarda tudo isso?*
- **Narração:** "Nota da oficina, IPVA, multa, revisão. Onde você guarda tudo isso do seu carro?"
- **Motion:** cada palavra em Gabarito 900, 120 px, branco; a última linha em Instrument Serif, ciano.

### Cena 2 · 0:05–0:12 · O que é
- **Visual:** mockup de celular entra de baixo (ease-out 600 ms) com `A02_conversa-inicial.mp4` (conversa com o Co-pilot mostrando o menu: Gastos do mês, Meu consumo, Manutenção (km), Achar oficina/serviço, Garagem Totex, Planejar viagem, Acessar o sistema).
- **Texto na tela (canto superior):** `Seu carro, cuidado pelo WhatsApp.`
- **Narração:** "O TotexCar Co-pilot é um assistente no seu WhatsApp. Você manda, ele organiza, avisa e lembra. Sem app pra instalar."
- **Motion:** zoom lento no celular; highlight ciano passa pelo menu de baixo pra cima (1,5 s).

### Cena 3 · 0:12–0:22 · Foto da nota vira gasto
- **Visual:** `A03_nota-oficina.mp4` (manda foto de uma nota; o Co-pilot responde com valor, item, data e categoria registrados). Corte pra `W01_transactions.png` (painel web, lista de gastos) por 3 s.
- **Texto na tela:** `Manda a foto. Ele registra.`
- **Narração:** "Fez uma troca de óleo? Manda a foto da nota. O Co-pilot lê, registra o valor e guarda o histórico. No painel fica tudo organizado por mês."
- **Motion:** highlight no valor da resposta; transição *push* pra tela web.

### Cena 4 · 0:22–0:30 · Documentos e vencimentos
- **Visual:** `A04_crlv-arquivo.mp4` (manda o CRLV, ele guarda no ArquivoZap) + `A05_alerta-ipva.png` (mensagem de alerta "seu IPVA vence em 7 dias").
- **Texto na tela:** `CRLV, IPVA, licenciamento. Ele avisa antes de vencer.`
- **Narração:** "Documento do carro, CNH, boleto do IPVA: manda que ele guarda. E avisa antes de vencer, pra você não pagar multa por esquecimento."
- **Motion:** o alerta entra como notificação (slide do topo, 300 ms), com som sutil de notificação.

### Cena 5 · 0:30–0:38 · Km e manutenção
- **Visual:** `A06_hodometro.mp4` (foto do painel com o km; o Co-pilot lê o número e responde "próxima troca de óleo em X km"). Corte pra `W02_manutencao.png` (painel /manutencao).
- **Texto na tela:** `Foto do painel. Ele calcula a próxima revisão.`
- **Narração:** "Tira uma foto do painel. Ele lê a quilometragem, calcula o consumo e avisa quando chega a hora da próxima troca ou revisão."
- **Motion:** o número do km ganha zoom (1.0→1.15) ao ser lido; highlight em "próxima troca".

### Cena 6 · 0:38–0:46 · Multas e Raio-X
- **Visual:** `A07_multa.mp4` (foto do auto de infração; ele resume: infração, valor, prazo, se cabe recurso). Corte pra `W03_historico.png` (Raio-X do carro em /historico).
- **Texto na tela:** `Multa chegou? Ele analisa. Quer o histórico? Raio-X.`
- **Narração:** "Chegou multa? Manda a foto que ele explica o que é, quanto custa e se dá pra recorrer. E se quiser saber tudo sobre o seu carro, o Raio-X puxa o histórico pela placa."
- **Motion:** highlight no valor e no prazo; a tela web entra com zoom lento.

### Cena 7 · 0:46–0:54 · Radar de serviços
- **Visual:** `A08_radar.mp4` (toca em "Achar oficina/serviço", escolhe guincho/borracharia, recebe a lista com parceiros no topo e benefício). Corte pra `W04_servicos.png` (/servicos com selo "No topo" e "vale R$ X").
- **Texto na tela:** `Guincho, borracharia, oficina. Perto de você, com benefício.`
- **Narração:** "Precisou de guincho, borracharia ou oficina? Ele mostra quem está perto, e os parceiros da Totex ainda dão um benefício pra quem vem pelo Co-pilot."
- **Motion:** highlight no selo do parceiro e no valor do benefício.

### Cena 8 · 0:54–0:62 · Quanto vale e Garagem
- **Visual:** `W05_vale.png` (tela /vale: placa → valor FIPE) com animação de contagem no número. Depois `A09_canal-oferta.png` (post do canal com foto do carro e link `/o/código`).
- **Texto na tela:** `Quanto vale o seu? E o próximo, já na vitrine.`
- **Narração:** "Quer saber quanto o seu carro vale hoje? Digita a placa. E quando for trocar, as ofertas da Totex chegam primeiro pra quem está no Co-pilot."
- **Motion:** o valor em Martian Mono sobe de 0 até o valor (800 ms); o post do canal entra como card.

### Cena 9 · 0:62–0:69 · A etiqueta do para-brisa
- **Visual:** `F01_etiqueta-parabrisa.jpg` (foto real do adesivo colado no para-brisa, lado de dentro) → `A10_scan-etiqueta.mp4` (câmera aponta, abre o WhatsApp, o Co-pilot responde "✅ Pronto: a partir de agora eu cuido dele por aqui").
- **Texto na tela:** `Aponte a câmera. Pronto.`
- **Narração:** "Na entrega do carro, a etiqueta no para-brisa já vem com tudo pronto. Aponta a câmera e o Co-pilot assume o cuidado do seu carro na hora."
- **Motion:** zoom na etiqueta (1.0→1.2, 1,5 s), corte seco pro celular; o "✅ Pronto" ganha highlight.

### Cena 10 · 0:69–0:75 · Fechamento
- **Visual:** fundo escuro, logo TotexMotors (`totexmotors-logo.png`) + texto `TotexCar Co-pilot`. Embaixo: `copilot.totexmotors.com` e o QR (`QR_whatsapp.png`, link `wa.me/5511963786699`). Linha final em serif: *Grátis. Sem mensalidade. Só o seu carro, organizado.*
- **Narração:** "É grátis, sem mensalidade. Entra em copilot.totexmotors.com ou manda um oi no WhatsApp. Seu carro, organizado."
- **Motion:** logo entra com fade (400 ms); QR aparece com escala 0.9→1.0; o link fica 4 s parado (tempo de ler/escanear).

## Versão curta (30 s) — pra Status e primeiro contato

```
0–3    Gancho: "NOTA. IPVA. MULTA. Onde você guarda?"
3–9    Celular: foto da nota → gasto registrado (A03)
9–15   Celular: alerta de IPVA + foto do painel (A05 + A06, 3 s cada)
15–21  Celular: radar com parceiro no topo (A08)
21–25  Etiqueta: aponta a câmera → "✅ Pronto" (A10)
25–30  Fechamento: logo + link + QR
```
Narração da curta: "Nota da oficina, IPVA, multa. Manda pro Co-pilot no WhatsApp: ele registra, guarda e avisa antes de vencer. Precisou de oficina, ele acha perto de você. É grátis. copilot.totexmotors.com."

## Assets pra capturar (nomes exatos, pasta `video/assets/`)

Gravações de tela do **celular** (WhatsApp com o Co-pilot, 1080×1920, sem barra de status com dados pessoais; usar um número de teste ou borrar o número):

| Arquivo | O que gravar | Dica |
|---|---|---|
| `A02_conversa-inicial.mp4` | Abre a conversa, manda "oi", recebe o menu | 8 s, termina com o menu aberto |
| `A03_nota-oficina.mp4` | Manda foto de uma nota real (troca de óleo), recebe a resposta com o gasto | 10 s |
| `A04_crlv-arquivo.mp4` | Manda o CRLV, recebe "guardei no ArquivoZap" | 6 s |
| `A05_alerta-ipva.png` | Print da mensagem de alerta de vencimento | Pode ser um alerta real recebido |
| `A06_hodometro.mp4` | Foto do painel com o km, resposta com consumo/próxima troca | 8 s |
| `A07_multa.mp4` | Foto de um auto de infração, resposta com análise | 8 s |
| `A08_radar.mp4` | "Achar oficina/serviço" → categoria → lista com parceiro no topo | 10 s |
| `A09_canal-oferta.png` | Print de um post do canal (carro do dia) | Escolher um carro bonito |
| `A10_scan-etiqueta.mp4` | Câmera na etiqueta → WhatsApp abre → "✅ Pronto" | Gravar com um segundo celular filmando o primeiro |

Prints **web** (1440×900, navegador sem abas, tema do app):

| Arquivo | Tela |
|---|---|
| `W01_transactions.png` | `/transactions` com gastos do mês |
| `W02_manutencao.png` | `/manutencao` com próxima troca |
| `W03_historico.png` | `/historico` (Raio-X) com resultado |
| `W04_servicos.png` | `/servicos` com parceiro "No topo" |
| `W05_vale.png` | `/vale` com placa consultada e valor |

Fotos e estáticos:

| Arquivo | O que é |
|---|---|
| `F01_etiqueta-parabrisa.jpg` | Foto real do adesivo colado no para-brisa (lado de dentro, com o carro ao fundo) |
| `totexmotors-logo.png` | Já existe em `microsaas-clean/public/` |
| `QR_whatsapp.png` | QR do link `https://wa.me/5511963786699?text=Oi!%20Quero%20cuidar%20do%20meu%20carro%20com%20o%20Co-pilot` |
| `trilha.mp3` | Trilha leve, 75 s, sem voz (loop), volume −18 dB sob a narração |
| `narracao.mp3` | Voz gravada ou TTS pt-BR (tom calmo, masculino ou feminino), com os textos de "Narração" acima |

Dados sensíveis: tampar número de telefone, placa de cliente e nome. Usar carro e placa da própria loja nas gravações.

## Como pedir pra skill de motion

Prompt sugerido no terminal, com este arquivo na pasta:

```
Use ROTEIRO-VIDEO-COPILOT.md como roteiro. Monte o vídeo 9:16 (1080×1920, 30 fps, 75 s) seguindo
as cenas, tempos, textos na tela e movimentos descritos. Assets em video/assets/ com os nomes do
roteiro. Identidade: fundo #0b0c0e, destaque #2DD4BF, fontes Gabarito 900 (títulos), Instrument
Serif (frases) e Martian Mono (números). Mockup de celular escuro com cantos 48 px para os .mp4.
Legendas queimadas a partir da narração. Exporte também a versão de 30 s descrita no fim do roteiro.
Se faltar algum asset, use um placeholder cinza com o nome do arquivo e me avise.
```
