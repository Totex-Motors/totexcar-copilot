import { Navigate, Link } from "react-router-dom";
import { FileText, Download, MessageCircle, ChevronRight, FolderLock, ExternalLink, Pencil } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";

const WA = "5511963786699";

// TELA CRLV DIGITAL — mostra os dados do documento (do cadastro) e leva pro gov.br/Detran pra baixar
// o CRLV-e oficial, + guardar no ArquivoZap (WhatsApp). Não emitimos o documento, só facilitamos.
export default function Crlv() {
  const { userData, userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const v: any = vehicle || {};
  const carro = vehicle ? [v.marca, v.modelo].filter(Boolean).join(" ") : null;
  const dados = [
    ["Placa", v.placa || "—"], ["Renavam", v.renavam || "—"],
    ["Marca/Modelo", carro || "—"], ["Ano", v.ano_modelo || v.ano_fabricacao || "—"],
    ["Cor", v.cor || "—"], ["Chassi", v.chassi ? `••••${String(v.chassi).slice(-4)}` : "—"],
  ];
  const waArquivo = `https://wa.me/${WA}?text=${encodeURIComponent("Quero guardar o CRLV do meu carro no ArquivoZap 📎")}`;

  return (
    <MgShell title="CRLV digital" back="/">
      <div className="stack">
        {/* cartão do documento */}
        <section className="hero" style={{ background: "linear-gradient(150deg,#0C6E6A,#0A5350)" }}>
          <div className="eyebrow">Documento do veículo</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{v.placa || "—"}</div>
          <span className="trend" style={{ marginTop: 8 }}><FileText size={13} /> {carro || "Cadastre seu carro"}</span>
        </section>

        <section className="card" style={{ padding: 4 }}>
          {dados.map(([l, val]) => (
            <div key={l} className="list-row" style={{ padding: "12px" }}>
              <div style={{ flex: 1, color: "var(--muted)", fontSize: 13 }}>{l}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }} className="mono">{String(val)}</div>
            </div>
          ))}
        </section>

        {/* baixar oficial */}
        <a href="https://www.gov.br/pt-br/servicos/emitir-o-certificado-de-registro-e-licenciamento-de-veiculo-digital" target="_blank" rel="noreferrer">
          <button className="btn-primary"><Download size={17} /> Baixar CRLV-e oficial (gov.br) <ExternalLink size={14} /></button>
        </a>

        {/* arquivozap */}
        <a className="card list-row" href={waArquivo} target="_blank" rel="noreferrer">
          <span className="offer-ico"><FolderLock size={19} /></span>
          <div style={{ flex: 1 }}><div className="t">Guardar no ArquivoZap</div><div className="s">Seu documento no cofre do WhatsApp, sempre à mão</div></div>
          <ChevronRight size={20} style={{ color: "var(--faint)" }} />
        </a>

        <a className="copilot" href={`https://wa.me/${WA}?text=${encodeURIComponent("Tenho dúvida sobre o CRLV / licenciamento do meu carro")}`} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Dúvida no licenciamento?</div>
            <div className="s">"Já posso licenciar?" · "Tem débito?" — pergunta no WhatsApp.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        <Link to="/settings" className="foot-note" style={{ display: "block" }}>Atualizar os dados do veículo</Link>
        <p className="foot-note">O CRLV-e oficial sai no gov.br/Detran (precisa estar licenciado e sem débitos). A gente só facilita e guarda.</p>
      </div>
    </MgShell>
  );
}
