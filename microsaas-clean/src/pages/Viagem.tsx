import { useEffect, useState } from "react";
import {
  Plane, Loader2, Fuel, Wrench, RotateCcw, MessageCircle, Gauge, Route, Clock,
  Coins, Ship, MapPin, Hotel, UtensilsCrossed, CheckCircle2, Sparkles, Globe,
} from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const WA = "5511963786699";
const PERFIS = [
  ["familia", "Família"],
  ["casal", "Casal"],
  ["amigos", "Amigos"],
  ["sozinho", "Sozinho(a)"],
  ["pet", "Com pet"],
  ["carro_novo", "Primeira viagem com o carro novo"],
];

const FAIXA_LABEL: Record<string, { label: string; color: string; soft: string }> = {
  economica: { label: "Econômica", color: "var(--good)", soft: "var(--good-soft)" },
  intermediaria: { label: "Intermediária", color: "#2f80ed", soft: "rgba(47,128,237,.14)" },
  charme: { label: "Charme", color: "#8A4FBE", soft: "rgba(138,79,190,.16)" },
};

const brl = (v: number | null | undefined) =>
  v == null ? null : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface DadosCarro {
  carro: string | null;
  consumo_km_por_litro: number | null;
  fonte_consumo: string | null;
  custo_por_km: number | null;
  preco_medio_litro: number | null;
  manutencoes_pendentes: { item: string; faltam_km: number }[];
  loja: string | null;
}

interface Plano {
  titulo?: string;
  resumo?: string;
  rota?: { descricao?: string; distancia_km_ida?: number; tempo_ida?: string; condicoes?: string | null };
  combustivel?: { conta?: string; total_ida_volta?: number | null };
  pedagios?: { itens?: { praca: string; valor: number | null }[]; total_ida_volta?: number | null; obs?: string | null };
  balsa?: { descricao?: string; preco_carro?: number | null; dica?: string } | null;
  roteiro?: { titulo: string; descricao?: string }[];
  hospedagem?: { faixa?: string; nome: string; regiao?: string; motivo?: string; diaria?: number | null }[];
  comida?: { nome: string; especialidade?: string }[];
  passeios?: string[];
  antes_de_viajar?: string[];
  checklist?: string[];
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="card pad">
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <Icon size={16} style={{ color: "var(--brand)" }} /> {title}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="box" style={highlight ? { background: "var(--brand)", borderColor: "transparent", color: "#fff" } : undefined}>
      <div className="l" style={{ display: "flex", alignItems: "center", gap: 5, color: highlight ? "rgba(255,255,255,.8)" : undefined }}><Icon size={12} /> {label}</div>
      <div className="v mono" style={{ fontSize: 17, color: highlight ? "#fff" : undefined }}>{value}</div>
    </div>
  );
}

