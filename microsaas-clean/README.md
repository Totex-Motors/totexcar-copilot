# Totex_CAR_FINANCE

Sistema de **controle financeiro de gastos com o carro** — parte do ecossistema **Totexmotors**.

Registre e acompanhe tudo que envolve o seu veículo: combustível, peças, revisões, seguro,
IPVA, multas, acessórios, pneus e serviços em geral. Além disso, cadastre os dados do veículo
(placa, RENAVAM, chassi, marca/modelo, ano, cor, hodômetro) e receba alertas dos vencimentos
de **licenciamento, IPVA, seguro** e da sua **CNH (carta de habilitação)**.

## Funcionalidades

- **Dashboard** com total gasto, gasto do mês, gasto com combustível e hodômetro atual.
- **Alertas de vencimento** (licenciamento, IPVA, seguro e CNH).
- **Gastos** com categoria, data e hodômetro no momento do gasto (despesas e receitas/reembolsos).
- **Meu Veículo**: cadastro completo do carro + dados do proprietário e CNH.
- **Categorias** específicas de carro (Combustível, Peças, Revisão, Pneus, Seguro, IPVA, Multas, etc.).
- **Análises e Relatórios** dos gastos.

## Stack

- Vite + React + TypeScript
- shadcn/ui + Tailwind CSS
- TanStack Query
- Supabase (Postgres + Auth)

## Configuração

1. Instale as dependências:

   ```sh
   npm i
   ```

2. Copie `.env.example` para `.env` e preencha com as credenciais do seu projeto Supabase:

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

3. Aplique o schema do banco rodando a migration em
   `supabase/migrations/20260615000000_totex_car_finance_schema.sql`
   (via Supabase CLI, SQL Editor do dashboard, ou MCP).

4. Rode o app:

   ```sh
   npm run dev
   ```

## Banco de dados

O schema reaproveita a lógica original (`users` / `accounts` / `categories` / `transactions`),
onde **`accounts` representa o veículo** e **`transactions` representa cada gasto**. As colunas
específicas de carro (placa, RENAVAM, vencimentos, hodômetro, CNH) foram adicionadas a essas tabelas.
