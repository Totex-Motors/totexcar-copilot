import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileText, Share2 } from "lucide-react";

// Visualizador de documento DENTRO do app.
// Aceita `arquivo` como URL (http), base64 puro, ou objeto { nome, tipo, conteudo|base64|url }.
// Desktop: mostra PDF em <iframe> / imagem em <img>. Mobile: o iframe de PDF costuma vir em
// branco, então o botão "Abrir" usa a partilha nativa (Web Share) pra abrir no leitor do
// aparelho / salvar / mandar no WhatsApp, com fallback pra nova aba e navegação direta.

function decodeB64(b64: string): Uint8Array | null {
  try {
    const clean = b64.replace(/\s/g, ""); // remove quebras de linha que quebram o atob
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

function sniffMime(b64: string, hint?: string): string {
  if (hint && hint.includes("/")) return hint;
  const s = b64.replace(/^\s+/, "");
  if (s.startsWith("JVBER")) return "application/pdf";     // %PDF
  if (s.startsWith("/9j/")) return "image/jpeg";
  if (s.startsWith("iVBOR")) return "image/png";
  if (s.startsWith("R0lGOD")) return "image/gif";
  return "application/pdf";
}

const extFor = (mime: string) =>
  mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : mime.includes("gif") ? "gif" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "bin";

export function DocViewer({ arquivo, filename = "documento", height = 460 }: { arquivo: any; filename?: string; height?: number }) {
  const parsed = useMemo(() => {
    if (!arquivo) return null;

    // 1) URL http direta
    if (typeof arquivo === "string" && /^https?:\/\//.test(arquivo)) {
      return { url: arquivo, mime: /\.pdf($|\?)/i.test(arquivo) ? "application/pdf" : "image/*", bytes: null as Uint8Array | null };
    }
    if (arquivo && typeof arquivo === "object" && typeof arquivo.url === "string" && /^https?:\/\//.test(arquivo.url)) {
      return { url: String(arquivo.url), mime: arquivo.tipo || arquivo.contentType || "application/pdf", bytes: null };
    }

    // 2) base64 (string pura ou dentro de objeto)
    let raw: string = typeof arquivo === "string"
      ? arquivo
      : (arquivo.conteudo || arquivo.base64 || arquivo.arquivo || arquivo.dados || arquivo.content || "");
    if (typeof raw !== "string" || !raw) return null;
    if (raw.startsWith("data:")) raw = raw.split(",")[1] || "";

    const hint = typeof arquivo === "object" ? (arquivo.tipo || arquivo.contentType) : undefined;
    const mime = sniffMime(raw, hint);
    const bytes = decodeB64(raw);
    if (!bytes) return null;
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    return { url, mime, bytes };
  }, [arquivo]);

  // limpa o Blob URL ao desmontar
  useEffect(() => () => { if (parsed?.bytes && parsed.url) { try { URL.revokeObjectURL(parsed.url); } catch { /* */ } } }, [parsed]);

  const [shared, setShared] = useState(false);

  if (!parsed) {
    return <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>Não consegui carregar este documento. Tente de novo em instantes.</div>;
  }

  const isImg = String(parsed.mime).startsWith("image");
  const ext = extFor(String(parsed.mime));
  const dlName = /\.[a-z0-9]{2,4}$/i.test(filename) ? filename : `${filename}.${ext}`;

  // File pra Web Share (só quando temos os bytes)
  const file = parsed.bytes ? new File([parsed.bytes], dlName, { type: String(parsed.mime) }) : null;
  const canShareFile = !!file && typeof navigator !== "undefined" && !!(navigator as any).canShare && (navigator as any).canShare({ files: [file] });

  // Abre o documento de forma robusta (funciona no celular e no desktop)
  const abrir = async () => {
    if (canShareFile) {
      try { await (navigator as any).share({ files: [file], title: dlName }); setShared(true); }
      catch { /* usuário cancelou ou falhou — não faz nada */ }
      return;
    }
    const w = window.open(parsed.url, "_blank");
    if (!w) window.location.href = parsed.url; // popup bloqueado → navega na própria aba
  };

  return (
    <div>
      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--card-2)" }}>
        {isImg
          ? <img src={parsed.url} alt={dlName} style={{ width: "100%", display: "block" }} />
          : <iframe title={dlName} src={parsed.url} style={{ width: "100%", height, border: "none", display: "block" }} />}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="sbtn brand" style={{ flex: 1, justifyContent: "center" }} onClick={abrir}>
          {canShareFile ? <Share2 size={15} /> : <ExternalLink size={15} />} {canShareFile ? "Abrir / compartilhar" : "Abrir em tela cheia"}
        </button>
        <a href={parsed.url} download={dlName}><button className="sbtn"><Download size={15} /> Baixar</button></a>
      </div>

      {!isImg && (
        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <FileText size={12} /> {shared ? "Documento enviado pro leitor do seu aparelho." : "No celular, toque em \"Abrir\" pra ver o PDF no leitor do aparelho."}
        </p>
      )}
    </div>
  );
}
