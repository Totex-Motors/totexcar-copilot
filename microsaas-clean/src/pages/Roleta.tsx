import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Disc3, CheckCircle2, Clock, Sparkles, Gift, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Roleta Totex — "giro conquistado": cada giro é destravado por uma missão que
// gera valor pra loja parceira. O sorteio da fatia acontece no servidor (edge `roleta`);
// aqui só animamos a roleta até parar na fatia sorteada.

interface Missao { id: string; titulo: string; como: string; auto: boolean; status: string }
interface Giro { id: string; missao: string; status: string; premio: string | null; codigo: string | null }
interface Estado {
  ativo: boolean; loja?: string;
  fatias?: { rotulo: string; cor: string | null }[];
  missoes?: Missao[]; disponiveis?: Giro[]; premios?: Giro[];
}

const CORES = ["#1436C7", "#F5B301", "#38B6E8", "#1B9E4B", "#E4572E", "#7B2FBE", "#0A1B5C", "#C7332B"];

export default function Roleta() {
  const [st, setSt] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);
  const [girando, setGirando] = useState(false);
  const [rotacao, setRotacao] = useState(0);
  const [resultado, setResultado] = useState<{ premio: string; codigo: string } | null>(null);

  const carregar = async () => {
    try {
      const { data } = await supabase.functions.invoke("roleta", { body: { action: "estado" } });
      setSt(data || { ativo: false });
    } catch { setSt({ ativo: false }); }
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const fatias = st?.fatias || [];
  const n = Math.max(fatias.length, 1);
  const grad = useMemo(() => {
    if (!fatias.length) return "conic-gradient(#D9E0F2 0 360deg)";
    const passo = 360 / n;
    const partes = fatias.map((f, i) =>
      `${f.cor || CORES[i % CORES.length]} ${i * passo}deg ${(i + 1) * passo}deg`);
    return `conic-gradient(${partes.join(",")})`;
  }, [fatias, n]);

  const girar = async () => {
    const giro = st?.disponiveis?.[0];
    if (!giro || girando) return;
    setGirando(true);
    setResultado(null);
    try {
      const { data } = await supabase.functions.invoke("roleta", { body: { action: "girar", giro_id: giro.id } });
      if (!data?.ok) throw new Error(data?.error || "erro");
      // anima até a fatia sorteada: o ponteiro fica no topo (0deg)
      const idx = Math.max(0, fatias.findIndex((f) => f.rotulo === data.premio));
      const passo = 360 / n;
      const centro = idx * passo + passo / 2;
      const voltas = 5 * 360;
      setRotacao((r) => r + voltas + ((360 - centro) - (r % 360) + 360) % 360);
      setTimeout(() => {
        setResultado({ premio: data.premio, codigo: data.codigo });
        setGirando(false);
        carregar();
      }, 4200);
    } catch (e: any) {
      setGirando(false);
      toast({ title: "Não foi possível girar", description: String(e?.message || e), variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  if (!st?.ativo) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
          <Disc3 className="w-14 h-14 text-muted-foreground/40 mx-auto" />
          <h1 className="text-2xl font-bold">Roleta Totex</h1>
          <p className="text-muted-foreground">
            A Roleta de prêmios é um <strong>benefício das lojas parceiras</strong>.
            {st?.loja ? " A sua loja ainda não ativou a roleta — fique de olho!" : " Ela aparece aqui quando a sua loja ativar."}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const disponiveis = st.disponiveis || [];
  const missoes = st.missoes || [];
  const premios = st.premios || [];
  const passo = 360 / n;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Disc3 className="w-6 h-6 text-primary" /> Roleta {st.loja}</h1>
          <p className="text-muted-foreground text-sm">Cumpra missões, ganhe giros, leve prêmios de verdade da sua loja. 🎁</p>
        </div>

        {/* roleta */}
        <Card className="border-0 shadow-premium-md overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center">
            <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">
              {/* ponteiro */}
              <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10 w-0 h-0
                border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[26px] border-t-amber-500 drop-shadow" />
              {/* disco */}
              <div
                className="w-full h-full rounded-full border-8 border-white shadow-2xl relative"
                style={{ background: grad, transform: `rotate(${rotacao}deg)`, transition: girando ? "transform 4s cubic-bezier(.15,.9,.25,1)" : undefined }}
              >
                {fatias.map((f, i) => (
                  <span key={i}
                    className="absolute left-1/2 top-1/2 text-[11px] font-bold text-white drop-shadow whitespace-nowrap max-w-[110px] overflow-hidden text-ellipsis"
                    style={{ transform: `rotate(${i * passo + passo / 2 - 90}deg) translate(58px, -50%)`, transformOrigin: "0 50%" }}>
                    {f.rotulo}
                  </span>
                ))}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white shadow flex items-center justify-center text-xl">🎡</div>
              </div>
            </div>

            <Button size="lg" className="mt-6 gap-2 text-base font-bold px-10" disabled={!disponiveis.length || girando} onClick={girar}>
              {girando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {girando ? "Girando…" : disponiveis.length ? `GIRAR (${disponiveis.length} giro${disponiveis.length > 1 ? "s" : ""})` : "Complete uma missão para girar"}
            </Button>

            {resultado && (
              <div className="mt-5 w-full max-w-sm rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                <p className="font-bold text-lg">🎉 Você ganhou: {resultado.premio}</p>
                <p className="text-sm text-muted-foreground mt-1">Código de resgate — apresente na loja:</p>
                <p className="text-2xl font-extrabold tracking-wider text-primary">{resultado.codigo}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* missões */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base">Missões para ganhar giros</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border">
            {missoes.map((m) => (
              <div key={m.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{m.titulo}</p>
                  <p className="text-xs text-muted-foreground">{m.como}</p>
                </div>
                {m.status === "conquistada" ? (
                  <Badge className="gap-1 bg-green-500/15 text-green-600 shrink-0"><CheckCircle2 className="w-3 h-3" /> Giro conquistado</Badge>
                ) : (
                  <Badge className="gap-1 bg-muted text-muted-foreground shrink-0"><Clock className="w-3 h-3" /> {m.auto ? "Em andamento" : "Peça à loja para liberar"}</Badge>
                )}
              </div>
            ))}
            {!missoes.length && <p className="text-sm text-muted-foreground py-3">A loja ainda não ativou missões.</p>}
          </CardContent>
        </Card>

        {/* prêmios ganhos */}
        {!!premios.length && (
          <Card className="border-0 shadow-premium-md">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4 text-primary" /> Meus prêmios</CardTitle></CardHeader>
            <CardContent className="divide-y divide-border">
              {premios.map((g) => (
                <div key={g.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{g.premio}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Ticket className="w-3 h-3" /> Código: <strong>{g.codigo}</strong></p>
                  </div>
                  {g.status === "entregue"
                    ? <Badge className="bg-green-500/15 text-green-600 shrink-0">Resgatado ✅</Badge>
                    : <Badge className="bg-amber-500/15 text-amber-600 shrink-0">Apresente na loja</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
