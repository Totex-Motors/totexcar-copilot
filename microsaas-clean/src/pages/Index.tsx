import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  TrendingUp, ChevronRight, Car, Repeat2, CreditCard, CalendarDays, FileCheck2, ShieldCheck,
  IdCard, LineChart, MessageCircle, Coins, Ticket, Landmark, Truck, Wrench, Plane, Warehouse,
  Gift, Award, Banknote, FileText, Tag, LifeBuoy, Disc3, Store,
} from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { useTotalSpent } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";

const WA = "5511963786699";

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(y, m - 1, d); t.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}
const brl = (v?: number | null) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// MINHA GARAGEM — home (Início). Conteúdo dentro da moldura MgShell.
export default function Index() {
  const { userData, userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data: totals } = useTotalSpent(userId);

  const [fipe, setFipe] = useState<{ valor?: string; ref?: string; loading: boolean }>({ loading: false });
  useEffect(() => {
    const placa = (vehicle?.placa || "").replace(/[^A-Za-z0-9]/g, "");
    if (placa.length < 7) return;
    setFipe({ loading: true });
    supabase.functions.invoke("quanto-vale", { body: { placa } })
      .then(({ data }) => {
        const d = data as any;
        setFipe(d?.ok && d.valor ? { valor: d.valor, ref: d.ref, loading: false } : { loading: false });
      })
      .catch(() => setFipe({ loading: false }));
  }, [vehicle?.placa]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const carro = vehicle ? [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") : null;
  const placa = vehicle?.placa || null;
  const v: any = vehicle || {};
  const dLic = daysUntil(v.licenciamento_vencimento), dIpva = daysUntil(v.ipva_vencimento), dSeg = daysUntil(v.seguro_vencimento);
  const status = (d: number | null) => d == null ? { cls: "ok", txt: "—", ok: false } : d < 0 ? { cls: "warn", txt: `Venceu há ${Math.abs(d)}d`, ok: false } : d <= 30 ? { cls: "warn", txt: `Vence em ${d}d`, ok: false } : { cls: "ok", txt: "Em dia", ok: true };
  const sLic = status(dLic), sIpva = status(dIpva), sSeg = status(dSeg);

  const urg = [{ t: "Licenciamento", d: dLic }, { t: "IPVA", d: dIpva }, { t: "Seguro", d: dSeg }]
    .filter((x) => x.d != null).sort((a, b) => (a.d as number) - (b.d as number))[0];
  const aviso = urg && (urg.d as number) <= 60
    ? { txt: (urg.d as number) < 0 ? `${urg.t} venceu há ${Math.abs(urg.d as number)} dia(s)` : (urg.d as number) === 0 ? `${urg.t} vence hoje` : `${urg.t} vence em ${urg.d} dia(s)` }
    : null;

  const tiles = [
    { to: "/multas", ic: CreditCard, cls: "ic-gain", name: "Débitos", meta: "IPVA, multas e taxas", tag: "Consultar", tagcls: "new" },
    { to: "/veiculo", ic: CalendarDays, cls: "ic-brand", name: "Vencimentos", meta: "Licenciamento, seguro", tag: sLic.ok && sSeg.ok ? "Em dia" : "Atenção", tagcls: sLic.ok && sSeg.ok ? "ok" : "due" },
    { to: "/manutencao", ic: Wrench, cls: "ic-brand", name: "Manutenção", meta: "Revisões por km", tag: "Ver", tagcls: "new" },
    { to: "/historico", ic: FileCheck2, cls: "ic-brand", name: "Histórico", meta: "Consulta cautelar", tag: "Emitir", tagcls: "new" },
    { to: "/seguro", ic: ShieldCheck, cls: "ic-good", name: "Meu seguro", meta: "Cotação em minutos", tag: v.seguro_vencimento ? "Ativo" : "Sem proteção", tagcls: v.seguro_vencimento ? "ok" : "due" },
    { to: "/crlv", ic: IdCard, cls: "ic-brand", name: "CRLV digital", meta: "Documento do carro", tag: "Disponível", tagcls: "ok" },
    { to: "/custo", ic: LineChart, cls: "ic-brand", name: "Custo do carro", meta: "Quanto ele te custa", tag: totals?.totalExpenses ? brl(totals.totalExpenses) : "Ver", tagcls: "ok" },
    { to: "/viagem", ic: Plane, cls: "ic-good", name: "Modo Viagem", meta: "Planeje a road trip", tag: "Novo", tagcls: "new" },
  ];
  const offers = [
    { ic: Ticket, t: "Tag de pedágio", s: "Passe direto e ganhe desconto", cta: "Ver" },
    { ic: Landmark, t: "Empréstimo com garantia", s: "Use o carro sem parar de dirigir", cta: "Simular" },
    { ic: Truck, t: "Guincho 24h", s: "Ajuda na estrada quando precisar", cta: "Ver" },
  ];

  return (
    <MgShell tab="inicio">
      <div className="stack">
        {/* HERO: quanto vale */}
        <section className="hero">
          <div className="eyebrow">Quanto vale o seu carro</div>
          <div className="val mono">{fipe.valor || (fipe.loading ? "..." : carro ? "Consultar" : "—")}</div>
          {carro && <span className="trend"><Car size={13} /> {carro}</span>}
          <div className="hero-foot">
            <span className="updated">{fipe.valor ? `Tabela FIPE · ${fipe.ref || "atualizado"}` : "Descubra na tabela FIPE"}</span>
            <Link to="/vale" className="hero-cta">Ver detalhe <ChevronRight size={13} /></Link>
          </div>
        </section>

        {/* AVISO (dado real) */}
        {aviso && (
          <Link to="/settings" className="card alert-card">
            <span className="alert-ico"><Coins size={21} /></span>
            <div style={{ flex: 1 }}><div className="t">{aviso.txt}</div><div className="s">Toque pra ver e resolver</div></div>
            <span className="chip-pay">Ver</span>
          </Link>
        )}

        {/* SITUAÇÃO DO VEÍCULO */}
        <section className="card pad">
          <div className="veh-head">
            <span className="veh-ico"><Car size={23} /></span>
            <div>
              {placa && <span className="plate">{placa}</span>}
              <div className="veh-model">{carro || "Cadastre seu carro"}</div>
            </div>
            <Link to="/settings" className="swap">{carro ? "Trocar" : "Cadastrar"} <Repeat2 size={14} /></Link>
          </div>
          <div className="status-row">
            <div className={`status ${sLic.cls}`}>
              <span className="sd" style={{ background: sLic.ok ? "var(--good)" : "var(--gain)" }} />
              <div><div className="lab">Licenciamento</div><div className="big">{sLic.txt}</div></div>
            </div>
            <div className={`status ${sIpva.cls}`}>
              <span className="sd" style={{ background: sIpva.ok ? "var(--good)" : "var(--gain)" }} />
              <div><div className="lab">IPVA</div><div className="big">{sIpva.txt}</div></div>
            </div>
          </div>
        </section>

        {/* GRID */}
        <div className="grid">
          {tiles.map((t) => {
            const Ic = t.ic;
            return (
              <Link key={t.name} to={t.to} className="tile">
                <span className={`tile-ico ${t.cls}`}><Ic size={20} /></span>
                <div><div className="name">{t.name}</div><div className="meta">{t.meta}</div></div>
                <span className={`tag ${t.tagcls}`}>{t.tag}</span>
              </Link>
            );
          })}
        </div>

        {/* CO-PILOT */}
        <a className="copilot" href={`https://wa.me/${WA}?text=${encodeURIComponent("Oi! Quero cuidar do meu carro com o Co-pilot 🚗")}`} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Pergunte ao Co-pilot</div>
            <div className="s">"Vale a pena trocar meu carro?" · "Achei um barulho" — responde na hora, no WhatsApp.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        {/* GARAGEM TOTEX (vitrine + troca) */}
        <Link to="/garagem" className="card alert-card" style={{ borderLeftColor: "var(--brand)" }}>
          <span className="alert-ico" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Warehouse size={21} /></span>
          <div style={{ flex: 1 }}><div className="t">Garagem Totex</div><div className="s">Ache o próximo carro ou avalie o seu</div></div>
          <ChevronRight size={20} style={{ color: "var(--faint)" }} />
        </Link>

        {/* APROVEITE MAIS */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>Aproveite mais</div>
          <section className="card">
            {offers.map((o) => {
              const Ic = o.ic;
              return (
                <Link key={o.t} to="/servicos" className="offer">
                  <span className="offer-ico"><Ic size={19} /></span>
                  <div style={{ flex: 1 }}><div className="t">{o.t}</div><div className="s">{o.s}</div></div>
                  <span className="cta">{o.cta}</span>
                </Link>
              );
            })}
          </section>
        </div>

        {/* MAIS NO APP */}
        <div>
          <div className="eyebrow" style={{ margin: "4px 2px 10px" }}>Mais no app</div>
          <section className="card">
            {[
              ...(userData?.role === "admin" ? [
                { to: "/admin", ic: ShieldCheck, t: "Painel Admin", s: "Gestão da rede" },
                { to: "/lojista", ic: Store, t: "Painel do Lojista", s: "Clientes e vendas da loja" },
              ] : []),
              { to: "/indique", ic: Gift, t: "Indique e Ganhe", s: "Comissão por indicação" },
              { to: "/selo", ic: Award, t: "Selo Totex", s: "Seu histórico vale dinheiro" },
              { to: "/financiamento", ic: Banknote, t: "Financiamento", s: "Acompanhe as parcelas" },
              { to: "/reports", ic: FileText, t: "Relatórios", s: "Gastos por período" },
              { to: "/categories", ic: Tag, t: "Categorias", s: "Organize seus gastos" },
              { to: "/roleta", ic: Disc3, t: "Roleta Totex", s: "Missões e prêmios da loja" },
              { to: "/suporte", ic: LifeBuoy, t: "Suporte", s: "Ajuda na hora, com IA" },
            ].map((o) => {
              const Ic = o.ic;
              return (
                <Link key={o.to} to={o.to} className="offer">
                  <span className="offer-ico"><Ic size={19} /></span>
                  <div style={{ flex: 1 }}><div className="t">{o.t}</div><div className="s">{o.s}</div></div>
                  <ChevronRight size={18} style={{ color: "var(--faint)" }} />
                </Link>
              );
            })}
          </section>
        </div>

        <p className="foot-note"><em>O carro que você procura, ao alcance do seu dedo.</em><br />TotexMotors · seu carro cuidado no WhatsApp.</p>
      </div>
    </MgShell>
  );
}
