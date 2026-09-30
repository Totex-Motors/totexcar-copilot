// TotexCar — serve o arquivo de uma consulta GPT (ex.: CRLV-e em PDF) por HTTPS, com o
// Content-Type certo e "inline", pra ABRIR no leitor nativo do aparelho. No celular/webview
// um blob: não abre (só baixa) — uma URL https de verdade abre em qualquer lugar.
//
// GET /functions/v1/doc-open?id=<consultaId>&t=<accessToken>
//   • id  = gpt_consultas.id
//   • t   = access token do usuário (ou header Authorization: Bearer <token>)
// Confere que a consulta é DO usuário do token. Deploy com verify_jwt=false (auth manual pelo token).

const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const txt = (s: string, code = 200) =>
  new Response(s, { status: code, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") || "").trim();
  const token = (url.searchParams.get("t") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "").trim();
  if (!id || !token) return txt("faltando id/token", 400);

  // valida o usuário pelo access token
  const ures = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, authorization: `Bearer ${token}` } });
  if (!ures.ok) return txt("nao autorizado", 401);
  const user = await ures.json().catch(() => null);
  const uid = user?.id as string | undefined;
  if (!uid) return txt("nao autorizado", 401);

  // busca a consulta (service role) e confere o dono
  const cres = await fetch(`${SB}/rest/v1/gpt_consultas?id=eq.${encodeURIComponent(id)}&select=user_id,produto,placa,dados&limit=1`, {
    headers: { apikey: KEY, authorization: `Bearer ${KEY}` },
  });
  const rows = cres.ok ? await cres.json().catch(() => []) : [];
  const row = rows?.[0];
  if (!row || row.user_id !== uid) return txt("nao encontrado", 404);

  // extrai o base64 do arquivo (objeto {nome,tipo,conteudo}, ou string base64/data:)
  const arq = row?.dados?.arquivo;
  let b64 = "", tipo = "application/pdf", nome = `${row.produto || "documento"}-${row.placa || id}`;
  if (arq && typeof arq === "object") {
    b64 = String(arq.conteudo || arq.base64 || arq.arquivo || arq.dados || "");
    if (arq.tipo || arq.contentType) tipo = String(arq.tipo || arq.contentType);
    if (arq.nome) nome = String(arq.nome);
  } else if (typeof arq === "string") {
    b64 = arq.startsWith("data:") ? (arq.split(",")[1] || "") : arq;
  }
  b64 = b64.replace(/\s/g, "");
  if (!b64) return txt("sem arquivo", 404);

  let bytes: Uint8Array;
  try {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return txt("arquivo invalido", 500); }

  const ext = tipo.includes("pdf") ? "pdf" : tipo.includes("png") ? "png" : tipo.includes("jpeg") || tipo.includes("jpg") ? "jpg" : (tipo.split("/")[1] || "bin");
  const filename = /\.[a-z0-9]{2,4}$/i.test(nome) ? nome : `${nome}.${ext}`;
  // ?dl=1 força download (attachment); padrão = inline (abre no leitor do aparelho)
  const disp = url.searchParams.get("dl") ? "attachment" : "inline";

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": tipo,
      "content-disposition": `${disp}; filename="${filename}"`,
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
});
