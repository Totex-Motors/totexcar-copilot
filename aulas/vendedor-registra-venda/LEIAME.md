# Aula: Como o vendedor registra a venda e faz a entrega

Fontes da aula (skill `aulas-visuais`). Versão atual: **storyboard v1 APROVADO pelo dono (07/11/2026)**.

- `roteiro.md`: roteiro com narração, tela e sincronização de cada cena (gerado de `cenas.js`).
- `storyboard-v1.pdf`: storyboard visual (gerado por `gerar.cjs`).
- `gravacao-v1.pdf`: roteiro de gravação, 1 cena por página, com a pronúncia de placas, etiqueta e km (gerado por `gravacao.cjs`).
- `capturas/v*.png`: telas **reais** do link de venda (`/venda/:token`) com **dados de demonstração** (API simulada; cliente, CPF, placa e etiqueta fictícios).
- `capturas/w*.png` e `e01.png`: **simulação** do WhatsApp do cliente (textos reais do Co-pilot) e ilustração da etiqueta (`simulacao-whatsapp.cjs`).
- Continuidade: é o mesmo Onix (ABC1D23) revisado na aula da oficina.

Regenerar: build de demonstração servido em 127.0.0.1:4179 (ver a aula da oficina), depois `node captura.cjs`, `node simulacao-whatsapp.cjs`, `node gerar.cjs`, `node gravacao.cjs` nesta pasta.

## Vídeo (prévia v1, 07/11/2026)

- `audio/S1…S12.m4a`: narração gravada (enviada pelo dono em 07/11/2026), originais sem edição.
- `transcricao/S*.json`: transcrição local (faster-whisper, modelo small, sem serviço externo) com o tempo de cada palavra; gerada por `transcrever.py`.
- `video.js`: o que aparece em cada cena e em qual trecho da fala (âncoras).
- `render-video.cjs`: alinha roteiro × áudio palavra a palavra, gera os quadros 1080×1920 e junta com o áudio (loudnorm -16 LUFS). 1080p vertical, 30 fps, H.264/AAC.
- Gerar: `node render-video.cjs transcricao audio <saida.mp4>` (o mp4 não fica no repositório; sai em minutos a partir destes fontes).

Pendente: revisão da prévia pelo dono; aprovação; publicação.
