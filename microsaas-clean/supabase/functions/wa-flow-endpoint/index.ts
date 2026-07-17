// TotexCar Co-pilot — ENDPOINT de WhatsApp Flows (data exchange criptografado)
// Fundação para flows DINÂMICOS: o Meta manda cada navegação de tela criptografada
// (RSA-OAEP SHA-256 na chave AES + AES-128-GCM no payload), a gente processa e devolve
// a próxima tela com dados AO VIVO. Resposta cifrada com a MESMA chave e IV com bits invertidos.
//
// Flow atendido (v1): RECOMPRA FIPE AO VIVO
//   MARCA → MODELO → ANO → RESULTADO (avaliação na hora: valor FIPE × % de recompra)
//   O "complete" da última tela chega no whatsapp-webhook (nfm_reply) e vira lead em buyback_requests.
//
// Chave privada: secret WA_FLOW_PRIVATE_KEY_B64 (PEM PKCS8 em base64).
// Pública correspondente: subida no número via /whatsapp_business_encryption.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRIVATE_KEY_B64 = Deno.env.get("WA_FLOW_PRIVATE_KEY_B64") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const FIPE = "https://parallelum.com.br/fipe/api/v1/carros";
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const parseBRL = (s: any) => Number(String(s || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;

// ---------------- criptografia (protocolo oficial dos Flows) ----------------
const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
function bytesToB64(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

let _privKey: CryptoKey | null = null;
async function privateKey(): Promise<CryptoKey> {
  if (_privKey) return _privKey;
  const pem = atob(PRIVATE_KEY_B64);
  const der = b64ToBytes(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  _privKey = await crypto.subtle.importKey("pkcs8", der, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  return _privKey;
}

async function decryptRequest(body: any): Promise<{ req: any; aesKey: CryptoKey; iv: Uint8Array } | null> {
  const encKey = b64ToBytes(body.encrypted_aes_key);
  const iv = b64ToBytes(body.initial_vector);
  const data = b64ToBytes(body.encrypted_flow_data);
  let rawAes: ArrayBuffer;
  try {
    rawAes = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, await privateKey(), encKey);
  } catch {
    return null; // chave não bate → 421 (Meta renova a pública)
  }
  const aesKey = await crypto.subtle.importKey("raw", rawAes, "AES-GCM", false, ["decrypt", "encrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, aesKey, data);
  return { req: JSON.parse(new TextDecoder().decode(plain)), aesKey, iv };
}

async function encryptResponse(resp: unknown, aesKey: CryptoKey, iv: Uint8Array): Promise<string> {
  const flipped = iv.map((b) => b ^ 0xff); // IV da resposta = bits invertidos do IV da requisição
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: flipped, tagLength: 128 }, aesKey, new TextEncoder().encode(JSON.stringify(resp)),
  );
  return bytesToB64(ct);
}

// ---------------- FIPE (mesma fonte da edge buyback) ----------------
async function fipeGet(path: string) {
  const res = await fetch(`${FIPE}${path}`);
  if (!res.ok) throw new Error(`FIPE ${res.status}`);
  return res.json();
}
// Dropdown do Flow aceita até 200 itens — filtro opcional digitado pelo usuário resolve marcas grandes
const cap200 = (arr: any[], filtro?: string) => {
  let list = arr;
  const f = String(filtro || "").trim().toLowerCase();
  if (f) list = arr.filter((x: any) => String(x.nome).toLowerCase().includes(f));
  return list.slice(0, 200).map((x: any) => ({ id: String(x.codigo), title: String(x.nome).slice(0, 30) }));
};

// ---------------- telas do flow RECOMPRA ----------------
async function handleRecompra(req: any): Promise<any> {
  const d = req.data || {};

  if (req.action === "INIT") {
    const marcas = await fipeGet("/marcas");
    return { screen: "MARCA", data: { marcas: cap200(marcas) } };
  }

  if (req.action === "data_exchange") {
    if (req.screen === "MARCA") {
      const res = await fipeGet(`/marcas/${encodeURIComponent(d.marca)}/modelos`);
      const marcas = await fipeGet("/marcas");
      const marcaNome = (marcas.find((m: any) => String(m.codigo) === String(d.marca)) || {}).nome || "";
      return { screen: "MODELO", data: { modelos: cap200(res?.modelos || [], d.filtro), marca: String(d.marca), marca_nome: String(marcaNome) } };
    }
    if (req.screen === "MODELO") {
      const anos = await fipeGet(`/marcas/${encodeURIComponent(d.marca)}/modelos/${encodeURIComponent(d.modelo)}/anos`);
      return { screen: "ANO", data: { anos: cap200(anos), marca: String(d.marca), marca_nome: String(d.marca_nome || ""), modelo: String(d.modelo) } };
    }
    if (req.screen === "ANO") {
      const p = await fipeGet(`/marcas/${encodeURIComponent(d.marca)}/modelos/${encodeURIComponent(d.modelo)}/anos/${encodeURIComponent(d.ano)}`);
      const fipeValue = parseBRL(p?.Valor);
      const { data: s } = await admin.from("app_settings").select("buyback_fipe_pct").eq("id", 1).single();
      const pct = Number(s?.buyback_fipe_pct ?? 90);
      const offer = Math.round(fipeValue * pct) / 100;
      const titulo = `${p?.Marca || ""} ${p?.Modelo || ""} ${p?.AnoModelo || ""}`.trim();
      return {
        screen: "RESULTADO",
        data: {
          titulo,
          oferta: brl(offer),
          corpo: `Tabela FIPE: ${brl(fipeValue)} (código ${p?.CodigoFipe || "-"}). Oferta de recompra de até ${pct}% da FIPE, sujeita a vistoria e estado de conservação.`,
          marca_nome: String(p?.Marca || d.marca_nome || ""),
          modelo_nome: String(p?.Modelo || ""),
          ano_nome: String(p?.AnoModelo || ""),
          combustivel: String(p?.Combustivel || ""),
          fipe_code: String(p?.CodigoFipe || ""),
          fipe_value: String(fipeValue),
          offer_value: String(offer),
          pct: String(pct),
        },
      };
    }
  }

  // BACK ou tela desconhecida → volta pro início
  const marcas = await fipeGet("/marcas");
  return { screen: "MARCA", data: { marcas: cap200(marcas) } };
}

// ---------------- servidor ----------------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  let body: any = {};
  try { body = await req.json(); } catch { return new Response("bad request", { status: 400 }); }

  const dec = await decryptRequest(body).catch(() => null);
  if (!dec) return new Response("", { status: 421 }); // pede refresh da chave pública

  const { req: flowReq, aesKey, iv } = dec;
  let resp: any;
  try {
    if (flowReq.action === "ping") {
      resp = { data: { status: "active" } };
    } else {
      resp = await handleRecompra(flowReq);
    }
  } catch (e) {
    console.error("wa-flow-endpoint erro:", e);
    // devolve a tela inicial com lista vazia em vez de quebrar o formulário
    resp = { screen: "MARCA", data: { marcas: [] } };
  }

  const encrypted = await encryptResponse(resp, aesKey, iv);
  return new Response(encrypted, { status: 200, headers: { "Content-Type": "text/plain" } });
});
