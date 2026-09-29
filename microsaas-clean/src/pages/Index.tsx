import { useEffect, useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import {
  Bell, Sun, Moon, User, TrendingUp, ChevronRight, Car, Repeat2, CreditCard, CalendarDays,
  FileCheck2, ShieldCheck, IdCard, LineChart, MessageCircle, Home as HomeIcon, Wrench,
  Coins, Ticket, Landmark, Truck,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { useTotalSpent, useFuelThisMonth } from "@/hooks/useTransactions";
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

// MINHA GARAGEM — home do motorista (versão grátis), fiel ao protótipo: barra própria em cima,
// abas embaixo, tema claro (com alternar), o carro e o "quanto vale" como âncora. Dados reais onde há.
export default function Index() {
  const nav = useNavigate();
  const { userData, userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data: totals } = useTotalSpent(userId);
  const { data: fuelMonth } = useFuelThisMonth(userId);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return (localStorage.getItem("mg_theme") as "light" | "dark") || "light"; } catch { return "light"; }
  });
  useEffect(() => { try { localStorage.setItem("mg_theme", theme); } catch { /* */ } }, [theme]);

  // valor FIPE do carro do dono (consulta pela placa) — âncora do hero
  const [fipe, setFipe] = useState<{ valor?: string; ref?: string; loading: boolean }>({ loading: false });
  useEffect(() => {
    const placa = (vehicle?.placa || "").replace(/[^A-Za-z0-9]/g, "");
    if (placa.length < 7) return;
    setFipe({ loading: true });
    supabase.functions.invoke("quanto-vale", { body: { placa } })
      .then(({ data }) => {
        const d = data as any;
        if (d?.ok && d.valor) setFipe({ valor: d.valor, ref: d.ref, loading: false });
        else setFipe({ loading: false });
      })
      .catch(() => setFipe({ loading: false }));
  }, [vehicle?.placa]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const carro = vehicle ? [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") : null;
  const placa = vehicle?.placa || null;
  const v: any = vehicle || {};

  const dLic = daysUntil(v.licenciamento_vencimento);
  const dIpva = daysUntil(v.ipva_vencimento);
  const dSeg = daysUntil(v.seguro_vencimento);
  const status = (d: number | null) => d == null ? { cls: "", txt: "—", ok: false } : d < 0 ? { cls: "warn", txt: `Venceu há ${Math.abs(d)}d`, ok: false } : d <= 30 ? { cls: "warn", txt: `Vence em ${d}d`, ok: false } : { cls: "ok", txt: "Em dia", ok: true };
  const sLic = status(dLic), sIpva = status(dIpva), sSeg = status(dSeg);

  // aviso (o mais urgente entre os vencimentos)
  const urg = [
    { t: "Licenciamento", d: dLic }, { t: "IPVA", d: dIpva }, { t: "Seguro", d: dSeg },
  ].filter((x) => x.d != null).sort((a, b) => (a.d as number) - (b.d as number))[0];
  const aviso = urg && (urg.d as number) <= 60
    ? { txt: (urg.d as number) < 0 ? `${urg.t} venceu há ${Math.abs(urg.d as number)} dia(s)` : (urg.d as number) === 0 ? `${urg.t} vence hoje` : `${urg.t} vence em ${urg.d} dia(s)` }
    : null;

  const tiles = [
    { to: "/multas", ic: CreditCard, cls: "ic-gain", name: "Débitos", meta: "IPVA, multas e taxas", tag: "Consultar", tagcls: "new" },
    { to: "/settings", ic: CalendarDays, cls: "ic-brand", name: "Vencimentos", meta: "Licenciamento, seguro", tag: sLic.ok && sSeg.ok ? "Em dia" : "Atenção", tagcls: sLic.ok && sSeg.ok ? "ok" : "due" },
    { to: "/servicos", ic: FileCheck2, cls: "ic-brand", name: "Histórico", meta: "Consulta cautelar", tag: "Emitir", tagcls: "new" },
    { to: "/servicos", ic: ShieldCheck, cls: "ic-good", name: "Meu seguro", meta: "Cotação em minutos", tag: v.seguro_vencimento ? "Ativo" : "Sem proteção", tagcls: v.seguro_vencimento ? "ok" : "due" },
    { to: "/settings", ic: IdCard, cls: "ic-brand", name: "CRLV digital", meta: "Documento do carro", tag: "Disponível", tagcls: "ok" },
    { to: "/analytics", ic: LineChart, cls: "ic-brand", name: "Custo do carro", meta: "Quanto ele te custa", tag: totals?.totalExpenses ? brl(totals.totalExpenses) : "Ver", tagcls: "ok" },
  ];
  const offers = [
    { ic: Ticket, t: "Tag de pedágio", s: "Passe direto e ganhe desconto", cta: "Ver" },
    { ic: Landmark, t: "Empréstimo com garantia", s: "Use o carro sem parar de dirigir", cta: "Simular" },
    { ic: Truck, t: "Guincho 24h", s: "Ajuda na estrada quando precisar", cta: "Ver" },
  ];

  return (
    <div className="mg" data-theme={theme}>
      <style>{MG_CSS}</style>
      <div className="phone">
        {/* TOP BAR */}
        <header className="bar">
          <img className="brand-logo" src="/totexmotors-logo.png" alt="TotexMotors" />
          <div className="bar-actions">
            <button className="icon-btn" aria-label="Avisos" onClick={() => nav("/multas")}><span className="dot" /><Bell size={19} /></button>
            <button className="icon-btn" aria-label="Alternar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button>
            <button className="icon-btn" aria-label="Perfil" onClick={() => nav("/settings")}><User size={19} /></button>
          </div>
        </header>

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

          {/* AVISO de vencimento (dado real) */}
          {aviso && (
            <Link to="/settings" className="card alert-card">
              <span className="alert-ico"><Coins size={21} /></span>
              <div style={{ flex: 1 }}>
                <div className="t">{aviso.txt}</div>
                <div className="s">Toque pra ver e resolver</div>
              </div>
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
              <div className={`status ${sLic.cls || "ok"}`}>
                <span className="sd" style={{ background: sLic.ok ? "var(--good)" : "var(--gain)" }} />
                <div><div className="lab">Licenciamento</div><div className="big">{sLic.txt}</div></div>
              </div>
              <div className={`status ${sIpva.cls || "ok"}`}>
                <span className="sd" style={{ background: sIpva.ok ? "var(--good)" : "var(--gain)" }} />
                <div><div className="lab">IPVA</div><div className="big">{sIpva.txt}</div></div>
              </div>
            </div>
          </section>

          {/* GRID DE SERVIÇOS */}
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

          <p className="foot-note"><em>O carro que você procura, ao alcance do seu dedo.</em><br />TotexMotors · seu carro cuidado no WhatsApp.</p>
        </div>
      </div>

      {/* ABAS INFERIORES */}
      <nav className="tabs" aria-label="Navegação">
        <Link to="/" className="tab on"><HomeIcon size={21} />Início</Link>
        <Link to="/settings" className="tab"><Car size={21} />Veículo</Link>
        <Link to="/settings" className="tab"><IdCard size={21} />CNH</Link>
        <Link to="/servicos" className="tab"><Wrench size={21} />Serviços</Link>
      </nav>
    </div>
  );
}

const MG_CSS = `
.mg{--ground:#EEF2F0;--card:#FFFFFF;--card-2:#F5F8F6;--ink:#13211E;--muted:#5D6E69;--faint:#8A9994;--line:#E1E8E5;--brand:#0C6E6A;--brand-deep:#0A5350;--brand-soft:#DCEDEB;--gain:#C9781E;--gain-soft:#F6E7D3;--good:#1F8A54;--good-soft:#DDEFE4;--warn:#B8621A;--wa:#1FA855;--shadow:0 1px 2px rgba(19,33,30,.06),0 8px 24px rgba(19,33,30,.06);--radius:18px;color-scheme:light;background:var(--ground);color:var(--ink);min-height:100vh;font-family:"IBM Plex Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.mg[data-theme="dark"]{--ground:#0C1211;--card:#14201D;--card-2:#101A18;--ink:#EAF1EE;--muted:#9FB0AB;--faint:#75857F;--line:#223029;--brand:#38A69F;--brand-deep:#2C8580;--brand-soft:#16302D;--gain:#E0954A;--gain-soft:#33261A;--good:#45B67E;--good-soft:#16281F;--warn:#E0954A;--wa:#35C36C;--shadow:0 1px 2px rgba(0,0,0,.3),0 10px 26px rgba(0,0,0,.35);color-scheme:dark}
.mg *{box-sizing:border-box}
.mg a{text-decoration:none;color:inherit}
.mg .phone{max-width:460px;margin:0 auto;padding:0 16px 100px;min-height:100vh}
.mg .mono{font-variant-numeric:tabular-nums}
.mg .bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;margin:0 -16px 6px;background:color-mix(in srgb,var(--ground) 90%,transparent);backdrop-filter:blur(8px)}
.mg .brand-logo{height:40px;width:auto;display:block}
.mg .bar-actions{display:flex;align-items:center;gap:10px}
.mg .icon-btn{width:38px;height:38px;border-radius:12px;background:var(--card);border:1px solid var(--line);display:grid;place-items:center;color:var(--ink);position:relative;box-shadow:var(--shadow);cursor:pointer}
.mg .dot{position:absolute;top:8px;right:9px;width:8px;height:8px;border-radius:50%;background:var(--gain);box-shadow:0 0 0 2px var(--card)}
.mg .stack{display:flex;flex-direction:column;gap:14px}
.mg .eyebrow{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--faint)}
.mg .hero{border-radius:22px;padding:20px;color:#fff;position:relative;overflow:hidden;background:radial-gradient(120% 130% at 85% -10%,#12857F 0%,var(--brand) 42%,var(--brand-deep) 100%);box-shadow:0 12px 30px rgba(10,83,80,.32)}
.mg .hero .eyebrow{color:rgba(255,255,255,.72)}
.mg .hero .val{font-weight:800;font-size:40px;letter-spacing:-.03em;line-height:1;margin:6px 0 8px}
.mg .trend{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;background:rgba(255,255,255,.16);padding:4px 9px;border-radius:999px}
.mg .hero-foot{display:flex;align-items:center;justify-content:space-between;margin-top:16px;gap:10px}
.mg .hero-cta{font-size:13px;font-weight:700;color:var(--brand-deep);background:#fff;padding:9px 14px;border-radius:11px;display:inline-flex;align-items:center;gap:6px}
.mg .updated{font-size:11px;color:rgba(255,255,255,.72)}
.mg .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
.mg .pad{padding:15px}
.mg .alert-card{display:flex;align-items:center;gap:13px;padding:14px 15px;border-left:4px solid var(--gain)}
.mg .alert-ico{width:42px;height:42px;border-radius:12px;background:var(--gain-soft);color:var(--warn);display:grid;place-items:center;flex:none}
.mg .alert-card .t{font-weight:700;font-size:14.5px}
.mg .alert-card .s{font-size:12.5px;color:var(--muted);margin-top:1px}
.mg .chip-pay{margin-left:auto;flex:none;font-size:12.5px;font-weight:700;color:#fff;background:var(--gain);padding:9px 13px;border-radius:11px}
.mg .veh-head{display:flex;align-items:center;gap:12px}
.mg .veh-ico{width:46px;height:46px;border-radius:13px;background:var(--brand-soft);color:var(--brand);display:grid;place-items:center;flex:none}
.mg .plate{display:inline-block;font-weight:600;font-size:11px;letter-spacing:.06em;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:1px 6px;margin-bottom:3px}
.mg .veh-model{font-weight:700;font-size:15px}
.mg .swap{margin-left:auto;font-size:12px;font-weight:700;color:var(--brand);display:inline-flex;align-items:center;gap:5px}
.mg .status-row{display:flex;gap:9px;margin-top:13px}
.mg .status{flex:1;border-radius:12px;padding:10px 11px;display:flex;align-items:center;gap:9px}
.mg .status.ok{background:var(--good-soft)}
.mg .status.warn{background:var(--gain-soft)}
.mg .status .lab{font-size:11px;color:var(--muted);line-height:1.15}
.mg .status .big{font-weight:700;font-size:13px;margin-top:1px}
.mg .sd{width:9px;height:9px;border-radius:50%;flex:none}
.mg .grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.mg .tile{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:10px;min-height:112px}
.mg .tile-ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex:none}
.mg .tile .name{font-weight:700;font-size:14px}
.mg .tile .meta{font-size:12px;color:var(--muted);margin-top:1px}
.mg .tag{align-self:flex-start;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 7px;border-radius:6px}
.mg .tag.ok{background:var(--good-soft);color:var(--good)}
.mg .tag.due{background:var(--gain-soft);color:var(--warn)}
.mg .tag.new{background:var(--brand-soft);color:var(--brand)}
.mg .ic-brand{background:var(--brand-soft);color:var(--brand)}
.mg .ic-gain{background:var(--gain-soft);color:var(--warn)}
.mg .ic-good{background:var(--good-soft);color:var(--good)}
.mg .copilot{border-radius:20px;padding:17px;display:flex;align-items:center;gap:14px;background:linear-gradient(120deg,#0E2A22,#123c30);color:#EAF7EF;border:1px solid #1c4636}
.mg .copilot .av{width:46px;height:46px;border-radius:14px;background:var(--wa);color:#062e17;display:grid;place-items:center;flex:none;box-shadow:0 6px 16px rgba(31,168,85,.4)}
.mg .copilot .t{font-weight:800;font-size:15px}
.mg .copilot .s{font-size:12.5px;color:#A9CBBB;margin-top:2px;line-height:1.3}
.mg .copilot .go{margin-left:auto;flex:none;width:40px;height:40px;border-radius:12px;background:var(--wa);color:#062e17;display:grid;place-items:center}
.mg .offer{display:flex;align-items:center;gap:12px;padding:13px 14px}
.mg .offer+.offer{border-top:1px solid var(--line)}
.mg .offer-ico{width:40px;height:40px;border-radius:11px;background:var(--card-2);color:var(--brand);display:grid;place-items:center;flex:none}
.mg .offer .t{font-weight:600;font-size:14px}
.mg .offer .s{font-size:12px;color:var(--muted);margin-top:1px}
.mg .offer .cta{margin-left:auto;font-size:12px;font-weight:700;color:var(--brand);border:1px solid var(--line);border-radius:10px;padding:7px 12px;flex:none}
.mg .foot-note{text-align:center;font-size:11px;color:var(--faint);padding:6px 20px 0;line-height:1.5}
.mg .tabs{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-template-columns:repeat(4,1fr);background:color-mix(in srgb,var(--card) 92%,transparent);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px));max-width:460px;margin:0 auto}
.mg .tab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:var(--faint)}
.mg .tab.on{color:var(--brand)}
`;
