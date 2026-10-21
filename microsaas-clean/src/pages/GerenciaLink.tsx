import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, ShoppingBag, Headset, Lightbulb } from "lucide-react";
import { setLinkToken, usePosvendaCasos, usePosvendaStats, usePosvendaOportunidades, useEntregas } from "@/hooks/useDealer";
import { LinkShell } from "@/components/link/LinkShell";
import { EntregasChecklist } from "@/components/dealer/EntregasChecklist";
import { TrocasClientes } from "@/components/dealer/PreparacaoTab";

// LINK DO GERENTE GERAL: /gerencia/{token}. Sem login, o acompanhamento da loja no celular: placar do
// processo por vendedor, vendas com o que cada uma cumpriu, checklists de entrega, atendimentos em
// andamento, oportunidades e trocas de óleo dos clientes. Só leitura: cobrar a equipe é com ele.

type Venda = {
  id: string; cliente: string; carro: string | null; data: string; vendedor: string | null; etiqueta: string | null;
  checklist: string | null; km_entrega: number | null; nota: number | null; pct: number;
  etapas: { vendedor: boolean; revisado: boolean; etiqueta: boolean; ativou: boolean; checklist: boolean; google: boolean };
};
const ETAPAS: [keyof Venda["etapas"], string][] = [["vendedor", "Vendedor"], ["revisado", "Revisado"], ["etiqueta", "Etiqueta"], ["ativou", "Ativou"], ["checklist", "Checklist"], ["google", "Google"]];
const dataBR = (s?: string | null) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
const ha = (s: string) => { const m = Math.round((Date.now() - new Date(s).getTime()) / 60000); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
const corPct = (p: number) => (p >= 90 ? "bg-green-500" : p >= 70 ? "bg-amber-500" : "bg-red-500");

function useGerenciaVendas(token: string, dias: number) {
  return useQuery({
    queryKey: ["gerencia-vendas", token, dias],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("dealer-api", { body: { action: "gerencia_vendas", dias, t: token } });
      if (error || data?.error) throw new Error(data?.error || "erro");
      return data as { vendas: Venda[]; placar: { nome: string; vendas: number; pct: number }[] };
    },
    refetchInterval: 120_000,
  });
}

