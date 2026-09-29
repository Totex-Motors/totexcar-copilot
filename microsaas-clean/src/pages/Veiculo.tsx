import { Navigate, Link } from "react-router-dom";
import {
  Car, Coins, ChevronRight, CalendarDays, ShieldCheck, IdCard, FileText, Pencil, Gauge, Fuel, Palette, Hash,
} from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(y, m - 1, d); t.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}
const fmtBR = (d?: string | null) => { if (!d) return null; const [y, m, day] = String(d).split("-"); return day && m && y ? `${day}/${m}/${y}` : String(d); };
function statusOf(dateStr?: string | null) {
  const d = daysUntil(dateStr);
  if (d == null) return { txt: "Não informado", cls: "", dot: "var(--faint)" };
  if (d < 0) return { txt: `Venceu há ${Math.abs(d)}d`, cls: "due", dot: "var(--alert)" };
  if (d <= 30) return { txt: `Vence em ${d}d`, cls: "due", dot: "var(--gain)" };
  return { txt: "Em dia", cls: "ok", dot: "var(--good)" };
}

// TELA VEÍCULO (Meu Carro) — visão do carro no padrão novo: carro em destaque, documentos/vencimentos
// com status real, dados do veículo e atalhos (quanto vale / editar). Edição continua no /settings.
export default function Veiculo() {
  const { userData, userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const v: any = vehicle || {};
  const carro = vehicle ? [v.marca, v.modelo].filter(Boolean).join(" ") : null;
  const ano = v.ano_modelo || v.ano_fabricacao || null;
  const km = v.hodometro ? `${Number(v.hodometro).toLocaleString("pt-BR")} km` : null;

  const docs = [
    { label: "Licenciamento", date: v.licenciamento_vencimento, ic: CalendarDays },
    { label: "IPVA", date: v.ipva_vencimento, ic: CalendarDays },
    { label: "Seguro", date: v.seguro_vencimento, ic: ShieldCheck },
    { label: "CNH (habilitação)", date: userData?.cnh_vencimento, ic: IdCard },
  ];
  const dados = [
    { label: "Ano", value: ano ? String(ano) : "—", ic: CalendarDays },
    { label: "Cor", value: v.cor || "—", ic: Palette },
    { label: "Combustível", value: v.combustivel || "—", ic: Fuel },
    { label: "Hodômetro", value: km || "—", ic: Gauge },
    { label: "Renavam", value: v.renavam || "—", ic: Hash },
    { label: "Chassi", value: v.chassi ? `••••${String(v.chassi).slice(-4)}` : "—", ic: Hash },
  ];

  return (
    <MgShell tab="veiculo">
      <div className="stack">
        <div className="sec-title" style={{ fontSize: 20, marginTop: 2 }}>Meu carro</div>

        {/* carro em destaque */}
        <section className="card pad">
          <div className="veh-head">
            <span className="veh-ico"><Car size={23} /></span>
            <div>
              {v.placa && <span className="plate">{v.placa}</span>}
              <div className="veh-model">{carro || "Cadastre seu carro"}</div>
            </div>
            <Link to="/settings" className="swap">Editar <Pencil size={13} /></Link>
          </div>
          {km && (
            <div className="status-row">
              <div className="status ok"><span className="sd" style={{ background: "var(--brand)" }} /><div><div className="lab">Hodômetro</div><div className="big">{km}</div></div></div>
              {ano && <div className="status ok"><span className="sd" style={{ background: "var(--brand)" }} /><div><div className="lab">Ano</div><div className="big">{ano}</div></div></div>}
            </div>
          )}
        </section>

        {/* quanto vale */}
        <Link to="/vale" className="card alert-card" style={{ borderLeftColor: "var(--brand)" }}>
          <span className="alert-ico" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Coins size={21} /></span>
          <div style={{ flex: 1 }}><div className="t">Quanto vale o seu carro</div><div className="s">Valor na tabela FIPE, na hora</div></div>
          <ChevronRight size={20} style={{ color: "var(--faint)" }} />
        </Link>

        {/* documentos & vencimentos */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>Documentos & vencimentos</div>
          <section className="card">
            {docs.map((d) => {
              const st = statusOf(d.date);
              const Ic = d.ic;
              return (
                <Link key={d.label} to="/settings" className="list-row">
                  <span className="offer-ico"><Ic size={19} /></span>
                  <div style={{ flex: 1 }}>
                    <div className="t">{d.label}</div>
                    <div className="s">{fmtBR(d.date) ? `Vence ${fmtBR(d.date)}` : "Toque pra informar"}</div>
                  </div>
                  <span className={`tag ${st.cls}`} style={{ alignSelf: "center" }}>{st.txt}</span>
                </Link>
              );
            })}
          </section>
        </div>

        {/* CRLV digital */}
        <Link to="/crlv" className="card list-row">
          <span className="offer-ico"><FileText size={19} /></span>
          <div style={{ flex: 1 }}><div className="t">CRLV digital</div><div className="s">Documento do carro</div></div>
          <span className="tag ok" style={{ alignSelf: "center" }}>Disponível</span>
        </Link>

        {/* dados do veículo */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>Dados do veículo</div>
          <section className="card" style={{ padding: 4 }}>
            {dados.map((d) => {
              const Ic = d.ic;
              return (
                <div key={d.label} className="list-row" style={{ padding: "12px 12px" }}>
                  <span className="offer-ico" style={{ width: 34, height: 34 }}><Ic size={17} /></span>
                  <div style={{ flex: 1 }} className="t">{d.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }} className="mono">{d.value}</div>
                </div>
              );
            })}
          </section>
        </div>

        <Link to="/settings"><button className="btn-primary"><Pencil size={17} /> Editar dados do veículo</button></Link>

        <p className="foot-note">Os dados vêm do seu cadastro. Atualize em "Editar" ou mandando no WhatsApp do Co-pilot.</p>
      </div>
    </MgShell>
  );
}
