-- OS concluída PELA LOJA: a oficina fez o serviço mas não registrou no link dela. O gerente registra o serviço
-- (mesmos campos obrigatórios) e a volta do carro de uma vez. concluida_por = quem registrou pela loja
-- (null = a própria oficina); concluida_motivo = por que a oficina não registrou.
alter table public.ordens_servico add column if not exists concluida_por text;
alter table public.ordens_servico add column if not exists concluida_motivo text;
