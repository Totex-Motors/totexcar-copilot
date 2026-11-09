// COFRE: criptografia dos documentos do cliente (ArquivoZap/CNH) e do nº da CNH, além da do disco.
// Chave AES-256 gerada DENTRO do banco e guardada no Supabase Vault ('docs_chave'); só a service role
// lê, pela função docs_chave() (migration 20261109000000_cofre_documentos.sql). Nunca em código/env/chat.
//  - arquivo: "TXE1" + iv(12) + AES-256-GCM(bytes), salvo como <caminho>.enc
//  - texto:   "enc:v1:" + base64(iv + AES-256-GCM(texto))
//  - pra ver: link temporário assinado (HMAC) da função `doc`, que decifra na hora (o Storage só tem cifrado)
// Sem a chave no banco (SQL ainda não rodado) tudo segue como antes (texto/arquivo aberto) e o cron migra depois.

const MAGICO = new TextEncoder().encode("TXE1");
const PREFIXO = "enc:v1:";
type Chaves = { aes: CryptoKey; hmac: CryptoKey };
let cache: { em: number; v: Chaves | null } | null = null;

export async function chaves(sb: any): Promise<Chaves | null> {
  if (cache && (cache.v || Date.now() - cache.em < 60_000)) return cache.v;
  let v: Chaves | null = null;
  try {
    const { data, error } = await sb.rpc("docs_chave");
    const raw = !error && data ? Uint8Array.from(atob(String(data)), (c) => c.charCodeAt(0)) : null;
    if (raw && raw.length === 32) {
      const base = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
      const hk = (info: string) => ({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(info) });
      v = {
        aes: await crypto.subtle.deriveKey(hk("totex-docs-aes"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
        hmac: await crypto.subtle.deriveKey(hk("totex-docs-link"), base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign", "verify"]),
      };
    } else if (error) console.error("cofre: sem chave (rode o SQL do cofre):", error.message);
  } catch (e) { console.error("cofre:", e); }
  cache = { em: Date.now(), v };
  return v;
}

const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (u: Uint8Array) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64url = (s: string) => deB64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

export const estaCifrado = (bytes: Uint8Array) => bytes.length > 16 && MAGICO.every((b, i) => bytes[i] === b);

export async function cifrarBytes(sb: any, bytes: Uint8Array): Promise<Uint8Array | null> {
  const k = await chaves(sb);
  if (!k) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k.aes, bytes));
  const out = new Uint8Array(4 + 12 + ct.length);
  out.set(MAGICO, 0); out.set(iv, 4); out.set(ct, 16);
  return out;
}

export async function decifrarBytes(sb: any, bytes: Uint8Array): Promise<Uint8Array> {
  if (!estaCifrado(bytes)) return bytes;
  const k = await chaves(sb);
  if (!k) throw new Error("cofre_sem_chave");
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(4, 16) }, k.aes, bytes.subarray(16)));
}

export async function cifrarTexto(sb: any, s: string | null | undefined): Promise<string | null> {
  if (s == null || s === "" || String(s).startsWith(PREFIXO)) return s ?? null;
  const k = await chaves(sb);
  if (!k) return String(s);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k.aes, new TextEncoder().encode(String(s))));
  const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12);
  return PREFIXO + b64(out);
}

export async function decifrarTexto(sb: any, s: string | null | undefined): Promise<string | null> {
  if (!s) return null;
  if (!String(s).startsWith(PREFIXO)) return String(s);
  const k = await chaves(sb);
  if (!k) return null;
  try {
    const raw = deB64(String(s).slice(PREFIXO.length));
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.subarray(0, 12) }, k.aes, raw.subarray(12)));
  } catch { return null; }
}

// CNH dentro da ficha: o nº de registro vai cifrado; fica só o final (pra mostrar ••••1234)
export async function protegerMeta(sb: any, meta: any): Promise<any> {
  const c = meta?.cnh;
  if (!c?.numero_registro) return meta;
  const enc = await cifrarTexto(sb, c.numero_registro);
  if (!enc || !enc.startsWith(PREFIXO)) return meta;
  const { numero_registro, ...resto } = c;
  return { ...meta, cnh: { ...resto, numero_registro_enc: enc, numero_final: String(numero_registro).slice(-4) } };
}

// Sobe pro ArquivoZap já cifrado (<path>.enc). Sem chave, sobe aberto como antes. Devolve o caminho salvo.
export async function subirDoc(sb: any, path: string, bytes: Uint8Array, mime: string): Promise<{ path: string; error?: string }> {
  const enc = await cifrarBytes(sb, bytes);
  const final = enc ? `${path}.enc` : path;
  const { error } = await sb.storage.from("arquivozap").upload(final, enc || bytes, { contentType: enc ? "application/octet-stream" : mime, upsert: false });
  return error ? { path: final, error: error.message } : { path: final };
}

// Link temporário pra abrir o documento: cifrado → função `doc` (decifra na hora); aberto → URL assinada do Storage
export async function linkDoc(sb: any, path: string, mime: string | null, segundos = 600, nome = "documento"): Promise<string | null> {
  if (!path) return null;
  if (!path.endsWith(".enc")) return (await sb.storage.from("arquivozap").createSignedUrl(path, segundos)).data?.signedUrl || null;
  const k = await chaves(sb);
  if (!k) return null;
  const corpo = b64url(new TextEncoder().encode(JSON.stringify({ p: path, m: mime || "application/octet-stream", n: nome.slice(0, 60), e: Math.floor(Date.now() / 1000) + segundos })));
  const sig = b64url(new Uint8Array(await crypto.subtle.sign("HMAC", k.hmac, new TextEncoder().encode(corpo))));
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/doc?t=${corpo}.${sig}`;
}

export async function lerLink(sb: any, t: string): Promise<{ p: string; m: string; n: string } | null> {
  const [corpo, sig] = String(t || "").split(".");
  if (!corpo || !sig) return null;
  const k = await chaves(sb);
  if (!k) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", k.hmac, deB64url(sig), new TextEncoder().encode(corpo)); } catch { ok = false; }
  if (!ok) return null;
  try {
    const d = JSON.parse(new TextDecoder().decode(deB64url(corpo)));
    if (!d?.p || !(Number(d.e) > Date.now() / 1000)) return null;
    return { p: String(d.p), m: String(d.m || "application/octet-stream"), n: String(d.n || "documento") };
  } catch { return null; }
}
