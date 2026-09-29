import { useEffect, useState } from "react";
import { Award, Fuel, Gauge, TrendingUp, ShieldCheck, Loader2, Banknote, Flame, HelpCircle, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MgShell } from "@/components/mg/MgShell";
import { supabase } from "@/integrations/supabase/client";

// Selo Totex — "seu histórico vale dinheiro". Exclusivo de clientes de loja parceira aderida.
type Statement = {
  ok: boolean; elegivel: boolean; loja: string | null;
  score: number; tier: string; meses_ativos: number; delta_mes: number;
  faixa_garantida: { min_pct: number; max_pct: number | null } | null;
  proximo_selo: { tier: string; faltam_pontos: number; faltam_meses: number; fipe_min_pct: number } | null;
  programa?: { teto_pct: number; troca12m_pct: number; niveis: { tier: string; pontos: number; meses: number; fipe_min_pct: number; fipe_max_pct?: number }[] };
  troca12m_ate: string | null;
  ultimos_eventos: { o_que: string; pontos: number; data: string }[];
};

const TIER_META: Record<string, { label: string; emoji: string; grad: string }> = {
  ouro: { label: "Ouro", emoji: "🥇", grad: "linear-gradient(120deg,#F0B429,#C9781E)" },
  prata: { label: "Prata", emoji: "🥈", grad: "linear-gradient(120deg,#B8C2CC,#8A9994)" },
  bronze: { label: "Bronze", emoji: "🥉", grad: "linear-gradient(120deg,#E0954A,#B8621A)" },
  none: { label: "Em construção", emoji: "🔧", grad: "linear-gradient(120deg,#12857F,#0A5350)" },
};

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="faq">
      <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontSize: 13.5, fontWeight: 700, padding: "12px 0", listStyle: "none" }}>
        {q} <ChevronDown size={16} style={{ color: "var(--faint)", flex: "none" }} />
      </summary>
      <div style={{ fontSize: 12.5, color: "var(--muted)", paddingBottom: 12, display: "flex", flexDirection: "column", gap: 6, lineHeight: 1.5 }}>{children}</div>
    </details>
  );
}

