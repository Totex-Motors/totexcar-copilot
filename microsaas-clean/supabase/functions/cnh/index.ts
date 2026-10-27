// TotexCar — CNH importada pelo app (aba CNH).
// POST { acao: "ler", arquivo: "data:application/pdf;base64,..." | "data:image/jpeg;base64,..." }
//   → a IA lê a CNH (PDF da CNH digital ou foto), guarda o original no ArquivoZap e preenche o cadastro.
// POST { acao: "minha" }  → a CNH importada mais recente + link temporário do arquivo
// POST { acao: "apagar" } → apaga os arquivos e as fichas da CNH (LGPD); o vencimento fica pros avisos.
// Auth: access token do usuário (deploy com --no-verify-jwt, como as outras).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { lerCnhMidia, fichaCnh, aplicarCnhNoCadastro, type CnhLida } from "../_shared/cnh.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, apikey, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });

const TIPOS: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 8 * 1024 * 1024;
const onlyDigits = (s: string) => String(s || "").replace(/\D/g, "");

async function aiCfg() {
  const { data } = await admin.from("app_settings")
    .select("ai_provider, ai_model, openai_api_key, anthropic_api_key, gemini_api_key").eq("id", 1).single();
  const provider = data?.ai_provider || "anthropic";
  const key = provider === "openai" ? (data?.openai_api_key || "")
    : provider === "gemini" ? (data?.gemini_api_key || "")
    : (data?.anthropic_api_key || Deno.env.get("ANTHROPIC_API_KEY") || "");
  const defaults: Record<string, string> = { anthropic: "claude-opus-4-8", openai: "gpt-4o", gemini: "gemini-2.5-flash" };
  return { provider, model: data?.ai_model || defaults[provider], key };
}

// fichas de CNH do usuário (do app pelo user_id; do WhatsApp também pelo telefone)
async function fichasCnh(uid: string, phone: string) {
  let q = admin.from("arquivozap_docs").select("id, storage_path, meta, created_at").eq("tipo", "cnh").order("created_at", { ascending: false });
  q = phone ? q.or(`user_id.eq.${uid},phone.eq.${phone}`) : q.eq("user_id", uid);
  const { data } = await q;
  return data || [];
}

async function resposta(doc: any) {
  const c: CnhLida | undefined = doc?.meta?.cnh;
  if (!c) return { ok: true, cnh: null };
  const { data: s } = await admin.storage.from("arquivozap").createSignedUrl(doc.storage_path, 600);
  return {
    ok: true,
    cnh: {
      nome: c.nome, categoria: c.categoria,
      registro: c.numero_registro ? `••••••${c.numero_registro.slice(-4)}` : null,
      validade: c.validade, primeira_habilitacao: c.primeira_habilitacao, emissao: c.emissao,
      observacoes: c.observacoes, digital: !!c.digital,
      importada_em: doc.created_at, url: s?.signedUrl || null,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const authz = req.headers.get("Authorization") || "";
  const { data: au } = await admin.auth.getUser(authz.replace(/^Bearer\s+/i, ""));
  const uid = au?.user?.id;
  if (!uid) return json({ ok: false, error: "nao_autenticado" }, 401);
  const { data: u } = await admin.from("users").select("id, phone").eq("id", uid).maybeSingle();
  const phone = onlyDigits(u?.phone || "");

  const body = await req.json().catch(() => ({}));
  const acao = String(body?.acao || "");

  try {
    if (acao === "minha") {
      const docs = await fichasCnh(uid, phone);
      return json(await resposta(docs.find((d: any) => d.meta?.cnh)));
    }

    if (acao === "apagar") {
      const docs = await fichasCnh(uid, phone);
      const paths = docs.map((d: any) => d.storage_path).filter(Boolean);
      if (paths.length) await admin.storage.from("arquivozap").remove(paths);
      if (docs.length) await admin.from("arquivozap_docs").delete().in("id", docs.map((d: any) => d.id));
      await admin.from("users").update({ cnh_numero: null }).eq("id", uid);
      return json({ ok: true, apagados: docs.length });
    }

    if (acao === "ler") {
      const m = String(body?.arquivo || "").match(/^data:([\w/+.-]+);base64,(.+)$/s);
      if (!m) return json({ ok: false, error: "arquivo_invalido" }, 400);
      const mime = m[1].toLowerCase(), b64 = m[2].replace(/\s/g, "");
      const ext = TIPOS[mime];
      if (!ext) return json({ ok: false, error: "formato_nao_aceito" }, 400);
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      if (bytes.length > MAX_BYTES) return json({ ok: false, error: "arquivo_grande" }, 400);

      const cnh = await lerCnhMidia(await aiCfg(), { data: b64, mime });
      if (!cnh) return json({ ok: false, error: "nao_consegui_ler" });
      if (!cnh.e_cnh) return json({ ok: false, error: "nao_parece_cnh" });
      if (!cnh.validade && !cnh.categoria) return json({ ok: false, error: "nao_consegui_ler" });

      // guarda o original (pasta privada) e troca a CNH anterior, se tinha
      const antigas = await fichasCnh(uid, phone);
      const path = `${phone || uid}/cnh-${crypto.randomUUID()}.${ext}`;
      const up = await admin.storage.from("arquivozap").upload(path, bytes, { contentType: mime, upsert: false });
      if (up.error) { console.error("cnh upload:", up.error.message); return json({ ok: false, error: "falha_ao_guardar" }, 500); }
      const { data: doc, error } = await admin.from("arquivozap_docs").insert({
        user_id: uid, phone, ...fichaCnh(cnh),
        meta: { cnh, origem: "app" }, storage_path: path, mime, size: bytes.length,
      }).select("id, storage_path, meta, created_at").single();
      if (error) { await admin.storage.from("arquivozap").remove([path]); return json({ ok: false, error: error.message }, 500); }
      if (antigas.length) {
        await admin.storage.from("arquivozap").remove(antigas.map((d: any) => d.storage_path).filter(Boolean));
        await admin.from("arquivozap_docs").delete().in("id", antigas.map((d: any) => d.id));
      }
      await aplicarCnhNoCadastro(admin, uid, cnh);
      return json(await resposta(doc));
    }

    return json({ ok: false, error: "acao_invalida" }, 400);
  } catch (e) {
    console.error("cnh:", e);
    return json({ ok: false, error: String((e as any)?.message || e) }, 500);
  }
});
