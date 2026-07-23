import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Award, Loader2, Flame, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// SELO TOTEX — adesão da loja + Central de Valor (Fase 4)
// Sem adesão, NENHUM cliente da loja vê o programa. A garantia (mín. 82/85/87%, teto 90% da FIPE)
// é da LOJA, condicionada à vistoria — por isso a adesão é explícita.

const TIER_EMOJI: Record<string, string> = { ouro: "🥇", prata: "🥈", bronze: "🥉" };

export function SeloLojaCard({ dealership }: { dealership?: string }) {
  const [status, setStatus] = useState<any>(null);
  const [carteira, setCarteira] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: st } = await supabase.functions.invoke("dealer-api", { body: { action: "selo_status", dealership } });
      setStatus(st || null);
      if (st?.aderido) {
        const { data: ct } = await supabase.functions.invoke("dealer-api", { body: { action: "selo_carteira", dealership } });
        setCarteira(ct || null);
      }
    } catch { /* */ }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [dealership]);

  const aderir = async (valor: boolean) => {
    setSaving(true);
    try {
      const { data } = await supabase.functions.invoke("dealer-api", { body: { action: "selo_aderir", aderir: valor, dealership } });
      if (data?.ok) {
        toast({ title: valor ? "Loja aderida ao Selo Totex! 🏅" : "Adesão desativada", description: valor ? "Seus clientes já podem construir a garantia de recompra." : undefined });
        await load();
      } else {
        toast({ title: "Não foi possível salvar", description: String(data?.error || ""), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return <Card className="border-0 shadow-premium-md"><CardContent className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></CardContent></Card>;
  }
  const f = status?.faixas || { bronze: 82, prata: 85, ouro_min: 87, ouro_max: 90 };

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" /> Selo Totex — Recompra Garantida
          {status?.aderido && <Badge className="bg-green-500/15 text-green-600 border-0">programa ativo</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.aderido ? (
          <>
            <p className="text-sm text-muted-foreground">
              Transforme o histórico dos seus clientes em <strong>recompra garantida</strong>: quem cuida do
              carro e comprova (cupom, hodômetro, revisões) conquista o Selo — Bronze mín. {f.bronze}%,
              Prata mín. {f.prata}%, Ouro mín. {f.ouro_min}% (teto {f.ouro_max}%) da FIPE na troca AQUI na sua loja.
              Carro com histórico verificado gira mais rápido e revende com prêmio.
            </p>
            <p className="text-xs text-muted-foreground">
              Ao aderir, a garantia vale para os SEUS clientes e é sempre <strong>condicionada à vistoria
              presencial</strong> confirmar o histórico (divergência material anula a garantia). A oferta final é sua.
            </p>
            <Button onClick={() => aderir(true)} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
              Aderir ao programa
            </Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[["🥇 Ouro", carteira?.resumo?.ouro], ["🥈 Prata", carteira?.resumo?.prata], ["🥉 Bronze", carteira?.resumo?.bronze], ["Sem selo", carteira?.resumo?.sem_selo]].map(([l, v], i) => (
                <div key={i} className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xl font-extrabold tabular-nums">{Number(v) || 0}</p>
                  <p className="text-[11px] text-muted-foreground">{l as string}</p>
                </div>
              ))}
            </div>
            {carteira?.prontos?.length ? (
              <div>
                <p className="text-sm font-bold flex items-center gap-1.5 mb-2"><Flame className="w-4 h-4 text-warning" /> Prontos para troca (lead quente)</p>
                <div className="space-y-2">
                  {carteira.prontos.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{TIER_EMOJI[c.selo] || "🏅"} {c.name || c.phone}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.veiculo || "—"}{c.km ? ` · ${Number(c.km).toLocaleString("pt-BR")} km` : ""}{c.selo_desde ? ` · selo desde ${new Date(c.selo_desde + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}</p>
                      </div>
                      {c.phone && (
                        <a href={`https://wa.me/${String(c.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="gap-1.5"><Phone className="w-3.5 h-3.5" /> Chamar</Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum cliente com Selo Prata/Ouro ainda — os pontos deles já estão acumulando a cada registro no Co-pilot.
              </p>
            )}
            <button className="text-[11px] text-muted-foreground underline" onClick={() => aderir(false)} disabled={saving}>
              desativar adesão ao programa
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
