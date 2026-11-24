-- LAUDO DO SCANNER (Doutor-IE) — a loja passa o scanner no carro na ENTRADA (compra/estoque) e o relatório em
-- PDF fica ligado ao carro pela placa: códigos de falha, teste de bateria, km. Com falha, o laudo vai junto na
-- ordem de serviço da oficina parceira; depois do reparo entra o scanner de CONFERÊNCIA (antes x depois).
-- Na entrega, o checklist do cliente mostra o laudo mais recente do carro.
create table if not exists public.scanner_laudos (
  id uuid primary key default gen_random_uuid(),
  dealership text not null,
  placa text,                               -- lida do relatório (ou informada)
  vehicle_id text,                          -- anúncio do estoque, quando escolhido
  car_desc text,
  momento text not null default 'entrada' check (momento in ('entrada', 'conferencia', 'avulso')),
  os_id uuid references public.ordens_servico(id) on delete set null,
  titulo text,                              -- "Checklist de entrada"
  gerado_em timestamptz,                    -- data/hora que o scanner gerou o relatório
  km int,
  n_falhas int,                             -- null = não deu pra ler a lista (ver o PDF)
  falhas jsonb not null default '[]'::jsonb, -- [{codigo, descricao}]
  bateria jsonb,                            -- {status, inicial, minima, maxima, queda, temperatura}
  compressao text,
  arquivo text not null,                    -- caminho no Storage (bucket privado arquivozap)
  reconhecido boolean not null default true, -- false = PDF guardado, mas não parece relatório do scanner
  enviado_por text,
  created_at timestamptz not null default now()
);
create index if not exists scanner_laudos_placa_idx on public.scanner_laudos (dealership, placa, created_at desc);
create index if not exists scanner_laudos_loja_idx on public.scanner_laudos (dealership, created_at desc);
alter table public.scanner_laudos enable row level security;

alter table public.ordens_servico add column if not exists scanner_entrada_id uuid references public.scanner_laudos(id) on delete set null;
alter table public.ordens_servico add column if not exists scanner_saida_id uuid references public.scanner_laudos(id) on delete set null;
alter table public.entrega_checklists add column if not exists scanner_laudo_id uuid references public.scanner_laudos(id) on delete set null;
