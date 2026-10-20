-- CPF do cliente no cadastro da venda (obrigatório no painel e no link do vendedor)
alter table public.postsale_journeys add column if not exists customer_cpf text;
