# Aula: Como o vendedor registra a venda e faz a entrega

Fontes da aula (skill `aulas-visuais`). Versão atual: **storyboard v1 APROVADO pelo dono (07/11/2026)**.

- `roteiro.md`: roteiro com narração, tela e sincronização de cada cena (gerado de `cenas.js`).
- `storyboard-v1.pdf`: storyboard visual (gerado por `gerar.cjs`).
- `gravacao-v1.pdf`: roteiro de gravação, 1 cena por página, com a pronúncia de placas, etiqueta e km (gerado por `gravacao.cjs`).
- `capturas/v*.png`: telas **reais** do link de venda (`/venda/:token`) com **dados de demonstração** (API simulada; cliente, CPF, placa e etiqueta fictícios).
- `capturas/w*.png` e `e01.png`: **simulação** do WhatsApp do cliente (textos reais do Co-pilot) e ilustração da etiqueta (`simulacao-whatsapp.cjs`).
- Continuidade: é o mesmo Onix (ABC1D23) revisado na aula da oficina.

Regenerar: build de demonstração servido em 127.0.0.1:4179 (ver a aula da oficina), depois `node captura.cjs`, `node simulacao-whatsapp.cjs`, `node gerar.cjs`, `node gravacao.cjs` nesta pasta.

Pendente: gravação da voz, tempos pelo áudio, animação, revisão do vídeo exportado.
