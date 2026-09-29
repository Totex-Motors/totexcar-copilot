import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { FileText, Download, MessageCircle, ChevronRight, FolderLock, ExternalLink, Loader2, FileCheck2, Sparkles } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { runGptConsulta, type GptResult } from "@/hooks/useGptMotors";

const WA = "5511963786699";
const PRECO = 39; // preço de exibição (o valor final vem do servidor)

// href de download do arquivo do CRLV-e (aceita url direta ou base64)
function arquivoHref(arq: any): string | null {
  if (!arq) return null;
  if (typeof arq === "string" && /^https?:\/\//.test(arq)) return arq;
  if (arq.url) return String(arq.url);
  const b64 = arq.base64 || arq.conteudo || arq.arquivo || arq.dados;
  if (b64) return `data:${arq.tipo || arq.contentType || "application/pdf"};base64,${b64}`;
  return null;
}

// TELA CRLV — dados do documento + emissão do CRLV-e na hora (GPT Motors) + gov.br como alternativa.
export default function Crlv() {
  const { userData, userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GptResult | null>(null);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const v: any = vehicle || {};
  const placa = v.placa || "";
  const carro = vehicle ? [v.marca, v.modelo].filter(Boolean).join(" ") : null;
  const dados = [
    ["Placa", v.placa || "—"], ["Renavam", v.renavam || "—"],
    ["Marca/Modelo", carro || "—"], ["Ano", v.ano_modelo || v.ano_fabricacao || "—"],
    ["Cor", v.cor || "—"], ["Chassi", v.chassi ? `••••${String(v.chassi).slice(-4)}` : "—"],
  ];
  const waArquivo = `https://wa.me/${WA}?text=${encodeURIComponent("Quero guardar o CRLV do meu carro no ArquivoZap 📎")}`;
  const waCRLV = `https://wa.me/${WA}?text=${encodeURIComponent(`Quero emitir o CRLV-e do meu carro${placa ? ` (placa ${placa})` : ""} 📄`)}`;

  const emitir = async () => {
    if (!placa || busy) return;
    setBusy(true); setRes(null);
    const r = await runGptConsulta("crlv", placa, v.uf || undefined);
    setRes(r); setBusy(false);
  };
  const href = res?.ok ? arquivoHref(res.dados?.arquivo) : null;

  return (
    <MgShell title="CRLV digital" back="/">
      <div className="stack">
        <section className="hero" style={{ background: "linear-gradient(150deg,#0C6E6A,#0A5350)" }}>
          <div className="eyebrow">Documento do veículo</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{v.placa || "—"}</div>
          <span className="trend" style={{ marginTop: 8 }}><FileText size={13} /> {carro || "Cadastre seu carro"}</span>
        </section>

        {/* EMITIR CRLV-e na hora */}
        {res?.ok ? (
          <section className="card pad">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="badge-p" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FileCheck2 size={12} /> CRLV-e emitido</span>
              {res.cached && <span className="tag mut">recente</span>}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--muted)" }}>{[res.dados?.marcaModelo, res.dados?.anoModelo].filter(Boolean).join(" · ") || "Documento pronto"}</div>
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" download={`CRLV-${placa}.pdf`}><button className="btn-primary" style={{ marginTop: 12 }}><Download size={17} /> Baixar CRLV-e</button></a>
            ) : (
              <a className="sbtn wa" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} href={waCRLV} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Receber o arquivo pelo Co-pilot</a>
            )}
          </section>
        ) : res && !res.ok && res.needsPayment ? (
          <section className="card pad" style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Emitir CRLV-e por {res.preco ? `R$ ${res.preco}` : `R$ ${PRECO}`}</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 12px" }}>Pra emitir agora, fale com o Co-pilot no WhatsApp.</p>
            <a className="btn-primary" href={waCRLV} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Emitir pelo Co-pilot</a>
          </section>
        ) : res && !res.ok ? (
          <div className="card pad" style={{ background: "var(--gain-soft)", borderColor: "transparent", fontSize: 13 }}>
            <b>Não consegui emitir agora.</b> {res.error === "uf_obrigatoria" ? "Informe a UF da placa em Meu veículo." : (res.error || "Tente de novo em instantes.")}
          </div>
        ) : null}

        {placa && !res?.ok && (
          <button className="btn-primary" onClick={emitir} disabled={busy}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            {busy ? "Emitindo…" : `Emitir CRLV-e agora · R$ ${PRECO}`}
          </button>
        )}

        {/* dados do cadastro */}
        <section className="card" style={{ padding: 4 }}>
          {dados.map(([l, val]) => (
            <div key={l} className="list-row" style={{ padding: "12px" }}>
              <div style={{ flex: 1, color: "var(--muted)", fontSize: 13 }}>{l}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }} className="mono">{String(val)}</div>
            </div>
          ))}
        </section>

        {/* alternativa oficial */}
        <a href="https://www.gov.br/pt-br/servicos/emitir-o-certificado-de-registro-e-licenciamento-de-veiculo-digital" target="_blank" rel="noreferrer">
          <button className="sbtn" style={{ width: "100%", justifyContent: "center" }}><Download size={15} /> Ou baixar no gov.br <ExternalLink size={13} /></button>
        </a>

        {/* arquivozap */}
        <a className="card list-row" href={waArquivo} target="_blank" rel="noreferrer">
          <span className="offer-ico"><FolderLock size={19} /></span>
          <div style={{ flex: 1 }}><div className="t">Guardar no ArquivoZap</div><div className="s">Seu documento no cofre do WhatsApp, sempre à mão</div></div>
          <ChevronRight size={20} style={{ color: "var(--faint)" }} />
        </a>

        <Link to="/settings" className="foot-note" style={{ display: "block" }}>Atualizar os dados do veículo</Link>
        <p className="foot-note">O CRLV-e exige o veículo licenciado e sem débitos. Emissão paga, feita na hora pelo provedor credenciado.</p>
      </div>
    </MgShell>
  );
}
