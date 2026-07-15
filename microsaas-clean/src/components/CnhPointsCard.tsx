import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IdCard, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { computeCnh, type MultaLike } from "@/lib/cnhPoints";

const fmtDate = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

const RISCO: Record<string, { bar: string; text: string; Icon: any; ring: string }> = {
  baixo: { bar: "bg-green-500", text: "text-green-600", Icon: ShieldCheck, ring: "border-green-500/30 bg-green-500/[0.06]" },
  medio: { bar: "bg-amber-500", text: "text-amber-600", Icon: ShieldAlert, ring: "border-amber-500/30 bg-amber-500/[0.06]" },
  alto: { bar: "bg-orange-500", text: "text-orange-600", Icon: ShieldAlert, ring: "border-orange-500/30 bg-orange-500/[0.07]" },
  suspensao: { bar: "bg-red-500", text: "text-red-600", Icon: ShieldX, ring: "border-red-500/30 bg-red-500/[0.08]" },
};

// Card "Pontos na CNH" — soma os pontos dos últimos 12 meses das multas registradas e mostra
// o risco de suspensão (regra nova do CTB). Fonte: multas cadastradas aqui (pode não ser o total oficial).
export function CnhPointsCard({ multas, ear }: { multas: MultaLike[]; ear?: boolean }) {
  const r = computeCnh(multas || [], { ear });
  const st = RISCO[r.risco];
  const pct = Math.min(100, Math.round((r.pontos / r.limite) * 100));

  const msg =
    r.risco === "suspensao" ? "Você atingiu o limite de pontos — risco de suspensão da CNH. Busque orientação e verifique recursos em aberto."
    : r.risco === "alto" ? `Atenção: faltam apenas ${r.faltam} ponto(s) para o limite de ${r.limite}.`
    : r.risco === "medio" ? `Faltam ${r.faltam} ponto(s) para o limite de ${r.limite}.`
    : r.pontos === 0 ? "Sua CNH está zerada nos últimos 12 meses. 👏"
    : `Tranquilo: ${r.pontos} de ${r.limite} pontos nos últimos 12 meses.`;

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <IdCard className="w-4 h-4 text-primary" /> Pontos na CNH
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <span className={`text-4xl font-bold ${st.text}`}>{r.pontos}</span>
          <span className="text-muted-foreground text-sm pb-1.5">de {r.limite} pts (limite de suspensão)</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full ${st.bar} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${st.ring}`}>
          <st.Icon className={`w-5 h-5 shrink-0 ${st.text}`} />
          <div className="space-y-1">
            <p className="font-medium text-foreground">{msg}</p>
            {r.proxima_queda && r.pontos > 0 && (
              <p className="text-xs text-muted-foreground">
                Seus pontos caem <strong>{r.proxima_queda.pontos}</strong> em {fmtDate(r.proxima_queda.data)} (12 meses da infração mais antiga).
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Limite de {r.limite} pts{ear ? " (CNH com EAR)" : r.gravissimas >= 2 ? " — você tem 2+ infrações gravíssimas" : r.gravissimas === 1 ? " — você tem 1 infração gravíssima" : " — sem infrações gravíssimas"}.
          {!ear && " Se sua CNH tem EAR (atividade remunerada), o limite é 40."}
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          Baseado nas {r.consideradas} multa(s) registradas aqui nos últimos 12 meses — pode não incluir todas. Confirme o total no DETRAN.
        </p>
      </CardContent>
    </Card>
  );
}

export default CnhPointsCard;
