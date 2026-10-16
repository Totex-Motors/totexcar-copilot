import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Wrench, Plus, Trash2, Search } from "lucide-react";
import { useEstoqueLista, usePreparacoes, usePosvendaAcao, type EstoqueCarro, type Preparacao } from "@/hooks/useDealer";

// PREPARAÇÃO DO CARRO ANTES DA VENDA — o gerente de manutenção registra a troca de óleo + filtro e o km.
// É o PONTO ZERO do motor de manutenção do Co-pilot: na venda, vira o lembrete de troca de óleo do cliente
// (última troca = km da preparação), então o Co-pilot já sabe quando avisar a próxima desde o 1º dia.
const hoje = () => new Date().toISOString().slice(0, 10);
const dataBR = (s?: string | null) => (s ? String(s).split("-").reverse().join("/") : "");
const kmBR = (n?: number | null) => (n ? `${Number(n).toLocaleString("pt-BR")} km` : "");
type Form = {
  id?: string; vehicle_id?: string | null; car_desc: string; placa: string; data: string; km: string; oleo: boolean; oleo_tipo: string;
  filtro_oleo: boolean; filtro_ar: boolean; filtro_combustivel: boolean; filtro_cabine: boolean; intervalo_km: string; obs: string;
};
const vazio = (): Form => ({ car_desc: "", placa: "", data: hoje(), km: "", oleo: true, oleo_tipo: "", filtro_oleo: true, filtro_ar: false, filtro_combustivel: false, filtro_cabine: false, intervalo_km: "10000", obs: "" });

