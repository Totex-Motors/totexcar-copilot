-- Função "Apoio de manutenção" (ex.: Léo e Jorginho, que levam os carros pras oficinas): usa o mesmo link
-- da oficina do gerente de manutenção, mas fica FORA da escada de atendimento do pós-venda.
alter table public.posvenda_equipe drop constraint if exists posvenda_equipe_papel_check;
alter table public.posvenda_equipe add constraint posvenda_equipe_papel_check
  check (papel in ('vendedor', 'gerente_manutencao', 'apoio_manutencao', 'gerente_geral'));