function Painel({ token }: { token: string }) {
  const [dias, setDias] = useState(30);
  const { data: vend, isLoading } = useGerenciaVendas(token, dias);
  const { data: stats } = usePosvendaStats(true, dias);
  const { data: casosData } = usePosvendaCasos(true, "ativos");
  const { data: ops } = usePosvendaOportunidades(true, "abertas");
  const { data: ent } = useEntregas(true);
  const [todas, setTodas] = useState(false);
  const vendas = vend?.vendas || [];
  const media = vendas.length ? Math.round(vendas.reduce((a, v) => a + v.pct, 0) / vendas.length) : null;
  const casos = casosData?.casos || [];
  const motivos = casosData?.motivos || {};

  return (
    <>
      <div className="flex gap-1.5">
        {[7, 30, 90].map((d) => <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} className="h-8" onClick={() => setDias(d)}>{d} dias</Button>)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Vendas" value={String(vendas.length)} />
        <Kpi label="Processo cumprido" value={media == null ? "—" : `${media}%`} accent={media == null ? "" : media >= 90 ? "text-green-600" : media >= 70 ? "text-amber-600" : "text-red-600"} />
        <Kpi label="Entregas conferidas" value={`${ent?.resumo?.ok || 0}`} hint={`${ent?.resumo?.problema || 0} com problema`} />
        <Kpi label="Nota dos clientes" value={stats?.nota_media != null ? `${stats.nota_media.toFixed(1)} ⭐` : "—"} hint={stats?.min_ate_assumir != null ? `assumem em ${stats.min_ate_assumir} min` : undefined} />
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Placar do processo por vendedor</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          <p className="text-xs text-muted-foreground">Média das 6 etapas de cada venda: vendedor marcado, carro revisado, etiqueta, cliente ativou, checklist de entrega e pedido de avaliação no Google.</p>
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : !(vend?.placar || []).length ? <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p> : (vend!.placar.map((p) => (
            <div key={p.nome}>
              <div className="flex justify-between text-sm"><span className="font-medium">{p.nome}</span><span className="text-muted-foreground">{p.vendas} venda{p.vendas > 1 ? "s" : ""} · <b className="text-foreground">{p.pct}%</b></span></div>
              <div className="h-2 rounded-full bg-muted mt-1 overflow-hidden"><div className={`h-full ${corPct(p.pct)}`} style={{ width: `${p.pct}%` }} /></div>
            </div>
          )))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-primary" /> Vendas e o que cada uma cumpriu</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!vendas.length ? <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p> : (
            <div className="divide-y">
              {(todas ? vendas : vendas.slice(0, 10)).map((v) => (
                <div key={v.id} className="py-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="truncate"><b>{v.cliente}</b>{v.carro ? ` · ${v.carro}` : ""}</div>
                      <div className="text-xs text-muted-foreground">{dataBR(v.data)} · {v.vendedor || <span className="text-red-700">sem vendedor</span>}{v.etiqueta ? ` · ${v.etiqueta}` : ""}{v.nota != null ? ` · nota ${v.nota}` : ""}</div>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full text-white ${corPct(v.pct)}`}>{v.pct}%</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ETAPAS.map(([k, label]) => (
                      <span key={k} className={`text-[10.5px] px-1.5 py-0.5 rounded ${v.etapas[k] ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{v.etapas[k] ? "✓" : "✗"} {label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {vendas.length > 10 && <Button size="sm" variant="outline" className="h-8" onClick={() => setTodas(!todas)}>{todas ? "Mostrar menos" : `Ver todas (${vendas.length})`}</Button>}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Headset className="w-4 h-4 text-primary" /> Atendimentos em andamento ({casos.length})</CardTitle></CardHeader>
        <CardContent>
          {!casos.length ? <p className="text-sm text-muted-foreground">Nenhum cliente esperando agora. 👏</p> : (
            <div className="divide-y">
              {casos.map((c) => (
                <div key={c.id} className="py-2 text-sm flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="truncate"><b>#{c.numero}</b> {String(c.customer_name || "Cliente").split(" ")[0]}{c.car_desc ? ` · ${c.car_desc}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{motivos[c.motivo] || c.motivo} · {c.agente_nome ? `com ${c.agente_nome}` : <span className="text-amber-700 font-medium">esperando alguém assumir</span>} · há {ha(c.created_at)}</div>
                    {c.resumo && <div className="text-xs mt-0.5 line-clamp-2">{c.resumo}</div>}
                  </div>
                  {(c.prioridade === "alta" || c.prioridade === "urgente") && <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 uppercase">{c.prioridade}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EntregasChecklist />

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4 text-primary" /> Oportunidades abertas ({(ops?.oportunidades || []).length})</CardTitle></CardHeader>
        <CardContent>
          {!(ops?.oportunidades || []).length ? <p className="text-sm text-muted-foreground">Nenhuma oportunidade aberta.</p> : (
            <div className="divide-y">
              {ops!.oportunidades.slice(0, 15).map((o) => (
                <div key={o.id} className="py-2 text-sm">
                  <div className="truncate"><b>{ops!.tipos[o.tipo] || o.tipo}</b> · {String(o.customer_name || "Cliente").split(" ")[0]}{o.car_desc ? ` · ${o.car_desc}` : ""}</div>
                  <div className="text-xs text-muted-foreground">{o.vendedor_nome ? `com ${o.vendedor_nome}` : "sem vendedor"} · {o.status === "nova" ? "ainda não tratada" : o.status.replace("_", " ")} · há {ha(o.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TrocasClientes />
    </>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="border-0 shadow-md"><CardContent className="p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${accent || ""}`}>{value}</div>
      {hint && <div className="text-[10.5px] text-muted-foreground">{hint}</div>}
    </CardContent></Card>
  );
}

export default function GerenciaLink() {
  const { token = "" } = useParams();
  setLinkToken(token);
  return <LinkShell token={token} titulo="Gerência">{() => <Painel token={token} />}</LinkShell>;
}
