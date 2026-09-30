import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";

// Visualizador de documento DENTRO do app: PDF em <iframe>, imagem em <img>.
// Aceita `arquivo` como URL (http) ou base64 (com/sem prefixo data:). Base64 vira Blob URL
// (renderiza melhor em webview do que data: e não estoura limite de URL).
function b64ToBlobUrl(b64: string, mime: string): string | null {
  try {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch { return null; }
}

function sniffMime(b64: string, hint?: string): string {
  if (hint && hint.includes("/")) return hint;
  if (b64.startsWith("JVBER")) return "application/pdf";     // %PDF
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  return "application/pdf";
}

export function DocViewer({ arquivo, filename = "documento", height = 460 }: { arquivo: any; filename?: string; height?: number }) {
  const parsed = useMemo(() => {
    if (!arquivo) return null;
    // URL direta
    if (typeof arquivo === "string") {
      if (/^https?:\/\//.test(arquivo)) return { url: arquivo, mime: /\.pdf($|\?)/i.test(arquivo) ? "application/pdf" : "image/*", isBlob: false };
      // string base64 pura
      const mime = sniffMime(arquivo);
      const url = b64ToBlobUrl(arquivo, mime);
      return url ? { url, mime, isBlob: true } : null;
    }
    if (arquivo.url) return { url: String(arquivo.url), mime: arquivo.tipo || arquivo.contentType || "application/pdf", isBlob: false };
    let raw = arquivo.base64 || arquivo.conteudo || arquivo.arquivo || arquivo.dados || "";
    if (typeof raw === "string" && raw.startsWith("data:")) raw = raw.split(",")[1] || "";
    if (!raw) return null;
    const mime = sniffMime(raw, arquivo.tipo || arquivo.contentType);
    const url = b64ToBlobUrl(raw, mime);
    return url ? { url, mime, isBlob: true } : null;
  }, [arquivo]);

  const [ok] = useState(true);
  useEffect(() => () => { if (parsed?.isBlob && parsed.url) { try { URL.revokeObjectURL(parsed.url); } catch { /* */ } } }, [parsed]);

  if (!parsed || !ok) {
    return <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>Não consegui pré-visualizar aqui. Baixe pelo botão abaixo.</div>;
  }
  const isImg = String(parsed.mime).startsWith("image");
  const dl = String(parsed.mime).includes("pdf") ? `${filename}.pdf` : filename;

  return (
    <div>
      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--card-2)" }}>
        {isImg
          ? <img src={parsed.url} alt={filename} style={{ width: "100%", display: "block" }} />
          : <iframe title={filename} src={parsed.url} style={{ width: "100%", height, border: "none", display: "block" }} />}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <a href={parsed.url} download={dl} style={{ flex: 1 }}><button className="sbtn brand" style={{ width: "100%", justifyContent: "center" }}><Download size={15} /> Baixar</button></a>
        <a href={parsed.url} target="_blank" rel="noreferrer"><button className="sbtn"><ExternalLink size={15} /> Tela cheia</button></a>
      </div>
      {!isImg && <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}><FileText size={12} /> Se não abrir aqui no seu aparelho, use "Tela cheia" ou "Baixar".</p>}
    </div>
  );
}
