# Contrato OS ↔ TCF — Fase 3 (Indique e Ganhe)

> Documento para o **Claude do projeto OS (Totexmotors OS)**. O lado **TCF** já está pronto e no ar.
> O TCF expõe a Edge Function `integration` (autenticada por `x-api-key`). O OS chama via o proxy
> `tcf-proxy` (a mesma chave que já usa). Última atualização: 2026-06-20.

## Endpoint
- URL: `https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/integration`
- Header: `x-api-key: <TCF_INTEGRATION_KEY>` (a mesma já configurada no OS) + `Content-Type: application/json`
- Método: `POST`. Sucesso `{ ok: true, ... }`; erro `{ error }` com status 4xx.

## Visão geral do fluxo
1. O **TCF** mostra ao dono do carro um feed de estoque e gera um **link `wa.me` da loja** com o
   **código de indicação** do dono embutido na mensagem. Exemplo do que o amigo envia à loja:
   > "Oi! Vim pela indicação de Marcos (código **A1B2C3D4**) e tenho interesse no Honda Civic EXL 2020."
2. O **OS** precisa: (a) manter o estoque sincronizado no TCF, (b) capturar o **código** na conversa
   de WhatsApp da loja, (c) quando a **venda fechar**, reportar a venda + comissão ao TCF, e (d) após
   pagar o PIX, marcar como pago.

> ⚠️ A recompensa é **dinheiro via PIX**, paga **só na venda confirmada**. O **OS** define o valor da
> comissão e faz o pagamento; o **TCF** apenas exibe o valor que o OS reportar.

---

## 1) `sync_inventory` — OS empurra o estoque para o TCF
Chame periodicamente (ex.: a cada X min, ou quando o estoque mudar). Faz **upsert por `external_id`**.

**Request**
```json
{
  "action": "sync_inventory",
  "cars": [
    {
      "external_id": "OS-1001",            // ID do carro no OS (obrigatório, chave do upsert)
      "dealership": "Julio Multimarcas",   // nome da loja (deve bater com o usado nos cupons/clientes)
      "store_whatsapp": "5531999990000",   // WhatsApp da loja (com DDI/DDD) — usado no link de indicação
      "brand": "Honda",
      "model": "Civic EXL",
      "year": 2020,
      "price": 109900,
      "km": 45000,
      "color": "Preto",
      "photo_url": "https://.../foto.jpg",
      "title": "Honda Civic EXL 2020",     // opcional; se ausente, é montado de brand+model+year
      "url": "https://.../carro/OS-1001",  // opcional
      "active": true                        // false p/ tirar do feed (ou simplesmente não enviar)
    }
  ]
}
```
**Response**: `{ "ok": true, "upserted": 1 }`

Notas:
- O TCF só mostra no feed os carros com `active: true`.
- Para **remover** um carro do feed, reenvie com `active: false` (ele some do feed).
- `store_whatsapp` é essencial: é o número para onde o link de indicação aponta.

---

## 2) `report_referral` — OS reporta a venda (e depois marca como paga)

### 2a) Registrar a venda confirmada
Quando a loja fecha a venda atribuída a um código de indicação:

**Request**
```json
{
  "action": "report_referral",
  "owner_code": "A1B2C3D4",                // código do dono (capturado na conversa de WhatsApp)
  "type": "sale",                          // "sale" (padrão) | "lead" | "click"
  "value": 150,                            // comissão em R$ que o OS vai pagar (defina no OS)
  "car_external_id": "OS-1001",            // opcional
  "car_title": "Honda Civic EXL 2020"      // opcional
}
```
**Response**
```json
{
  "ok": true,
  "event": { "id": "uuid-do-evento", "status": "pending", "value": 150, ... },
  "owner": { "id": "...", "name": "Marcos", "referral_code": "A1B2C3D4", "pix_key": "marcos@email.com" }
}
```
> Use `owner.pix_key` para **pagar a comissão** ao dono. Guarde o `event.id` para marcar como pago.
> Se o dono ainda não cadastrou a chave PIX, `pix_key` vem `null` (cobre o dono para cadastrar).
> Alternativa: pode enviar `owner_id` em vez de `owner_code`, se o OS já tiver o ID do dono.

### 2b) Marcar como pago (após cair o PIX)
**Request**
```json
{ "action": "report_referral", "event_id": "uuid-do-evento", "status": "paid" }
```
**Response**: `{ "ok": true, "event": { "status": "paid", "paid_at": "..." } }`

No app do dono, o ganho passa de **"a receber"** para **"recebido"**.

---

## 3) Como o OS descobre a chave PIX / dados de um dono (opcional)
`get_owner` agora também devolve `referral_code` e `pix_key`:
```json
{ "action": "get_owner", "email": "dono@email.com" }   // ou { "phone": "5531..." }
```
→ `{ ok: true, owner: { id, name, email, phone, ..., referral_code, pix_key } }`

---

## Resumo do que o OS precisa implementar
1. **Sincronizar o estoque** chamando `sync_inventory` (inclua sempre `external_id`, `dealership` e `store_whatsapp`).
2. **Capturar o código** de indicação que chega na conversa de WhatsApp da loja (padrão: `código XXXXXXXX`).
3. Ao **fechar a venda**, chamar `report_referral` (`type:"sale"`, `value`, `owner_code`) e **pagar o PIX** (`owner.pix_key`).
4. Após pagar, chamar `report_referral` com `event_id` + `status:"paid"`.

O lado do dono (feed, geração do link, painel de ganhos, cadastro do PIX) já está **pronto e no ar** no TCF (`/indique`).