export default function Selo() {
  const [st, setSt] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try { const { data } = await supabase.functions.invoke("care-score", { body: {} }); setSt(data || null); }
      catch { setSt(null); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <MgShell title="Selo Totex" back="/"><div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand)" }} /></div></MgShell>;

  if (!st?.elegivel) {
    return (
      <MgShell title="Selo Totex" back="/">
        <div className="stack" style={{ textAlign: "center", padding: "40px 8px" }}>
          <Award size={52} style={{ color: "var(--faint)", margin: "0 auto" }} />
          <div style={{ fontWeight: 800, fontSize: 18 }}>Selo Totex</div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
            O Selo Totex é um <b style={{ color: "var(--ink)" }}>benefício exclusivo</b> para quem comprou o carro em uma loja parceira do ecossistema Totexmotors. Seus registros continuam valorizando o histórico do seu carro normalmente.
          </p>
        </div>
      </MgShell>
    );
  }

  const tier = TIER_META[st.tier] || TIER_META.none;
  const pct = Math.min(100, Math.round((st.score / 850) * 100));

  return (
    <MgShell title="Selo Totex" back="/">
      <style>{`.mg .faq{border-top:1px solid var(--line)}.mg .faq summary::-webkit-details-marker{display:none}.mg .faq[open] summary svg{transform:rotate(180deg)}`}</style>
      <div className="stack">
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 2px", lineHeight: 1.4 }}>
          Seu histórico vale dinheiro: cada cupom, foto de hodômetro e revisão aumenta a garantia de recompra do seu carro na <b style={{ color: "var(--ink)" }}>{st.loja}</b> — que pode chegar a <b style={{ color: "var(--brand)" }}>até {st.programa?.teto_pct ?? 90}% da FIPE</b>.
        </p>

        {/* selo atual */}
        <section className="card" style={{ overflow: "hidden" }}>
          <div style={{ background: tier.grad, padding: 18, color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div style={{ fontSize: 11, fontWeight: 700, opacity: .9, textTransform: "uppercase", letterSpacing: ".06em" }}>Seu selo</div><div style={{ fontSize: 28, fontWeight: 800 }}>{tier.emoji} {tier.label}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, opacity: .9 }}>Score de Cuidado</div><div className="mono" style={{ fontSize: 28, fontWeight: 800 }}>{st.score}</div><div style={{ fontSize: 10.5, opacity: .9 }}>{st.meses_ativos} {st.meses_ativos === 1 ? "mês ativo" : "meses ativos"}{st.delta_mes ? ` · ${st.delta_mes > 0 ? "+" : ""}${st.delta_mes} este mês` : ""}</div></div>
            </div>
            <div style={{ marginTop: 14, height: 8, borderRadius: 999, background: "rgba(255,255,255,.25)", overflow: "hidden" }}><div style={{ height: "100%", background: "rgba(255,255,255,.9)", borderRadius: 999, width: `${pct}%` }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 4, opacity: .9 }}><span>Bronze 300</span><span>Prata 600</span><span>Ouro 850</span></div>
          </div>
          <div style={{ padding: 15 }}>
            {st.faixa_garantida ? (
              <div style={{ display: "flex", gap: 12 }}>
                <span className="alert-ico" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Banknote size={20} /></span>
                <div><div style={{ fontWeight: 700, fontSize: 14 }}>Garantia mínima de {st.faixa_garantida.min_pct}% da FIPE na recompra{st.faixa_garantida.max_pct ? ` (até ${st.faixa_garantida.max_pct}%)` : ""}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Válida na {st.loja}, confirmada na vistoria.{st.troca12m_ate ? ` Bônus: trocando até ${new Date(st.troca12m_ate + "T12:00:00").toLocaleDateString("pt-BR")}, garante o teto de 90%.` : ""}</div></div>
              </div>
            ) : st.proximo_selo ? (
              <div style={{ display: "flex", gap: 12 }}>
                <span className="alert-ico"><TrendingUp size={20} /></span>
                <div><div style={{ fontWeight: 700, fontSize: 14 }}>Faltam {st.proximo_selo.faltam_pontos} pontos {st.proximo_selo.faltam_meses > 0 ? `e ${st.proximo_selo.faltam_meses} meses ` : ""}para o Selo {TIER_META[st.proximo_selo.tier]?.label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Ele garante o mínimo de {st.proximo_selo.fipe_min_pct}% da FIPE na troca.</div></div>
              </div>
            ) : null}
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => navigate("/recompra")}><Banknote size={16} /> Avaliar meu carro agora</button>
          </div>
        </section>

        {/* níveis */}
        <section className="card pad">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Os 3 níveis do Selo</div>
          <div className="stack" style={{ gap: 8 }}>
            {(st.programa?.niveis || []).map((n) => {
              const atual = n.tier === st.tier; const m = TIER_META[n.tier];
              return (
                <div key={n.tier} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderRadius: 12, border: `1px solid ${atual ? "var(--brand)" : "var(--line)"}`, background: atual ? "var(--brand-soft)" : "transparent", padding: 12 }}>
                  <div style={{ display: "flex", gap: 10, minWidth: 0, alignItems: "center" }}>
                    <span style={{ fontSize: 22 }}>{m?.emoji}</span>
                    <div><div style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>Selo {m?.label}{atual && <span className="tag new">seu nível</span>}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{n.pontos} pontos + {n.meses} meses ativos</div></div>
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}><div style={{ fontWeight: 800, color: "var(--brand)", fontSize: 13 }}>mín. {n.fipe_min_pct}%{n.fipe_max_pct ? ` — até ${n.fipe_max_pct}%` : ""}</div><div style={{ fontSize: 10, color: "var(--muted)" }}>da FIPE na troca</div></div>
                </div>
              );
            })}
            <p style={{ fontSize: 11.5, color: "var(--muted)", paddingTop: 2 }}>🥇 Ouro tem o <b>Bônus Troca em 12 meses</b>: trocando em até 1 ano, a garantia vai ao teto de <b>{st.programa?.troca12m_pct ?? 90}% da FIPE</b>.</p>
          </div>
        </section>

        {/* como pontuar */}
        <section className="card pad">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Como ganhar pontos</div>
          <div className="stack" style={{ gap: 10, fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Fuel size={16} style={{ color: "var(--brand)" }} /> Abastecimento com cupom + hodômetro <span className="tag ok">+10</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Gauge size={16} style={{ color: "var(--brand)" }} /> Hodômetro atualizado no mês <span className="tag ok">+10</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Flame size={16} style={{ color: "var(--brand)" }} /> 3 meses seguidos registrando <span className="tag ok">+50</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={16} style={{ color: "var(--brand)" }} /> Tudo pelo WhatsApp — foto do cupom e pronto</div>
          </div>
        </section>

        {/* extrato */}
        <section className="card pad">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Últimos pontos</div>
          {st.ultimos_eventos?.length ? (
            <div className="stack" style={{ gap: 8 }}>
              {st.ultimos_eventos.map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, borderBottom: i < st.ultimos_eventos.length - 1 ? "1px solid var(--line)" : "none", paddingBottom: 8 }}>
                  <span>{e.o_que}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(e.data + "T12:00:00").toLocaleDateString("pt-BR")}</span><span className={`tag ${e.pontos >= 0 ? "ok" : "due"}`}>{e.pontos > 0 ? `+${e.pontos}` : e.pontos}</span></span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum ponto ainda — registre o próximo abastecimento no WhatsApp (foto do cupom + hodômetro) e comece a construir o valor do seu carro.</p>
          )}
        </section>

        {/* regras */}
        <section className="card pad">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><HelpCircle size={16} style={{ color: "var(--brand)" }} /> Como funciona e as regras</div>
          <Faq q="Como os pontos funcionam">
            <p>• Abastecimento com <b>foto do cupom + hodômetro</b> vale +10 (só um, +5). Limite de 40 pts/mês.</p>
            <p>• Conta <b>1 abastecimento a cada 48h</b> (motorista de app: 24h).</p>
            <p>• <b>Hodômetro atualizado</b> vale +10, 1x por mês.</p>
            <p>• <b>Constância paga</b>: 3 meses seguidos com 4+ registros = +50.</p>
            <p>• Cupom com mais de <b>7 dias</b> vale metade (registre no dia!).</p>
          </Faq>
          <Faq q="O Selo é um compromisso vivo">
            <p>• Cada selo exige <b>meses de histórico ativo</b>: Bronze 3, Prata 6, Ouro 12.</p>
            <p>• <b>90 dias sem registrar</b> (45 p/ motorista de app) faz o score decair até o piso do selo atual.</p>
            <p>• Registro é pelo WhatsApp: foto do cupom e do hodômetro.</p>
          </Faq>
          <Faq q="A garantia na recompra">
            <p>• O selo garante o <b>MÍNIMO da faixa</b> (Bronze 82% · Prata 85% · Ouro 87%) na loja parceira — até <b>90% da FIPE</b>.</p>
            <p>• Condicionada à <b>vistoria presencial</b>. Divergência material (km adulterado, dano estrutural, leilão) anula.</p>
            <p>• A <b>oferta final é sempre da loja</b> — o programa define o piso.</p>
          </Faq>
          <Faq q="Quem participa">
            <p>• <b>Exclusivo de clientes que compraram numa loja parceira</b> aderida ao Selo.</p>
            <p>• Seus registros são seus: mesmo fora do programa, o histórico segue valendo na revenda.</p>
          </Faq>
        </section>

        <p className="foot-note">A garantia do Selo é o mínimo da faixa, confirmada na vistoria presencial. A oferta final é sempre da loja. Teto do programa: 90% da FIPE.</p>
      </div>
    </MgShell>
  );
}
