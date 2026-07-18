import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plane, Loader2, Fuel, Wrench, RotateCcw, MessageCircle, Gauge, Route, Clock,
  Coins, Ship, MapPin, Hotel, UtensilsCrossed, CheckCircle2, Sparkles, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PERFIS = [
  ["familia", "Família"],
  ["casal", "Casal"],
  ["amigos", "Amigos"],
  ["sozinho", "Sozinho(a)"],
  ["pet", "Com pet"],
  ["carro_novo", "Primeira viagem com o carro novo"],
];

const FAIXA_LABEL: Record<string, { label: string; cls: string }> = {
  economica: { label: "Econômica", cls: "bg-emerald-500/15 text-emerald-600" },
  intermediaria: { label: "Intermediária", cls: "bg-sky-500/15 text-sky-600" },
  charme: { label: "Charme", cls: "bg-violet-500/15 text-violet-600" },
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

function Section({ icon: Icon, title, children, accent }: { icon: any; title: string; children: React.ReactNode; accent?: string }) {
  return (
    <Card className="border-0 shadow-premium-md overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className={`text-base flex items-center gap-2 ${accent || ""}`}>
          <Icon className="w-4 h-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`border-0 shadow-premium-md ${highlight ? "bg-gradient-primary text-white" : ""}`}>
      <CardContent className="p-4">
        <div className={`flex items-center gap-1.5 text-xs ${highlight ? "text-white/80" : "text-muted-foreground"}`}>
          <Icon className="w-3.5 h-3.5" /> {label}
        </div>
        <p className="text-xl font-bold mt-1 leading-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function Viagem() {
  const [form, setForm] = useState({ destino: "", origem: "", dias: "", perfil: "" });
  const [loading, setLoading] = useState(false);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [planoTexto, setPlanoTexto] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosCarro | null>(null);
  const [pesquisaWeb, setPesquisaWeb] = useState(false);

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
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Plane className="w-6 h-6 text-primary" /> Modo Viagem</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Planeje sua road trip com os dados <strong>reais do seu carro</strong> e pesquisa ao vivo de pedágios,
            balsa, hospedagem e restaurantes. Nenhum app de viagem conhece seu carro — o Co-pilot conhece. 🚗
          </p>
        </div>

        {!temResultado && (
          <Card className="border-0 shadow-premium-md">
            <CardHeader className="pb-2"><CardTitle className="text-base">Pra onde vamos?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Destino</Label>
                  <Input value={form.destino} onChange={(e) => setForm((p) => ({ ...p, destino: e.target.value }))} placeholder="Ex.: Ubatuba, Gramado… (vazio = me sugira!)" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Saindo de</Label>
                  <Input value={form.origem} onChange={(e) => setForm((p) => ({ ...p, origem: e.target.value }))} placeholder="Ex.: São Paulo" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantos dias?</Label>
                  <Input type="number" min={1} value={form.dias} onChange={(e) => setForm((p) => ({ ...p, dias: e.target.value }))} placeholder="Ex.: 3" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Perfil da viagem</Label>
                  <Select value={form.perfil} onValueChange={(v) => setForm((p) => ({ ...p, perfil: v }))}>
                    <SelectTrigger><SelectValue placeholder="Escolha (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {PERFIS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={montar} disabled={loading} className="w-full sm:w-auto gap-1.5 bg-gradient-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plane className="w-4 h-4" />}
                {loading ? "Pesquisando rota, pedágios e lugares…" : "Montar meu plano de viagem"}
              </Button>
              {loading && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 animate-pulse" /> Buscando valores atuais na web — leva uns 30 segundos, vale a pena. 😉
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {temResultado && (
          <>
            {/* Cabeçalho do plano */}
            <Card className="border-0 shadow-premium-md bg-gradient-primary text-white overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-white/80 text-xs font-medium uppercase tracking-wide">
                  <Sparkles className="w-3.5 h-3.5" /> Seu plano de viagem {pesquisaWeb && "· valores pesquisados agora"}
                </div>
                <h2 className="text-2xl font-bold mt-1">{plano?.titulo || form.destino || "Sua viagem"}</h2>
                {plano?.resumo && <p className="text-white/90 text-sm mt-2">{plano.resumo}</p>}
                {dados && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {dados.carro && <Badge className="bg-white/15 text-white border-0 gap-1"><Gauge className="w-3 h-3" /> {dados.carro}</Badge>}
                    {dados.consumo_km_por_litro && <Badge className="bg-white/15 text-white border-0 gap-1"><Fuel className="w-3 h-3" /> {dados.consumo_km_por_litro} km/L</Badge>}
                    {dados.custo_por_km && <Badge className="bg-white/15 text-white border-0">R$ {dados.custo_por_km.toFixed(2)}/km real</Badge>}
                  </div>
                )}
              </CardContent>
            </Card>

            {plano ? (
              <>
                {/* Números principais */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {plano.rota?.distancia_km_ida != null && <Stat icon={Route} label="Distância (ida)" value={`${plano.rota.distancia_km_ida} km`} />}
                  {plano.rota?.tempo_ida && <Stat icon={Clock} label="Tempo (ida)" value={plano.rota.tempo_ida} />}
                  {plano.combustivel?.total_ida_volta != null && <Stat icon={Fuel} label="Combustível ida+volta" value={brl(plano.combustivel.total_ida_volta)!} highlight />}
                  {plano.pedagios?.total_ida_volta != null && <Stat icon={Coins} label="Pedágios ida+volta" value={brl(plano.pedagios.total_ida_volta)!} />}
                </div>

                {/* Rota */}
                {plano.rota?.descricao && (
                  <Section icon={Route} title="Rota">
                    <p className="text-sm">{plano.rota.descricao}</p>
                    {plano.rota.condicoes && <p className="text-xs text-muted-foreground mt-2">⚠️ {plano.rota.condicoes}</p>}
                  </Section>
                )}

                {/* Combustível */}
                {plano.combustivel?.conta && (
                  <Section icon={Fuel} title="A conta do combustível (no SEU carro)">
                    <p className="text-sm">{plano.combustivel.conta}</p>
                    {dados?.fonte_consumo && <p className="text-xs text-muted-foreground mt-2">Fonte do consumo: {dados.fonte_consumo}</p>}
                  </Section>
                )}

                {/* Pedágios */}
                {(plano.pedagios?.itens?.length || 0) > 0 && (
                  <Section icon={Coins} title="Pedágios no caminho">
                    <div className="divide-y divide-border">
                      {plano.pedagios!.itens!.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-2 text-sm">
                          <span className="text-muted-foreground">{p.praca}</span>
                          <span className="font-medium">{brl(p.valor) || "—"}</span>
                        </div>
                      ))}
                    </div>
                    {plano.pedagios?.total_ida_volta != null && (
                      <div className="flex items-center justify-between pt-3 mt-1 border-t border-border text-sm font-bold">
                        <span>Total ida + volta</span><span className="text-primary">{brl(plano.pedagios.total_ida_volta)}</span>
                      </div>
                    )}
                    {plano.pedagios?.obs && <p className="text-xs text-muted-foreground mt-2">{plano.pedagios.obs}</p>}
                  </Section>
                )}

                {/* Balsa */}
                {plano.balsa && (
                  <Section icon={Ship} title="Balsa / travessia">
                    <p className="text-sm">{plano.balsa.descricao}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {plano.balsa.preco_carro != null && <Badge variant="secondary">Carro: {brl(plano.balsa.preco_carro)}</Badge>}
                    </div>
                    {plano.balsa.dica && <p className="text-xs text-muted-foreground mt-2">💡 {plano.balsa.dica}</p>}
                  </Section>
                )}

                {/* Roteiro */}
                {(plano.roteiro?.length || 0) > 0 && (
                  <Section icon={MapPin} title="Roteiro e paradas">
                    <div className="space-y-3">
                      {plano.roteiro!.map((r, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                          <div>
                            <p className="text-sm font-medium">{r.titulo}</p>
                            {r.descricao && <p className="text-xs text-muted-foreground">{r.descricao}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Hospedagem */}
                {hospedagemOrdenada.length > 0 && (
                  <Section icon={Hotel} title="Onde ficar (bem avaliados)">
                    <div className="space-y-3">
                      {hospedagemOrdenada.map((h, i) => {
                        const fx = FAIXA_LABEL[String(h.faixa)] || null;
                        return (
                          <div key={i} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{h.nome}</p>
                              <div className="flex items-center gap-2 shrink-0">
                                {h.diaria != null && <span className="text-sm font-bold text-primary">{brl(h.diaria)}<span className="text-[10px] text-muted-foreground font-normal">/noite</span></span>}
                                {fx && <Badge className={`${fx.cls} border-0`}>{fx.label}</Badge>}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {[h.regiao, h.motivo].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3">Sugestões da pesquisa ao vivo — confirme disponibilidade e valores na reserva.</p>
                  </Section>
                )}

                {/* Comida */}
                {(plano.comida?.length || 0) > 0 && (
                  <Section icon={UtensilsCrossed} title="Onde comer e beber">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {plano.comida!.map((c, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <p className="text-sm font-medium">{c.nome}</p>
                          {c.especialidade && <p className="text-xs text-muted-foreground mt-0.5">{c.especialidade}</p>}
                        </div>
                      ))}
                    </div>
                    {(plano.passeios?.length || 0) > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {plano.passeios!.map((p, i) => <Badge key={i} variant="secondary">🎯 {p}</Badge>)}
                      </div>
                    )}
                  </Section>
                )}

                {/* Antes de viajar */}
                {(plano.antes_de_viajar?.length || 0) > 0 && (
                  <Card className="border-0 shadow-premium-md bg-amber-500/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-amber-700"><Wrench className="w-4 h-4" /> Antes de pegar estrada</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {plano.antes_de_viajar!.map((a, i) => <li key={i} className="text-sm flex gap-2"><span>•</span>{a}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Checklist */}
                {(plano.checklist?.length || 0) > 0 && (
                  <Section icon={CheckCircle2} title="Checklist de viagem">
                    <div className="grid sm:grid-cols-2 gap-2">
                      {plano.checklist!.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {c}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            ) : (
              // fallback: plano em texto (quando o JSON não veio)
              <Card className="border-0 shadow-premium-md">
                <CardContent className="p-6">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {planoTexto?.replace(/^#{1,4}\s*/gm, "").replace(/^---+$/gm, "").replace(/\*\*/g, "")}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { setPlano(null); setPlanoTexto(null); }} className="gap-1.5">
                <RotateCcw className="w-4 h-4" /> Planejar outra viagem
              </Button>
              <Button asChild variant="outline" className="gap-1.5">
                <a href={`https://wa.me/5511963786699?text=${encodeURIComponent("Quero ajustar meu plano de viagem!")}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="w-4 h-4" /> Continuar no WhatsApp
                </a>
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
