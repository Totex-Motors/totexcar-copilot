# Visão — Carro Conectado (TotexCar Link)

> App nativo que roda NA TELA do carro (BYD DiLink / GWM / EVs chineses com Android), lê a telemetria do
> veículo e envia pro TotexCar Co-pilot. Sem hardware, sem fios. Inspirado no "Electro"; referência
> open-source: **BYDMate** (github.com/AndyShaman/BYDMate) e **OverDrive**.
> Versão 1 — 2026-07-02. v1 = SÓ LEITURA (telemetria + GPS). Marcas alvo: BYD/GWM (Android aberto).

---

## 1. Arquitetura em 2 metades

1. **Nuvem + App (PRONTO, no ar):** recebe e mostra. Fonte-agnóstico — qualquer app com o token alimenta.
   - DB: `car_links` (pareamento + último estado), `car_telemetry` (histórico), `car_events`.
   - Edge **`car-ingest`** (sem JWT, auth por token) — o carro envia aqui.
   - Edge **`car-link`** (JWT) — o app gera código+token (QR) / consulta estado / desconecta.
   - App: página **`/conectado`** — pareamento por QR e painel ao vivo (bateria, velocidade, potência,
     hodômetro, mapa, eventos). Sincroniza hodômetro (só-sobe).
2. **APK no carro (A CONSTRUIR juntos):** "TotexCar Link" — lê a telemetria e faz POST pro `car-ingest`.

---

## 2. CONTRATO DE INTEGRAÇÃO (o que o APK envia)

`POST https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/car-ingest`
`Content-Type: application/json`

**Ao conectar (1x):**
```json
{ "token": "<token do pareamento>", "type": "hello", "device_label": "BYD Seal" }
```
**Telemetria (a cada ~5–15s, ou quando mudar):**
```json
{ "token": "...", "type": "telemetry",
  "lat": -25.43, "lng": -49.27, "speed": 42, "battery_pct": 58.2,
  "odometer": 14864, "power_kw": 12, "moving": true,
  "ignition": true, "soh": 100, "range_km": 310, "raw": { } }
```
**Evento (porta, ignição, viagem, carga…):**
```json
{ "token": "...", "type": "event", "event_type": "door",
  "label": "Porta dianteira esquerda aberta", "raw": { } }
```
Todos os campos de telemetria são opcionais — envie o que conseguir ler. Resposta `{ ok: true }`.
Token inválido → 401. O token sai no QR Code como `{"url":"...car-ingest","token":"..."}`.

---

## 3. Plano do APK — por fases (realista p/ quem não é dev)

> Fazemos por etapas pequenas e testáveis. Você tem um BYD/GWM pra testar (essencial).

- **Fase A — Ferramentas (1x):** instalar Android Studio; criar um "Hello World"; aprender a gerar o `.apk`;
  habilitar ADB e **sideload** no carro (a comunidade XDA documenta; a BYD mostra aviso de "app de terceiros"
  que se contorna). Meta: um app qualquer meu abrindo na tela do carro.
- **Fase B — Provar o cano (SEM dados reais):** APK mínimo que, com o token colado, faz POST de uma telemetria
  FALSA (lat/lng/bateria fixos) pro `car-ingest` a cada 10s. Meta: ver os números aparecendo em `/conectado`.
  **Isso valida 100% da plataforma antes de mexer com o carro.** Eu escrevo esse APK inteiro.
- **Fase C — Ler dados REAIS (o coração):** descobrir como o DiLink expõe bateria/velocidade/GPS. Caminhos
  conhecidos (BYDMate): `BroadcastReceiver` de sinais do sistema, `ContentProvider`/`energydata` do BMS,
  APIs do SDK BYD. É **específico da marca/firmware e iterativo** — você lê na tela o que aparece, me manda,
  ajustamos. Começar por bateria + GPS (mais fáceis), depois velocidade/hodômetro.
- **Fase D — Produto:** serviço em segundo plano (foreground service) que roda sozinho; tela de pareamento
  lendo o QR; eventos (porta/ignição/viagem); auto-start ao ligar o carro.

**Distribuição:** APK hospedado (ex.: `totexcarco-pilot.vercel.app/car-apk`) + guia de instalação
(igual o Electro faz: "Baixar APK para o Carro" + FAQ "como instalar").

---

## 4. Riscos e limites (honestos)
- **Só marcas com Android aberto** (BYD/GWM/Chery/Zeekr). Tradicionais (Toyota/VW/Fiat/GM) = sistema fechado,
  NÃO se aplica → pra esses, o caminho é OBD/rastreador.
- **Sideload tem fricção** (ADB/gerenciador de pacotes) — não é 1-clique da Play Store; precisa de guia.
- **Atualização de firmware pode quebrar** a leitura → manutenção contínua.
- **Fase C é incerta por firmware** — pode ser rápido (se igual ao BYDMate) ou dar trabalho.
- v1 é **SÓ LEITURA** — controlar funções (assento/clima como o Electro) fica pra depois (risco garantia/jurídico).
- Bateria do carro: enviar com o carro desligado drena a 12V — o serviço deve pausar/reduzir quando ignição off.

## 5. Por que vale muito
- **Zero hardware** → resolve o medo de queimar módulo e o custo de chip do SmartGPS.
- Diferencial enorme + alinhado ao boom de EV chinês no Brasil (a loja vende esses carros).
- Vira **plataforma**: BYD hoje, GWM/Chery depois, e o mesmo painel serve qualquer fonte.

## 6. Próximo passo imediato
1. Rodar a migração `car_links/car_telemetry/car_events` no SQL Editor (SQL está na conversa).
2. Testar `/conectado` → "Gerar pareamento" (mostra QR + código).
3. **Fase B:** eu escrevo o APK-teste que manda telemetria falsa; você instala no carro e vemos aparecer.
