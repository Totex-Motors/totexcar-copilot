// DOC: abre um documento cifrado do ArquivoZap por link temporário assinado (gerado por linkDoc em _shared/cofre.ts).
// GET /functions/v1/doc?t=<token>                 → bytes decifrados (link vale 10–60 min; o Storage só guarda cifrado)
// GET /functions/v1/doc?acao=migrar&secret=...    → cron: cifra o que ainda está aberto (fichas do ArquivoZap e
//                                                   nº da CNH no cadastro), em lotes. Deploy com --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { chaves, cifrarBytes, cifrarTexto, decifrarBytes, estaCifrado, lerLink, protegerMeta } from "../_shared/cofre.ts";
import { secretOk, unauthorized } from "../_shared/secret.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

async function migrar() {
  if (!(await chaves(admin))) return { ok: false, error: "sem_chave" };
  const rel = { arquivos: 0, fichas: 0, cadastros: 0, falhas: 0 };
  // 1) arquivos do ArquivoZap ainda abertos (a foto do painel na entrega é registro da loja: fica fora)
  const { data: docs } = await admin.from("arquivozap_docs").select("id, storage_path, meta")
    .not("storage_path", "like", "%.enc").not("storage_path", "like", "entrega/%").not("storage_path", "is", null).limit(25);
  for (const d of docs || []) {
    try {
      const { data: blob, error } = await admin.storage.from("arquivozap").download(d.storage_path);
      if (error || !blob) {
        // arquivo já não existe no Storage: tira da fila (senão trava o lote pra sempre)
        if (/not.?found|404/i.test(String(error?.message || ""))) {
          const { error: e1 } = await admin.from("arquivozap_docs").update({ storage_path: null }).eq("id", d.id);
          if (e1) await admin.from("arquivozap_docs").update({ storage_path: `${d.storage_path}.enc` }).eq("id", d.id);
        }
        rel.falhas++; continue;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const enc = estaCifrado(bytes) ? bytes : await cifrarBytes(admin, bytes);
      if (!enc) throw new Error("sem_chave");
      const novo = `${d.storage_path}.enc`;
      const up = await admin.storage.from("arquivozap").upload(novo, enc, { contentType: "application/octet-stream", upsert: true });
      if (up.error) throw new Error(up.error.message);
      const { error: eu } = await admin.from("arquivozap_docs").update({ storage_path: novo, meta: await protegerMeta(admin, d.meta) }).eq("id", d.id);
      if (eu) { await admin.storage.from("arquivozap").remove([novo]); throw new Error(eu.message); }
      await admin.storage.from("arquivozap").remove([d.storage_path]);
      rel.arquivos++;
    } catch (e) { rel.falhas++; console.error("doc migrar arquivo", d.id, String((e as any)?.message || e)); }
  }
  // 2) fichas de CNH já cifradas no arquivo mas com o nº aberto na ficha
  const { data: fichas } = await admin.from("arquivozap_docs").select("id, meta").eq("tipo", "cnh").not("meta->cnh->>numero_registro", "is", null).limit(100);
  for (const f of fichas || []) {
    const { error } = await admin.from("arquivozap_docs").update({ meta: await protegerMeta(admin, f.meta) }).eq("id", f.id);
    if (error) rel.falhas++; else rel.fichas++;
  }
  // 3) nº da CNH no cadastro
  const { data: us } = await admin.from("users").select("id, cnh_numero").not("cnh_numero", "is", null).not("cnh_numero", "like", "enc:%").limit(200);
  for (const u of us || []) {
    const enc = await cifrarTexto(admin, u.cnh_numero);
    if (!enc?.startsWith("enc:")) continue;
    const { error } = await admin.from("users").update({ cnh_numero: enc }).eq("id", u.id).eq("cnh_numero", u.cnh_numero);
    if (error) rel.falhas++; else rel.cadastros++;
  }
  const { count } = await admin.from("arquivozap_docs").select("id", { count: "exact", head: true })
    .not("storage_path", "like", "%.enc").not("storage_path", "like", "entrega/%").not("storage_path", "is", null);
  return { ok: true, ...rel, faltam_arquivos: count || 0 };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("acao") === "migrar") {
    if (!secretOk(url)) return unauthorized();
    const r = await migrar();
    console.log("doc migrar", JSON.stringify(r));
    return json(r);
  }
  const t = url.searchParams.get("t") || "";
  const tk = await lerLink(admin, t);
  if (!tk) return new Response("Link inválido ou vencido. Peça o documento de novo.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  const { data: blob, error } = await admin.storage.from("arquivozap").download(tk.p);
  if (error || !blob) return new Response("Documento não encontrado.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  try {
    const bytes = await decifrarBytes(admin, new Uint8Array(await blob.arrayBuffer()));
    const ext = (tk.m.split("/")[1] || "bin").split(";")[0].replace("jpeg", "jpg");
    const nome = `${tk.n.replace(/[^\w.-]+/g, "_") || "documento"}.${ext}`;
    return new Response(bytes, { headers: {
      "content-type": tk.m, "content-length": String(bytes.length), "content-disposition": `inline; filename="${nome}"`,
      "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
    } });
  } catch (e) {
    console.error("doc decifrar", String((e as any)?.message || e));
    return new Response("Não consegui abrir o documento.", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
});
