# VISÃO — Modo Viagem (TotexCar Co-pilot)

> Origem: ideia do dono (2026-07-17) + spec `C:\Users\marco\TotexCar_Viajem\modulo-inteligencia-mercado-totexcar.md`.
> Decisões tomadas na conversa: SEM agência parceira (não existe; automatizar), SEM AISa (usamos nossa
> camada de IA própria), prioridade INVERTIDA — benefício ao MOTORISTA primeiro, inteligência de mercado depois.

## Tese

O usuário do Co-pilot é a persona exata da road trip (tem carro, cuida dele, está no WhatsApp).
**Diferencial que nenhum player de viagem tem: nós conhecemos O CARRO da pessoa** — consumo real,
custo por km, manutenções pendentes. O plano de viagem sai personalizado de verdade:
"sua viagem SP→Ubatuba custa ~R$ 180 de combustível no SEU Nivus; troque o óleo antes (faltam 800 km)".

48% dos brasileiros pretendem fazer road trip em 2026 (fonte: pesquisa do projeto TotexCar_Viajem).

## FASE 1 — Modo Viagem no agente (✅ FEITA, 2026-07-17)

- **Tool `planejar_viagem`** no `whatsapp-webhook`: devolve à IA os dados REAIS —
  consumo (real tanque-a-tanque > oficial INMETRO), custo de combustível por km real,
  preço médio do litro que o dono paga (últimos 5 abastecimentos com litros),
  manutenções vencendo em ≤1.500 km ("resolva antes de pegar estrada" → lead de revisão pra loja),
  checklist pré-viagem padrão, destinos em alta 2026 (seed do relatório de mercado).
- **Prompt "MODO VIAGEM"**: IA monta roteiro + contas mostrando o cálculo (ida e volta),
  pedágio como estimativa honesta, recomenda revisão na loja do cliente quando pendente,
  sugere 2-3 destinos por perfil quando não há destino. NUNCA inventa preço de hospedagem.
- Gatilhos: "viagem", "road trip", "feriado", "férias", "quanto gasto pra ir até X".

## FASE 2 — Monetização automatizada (sem agência)

- **Afiliados de hospedagem**: Booking.com Affiliate Partner (comissão por reserva via link).
  Pendência do dono: criar a conta de afiliado → salvar `booking_affiliate_id` no /admin →
  agente passa a linkar hospedagem no destino com o aid. Zero operação, zero CADASTUR
  (indicação, não venda de pacote).
- **Campanhas sazonais**: 30–45 dias antes de cada feriado prolongado (calendário 2026 no
  relatório de origem), via motor de campanhas existente do /lojista (template `campanha_loja`) —
  a loja dispara "planeje sua viagem de [feriado] com o Co-pilot" pros clientes dela.

## FASE 3 — Inteligência de mercado (a spec original, adaptada)

- Relatórios de tendências/destinos/campanhas gerados por IA + busca web DENTRO do /admin
  (nossa camada de IA do app_settings; sem AISa), com revisão humana antes de qualquer disparo.
- Vira também material pro lojista (sugestão de campanha pronta por feriado).

## O que foi descartado (e por quê)

- **AISa como intermediário**: já temos chaves diretas (OpenAI/Anthropic/Gemini) + busca web;
  intermediário = custo e ponto de falha a mais.
- **Comparação de preços de diária ao vivo**: não existe API pública de OTA acessível; prometer
  isso sem fonte é insustentável. Substituído por afiliado (Fase 2) e regiões recomendadas.
- **Módulo interno "para a agência"**: não há agência; o valor pro ecossistema está no canal
  (agente + lojas + dados do carro), não na ferramenta de relatório.
