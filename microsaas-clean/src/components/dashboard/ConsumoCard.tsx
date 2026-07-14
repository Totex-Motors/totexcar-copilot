import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fuel, Route, Gauge, MessageCircle, BadgeCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { useConsumo } from "@/hooks/useConsumo";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// Card "Meu consumo": litros vs km rodados, do jeito simples que o dono entende.
// Alimentado pelo TotexCar Co-pilot (foto do cupom + foto do hodômetro no WhatsApp).
// Agora cruza com o CONSUMO OFICIAL (INMETRO/PBE via Auto Data) pra dizer se está dentro do esperado.
export function ConsumoCard() {
  const { userId } = useCurrentUser();
  const { data: consumo, isLoading } = useConsumo(userId);
  const { vehicle } = useVehicle(userId);
  const qc = useQueryClient();

  const oficialRaw = (vehicle as any)?.consumo_oficial || null;
  const oficial = oficialRaw && !oficialRaw.nao_encontrado ? oficialRaw : null;
  const hasCar = !!(vehicle && (vehicle.marca || vehicle.modelo));
  // gera o consumo oficial via edge quando ainda não foi buscado
  useQuery({
    queryKey: ["consumo-oficial", (vehicle as any)?.id],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("car-consumo", { body: {} });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      return data ?? null;
    },
    enabled: hasCar && !oficialRaw,
    staleTime: Infinity,
    retry: false,
  });

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Fuel className="w-4 h-4 text-primary" /> Meu consumo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : !consumo ? (
          <div className="text-sm text-muted-foreground space-y-1.5">
            <p>Ainda sem medição. Pra eu medir seu consumo:</p>
            <p className="flex items-start gap-1.5">
              <MessageCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <span>
                A cada abastecimento, mande no WhatsApp a <strong>foto do cupom</strong> e a{" "}
                <strong>foto do hodômetro</strong>. A partir do 2º abastecimento eu calculo seu km/L.
              </span>
            </p>
            {oficial && <OficialBlock oficial={oficial} real={0} />}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-foreground">{consumo.media_km_por_litro}</span>
              <span className="text-muted-foreground text-sm pb-1">km/L na média</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
                  <Route className="w-3.5 h-3.5" /> Último tanque
                </div>
                <span className="font-semibold">
                  {consumo.ultimo.km_rodados.toLocaleString("pt-BR")} km · {consumo.ultimo.litros} L →{" "}
                  {consumo.ultimo.km_por_litro} km/L
                </span>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
                  <Gauge className="w-3.5 h-3.5" /> Custo por km
                </div>
                <span className="font-semibold">{brl(consumo.custo_combustivel_por_km)} /km</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {consumo.abastecimentos_medidos} abastecimento{consumo.abastecimentos_medidos > 1 ? "s" : ""} medido
              {consumo.abastecimentos_medidos > 1 ? "s" : ""} — continue mandando cupom + hodômetro no WhatsApp.
            </p>
            {oficial && <OficialBlock oficial={oficial} real={consumo.media_km_por_litro} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Bloco "consumo oficial (INMETRO)" + insight comparando com o consumo real do dono
function OficialBlock({ oficial, real }: { oficial: any; real: number }) {
  const ref: number | null = oficial.referencia_media || null;
  const flex = oficial.cidade_etanol != null;
  let insight: string | null = null;
  if (ref && real) {
    const r = real / ref;
    if (r >= 1.05) insight = `🎉 Seu consumo real (${real} km/L) está ACIMA do oficial (~${ref}). Mandando bem!`;
    else if (r >= 0.85) insight = `👍 Seu real (${real} km/L) está em linha com o oficial (~${ref}).`;
    else insight = `⚠️ Seu real (${real} km/L) está abaixo do oficial (~${ref})${flex ? " — se você abastece com etanol, é normal render menos km/L" : ""}. Vale checar calibragem dos pneus e filtro de ar.`;
  }
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.05] p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold flex items-center gap-1.5"><BadgeCheck className="w-4 h-4 text-primary" /> Consumo oficial (INMETRO)</p>
        {oficial.classificacao && <Badge variant="secondary" className="text-[10px]">Classe {oficial.classificacao}</Badge>}
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        {oficial.cidade_gasolina && <p>Gasolina: <strong>{oficial.cidade_gasolina}</strong> cidade / <strong>{oficial.estrada_gasolina}</strong> estrada (km/L)</p>}
        {oficial.cidade_etanol && <p>Etanol: <strong>{oficial.cidade_etanol}</strong> cidade / <strong>{oficial.estrada_etanol}</strong> estrada (km/L)</p>}
        {oficial.autonomia_km && <p>Autonomia elétrica: <strong>{oficial.autonomia_km}</strong> km</p>}
      </div>
      {insight && <p className="text-xs font-medium text-foreground">{insight}</p>}
      {oficial.match && <p className="text-[10px] text-muted-foreground/70">Referência: {oficial.match}</p>}
    </div>
  );
}

export default ConsumoCard;