// TELA MODO VIAGEM — planeja a road trip com os dados REAIS do carro (consumo/custo por km) +
// pesquisa ao vivo de pedágio/balsa/hospedagem. Mesma função "viagem"; reskin no padrão Minha Garagem.
export default function Viagem() {
  const [form, setForm] = useState({ destino: "", origem: "", dias: "", perfil: "" });
  const [loading, setLoading] = useState(false);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [planoTexto, setPlanoTexto] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosCarro | null>(null);
  const [pesquisaWeb, setPesquisaWeb] = useState(false);
  const [planoSalvo, setPlanoSalvo] = useState<{ quando: string; origem_pedido: string } | null>(null);

  // último plano salvo (gerado aqui OU no WhatsApp) abre direto em cards, sem recalcular
  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any).from("viagem_planos")
          .select("plano, dados, created_at, origem_pedido")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data?.plano) {
          setPlano(data.plano);
          setDados(data.dados || null);
          setPlanoSalvo({ quando: data.created_at, origem_pedido: data.origem_pedido || "app" });
        }
      } catch { /* sem plano salvo */ }
    })();
  }, []);

  const montar = async () => {
    setLoading(true);
    setPlano(null);
    setPlanoTexto(null);
    try {
      const { data, error } = await supabase.functions.invoke("viagem", {
        body: {
          destino: form.destino || undefined,
          origem: form.origem || undefined,
          dias: Number(form.dias) > 0 ? Number(form.dias) : undefined,
          perfil: form.perfil || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPlano(data.plano || null);
      setPlanoTexto(data.plano_texto || null);
      setDados(data.dados || null);
      setPesquisaWeb(!!data.pesquisa_web);
    } catch (e: any) {
      toast({ title: "Não consegui montar o plano", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const temResultado = plano || planoTexto;
  const hospedagemOrdenada = [...(plano?.hospedagem || [])].sort((a, b) => {
    const ordem = ["economica", "intermediaria", "charme"];
    return ordem.indexOf(String(a.faixa)) - ordem.indexOf(String(b.faixa));
  });

  return (
    <MgShell title="Modo Viagem" back="/">
      <div className="stack">
        {!temResultado && (
          <>
            <section className="card pad">
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Pra onde vamos?</div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.4 }}>
                Planejo com os dados <b>reais do seu carro</b> e pesquiso pedágio, balsa e hospedagem ao vivo. Nenhum app de viagem conhece seu carro — o Co-pilot conhece. 🚗
              </p>
              <div className="formgrid">
                <div><label className="lbl">Destino</label><input className="field" value={form.destino} onChange={(e) => setForm((p) => ({ ...p, destino: e.target.value }))} placeholder="Ubatuba, Gramado…" /></div>
                <div><label className="lbl">Saindo de</label><input className="field" value={form.origem} onChange={(e) => setForm((p) => ({ ...p, origem: e.target.value }))} placeholder="São Paulo" /></div>
                <div><label className="lbl">Quantos dias?</label><input className="field" type="number" inputMode="numeric" min={1} value={form.dias} onChange={(e) => setForm((p) => ({ ...p, dias: e.target.value }))} placeholder="3" /></div>
                <div><label className="lbl">Perfil</label>
                  <select className="field" value={form.perfil} onChange={(e) => setForm((p) => ({ ...p, perfil: e.target.value }))}>
                    <option value="">Opcional</option>
                    {PERFIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={montar} disabled={loading} className="btn-primary" style={{ marginTop: 16 }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Plane size={16} />}
                {loading ? "Pesquisando rota e lugares…" : "Montar meu plano de viagem"}
              </button>
              {loading && (
                <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Globe size={13} className="animate-pulse" /> Buscando valores atuais na web — leva ~30s, vale a pena. 😉
                </p>
              )}
            </section>
            <div className="card list-row" style={{ opacity: .95 }}>
              <span className="offer-ico"><Plane size={19} /></span>
              <div style={{ flex: 1 }}><div className="t">Deixa vazio que eu sugiro</div><div className="s">Sem destino? Eu escolho um bom pra você.</div></div>
            </div>
          </>
        )}

        {temResultado && (
          <>
            {planoSalvo && (
              <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 13px" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  📌 Seu último plano{planoSalvo.origem_pedido === "whatsapp" ? ", feito no WhatsApp" : ""} em {new Date(planoSalvo.quando).toLocaleDateString("pt-BR")}.
                </span>
                <button className="sbtn" style={{ flex: "none" }} onClick={() => { setPlano(null); setPlanoTexto(null); setPlanoSalvo(null); }}><RotateCcw size={13} /> Outro</button>
              </div>
            )}

            {/* Cabeçalho do plano */}
            <section className="hero">
              <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={13} /> Seu plano{pesquisaWeb ? " · valores de agora" : ""}</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 0", letterSpacing: "-.01em" }}>{plano?.titulo || form.destino || "Sua viagem"}</h2>
              {plano?.resumo && <p style={{ fontSize: 13, color: "rgba(255,255,255,.9)", marginTop: 8, lineHeight: 1.4 }}>{plano.resumo}</p>}
              {dados && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
                  {dados.carro && <span className="trend"><Gauge size={12} /> {dados.carro}</span>}
                  {dados.consumo_km_por_litro && <span className="trend"><Fuel size={12} /> {dados.consumo_km_por_litro} km/L</span>}
                  {dados.custo_por_km && <span className="trend">R$ {dados.custo_por_km.toFixed(2)}/km real</span>}
                </div>
              )}
            </section>

            {plano ? (
              <>
                {/* Números principais */}
                <div className="grid">
                  {plano.rota?.distancia_km_ida != null && <Stat icon={Route} label="Distância (ida)" value={`${plano.rota.distancia_km_ida} km`} />}
                  {plano.rota?.tempo_ida && <Stat icon={Clock} label="Tempo (ida)" value={plano.rota.tempo_ida} />}
                  {plano.combustivel?.total_ida_volta != null && <Stat icon={Fuel} label="Combustível ida+volta" value={brl(plano.combustivel.total_ida_volta)!} highlight />}
                  {plano.pedagios?.total_ida_volta != null && <Stat icon={Coins} label="Pedágios ida+volta" value={brl(plano.pedagios.total_ida_volta)!} />}
                </div>

                {plano.rota?.descricao && (
                  <Section icon={Route} title="Rota">
                    <p style={{ fontSize: 13.5, lineHeight: 1.45 }}>{plano.rota.descricao}</p>
                    {plano.rota.condicoes && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>⚠️ {plano.rota.condicoes}</p>}
                  </Section>
                )}

                {plano.combustivel?.conta && (
                  <Section icon={Fuel} title="A conta do combustível (no SEU carro)">
                    <p style={{ fontSize: 13.5, lineHeight: 1.45 }}>{plano.combustivel.conta}</p>
                    {dados?.fonte_consumo && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>Fonte do consumo: {dados.fonte_consumo}</p>}
                  </Section>
                )}

                {(plano.pedagios?.itens?.length || 0) > 0 && (
                  <Section icon={Coins} title="Pedágios no caminho">
                    <div>
                      {plano.pedagios!.itens!.map((p, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13.5, borderTop: i ? "1px solid var(--line)" : "none" }}>
                          <span style={{ color: "var(--muted)" }}>{p.praca}</span><span style={{ fontWeight: 700 }}>{brl(p.valor) || "—"}</span>
                        </div>
                      ))}
                    </div>
                    {plano.pedagios?.total_ida_volta != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: "1px solid var(--line)", fontSize: 13.5, fontWeight: 800 }}>
                        <span>Total ida + volta</span><span style={{ color: "var(--brand)" }}>{brl(plano.pedagios.total_ida_volta)}</span>
                      </div>
                    )}
                    {plano.pedagios?.obs && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{plano.pedagios.obs}</p>}
                  </Section>
                )}

                {plano.balsa && (
                  <Section icon={Ship} title="Balsa / travessia">
                    <p style={{ fontSize: 13.5, lineHeight: 1.45 }}>{plano.balsa.descricao}</p>
                    {plano.balsa.preco_carro != null && <span className="badge-p" style={{ display: "inline-block", marginTop: 8 }}>Carro: {brl(plano.balsa.preco_carro)}</span>}
                    {plano.balsa.dica && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>💡 {plano.balsa.dica}</p>}
                  </Section>
                )}

                {(plano.roteiro?.length || 0) > 0 && (
                  <Section icon={MapPin} title="Roteiro e paradas">
                    <div className="stack" style={{ gap: 12 }}>
                      {plano.roteiro!.map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: 11 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 999, background: "var(--brand-soft)", color: "var(--brand)", fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center", flex: "none", marginTop: 1 }}>{i + 1}</div>
                          <div><div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.titulo}</div>{r.descricao && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{r.descricao}</div>}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {hospedagemOrdenada.length > 0 && (
                  <Section icon={Hotel} title="Onde ficar (bem avaliados)">
                    <div className="stack" style={{ gap: 10 }}>
                      {hospedagemOrdenada.map((h, i) => {
                        const fx = FAIXA_LABEL[String(h.faixa)] || null;
                        return (
                          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{h.nome}</span>
                              <span style={{ display: "flex", alignItems: "center", gap: 7, flex: "none" }}>
                                {h.diaria != null && <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--brand)" }}>{brl(h.diaria)}<span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>/noite</span></span>}
                                {fx && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: fx.soft, color: fx.color }}>{fx.label}</span>}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{[h.regiao, h.motivo].filter(Boolean).join(" · ")}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>Sugestões da pesquisa ao vivo — confirme disponibilidade e valores na reserva.</p>
                  </Section>
                )}

                {(plano.comida?.length || 0) > 0 && (
                  <Section icon={UtensilsCrossed} title="Onde comer e beber">
                    <div className="stack" style={{ gap: 10 }}>
                      {plano.comida!.map((c, i) => (
                        <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.nome}</div>
                          {c.especialidade && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{c.especialidade}</div>}
                        </div>
                      ))}
                    </div>
                    {(plano.passeios?.length || 0) > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
                        {plano.passeios!.map((p, i) => <span key={i} className="badge-p">🎯 {p}</span>)}
                      </div>
                    )}
                  </Section>
                )}

                {(plano.antes_de_viajar?.length || 0) > 0 && (
                  <section className="card pad" style={{ background: "var(--gain-soft)", borderColor: "transparent" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 7, color: "var(--warn)" }}><Wrench size={16} /> Antes de pegar estrada</div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                      {plano.antes_de_viajar!.map((a, i) => <li key={i} style={{ fontSize: 13.5 }}>{a}</li>)}
                    </ul>
                  </section>
                )}

                {(plano.checklist?.length || 0) > 0 && (
                  <Section icon={CheckCircle2} title="Checklist de viagem">
                    <div className="stack" style={{ gap: 8 }}>
                      {plano.checklist!.map((c, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                          <CheckCircle2 size={16} style={{ color: "var(--brand)", flex: "none" }} /> {c}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            ) : (
              <section className="card pad">
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55 }}>
                  {planoTexto?.replace(/^#{1,4}\s*/gm, "").replace(/^---+$/gm, "").replace(/\*\*/g, "")}
                </div>
              </section>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button className="sbtn" onClick={() => { setPlano(null); setPlanoTexto(null); }}><RotateCcw size={14} /> Planejar outra</button>
              <a className="sbtn wa" href={`https://wa.me/${WA}?text=${encodeURIComponent("Quero ajustar meu plano de viagem!")}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Continuar no WhatsApp</a>
            </div>
          </>
        )}

        <p className="foot-note">O Modo Viagem usa o consumo real do seu carro pra estimar o combustível — registre abastecimentos pra ficar mais preciso.</p>
      </div>
    </MgShell>
  );
}