export function PreparacaoTab({ dealership }: { dealership?: string }) {
  const qc = useQueryClient();
  const { data: estoque, isLoading: loadingEstoque } = useEstoqueLista(true, dealership);
  const { data: preps, isLoading: loadingPreps } = usePreparacoes(true, dealership);
  const acao = usePosvendaAcao();
  const [form, setForm] = useState<Form | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "pendentes">("pendentes");

  const carros = estoque || [];
  const revisados = carros.filter((c) => c.preparacao).length;
  const lista = useMemo(() => carros
    .filter((c) => filtro === "todos" || !c.preparacao)
    .filter((c) => !busca.trim() || `${c.desc} ${c.versao || ""} ${c.cor || ""}`.toLowerCase().includes(busca.trim().toLowerCase())),
  [carros, filtro, busca]);

  const abrirDoEstoque = (c: EstoqueCarro) => setForm({ ...vazio(), vehicle_id: c.id, car_desc: [c.desc, c.cor].filter(Boolean).join(" "), km: c.km ? String(c.km) : "" });
  const editar = (p: Preparacao) => setForm({
    id: p.id, vehicle_id: p.vehicle_id, car_desc: p.car_desc || "", placa: p.placa || "", data: p.data, km: String(p.km), oleo: p.oleo, oleo_tipo: p.oleo_tipo || "",
    filtro_oleo: p.filtro_oleo, filtro_ar: p.filtro_ar, filtro_combustivel: p.filtro_combustivel, filtro_cabine: p.filtro_cabine, intervalo_km: String(p.intervalo_km), obs: p.obs || "",
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["preparacoes"] }); qc.invalidateQueries({ queryKey: ["estoque-lista"] }); };
  const salvar = () => {
    if (!form) return;
    if (!(Number(form.km) > 0)) { toast({ title: "Informe o km do carro", variant: "destructive" }); return; }
    if (!form.vehicle_id && !form.car_desc.trim()) { toast({ title: "Informe o carro", variant: "destructive" }); return; }
    acao.mutate({ action: "preparacao_save", ...(dealership ? { dealership } : {}), ...form, km: Number(form.km), intervalo_km: Number(form.intervalo_km) || 10000 }, {
      onSuccess: () => { toast({ title: "Troca de óleo registrada ✅", description: "Na venda, ela vira o lembrete de troca de óleo do cliente no Co-pilot." }); setForm(null); refresh(); },
      onError: (e: any) => toast({ title: "Não consegui salvar", description: String(e?.message || e), variant: "destructive" }),
    });
  };
  const apagar = (p: Preparacao) => {
    if (!confirm("Apagar este registro de preparação?")) return;
    acao.mutate({ action: "preparacao_del", id: p.id, ...(dealership ? { dealership } : {}) }, { onSuccess: () => { toast({ title: "Apagado" }); refresh(); } });
  };
  const set = (k: keyof Form, v: any) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-premium-md">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <div className="font-medium text-foreground flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Preparação do carro antes da venda</div>
          Registre a <b>troca de óleo e filtro</b> e o <b>km</b> de cada carro preparado. Na venda, isso vira o ponto de partida do Co-pilot do cliente:
          ele já sabe quando avisar a próxima troca, e o cliente recebe na entrega “seu carro saiu revisado: óleo e filtro trocados em … com … km”.
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-premium-md"><CardContent className="p-4"><div className="text-xs text-muted-foreground">No estoque</div><div className="text-2xl font-bold">{carros.length}</div></CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Revisados</div><div className="text-2xl font-bold text-green-600">{revisados}</div></CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Sem registro</div><div className="text-2xl font-bold text-amber-600">{carros.length - revisados}</div></CardContent></Card>
      </div>

      <Card className="border-0 shadow-premium-md">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Carros do estoque</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant={filtro === "pendentes" ? "default" : "outline"} className="h-8" onClick={() => setFiltro("pendentes")}>Sem registro</Button>
            <Button size="sm" variant={filtro === "todos" ? "default" : "outline"} className="h-8" onClick={() => setFiltro("todos")}>Todos</Button>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setForm(vazio())}><Plus className="w-3.5 h-3.5" /> Carro fora do estoque</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" /><Input className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por modelo, ano ou cor" /></div>
          {loadingEstoque ? <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : !lista.length ? (
            <p className="text-sm text-muted-foreground py-3">{filtro === "pendentes" && carros.length ? "Todos os carros do estoque estão com a troca de óleo registrada. 👏" : "Nenhum carro encontrado."}</p>
          ) : (
            <div className="divide-y">
              {lista.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2.5">
                  {c.capa ? <img src={c.capa} alt="" loading="lazy" className="w-16 h-11 rounded object-cover shrink-0" /> : <div className="w-16 h-11 rounded bg-muted shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.desc}</div>
                    <div className="text-xs text-muted-foreground truncate">{[c.versao, c.cor, c.km ? `${kmBR(c.km)} no anúncio` : null].filter(Boolean).join(" · ")}</div>
                    {c.preparacao
                      ? <div className="text-xs text-green-700 font-medium">🛠️ Óleo e filtro em {dataBR(c.preparacao.data)} · {kmBR(c.preparacao.km)}{c.preparacao.feito_por ? ` · ${c.preparacao.feito_por}` : ""}</div>
                      : <div className="text-xs text-amber-700 font-medium">⚠️ Sem troca de óleo registrada</div>}
                  </div>
                  <Button size="sm" variant={c.preparacao ? "outline" : "default"} className="h-8 shrink-0" onClick={() => abrirDoEstoque(c)}>{c.preparacao ? "Nova troca" : "Registrar"}</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-premium-md">
        <CardHeader className="pb-2"><CardTitle className="text-base">Histórico de preparações</CardTitle></CardHeader>
        <CardContent>
          {loadingPreps ? <Loader2 className="w-5 h-5 animate-spin" /> : !(preps || []).length ? <p className="text-sm text-muted-foreground">Nenhuma troca registrada ainda.</p> : (
            <div className="divide-y">
              {(preps || []).slice(0, 60).map((p) => (
                <div key={p.id} className="py-2 flex items-center gap-2 text-sm">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => editar(p)}>
                    <div className="font-medium truncate">{p.car_desc || "Carro do estoque"}{p.placa ? ` · ${p.placa}` : ""}</div>
                    <div className="text-xs text-muted-foreground">
                      {dataBR(p.data)} · {kmBR(p.km)} · {[p.oleo && `óleo${p.oleo_tipo ? ` ${p.oleo_tipo}` : ""}`, p.filtro_oleo && "filtro de óleo", p.filtro_ar && "filtro de ar", p.filtro_combustivel && "filtro de combustível", p.filtro_cabine && "filtro de cabine"].filter(Boolean).join(", ")}
                      {" · próxima: "}{kmBR(p.km + p.intervalo_km)}{p.feito_por ? ` · ${p.feito_por}` : ""}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => apagar(p)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Editar troca de óleo" : "Registrar troca de óleo"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Carro</Label>
                <Input value={form.car_desc} onChange={(e) => set("car_desc", e.target.value)} placeholder="Ex.: Tank 300 2026 preto" disabled={!!form.vehicle_id && !form.id} />
              </div>
              {!form.vehicle_id && <div className="space-y-1"><Label className="text-xs">Placa (carro fora do estoque)</Label><Input value={form.placa} onChange={(e) => set("placa", e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} /></div>}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Data da troca</Label><Input type="date" value={form.data} max={hoje()} onChange={(e) => set("data", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Km do carro</Label><Input type="number" inputMode="numeric" value={form.km} onChange={(e) => set("km", e.target.value)} placeholder="48200" /></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">O que foi trocado</Label>
                {([["oleo", "Óleo do motor"], ["filtro_oleo", "Filtro de óleo"], ["filtro_ar", "Filtro de ar"], ["filtro_combustivel", "Filtro de combustível"], ["filtro_cabine", "Filtro de cabine (ar-condicionado)"]] as [keyof Form, string][]).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={!!form[k]} onCheckedChange={(v) => set(k, v === true)} /> {label}</label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Tipo de óleo (opcional)</Label><Input value={form.oleo_tipo} onChange={(e) => set("oleo_tipo", e.target.value)} placeholder="5W30 sintético" /></div>
                <div className="space-y-1"><Label className="text-xs">Próxima troca a cada</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={form.intervalo_km} onChange={(e) => set("intervalo_km", e.target.value)}>
                    {["5000", "7500", "10000", "15000"].map((v) => <option key={v} value={v}>{Number(v).toLocaleString("pt-BR")} km</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Observação (opcional)</Label><Input value={form.obs} onChange={(e) => set("obs", e.target.value)} placeholder="Ex.: pastilhas de freio novas" /></div>
              {Number(form.km) > 0 && <p className="text-xs text-muted-foreground">Próxima troca de óleo: <b>{kmBR(Number(form.km) + (Number(form.intervalo_km) || 10000))}</b>. O Co-pilot avisa o cliente antes.</p>}
              <Button className="w-full" disabled={acao.isPending} onClick={salvar}>{acao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
