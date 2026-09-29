import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Sun, Moon, User, ChevronLeft, Home as HomeIcon, Car, IdCard, Wrench } from "lucide-react";

// Moldura do "app de carro" (Minha Garagem) — barra superior + abas inferiores + tema claro/escuro.
// Toda tela da versão grátis vive dentro dela, pra ficar tudo consistente (padrão do protótipo).
export type MgTab = "inicio" | "veiculo" | "cnh" | "servicos" | null;

const TABS: { key: MgTab; to: string; label: string; icon: typeof HomeIcon }[] = [
  { key: "inicio", to: "/", label: "Início", icon: HomeIcon },
  { key: "veiculo", to: "/settings", label: "Veículo", icon: Car },
  { key: "cnh", to: "/settings", label: "CNH", icon: IdCard },
  { key: "servicos", to: "/servicos", label: "Serviços", icon: Wrench },
];

export function MgShell({ children, tab = null, title, back }: {
  children: ReactNode;
  tab?: MgTab;
  title?: string;   // quando setado, a barra vira "voltar + título" (telas internas)
  back?: string;    // rota do voltar (default: history back)
}) {
  const nav = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return (localStorage.getItem("mg_theme") as "light" | "dark") || "light"; } catch { return "light"; }
  });
  useEffect(() => { try { localStorage.setItem("mg_theme", theme); } catch { /* */ } }, [theme]);
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <div className="mg" data-theme={theme}>
      <style>{MG_CSS}</style>
      <div className="phone">
        <header className="bar">
          {title ? (
            <button className="icon-btn" aria-label="Voltar" onClick={() => (back ? nav(back) : nav(-1))}><ChevronLeft size={19} /></button>
          ) : (
            <img className="brand-logo" src="/totexmotors-logo.png" alt="TotexMotors" />
          )}
          {title && <div className="bar-title">{title}</div>}
          <div className="bar-actions">
            {!title && <button className="icon-btn" aria-label="Avisos" onClick={() => nav("/multas")}><span className="dot" /><Bell size={19} /></button>}
            <button className="icon-btn" aria-label="Alternar tema" onClick={toggle}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button>
            {!title && <button className="icon-btn" aria-label="Perfil" onClick={() => nav("/settings")}><User size={19} /></button>}
          </div>
        </header>
        {children}
      </div>

      <nav className="tabs" aria-label="Navegação">
        {TABS.map((t) => {
          const Ic = t.icon;
          return (
            <Link key={t.label} to={t.to} className={`tab ${tab === t.key ? "on" : ""}`}>
              <Ic size={21} />{t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export const MG_CSS = `
.mg{--ground:#EEF2F0;--card:#FFFFFF;--card-2:#F5F8F6;--ink:#13211E;--muted:#5D6E69;--faint:#8A9994;--line:#E1E8E5;--brand:#0C6E6A;--brand-deep:#0A5350;--brand-soft:#DCEDEB;--gain:#C9781E;--gain-soft:#F6E7D3;--good:#1F8A54;--good-soft:#DDEFE4;--warn:#B8621A;--alert:#C0392B;--alert-soft:#F7E0DC;--wa:#1FA855;--shadow:0 1px 2px rgba(19,33,30,.06),0 8px 24px rgba(19,33,30,.06);--radius:18px;color-scheme:light;background:var(--ground);color:var(--ink);min-height:100vh;font-family:"IBM Plex Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.mg[data-theme="dark"]{--ground:#0C1211;--card:#14201D;--card-2:#101A18;--ink:#EAF1EE;--muted:#9FB0AB;--faint:#75857F;--line:#223029;--brand:#38A69F;--brand-deep:#2C8580;--brand-soft:#16302D;--gain:#E0954A;--gain-soft:#33261A;--good:#45B67E;--good-soft:#16281F;--warn:#E0954A;--alert:#E06455;--alert-soft:#2E1B18;--wa:#35C36C;--shadow:0 1px 2px rgba(0,0,0,.3),0 10px 26px rgba(0,0,0,.35);color-scheme:dark}
.mg *{box-sizing:border-box}
.mg a{text-decoration:none;color:inherit}
.mg .phone{max-width:460px;margin:0 auto;padding:0 16px 100px;min-height:100vh}
.mg .mono{font-variant-numeric:tabular-nums}
.mg .bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;padding:12px 16px 10px;margin:0 -16px 6px;background:color-mix(in srgb,var(--ground) 90%,transparent);backdrop-filter:blur(8px)}
.mg .brand-logo{height:40px;width:auto;display:block}
.mg .bar-title{font-weight:800;font-size:18px;letter-spacing:-.01em}
.mg .bar-actions{display:flex;align-items:center;gap:10px;margin-left:auto}
.mg .icon-btn{width:38px;height:38px;border-radius:12px;background:var(--card);border:1px solid var(--line);display:grid;place-items:center;color:var(--ink);position:relative;box-shadow:var(--shadow);cursor:pointer;flex:none}
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
.mg .list-row{display:flex;align-items:center;gap:12px;padding:14px 15px}
.mg .list-row+.list-row{border-top:1px solid var(--line)}
.mg .list-row .t{font-weight:700;font-size:14px}
.mg .list-row .s{font-size:12px;color:var(--muted);margin-top:1px}
.mg .sec-title{font-size:13px;font-weight:800;letter-spacing:.02em;margin:6px 2px 2px}
.mg .foot-note{text-align:center;font-size:11px;color:var(--faint);padding:6px 20px 0;line-height:1.5}
.mg .btn-primary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:48px;border-radius:14px;background:var(--brand);color:#fff;font-weight:700;font-size:15px;border:none;cursor:pointer;box-shadow:0 6px 16px rgba(10,83,80,.25)}
.mg .tabs{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-template-columns:repeat(4,1fr);background:color-mix(in srgb,var(--card) 92%,transparent);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px));max-width:460px;margin:0 auto}
.mg .tab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:var(--faint)}
.mg .tab.on{color:var(--brand)}
`;
