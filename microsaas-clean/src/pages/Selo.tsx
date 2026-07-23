import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Fuel, Gauge, TrendingUp, ShieldCheck, Loader2, Banknote, Store, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Selo Totex — "seu histórico vale dinheiro" (Fase 4)
// Exclusivo para clientes que compraram o carro numa loja parceira ADERIDA ao programa.

type Statement = {
  ok: boolean; elegivel: boolean; loja: string | null;
  score: number; tier: string; meses_ativos: number; delta_mes: number;
  faixa_garantida: { min_pct: number; max_pct: number | null } | null;
  proximo_selo: { tier: string; faltam_pontos: number; faltam_meses: number; fipe_min_pct: number } | null;
  troca12m_ate: string | null;
  ultimos_eventos: { o_que: string; pontos: number; data: string }[];
};

const TIER_META: Record<string, { label: string; emoji: string; cls: string }> = {
  ouro: { label: "Ouro", emoji: "🥇", cls: "from-amber-400 to-yellow-600" },
  prata: { label: "Prata", emoji: "🥈", cls: "from-slate-300 to-slate-500" },
  bronze: { label: "Bronze", emoji: "🥉", cls: "from-orange-300 to-orange-600" },
  none: { label: "Em construção", emoji: "🔧", cls: "from-teal-400 to-cyan-500" },
};

export default function Selo() {
  const [st, setSt] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("care-score", { body: {} });
        setSt(data || null);
      } catch { setSt(null); }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Não elegível: o programa é benefício das lojas parceiras — não vendemos aqui.
  if (!st?.elegivel) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
          <Award className="w-14 h-14 text-muted-foreground/40 mx-auto" />
          <h1 className="text-2xl font-bold">Selo Totex</h1>
          <p className="text-muted-foreground">
            O Selo Totex é um <strong>benefício exclusivo</strong> para clientes que compraram o carro
            em uma loja parceira do ecossistema Totexmotors. Seus registros continuam valorizando o
            histórico do seu carro normalmente.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const tier = TIER_META[st.tier] || TIER_META.none;
  const pct = Math.min(100, Math.round((st.score / 850) * 100));

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" /> Selo Totex
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Seu histórico vale dinheiro: cada cupom, foto de hodômetro e revisão comprovada aumenta a
            garantia de recompra do seu carro na <strong>{st.loja}</strong>.
          </p>
        </div>

        {/* Selo atual + faixa garantida */}
        <Card className="border-0 shadow-premium-md overflow-hidden">
          <div className={`bg-gradient-to-r ${tier.cls} p-5 text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold opacity-90 uppercase tracking-wide">Seu selo</p>
                <p className="text-3xl font-extrabold">{tier.emoji} {tier.label}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-90">Score de Cuidado</p>
                <p className="text-3xl font-extrabold tabular-nums">{st.score}</p>
                <p className="text-[11px] opacity-90">{st.meses_ativos} {st.meses_ativos === 1 ? "mês ativo" : "meses ativos"}{st.delta_mes ? ` · ${st.delta_mes > 0 ? "+" : ""}${st.delta_mes} este mês` : ""}</p>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-white/90 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] mt-1 opacity-90">
              <span>Bronze 300</span><span>Prata 600</span><span>Ouro 850</span>
            </div>
          </div>
          <CardContent className="p-4">
            {st.faixa_garantida ? (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold">
                    Garantia mínima de {st.faixa_garantida.min_pct}% da FIPE na recompra
                    {st.faixa_garantida.max_pct ? ` (até ${st.faixa_garantida.max_pct}%)` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Válida na {st.loja}, confirmada na vistoria presencial.
                    {st.troca12m_ate ? ` Bônus: trocando até ${new Date(st.troca12m_ate + "T12:00:00").toLocaleDateString("pt-BR")}, você garante o teto de 90%.` : ""}
                  </p>
                </div>
              </div>
            ) : st.proximo_selo ? (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-bold">Faltam {st.proximo_selo.faltam_pontos} pontos {st.proximo_selo.faltam_meses > 0 ? `e ${st.proximo_selo.faltam_meses} meses de histórico ` : ""}para o Selo {TIER_META[st.proximo_selo.tier]?.label}</p>
                  <p className="text-sm text-muted-foreground">Ele garante o mínimo de {st.proximo_selo.fipe_min_pct}% da FIPE na troca.</p>
                </div>
              </div>
            ) : null}
            <Button className="w-full mt-4 gap-2" onClick={() => navigate("/recompra")}>
              <Banknote className="w-4 h-4" /> Avaliar meu carro agora
            </Button>
          </CardContent>
        </Card>

        {/* Como pontuar */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base">Como ganhar pontos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><Fuel className="w-4 h-4 text-primary" /> Abastecimento com cupom + hodômetro <Badge variant="secondary">+10</Badge></div>
            <div className="flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" /> Hodômetro atualizado no mês <Badge variant="secondary">+10</Badge></div>
            <div className="flex items-center gap-2"><Flame className="w-4 h-4 text-primary" /> 3 meses seguidos registrando <Badge variant="secondary">+50</Badge></div>
            <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Tudo pelo WhatsApp — foto do cupom e pronto</div>
          </CardContent>
        </Card>

        {/* Extrato */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base">Últimos pontos</CardTitle></CardHeader>
          <CardContent>
            {st.ultimos_eventos?.length ? (
              <div className="space-y-2">
                {st.ultimos_eventos.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                    <span>{e.o_que}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{new Date(e.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                      <Badge className={e.pontos >= 0 ? "bg-green-500/15 text-green-600 border-0" : "bg-destructive/15 text-destructive border-0"}>
                        {e.pontos > 0 ? `+${e.pontos}` : e.pontos}
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum ponto ainda — registre o próximo abastecimento no WhatsApp (foto do cupom + hodômetro) e comece a construir o valor do seu carro.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground text-center">
          A garantia do Selo é o mínimo da faixa, condicionada à confirmação do histórico na vistoria
          presencial da loja participante. A oferta final é sempre da loja. O teto do programa é 90% da FIPE.
        </p>
      </div>
    </DashboardLayout>
  );
}
