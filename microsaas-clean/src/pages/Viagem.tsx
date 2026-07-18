import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, Loader2, Fuel, Wrench, RotateCcw, MessageCircle, Gauge } from "lucide-react";
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

interface DadosCarro {
  carro: string | null;
  consumo_km_por_litro: number | null;
  fonte_consumo: string | null;
  custo_por_km: number | null;
  preco_medio_litro: number | null;
  manutencoes_pendentes: { item: string; faltam_km: number }[];
  loja: string | null;
}

export default function Viagem() {
  const [form, setForm] = useState({ destino: "", origem: "", dias: "", perfil: "" });
  const [loading, setLoading] = useState(false);
  const [plano, setPlano] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosCarro | null>(null);

  const montar = async () => {
    setLoading(true);
    setPlano(null);
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
      setPlano(data.plano);
      setDados(data.dados || null);
    } catch (e: any) {
      toast({ title: "Não consegui montar o plano", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Plane className="w-6 h-6 text-primary" /> Modo Viagem</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Planeje sua road trip com os dados <strong>reais do seu carro</strong>: combustível calculado no seu consumo,
            checklist e o que revisar antes de pegar estrada. Nenhum app de viagem conhece seu carro — o Co-pilot conhece. 🚗
          </p>
        </div>

        {!plano && (
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
                {loading ? "Montando seu plano…" : "Montar meu plano de viagem"}
              </Button>
            </CardContent>
          </Card>
        )}

        {plano && (
          <>
            {dados && (
              <div className="flex flex-wrap gap-2">
                {dados.carro && <Badge variant="secondary" className="gap-1"><Gauge className="w-3 h-3" /> {dados.carro}</Badge>}
                {dados.consumo_km_por_litro && (
                  <Badge variant="secondary" className="gap-1"><Fuel className="w-3 h-3" /> {dados.consumo_km_por_litro} km/L ({dados.fonte_consumo})</Badge>
                )}
                {dados.custo_por_km && <Badge variant="secondary">R$ {dados.custo_por_km.toFixed(2)}/km rodado</Badge>}
                {dados.manutencoes_pendentes?.length > 0 && (
                  <Badge className="gap-1 bg-amber-500/15 text-amber-600"><Wrench className="w-3 h-3" /> {dados.manutencoes_pendentes.length} manutenção(ões) antes de viajar</Badge>
                )}
              </div>
            )}
            <Card className="border-0 shadow-premium-md">
              <CardContent className="p-6">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{plano}</div>
              </CardContent>
            </Card>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPlano(null)} className="gap-1.5">
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
