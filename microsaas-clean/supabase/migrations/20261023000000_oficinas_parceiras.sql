-- OFICINAS PARCEIRAS + ORDENS DE SERVIÇO — o gerente de manutenção manda um carro do estoque pra uma
-- oficina parceira (troca de óleo, revisão); a oficina recebe pelo LINK dela (sem login), confirma a
-- chegada (km + foto do painel) e registra o serviço com os campos obrigatórios (especificação do óleo,
-- filtros, km, foto do painel e da etiqueta). Extraordinário (algo além do pedido) só com aprovação do
-- gerente. A troca de óleo concluída vira a PREPARAÇÃO do carro (ponto zero do Co-pilot na venda).

create table if not exists public.oficinas_parceiras (
  id uuid primary key default gen_random_uuid(),
  dealership text not null,
  nome text not null,                      -- nome fantasia
  razao_social text,
  cnpj text,
  endereco text,
  cidade text,
  telefone text,
  responsavel text,
  whatsapp text,                           -- celular do responsável (avisos do Co-pilot)
  link_token text unique,                  -- link da oficina: /parceiro/<token>
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists oficinas_parceiras_loja_idx on public.oficinas_parceiras (dealership);
alter table public.oficinas_parceiras enable row level security;

create table if not exists public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  dealership text not null,
  oficina_id uuid not null references public.oficinas_parceiras(id),
  vehicle_id text,                         -- id do anúncio no estoque (marketplace)
  car_desc text,
  placa text,
  servicos text[] not null default '{troca_oleo}',   -- troca_oleo, revisao, outro
  pedido_obs text,
  status text not null default 'enviada'
    check (status in ('enviada', 'recebida', 'concluida', 'devolvida', 'cancelada')),
  -- 1) envio (gerente)
  enviada_em timestamptz not null default now(),
  enviada_por text,
  km_saida int,
  foto_saida text,
  -- 2) chegada (oficina)
  recebida_em timestamptz,
  km_chegada int,
  foto_chegada text,
  -- 3) serviço (oficina)
  concluida_em timestamptz,
  km_servico int,
  oleo_viscosidade text,                   -- 5W30
  oleo_norma text,                         -- API SP / ACEA C3 / norma da montadora
  oleo_marca text,
  oleo_litros numeric(4,1),
  filtro_oleo boolean,
  filtro_ar boolean,
  filtro_combustivel boolean,
  filtro_cabine boolean,
  foto_painel text,
  foto_etiqueta text,
  servico_obs text,
  valor numeric(10,2),                     -- opcional
  foto_nota text,                          -- opcional
  preparacao_id uuid references public.preparacao_veiculos(id) on delete set null,
  -- extraordinário (algo além do pedido): só com aprovação do gerente
  extra_descricao text,
  extra_valor numeric(10,2),
  extra_foto text,
  extra_status text check (extra_status in ('pendente', 'aprovado', 'recusado')),
  extra_pedido_em timestamptz,
  extra_decidido_em timestamptz,
  extra_decidido_por text,
  -- 4) volta (gerente)
  devolvida_em timestamptz,
  km_volta int,
  devolvida_por text,
  cancelada_em timestamptz,
  alerta_atraso_em timestamptz,            -- aviso de carro parado na oficina (prazo: 1 dia)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ordens_servico_loja_idx on public.ordens_servico (dealership, status, enviada_em desc);
create index if not exists ordens_servico_oficina_idx on public.ordens_servico (oficina_id, status);
alter table public.ordens_servico enable row level security;

-- As 3 oficinas parceiras da Cardoso (cadastro do Autoconf). O link de cada uma é gerado no painel.
do $$
declare loja text := coalesce((select dealership from public.posvenda_equipe where papel = 'gerente_manutencao' order by created_at limit 1), 'Cardoso Veículos');
begin
  if not exists (select 1 from public.oficinas_parceiras where cnpj = '22.132.968/0001-99') then
    insert into public.oficinas_parceiras (dealership, nome, razao_social, cnpj, endereco, cidade, telefone, responsavel, whatsapp)
    values (loja, 'Pires Transmissão', 'PIRES AUTO PECAS LTDA', '22.132.968/0001-99', 'R. Antonio Faustino dos Santos, 393 - Vila Municipal', 'Carapicuíba', '(11) 4303-1643', 'Jackson', '5511979563948');
  end if;
  if not exists (select 1 from public.oficinas_parceiras where cnpj = '07.613.824/0001-86') then
    insert into public.oficinas_parceiras (dealership, nome, razao_social, cnpj, endereco, cidade, telefone, responsavel, whatsapp)
    values (loja, 'LTL Auto Center', 'FLAVIO AMORIM ROCHA BATERIA ME', '07.613.824/0001-86', 'Av. dos Autonomistas, 6757 - km 18', 'Osasco', '(11) 94775-7106', 'Flávio', '5511947757106');
  end if;
  if not exists (select 1 from public.oficinas_parceiras where cnpj = '04.533.799/0001-32') then
    insert into public.oficinas_parceiras (dealership, nome, razao_social, cnpj, endereco, cidade, telefone, responsavel, whatsapp)
    values (loja, 'New Car', 'Nilton Cesar Sabioni Centro Automotivo', '04.533.799/0001-32', 'R. Deputado Emílio Carlos, 1900 - Vila Caldas', 'Carapicuíba', '(11) 94034-2499', 'Nilton', '5511940342499');
  end if;
end $$;
