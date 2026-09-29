import { useEffect, useMemo, useState } from "react";
import { Loader2, Disc3, CheckCircle2, Clock, Sparkles, Gift, Ticket } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Roleta Totex — cada giro é destravado por uma missão. O sorteio acontece no servidor (edge `roleta`);
// aqui só animamos até a fatia sorteada. Padrão Minha Garagem.
interface Missao { id: string; titulo: string; como: string; auto: boolean; status: string }
interface Giro { id: string; missao: string; status: string; premio: string | null; codigo: string | null }
interface Estado { ativo: boolean; loja?: string; fatias?: { rotulo: string; cor: string | null }[]; missoes?: Missao[]; disponiveis?: Giro[]; premios?: Giro[] }

const CORES = ["#1436C7", "#F5B301", "#38B6E8", "#1B9E4B", "#E4572E", "#7B2FBE", "#0A1B5C", "#C7332B"];

export default function Roleta() {
  const [st, setSt] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);
  const [girando, setGirando] = useState(false);
  const [rotacao, setRotacao] = useState(0);
  const [resultado, setResultado] = useState<{ premio: string; codigo: string } | null>(null);

  const carregar = async () => {
    try { const { data } = await supabase.functions.invoke("roleta", { body: { action: "estado" } }); setSt(data || { ativo: false }); }
    catch { setSt({ ativo: false }); }
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const fatias = st?.fatias || [];
  const n = Math.max(fatias.length, 1);
  const grad = useMemo(() => {
    if (!fatias.length) return "conic-gradient(#D9E0F2 0 360deg)";
    const passo = 360 / n;
    return `conic-gradient(${fatias.map((f, i) => `${f.cor || CORES[i % CORES.length]} ${i * passo}deg ${(i + 1) * passo}deg`).join(",")})`;
  }, [fatias, n]);

  const girar = async () => {
    const giro = st?.disponiveis?.[0];
    if (!giro || girando) return;
    setGirando(true); setResultado(null);
    try {
      const { data } = await supabase.functions.invoke("roleta", { body: { action: "girar", giro_id: giro.id } });
      if (!data?.ok) throw new Error(data?.error || "erro");
      const idx = Math.max(0, fatias.findIndex((f) => f.rotulo === data.premio));
      const passo = 360 / n;
      const centro = idx * passo + passo / 2;
      const voltas = 5 * 360;
      setRotacao((r) => r + voltas + ((360 - centro) - (r % 360) + 360) % 360);
      setTimeout(() => { setResultado({ premio: data.premio, codigo: data.codigo }); setGirando(false); carregar(); }, 4200);
    } catch (e: any) {
      setGirando(false);
      toast({ title: "Não foi possível girar", description: String(e?.message || e), variant: "destructive" });
    }
  };

  if (loading) return <MgShell title="Roleta Totex" back="/"><div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand)" }} /></div></MgShell>;

  if (!st?.ativo) {
    return (
      <MgShell title="Roleta Totex" back="/">
        <div className="stack" style={{ textAlign: "center", padding: "40px 8px" }}>
          <Disc3 size={52} style={{ color: "var(--faint)", margin: "0 auto" }} />
          <div style={{ fontWeight: 800, fontSize: 18 }}>Roleta Totex</div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
            A Roleta de prêmios é um <b style={{ color: "var(--ink)" }}>benefício das lojas parceiras</b>.{st?.loja ? " A sua loja ainda não ativou a roleta — fique de olho!" : " Ela aparece aqui quando a sua loja ativar."}
          </p>
        </div>
      </MgShell>
    );
  }

  const disponiveis = st.disponiveis || [];
  const missoes = st.missoes || [];
  const premios = st.premios || [];
  const passo = 360 / n;

  return (
    <MgShell title={`Roleta ${st.loja || ""}`.trim()} back="/">
      <div className="stack">
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 2px" }}>Cumpra missões, ganhe giros, leve prêmios de verdade da sua loja. 🎁</p>

        {/* roleta */}
        <section className="card pad" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative", width: 280, height: 280 }}>
            <div style={{ position: "absolute", left: "50%", top: -2, transform: "translateX(-50%)", zIndex: 10, width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: "24px solid var(--gain)" }} />
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "8px solid var(--card)", boxShadow: "var(--shadow)", position: "relative", background: grad, transform: `rotate(${rotacao}deg)`, transition: girando ? "transform 4s cubic-bezier(.15,.9,.25,1)" : undefined }}>
              {fatias.map((f, i) => {
                const ang = ((i * passo + passo / 2 - 90) % 360 + 360) % 360;
                const flip = ang > 90 && ang < 270;
                return (
                  <span key={i} style={{
                    position: "absolute", left: "50%", top: "50%", fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1.15, textAlign: "center",
                    transform: flip ? `rotate(${ang + 180}deg) translate(-126px, -50%)` : `rotate(${ang}deg) translate(42px, -50%)`,
                    transformOrigin: "0 50%", width: 84, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word",
                  }}>{f.rotulo}</span>
                );
              })}
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 54, height: 54, borderRadius: "50%", background: "var(--card)", boxShadow: "var(--shadow)", display: "grid", placeItems: "center", fontSize: 20 }}>🎡</div>
            </div>
          </div>

          <button className="btn-primary" style={{ marginTop: 22, width: "auto", padding: "0 32px" }} disabled={!disponiveis.length || girando} onClick={girar}>
            {girando ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {girando ? "Girando…" : disponiveis.length ? `GIRAR (${disponiveis.length} giro${disponiveis.length > 1 ? "s" : ""})` : "Complete uma missão"}
          </button>

          {resultado && (
            <div style={{ marginTop: 18, width: "100%", maxWidth: 340, borderRadius: 14, border: "2px solid var(--gain)", background: "var(--gain-soft)", padding: 16, textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>🎉 Você ganhou: {resultado.premio}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Código de resgate — apresente na loja:</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, letterSpacing: ".08em", color: "var(--brand)" }}>{resultado.codigo}</div>
            </div>
          )}
        </section>

        {/* missões */}
        <section className="card pad">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Missões para ganhar giros</div>
          <div>
            {missoes.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "12px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{m.titulo}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{m.como}</div></div>
                {m.status === "conquistada"
                  ? <span className="tag ok" style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={11} /> Conquistado</span>
                  : <span className="tag mut" style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {m.auto ? "Em andamento" : "Peça à loja"}</span>}
              </div>
            ))}
            {!missoes.length && <p style={{ fontSize: 13, color: "var(--muted)", paddingTop: 8 }}>A loja ainda não ativou missões.</p>}
          </div>
        </section>

        {/* prêmios */}
        {!!premios.length && (
          <section className="card pad">
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><Gift size={16} style={{ color: "var(--brand)" }} /> Meus prêmios</div>
            <div>
              {premios.map((g, i) => (
                <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{g.premio}</div><div style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}><Ticket size={11} /> Código: <b>{g.codigo}</b></div></div>
                  {g.status === "entregue" ? <span className="tag ok" style={{ flex: "none" }}>Resgatado ✅</span> : <span className="tag due" style={{ flex: "none" }}>Apresente na loja</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </MgShell>
  );
}
