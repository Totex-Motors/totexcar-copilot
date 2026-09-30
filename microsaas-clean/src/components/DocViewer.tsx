import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileText, Share2 } from "lucide-react";
import { PdfInline } from "./PdfInline";

// Visualizador de documento DENTRO do app.
// PDF é renderizado em <canvas> (PdfInline/PDF.js) → aparece dentro do app em QUALQUER
// aparelho, mesmo os sem leitor de PDF nativo (Samsung Internet, webview do WhatsApp).
// Aceita `arquivo` como objeto { nome, tipo, conteudo, url? }, base64 puro, data: URL ou URL http.

function decodeB64(b64: string): Uint8Array | null {
  try {
    const clean = b64.replace(/\s/g, "");
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

function sniffMime(b64: string, hint?: string): string {
  if (hint && hint.includes("/")) return hint;
  const s = b64.replace(/^\s+/, "");
  if (s.startsWith("JVBER")) return "application/pdf";
  if (s.startsWith("/9j/")) return "image/jpeg";
  if (s.startsWith("iVBOR")) return "image/png";
  if (s.startsWith("R0lGOD")) return "image/gif";
  return "application/pdf";
}

const extFor = (mime: string) =>
  mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : mime.includes("gif") ? "gif" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "bin";

export function DocViewer({ arquivo, filename = "documento" }: { arquivo: any; filename?: string; height?: number }) {
  const parsed = useMemo(() => {
    if (!arquivo) return null;
    let bytes: Uint8Array | null = null;
    let httpUrl: string | null = null;
    let mime = "application/pdf";
    let nome = filename;

    if (typeof arquivo === "string") {
      if (/^https?:\/\//.test(arquivo)) { httpUrl = arquivo; mime = /\.pdf($|\?)/i.test(arquivo) ? "application/pdf" : "image/*"; }
      else { const raw = arquivo.startsWith("data:") ? (arquivo.split(",")[1] || "") : arquivo; mime = sniffMime(raw); bytes = decodeB64(raw); }
    } else if (typeof arquivo === "object") {
      const hint = arquivo.tipo || arquivo.contentType;
      if (hint) mime = String(hint);
      if (arquivo.nome) nome = String(arquivo.nome);
      let raw = String(arquivo.conteudo || arquivo.base64 || arquivo.arquivo || arquivo.dados || arquivo.content || "");
      if (raw.startsWith("data:")) raw = raw.split(",")[1] || "";
      if (raw) { bytes = decodeB64(raw); if (!hint) mime = sniffMime(raw); }
      if (typeof arquivo.url === "string" && /^https?:\/\//.test(arquivo.url)) httpUrl = arquivo.url;
    }

    if (!bytes && !httpUrl) return null;
    // blob local pra abrir/baixar quando temos os bytes
    const blobUrl = bytes ? URL.createObjectURL(new Blob([bytes.slice(0)], { type: mime })) : null;
    return { bytes, httpUrl, blobUrl, mime, nome };
  }, [arquivo, filename]);

  useEffect(() => () => { if (parsed?.blobUrl) { try { URL.revokeObjectURL(parsed.blobUrl); } catch { /* */ } } }, [parsed]);

  const [shared, setShared] = useState(false);

  if (!parsed) {
    return <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>Não consegui carregar este documento. Tente de novo em instantes.</div>;
  }

  const isImg = String(parsed.mime).startsWith("image");
  const ext = extFor(String(parsed.mime));
  const dlName = /\.[a-z0-9]{2,4}$/i.test(parsed.nome) ? parsed.nome : `${parsed.nome}.${ext}`;
  const imgSrc = parsed.blobUrl || parsed.httpUrl || "";

  // File pra Web Share (celular abre no leitor/nas Notas/compartilha) — só quando temos os bytes
  const file = parsed.bytes ? new File([parsed.bytes.slice(0)], dlName, { type: String(parsed.mime) }) : null;
  const canShareFile = !!file && typeof navigator !== "undefined" && !!(navigator as any).canShare && (navigator as any).canShare({ files: [file] });

  // "Abrir": no celular usa a partilha nativa (leitor do aparelho / Notas / compartilhar);
  // senão abre a URL (blob local ou https doc-open) numa nova aba, com fallback pra navegação.
  const abrir = async () => {
    if (canShareFile) {
      try { await (navigator as any).share({ files: [file], title: dlName }); setShared(true); }
      catch { /* cancelou/falhou — silencioso */ }
      return;
    }
    const openUrl = parsed.httpUrl || parsed.blobUrl;
    if (!openUrl) return;
    const w = window.open(openUrl, "_blank");
    if (!w) window.location.href = openUrl;
  };

  // Baixar: bytes → blob local (download confiável, mesmo nome); só http → ?dl=1 força attachment.
  const dlHref = parsed.blobUrl || (parsed.httpUrl ? parsed.httpUrl + (parsed.httpUrl.includes("?") ? "&" : "?") + "dl=1" : "#");

  return (
    <div>
      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--card-2)", padding: isImg ? 0 : 8 }}>
        {isImg
          ? <img src={imgSrc} alt={dlName} style={{ width: "100%", display: "block" }} />
          : <PdfInline data={parsed.bytes || undefined} src={parsed.bytes ? undefined : parsed.httpUrl || undefined} />}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="sbtn brand" style={{ flex: 1, justifyContent: "center" }} onClick={abrir}>
          {canShareFile ? <Share2 size={15} /> : <ExternalLink size={15} />} {canShareFile ? "Abrir / compartilhar" : "Abrir em tela cheia"}
        </button>
        <a href={dlHref} download={dlName}><button className="sbtn"><Download size={15} /> Baixar</button></a>
      </div>

      {!isImg && (
        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <FileText size={12} /> {shared ? "Documento enviado pro leitor do seu aparelho." : "O documento aparece acima. \"Abrir\" manda pro leitor do aparelho; \"Baixar\" salva o PDF."}
        </p>
      )}
    </div>
  );
}
