# Feirão Cardoso Veículos — Sorteio TotexCar Co-pilot

App de página única para cadastro de clientes no feirão e sorteio de 5 ganhadores
(1 ano grátis do TotexCar Co-pilot) às 18:00.

## Banco de dados

Supabase — projeto **TotexMotors OS** (`fbgtqiqovwxccinbzvmx`, região São Paulo):

- `feirao_cadastros` — participantes; o voucher (CV-001, CV-002…) é gerado por
  trigger no banco, então vários celulares podem cadastrar ao mesmo tempo sem
  repetir número. WhatsApp é único (bloqueia cadastro duplicado).
- `feirao_ganhadores` — resultado do sorteio (posições 1 a 5).

Sem internet o app continua funcionando: salva no aparelho (voucher `CV-Lxx`),
mostra o selo "📴 só neste aparelho" e sincroniza sozinho quando a conexão volta.

## Publicar na Vercel

Dentro desta pasta (`feirao-cardoso/`):

```bash
npx vercel --prod
```

Ou em https://vercel.com/new arraste a pasta `feirao-cardoso`. É um site
estático — nenhuma variável de ambiente é necessária (a chave usada no HTML é a
publishable/anon key, feita para uso público no navegador).
