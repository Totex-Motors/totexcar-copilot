import { useEffect, useRef, useState } from "react";

// Renderiza um PDF DENTRO do app desenhando as páginas em <canvas> via PDF.js.
// Funciona em QUALQUER navegador/webview — inclusive os que não têm leitor de PDF
// nativo (Samsung Internet, webview do WhatsApp), onde <iframe>/blob de PDF fica em branco.
// Aceita os bytes direto (`data`) — sem rede, sem CORS — ou uma URL (`src`).
export function PdfInline({ data, src, onFail }: { data?: Uint8Array; src?: string; onFail?: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let task: any = null;
    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist");
        // worker casado com a versão instalada (Vite empacota o .mjs)
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const params = data ? { data: data.slice(0) } : src ? { url: src } : null;
        if (!params) { setState("error"); onFail?.(); return; }
        task = pdfjs.getDocument(params as any);
        const doc = await task.promise;
        if (cancelled) return;
        const host = holder.current;
        if (!host) return;
        host.innerHTML = "";
        const width = Math.max(host.clientWidth || 0, 280);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const N = Math.min(doc.numPages, 10); // limite de segurança
        for (let n = 1; n <= N; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width; canvas.height = vp.height;
          canvas.style.width = "100%"; canvas.style.height = "auto"; canvas.style.display = "block";
          canvas.style.borderRadius = "8px";
          if (n > 1) canvas.style.marginTop = "8px";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          host.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        }
        if (!cancelled) setState("ok");
      } catch {
        if (!cancelled) { setState("error"); onFail?.(); }
      }
    })();
    return () => { cancelled = true; try { task?.destroy?.(); } catch { /* */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div>
      <div ref={holder} />
      {state === "loading" && (
        <div style={{ padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Carregando documento…</div>
      )}
      {state === "error" && (
        <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          Não consegui exibir aqui. Use "Abrir" ou "Baixar" abaixo.
        </div>
      )}
    </div>
  );
}
