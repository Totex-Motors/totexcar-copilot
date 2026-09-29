import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon } from "lucide-react";

// Casca dos PAINÉIS de gestão (Admin/Lojista) no visual Minha Garagem, porém em LARGURA DE DESKTOP
// (as tabelas precisam de espaço). Em vez de reescrever cada painel, retematizamos o escopo: as
// variáveis de cor que o shadcn consome (--primary, --background, --card, --border...) passam a
// apontar pra paleta MG. Assim Cards, Tabs, Botões, Inputs e tabelas adotam o novo visual sozinhos.
export function MgPanelShell({ title, subtitle, children, right, home = true }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
  home?: boolean;   // mostra o atalho "← App" (default true); false para painéis sem app do dono
}) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return (localStorage.getItem("mg_theme") as "light" | "dark") || "light"; } catch { return "light"; }
  });
  useEffect(() => { try { localStorage.setItem("mg_theme", theme); } catch { /* */ } }, [theme]);

  return (
    <div className="mgpanel" data-theme={theme}>
      <style>{PANEL_CSS}</style>
      <header className="mgp-bar">
        <div className="mgp-bar-in">
          <Link to="/" className="mgp-brand"><img src="/totexmotors-logo.png" alt="TotexMotors" /></Link>
          <div className="mgp-title-wrap">
            <div className="mgp-title">{title}</div>
            {subtitle && <div className="mgp-sub">{subtitle}</div>}
          </div>
          <div className="mgp-actions">
            {right}
            <button className="mgp-icon" aria-label="Alternar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {home && <Link to="/" className="mgp-back">← App</Link>}
          </div>
        </div>
      </header>
      <main className="mgp-main">{children}</main>
    </div>
  );
}

// Redefine as variáveis do tema (formato HSL "H S% L%", como o shadcn espera) para a paleta MG.
const PANEL_CSS = `
.mgpanel{
  --background:150 14% 94%; --foreground:168 26% 10%;
  --card:0 0% 100%; --card-foreground:168 26% 10%;
  --popover:0 0% 100%; --popover-foreground:168 26% 10%;
  --primary:178 80% 24%; --primary-foreground:0 0% 100%;
  --primary-muted:174 40% 88%; --primary-glow:176 60% 40%;
  --secondary:150 20% 96%; --secondary-foreground:168 26% 10%;
  --muted:150 20% 96%; --muted-foreground:165 8% 40%;
  --accent:174 40% 92%; --accent-foreground:178 80% 20%;
  --destructive:6 64% 46%; --destructive-foreground:0 0% 100%;
  --success:146 63% 33%; --warning:28 74% 42%;
  --border:156 14% 89%; --input:156 14% 89%; --ring:178 80% 24%;
  --radius:1rem;
  background:hsl(var(--background)); color:hsl(var(--foreground));
  min-height:100vh; font-family:"IBM Plex Sans",system-ui,sans-serif; -webkit-font-smoothing:antialiased;
}
.mgpanel[data-theme="dark"]{
  --background:168 20% 6%; --foreground:156 20% 93%;
  --card:162 20% 10%; --card-foreground:156 20% 93%;
  --popover:162 20% 10%; --popover-foreground:156 20% 93%;
  --primary:176 50% 43%; --primary-foreground:168 30% 6%;
  --primary-muted:168 30% 18%; --primary-glow:176 50% 43%;
  --secondary:168 22% 12%; --secondary-foreground:156 20% 93%;
  --muted:168 22% 12%; --muted-foreground:162 10% 66%;
  --accent:168 30% 16%; --accent-foreground:156 20% 93%;
  --destructive:6 60% 52%; --destructive-foreground:0 0% 100%;
  --success:146 45% 46%; --warning:28 68% 55%;
  --border:150 18% 16%; --input:150 18% 16%; --ring:176 50% 43%;
  color-scheme:dark;
}
.mgpanel .mgp-bar{position:sticky;top:0;z-index:30;background:color-mix(in srgb, hsl(var(--background)) 88%, transparent);backdrop-filter:blur(8px);border-bottom:1px solid hsl(var(--border))}
.mgpanel .mgp-bar-in{max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:14px;padding:11px 20px}
.mgpanel .mgp-brand img{height:36px;width:auto;display:block}
.mgpanel .mgp-title-wrap{min-width:0}
.mgpanel .mgp-title{font-weight:800;font-size:18px;letter-spacing:-.01em;line-height:1.1}
.mgpanel .mgp-sub{font-size:12px;color:hsl(var(--muted-foreground));margin-top:1px}
.mgpanel .mgp-actions{margin-left:auto;display:flex;align-items:center;gap:10px}
.mgpanel .mgp-icon{width:38px;height:38px;border-radius:12px;background:hsl(var(--card));border:1px solid hsl(var(--border));display:grid;place-items:center;color:hsl(var(--foreground));cursor:pointer;flex:none}
.mgpanel .mgp-back{font-size:13px;font-weight:700;color:hsl(var(--primary));text-decoration:none;white-space:nowrap}
.mgpanel .mgp-main{max-width:1180px;margin:0 auto;padding:22px 20px 60px}
`;
