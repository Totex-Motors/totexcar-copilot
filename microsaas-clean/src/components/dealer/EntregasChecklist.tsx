import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardCheck } from "lucide-react";
import { useEntregas, type EntregaChecklist } from "@/hooks/useDealer";

// CHECKLIST DE ENTREGA — o cliente ativa a etiqueta na entrega e o Co-pilot conduz a conferência: foto do
// painel ligado (km + luzes de alerta) e o OK dele nos itens. Aqui a loja vê quem conferiu, quando e com que km.
const STATUS: Record<EntregaChecklist["status"], { label: string; cls: string }> = {
  ok: { label: "Conferida", cls: "bg-green-100 text-green-800" },
  problema: { label: "Problema", cls: "bg-red-100 text-red-800" },
  aguardando_confirmacao: { label: "Falta o OK", cls: "bg-amber-100 text-amber-800" },
  aguardando_foto: { label: "Falta a foto", cls: "bg-amber-100 text-amber-800" },
};
const dh = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const kmBR = (n?: number | null) => (n ? `${Number(n).toLocaleString("pt-BR")} km` : "");

export function EntregasChecklist({ dealership }: { dealership?: string }) {
  const { data, isLoading } = useEntregas(true, dealership);
  const [todas, setTodas] = useState(false);
  const lista = data?.entregas || [];
  const mostrar = todas ? lista : lista.slice(0, 8);
  const r = data?.resumo || {};
  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" /> Checklist de entrega</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Na entrega, o cliente ativa a etiqueta com o vendedor do lado. O Co-pilot pede a foto do painel ligado (km e nenhuma luz de alerta) e o OK do cliente nos itens:
          {" "}{(data?.itens || []).join(" · ")}.
        </p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800">Conferidas: <b>{r.ok || 0}</b></span>
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800">Com problema: <b>{r.problema || 0}</b></span>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Incompletas: <b>{r.pendente || 0}</b></span>
        </div>
        {isLoading ? <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : !lista.length ? (
          <p className="text-sm text-muted-foreground py-3">Nenhuma entrega com checklist ainda. Ele começa na próxima etiqueta ativada.</p>
        ) : (
          <div className="divide-y">
            {mostrar.map((e) => (
              <div key={e.id} className="py-2.5 flex items-start gap-3 text-sm">
                {e.foto_url
                  ? <a href={e.foto_url} target="_blank" rel="noreferrer" className="shrink-0"><img src={e.foto_url} alt="Painel na entrega" className="w-16 h-12 rounded object-cover" /></a>
                  : <div className="w-16 h-12 rounded bg-muted shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">sem foto</div>}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.customer_name || "Cliente"}{e.car_desc ? ` · ${e.car_desc}` : ""}{e.placa ? ` · ${e.placa}` : ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.confirmado_em ? `OK do cliente ${dh(e.confirmado_em)}` : `Iniciado ${dh(e.iniciado_em)}`}
                    {e.km ? ` · ${kmBR(e.km)}` : ""}{e.vendedor_nome ? ` · vendedor ${e.vendedor_nome}` : ""}
                  </div>
                  {e.luz_alerta && <div className="text-xs font-medium text-red-700">Luz de alerta no painel{e.painel_obs ? `: ${e.painel_obs}` : ""}</div>}
                  {e.problema_texto && <div className="text-xs text-red-700">Problema: {e.problema_texto}</div>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</span>
              </div>
            ))}
          </div>
        )}
        {lista.length > 8 && <Button size="sm" variant="outline" className="h-8" onClick={() => setTodas(!todas)}>{todas ? "Mostrar menos" : `Ver todas (${lista.length})`}</Button>}
      </CardContent>
    </Card>
  );
}
