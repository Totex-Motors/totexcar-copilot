import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertTriangle, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// AUDITORIA DAS TRATATIVAS: o que o cliente respondeu, o que a Nina disse e o que ela GRAVOU.
// "Conferir" = disse que anotou/registrou e nenhuma ação gravou. "Possível" = histórico anterior à
// auditoria (só temos os textos) em que a fala promete: vale ler.
type Item = {
  id: string; quando: string; nome: string | null; telefone: string; situacao: "conferir" | "possivel" | "ok" | "conferida"; motivo: string | null;
  aviso: { assunto: string; texto: string; quando: string } | null; cliente: string; nina: string; acoes: { n: string; ok: boolean }[] | null;
};
const FILTROS: [string, string][] = [["pendentes", "Para conferir"], ["avisos", "Respostas a avisos"], ["todas", "Todas"]];
const fone = (t: string) => t.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function TratativasTab() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("pendentes");
  const [dias, setDias] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["tratativas", filtro, dias],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-api", { body: { action: "tratativas", filtro, dias } });
      if (error) throw error;
      return data as { totais: { conferir: number; possivel: number; respostas_a_avisos: number; conferidas: number }; itens: Item[] };
    },
  });
  const conferida = async (id: string) => {
    const { data: r } = await supabase.functions.invoke("admin-api", { body: { action: "tratativa_conferida", id } });
    if (!r?.ok) { toast({ title: "Não deu certo", variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["tratativas"] });
  };
  const t = data?.totais;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Para conferir</div><div className="text-2xl font-bold text-destructive">{t?.conferir ?? "…"}</div><div className="text-[11px] text-muted-foreground">disse que anotou e nada foi gravado</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Possíveis (histórico)</div><div className="text-2xl font-bold text-amber-600">{t?.possivel ?? "…"}</div><div className="text-[11px] text-muted-foreground">antes da auditoria: vale ler</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Respostas a avisos</div><div className="text-2xl font-bold">{t?.respostas_a_avisos ?? "…"}</div><div className="text-[11px] text-muted-foreground">nos últimos {dias} dias</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Já conferidas</div><div className="text-2xl font-bold text-green-600">{t?.conferidas ?? "…"}</div></CardContent></Card>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {FILTROS.map(([v, l]) => <Button key={v} size="sm" variant={filtro === v ? "default" : "outline"} onClick={() => setFiltro(v)}>{l}</Button>)}
        <select className="h-9 rounded-md border bg-background px-2 text-sm ml-auto" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {[7, 15, 30, 60].map((d) => <option key={d} value={d}>últimos {d} dias</option>)}
        </select>
      </div>
      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        : !data?.itens?.length ? <p className="text-sm text-muted-foreground py-6">Nada para conferir neste filtro. 👍</p>
        : data.itens.map((i) => (
          <Card key={i.id} className={i.situacao === "conferir" ? "border-destructive/50" : i.situacao === "possivel" ? "border-amber-400/60" : ""}>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <b>{i.nome || "Cliente"}</b><span className="text-muted-foreground">{fone(i.telefone)} · {dt(i.quando)}</span>
                {i.situacao === "conferir" && <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Conferir</Badge>}
                {i.situacao === "possivel" && <Badge className="bg-amber-500/15 text-amber-700 border-0">Possível (histórico)</Badge>}
                {i.situacao === "conferida" && <Badge className="bg-green-500/15 text-green-700 border-0">Conferida</Badge>}
                {(i.situacao === "conferir" || i.situacao === "possivel") && (
                  <Button size="sm" variant="outline" className="ml-auto gap-1" onClick={() => conferida(i.id)}><CheckCircle2 className="w-4 h-4" /> Marcar como conferida</Button>
                )}
              </div>
              {i.motivo && <p className="text-destructive text-xs">{i.motivo}</p>}
              {i.aviso && (
                <div className="rounded-md bg-muted/60 p-2">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Aviso do Co-pilot{i.aviso.assunto ? ` · ${i.aviso.assunto}` : ""} · {dt(i.aviso.quando)}</div>
                  {i.aviso.texto}
                </div>
              )}
              <div><span className="text-[11px] text-muted-foreground">Cliente disse</span><div className="whitespace-pre-wrap">{i.cliente}</div></div>
              <div><span className="text-[11px] text-muted-foreground">Nina respondeu</span><div className="whitespace-pre-wrap">{i.nina}</div></div>
              <div className="text-xs">
                <span className="text-muted-foreground">O que foi gravado: </span>
                {i.acoes === null ? <span className="text-muted-foreground">sem registro (conversa anterior à auditoria)</span>
                  : i.acoes.length === 0 ? <b className="text-destructive">nada</b>
                  : i.acoes.map((a, k) => <Badge key={k} variant="outline" className={`mr-1 ${a.ok ? "" : "border-destructive text-destructive"}`}>{a.n}{a.ok ? "" : " (falhou)"}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
