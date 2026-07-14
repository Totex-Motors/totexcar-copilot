import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, Gauge, Droplet, Disc, AlertTriangle, Lightbulb, RefreshCw, FileText } from "lucide-react";

// Card "Ficha técnica" — mostra a ficha gerada por IA+web (edge car-spec). Se o veículo ainda não
// tem ficha salva, dispara a geração automaticamente. É o mesmo dado que o concierge usa no WhatsApp.
export function FichaTecnicaCard({ vehicle }: { vehicle: any }) {
  const qc = useQueryClient();
  const saved = vehicle?.ficha_tecnica || null;
  const hasCar = !!(vehicle && (vehicle.marca || vehicle.modelo));

  // gera (ou busca) a ficha via edge quando ainda não existe salva
  const gen = useQuery({
    queryKey: ["car-spec", vehicle?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("car-spec", { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      qc.invalidateQueries({ queryKey: ["accounts"] });
      return (data as any).ficha;
    },
    enabled: hasCar && !saved,
    staleTime: Infinity,
    retry: false,
  });

  const ficha = saved || gen.data;

  const regenerar = async () => {
    await supabase.functions.invoke("car-spec", { body: { force: true } });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["car-spec", vehicle?.id] });
  };

  if (!hasCar) return null;

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Ficha técnica do seu carro
        </CardTitle>
        {ficha && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={regenerar} title="Atualizar ficha">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!ficha && gen.isFetching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Montando a ficha técnica do seu carro (pesquisando na web)…
          </div>
        )}
        {!ficha && gen.isError && (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">Não consegui montar a ficha agora. Confira se marca e modelo estão preenchidos.</p>
            <Button variant="outline" size="sm" onClick={() => gen.refetch()} className="gap-1.5"><RefreshCw className="w-4 h-4" /> Tentar de novo</Button>
          </div>
        )}
        {ficha && <FichaBody f={ficha} />}
      </CardContent>
    </Card>
  );
}

const show = (v: any): string | null => {
  if (v == null) return null;
  if (typeof v === "object") {
    // a IA às vezes devolve objeto/array (ex.: consumo {gasolina, etanol}) — formata legível
    const parts = Array.isArray(v)
      ? v.map(show).filter(Boolean)
      : Object.entries(v).map(([k, val]) => { const sv = show(val); return sv ? `${k}: ${sv}` : null; }).filter(Boolean) as string[];
    return parts.length ? parts.join(" · ") : null;
  }
  const s = String(v).trim();
  if (!s || /^(n[aã]o especificado|faixa|n\/a|nd)$/i.test(s) || s === "null") return null;
  return s;
};

function Spec({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  const v = show(value);
  if (!v) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{v}</p>
      </div>
    </div>
  );
}

function FichaBody({ f }: { f: any }) {
  const oleo = f.oleo || {};
  const rev = f.revisao || {};
  const pneu = f.pneu || {};
  const oleoTxt = [show(oleo.especificacao), show(oleo.capacidade_litros) && `${show(oleo.capacidade_litros)} L`,
    show(oleo.troca_km) && `troca ${show(oleo.troca_km)} km`].filter(Boolean).join(" · ");
  const revTxt = [show(rev.intervalo_km) && `${show(rev.intervalo_km)} km`, show(rev.intervalo_meses) && `${show(rev.intervalo_meses)} meses`]
    .filter(Boolean).join(" ou ");
  const conf = show(f.confianca);
  return (
    <div className="space-y-4">
      {show(f.resumo) && <p className="text-sm text-muted-foreground">{show(f.resumo)}</p>}
      <div className="flex flex-wrap gap-1.5">
        {show(f.categoria) && <Badge variant="secondary">{show(f.categoria)}</Badge>}
        {show(f.combustivel) && <Badge variant="secondary">{show(f.combustivel)}</Badge>}
        {show(f.cambio) && <Badge variant="secondary">{show(f.cambio)}</Badge>}
        {show(f.tracao) && <Badge variant="secondary">{show(f.tracao)}</Badge>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Spec icon={Wrench} label="Motor" value={f.motor} />
        <Spec icon={Gauge} label="Potência" value={f.potencia_cv && `${show(f.potencia_cv)} cv`} />
        <Spec icon={Gauge} label="Torque" value={f.torque} />
        <Spec icon={Gauge} label="Consumo cidade" value={f.consumo_cidade} />
        <Spec icon={Gauge} label="Consumo estrada" value={f.consumo_estrada} />
        <Spec icon={Droplet} label="Tanque" value={f.tanque_litros && `${show(f.tanque_litros)} L`} />
        <Spec icon={Droplet} label="Bateria" value={f.bateria_kwh && `${show(f.bateria_kwh)} kWh`} />
        <Spec icon={Gauge} label="Autonomia elétrica" value={f.autonomia_km && `${show(f.autonomia_km)} km`} />
        <Spec icon={Droplet} label="Óleo" value={oleoTxt} />
        <Spec icon={Wrench} label="Revisão a cada" value={revTxt} />
        <Spec icon={Disc} label="Pneu" value={[show(pneu.medida), show(pneu.calibragem_psi)].filter(Boolean).join(" · ")} />
        <Spec icon={Wrench} label="Correia/corrente" value={f.correia_ou_corrente} />
        <Spec icon={Wrench} label="Velas (troca)" value={f.velas_troca_km && `${show(f.velas_troca_km)} km`} />
        <Spec icon={Disc} label="Pastilhas de freio" value={f.freios_pastilha_km && `${show(f.freios_pastilha_km)}`} />
      </div>
      {Array.isArray(f.pontos_de_atencao) && f.pontos_de_atencao.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/[0.06] p-3">
          <p className="text-sm font-semibold flex items-center gap-1.5 mb-1"><AlertTriangle className="w-4 h-4 text-warning" /> Pontos de atenção</p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
            {f.pontos_de_atencao.map((p: string, i: number) => show(p) && <li key={i}>{show(p)}</li>)}
          </ul>
        </div>
      )}
      {Array.isArray(f.dicas_donos) && f.dicas_donos.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
          <p className="text-sm font-semibold flex items-center gap-1.5 mb-1"><Lightbulb className="w-4 h-4 text-primary" /> Dicas pro seu carro</p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
            {f.dicas_donos.map((p: string, i: number) => show(p) && <li key={i}>{show(p)}</li>)}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground/80">
        {show(f.observacao) || "Valores de referência gerados por IA + busca na web."} {conf ? `· Confiança: ${conf}.` : ""} Confirme os números exatos no manual do proprietário.
      </p>
    </div>
  );
}
