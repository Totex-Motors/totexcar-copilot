import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, TrendingDown, Route, CalendarRange } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useCusto } from "@/hooks/useCusto";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const BUCKET_COLOR: Record<string, string> = {
  "Combustível": "bg-amber-500",
  "Manutenção": "bg-sky-500",
  "Fixos (imposto/seguro)": "bg-violet-500",
  "Financiamento": "bg-rose-500",
  "Outros": "bg-slate-400",
};

// Card "Custo do carro": custo REAL por km (CPK) + custo mensal + pra onde vai o dinheiro.
// Alimentado pelos gastos + hodômetro que o dono registra (cupom + foto do painel no WhatsApp).
export function CustoCard() {
  const { userId } = useCurrentUser();
  const { data: custo, isLoading } = useCusto(userId);

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" /> Custo do carro
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : !custo ? (
          <p className="text-sm text-muted-foreground">
            Assim que você registrar alguns gastos (com o km do hodômetro), eu calculo quanto seu carro custa
            por mês e por km rodado. Continue mandando cupom + hodômetro no WhatsApp. 🚗
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-end gap-1.5">
                  <span className="text-3xl font-bold text-foreground">{custo.custo_por_km != null ? brl(custo.custo_por_km) : "—"}</span>
                  <span className="text-muted-foreground text-xs pb-1.5">por km</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Route className="w-3 h-3" /> {custo.km_rodados.toLocaleString("pt-BR")} km no período</p>
              </div>
              <div>
                <div className="flex items-end gap-1.5">
                  <span className="text-2xl font-bold text-foreground">{brl(custo.custo_mensal)}</span>
                  <span className="text-muted-foreground text-xs pb-1">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarRange className="w-3 h-3" /> média de ~{custo.meses} {custo.meses > 1 ? "meses" : "mês"}</p>
              </div>
            </div>

            {/* barra de composição */}
            <div className="space-y-2">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full">
                {custo.buckets.map((b) => (
                  <div key={b.label} className={BUCKET_COLOR[b.label] || "bg-slate-400"} style={{ width: `${b.pct}%` }} title={`${b.label}: ${b.pct}%`} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {custo.buckets.map((b) => (
                  <div key={b.label} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                      <span className={`w-2 h-2 rounded-full ${BUCKET_COLOR[b.label] || "bg-slate-400"}`} /> {b.label}
                    </span>
                    <span className="font-medium shrink-0">{brl(b.valor)}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-primary" /> Total gasto no período: <strong className="text-foreground">{brl(custo.total)}</strong> · {custo.lancamentos} lançamentos
            </p>
            <p className="text-[10px] text-muted-foreground/70">Não inclui a desvalorização do carro (depreciação) — em breve.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CustoCard;
