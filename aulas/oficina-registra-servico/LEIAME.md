# Aula: Como a oficina registra o serviço

Fontes da aula (skill `aulas-visuais`). Versão atual: **storyboard v1 APROVADO pelo dono (06/11/2026)**. Voz: **Lucas (gerente de manutenção)**, a pedido do Marcos; `gravacao-v1.pdf` é o texto pra ler.

- `roteiro.md`: roteiro com narração, tela e sincronização de cada cena (gerado de `cenas.js`).
- `storyboard-v1.pdf`: storyboard visual aprovado (gerado de `cenas.js`).
- `gravacao-v1.pdf`: roteiro de gravação, 1 cena por página, com a pronúncia dos códigos (gerado por `gravacao.cjs`).
- `capturas/`: telas **reais** do link da oficina (`/parceiro/:token`) com **dados de demonstração** (API simulada, placa ABC1D23 fictícia).
- `ilustracoes/`: fotos fictícias de painel e etiqueta usadas na demonstração (marcadas como ilustração).
- `caixas.json`: posição dos elementos em cada captura (para as marcações laranja).

Regenerar (na pasta `microsaas-clean`): build de demonstração com `VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_ANON_KEY=demo npx vite build --outDir <tmp>` e `npx vite preview --host 127.0.0.1 --port 4179 --outDir <tmp>`; depois `node captura.cjs` e `node gerar.cjs` nesta pasta.

Pendente: áudios do Lucas (1 por cena: S1…S10), tempos pelo áudio real, animação, revisão do vídeo exportado.
