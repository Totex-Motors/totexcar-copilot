-- PLANO DE TROCA DE ÓLEO INFORMADO PELO CLIENTE (manual/concessionária) + pausa de avisos.
-- plano_fonte = 'cliente' → o intervalo que ele informou vale como está (sem o corte de uso severo);
-- pausado_ate → o cliente pediu pra não ser avisado até esta data.
alter table public.maintenance_reminders add column if not exists plano_fonte text;
alter table public.maintenance_reminders add column if not exists pausado_ate date;
