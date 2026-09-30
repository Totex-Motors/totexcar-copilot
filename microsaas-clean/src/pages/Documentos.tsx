import { useState } from "react";
import { Navigate } from "react-router-dom";
import { FileCheck2, ShieldAlert, Search, IdCard, Download, X, FolderLock, MessageCircle, ChevronRight } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMinhasConsultas, fetchConsultaById, type GptResult, type GptProduto } from "@/hooks/useGptMotors";

const WA = "5511963786699";
const META: Record<GptProduto, { label: string; icon: any }> = {
  raiox: { label: "Raio-X do carro", icon: FileCheck2 },
  crlv: { label: "CRLV-e", icon: FileCheck2 },
  debitos: { label: "Débitos & Multas", icon: Search },
  cnh: { label: "Consulta CNH", icon: IdCard },
};
const fmtDT = (s?: string) => s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

function arquivoHref(arq: any): string | null {
  if (!arq) return null;
  if (typeof arq === "string" && /^https?:\/\//.test(arq)) return arq;
  if (arq.url) return String(arq.url);
  const b64 = arq.base64 || arq.conteudo || arq.arquivo || arq.dados;
  if (b64) return `data:${arq.tipo || arq.contentType || "application/pdf"};base64,${b64}`;
  return null;
}

// COFRE — Meus documentos: todas as consultas/documentos GPT Motors num lugar só, clicáveis.
export default function Documentos() {
  const { userData, userId, loading } = useCurrentUser();
  const { data: docs, isLoading } = useMinhasConsultas(userId);
  const [aberto, setAberto] = useState<GptResult | null>(null);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const abrir = async (id: string) => { const r = await fetchConsultaById(id); if (r) setAberto(r); };
  const href = aberto?.produto === "crlv" ? arquivoHref(aberto?.dados?.arquivo) : null;

  return (
    <MgShell title="Meus documentos" back="/">
      <div className="stack">
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 2px" }}>Tudo que você já consultou ou emitiu, guardado e clicável pra rever quando quiser.</p>

        {isLoading ? (
          <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}>Carregando...</div>
        ) : !docs || docs.length === 0 ? (
          <div className="card pad" style={{ textAlign: "center" }}>
            <FolderLock size={34} style={{ opacity: .4, margin: "6px auto", color: "var(--brand)" }} />
            <div style={{ fontWeight: 700 }}>Nada guardado ainda</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Suas consultas (Raio-X, CRLV-e, Débitos, CNH) aparecem aqui automaticamente.</p>
          </div>
        ) : (
          <section className="card">
            {docs.map((d: any) => {
              const m = META[d.produto as GptProduto] || META.raiox;
              const Ic = m.icon;
              return (
                <button key={d.id} className="list-row" style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer" }} onClick={() => abrir(d.id)}>
                  <span className="offer-ico"><Ic size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">{m.label}</div>
                    <div className="s">{d.placa || (d.cpf ? `CPF ••••${String(d.cpf).slice(-4)}` : "")} · {fmtDT(d.created_at)}</div>
                  </div>
                  <ChevronRight size={18} style={{ color: "var(--faint)" }} />
                </button>
              );
            })}
          </section>
        )}

        <p className="foot-note">Guardado com segurança na sua conta. Só você vê. Documentos oficiais também no ArquivoZap (WhatsApp).</p>
      </div>

      {/* visualizador (bottom-sheet) */}
      {aberto && (
        <div className="overlay" onClick={() => setAberto(null)}>
          <div className="sheet2" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{META[aberto.produto as GptProduto]?.label || "Documento"}</div>
              <button className="icon-btn" onClick={() => setAberto(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            {aberto.produto === "crlv" ? (
              href
                ? <a href={href} target="_blank" rel="noreferrer" download={`CRLV-${aberto.placa || ""}.pdf`}><button className="btn-primary"><Download size={17} /> Baixar CRLV-e</button></a>
                : <a className="sbtn wa" style={{ width: "100%", justifyContent: "center" }} href={`https://wa.me/${WA}?text=${encodeURIComponent("Quero receber meu CRLV-e")}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Receber o arquivo pelo Co-pilot</a>
            ) : aberto.analiseIA ? (
              <p style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{aberto.analiseIA}</p>
            ) : (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Consulta concluída. Fale com o Co-pilot pra ver os detalhes.</p>
            )}
          </div>
        </div>
      )}
    </MgShell>
  );
}
