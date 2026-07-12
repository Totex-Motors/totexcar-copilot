import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wrench, Plus, Trash2, CheckCircle2, Gauge, AlertTriangle } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { toast } from "@/hooks/use-toast";
import {
  useMaintenance, useCreateMaintenance, useMarkMaintenanceDone, useDeleteMaintenance,
  maintenanceStatus, type MaintenanceReminder,
} from "@/hooks/useMaintenance";

const kmFmt = (n: number) => `${Number(n || 0).toLocaleString("pt-BR")} km`;

const PRESETS: { title: string; interval: number }[] = [
  { title: "Troca de óleo", interval: 10000 },
  { title: "Filtro de óleo", interval: 10000 },
  { title: "Filtro de ar", interval: 20000 },
  { title: "Rodízio de pneus", interval: 10000 },
  { title: "Alinhamento e balanceamento", interval: 10000 },
  { title: "Pastilhas de freio", interval: 30000 },
  { title: "Correia dentada", interval: 50000 },
  { title: "Velas", interval: 40000 },
  { title: "Revisão geral", interval: 10000 },
];

const LEVEL: Record<string, { label: string; cls: string }> = {
  overdue: { label: "Vencida", cls: "bg-destructive/15 text-destructive" },
  soon: { label: "Próxima", cls: "bg-warning/15 text-warning" },
  ok: { label: "Em dia", cls: "bg-green-500/15 text-green-600" },
};

export default function Manutencao() {
  const { userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data: reminders } = useMaintenance(userId);
  const create = useCreateMaintenance();
  const markDone = useMarkMaintenanceDone();
  const del = useDeleteMaintenance();

  const currentKm = Number(vehicle?.hodometro || 0);
  const [form, setForm] = useState({ title: "", interval: "", last: "" });

  const sorted = useMemo(() => {
    const list = [...(reminders || [])];
    return list.sort((a, b) => maintenanceStatus(a, currentKm).remaining - maintenanceStatus(b, currentKm).remaining);
  }, [reminders, currentKm]);

  const handleAdd = () => {
    const interval = Number(form.interval);
    if (!form.title.trim() || !interval) { toast({ title: "Preencha o item e o intervalo (km)", variant: "destructive" }); return; }
    if (!vehicle) { toast({ title: "Cadastre seu veículo primeiro", variant: "destructive" }); return; }
    const last = form.last === "" ? currentKm : Number(form.last);
    create.mutate(
      { user_id: userId!, account_id: vehicle.id, title: form.title.trim(), interval_km: interval, last_km: last },
      {
        onSuccess: () => { toast({ title: "Lembrete criado" }); setForm({ title: "", interval: "", last: "" }); },
        onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Wrench className="w-7 h-7 text-primary" /> Manutenção por km</h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Gauge className="w-4 h-4" /> Hodômetro atual: <strong className="text-foreground">{kmFmt(currentKm)}</strong>
          {!currentKm && <span className="text-xs">(registre um gasto com a km ou edite em Meu Veículo)</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Novo lembrete */}
        <Card className="border-0 shadow-premium-md lg:col-span-1 h-fit">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Plus className="w-5 h-5" /> Novo lembrete</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex.: Troca de óleo" />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESETS.map((pr) => (
                  <button key={pr.title} type="button"
                    onClick={() => setForm((p) => ({ ...p, title: pr.title, interval: String(pr.interval) }))}
                    className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {pr.title}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>A cada quantos km</Label>
              <Input type="number" value={form.interval} onChange={(e) => setForm((p) => ({ ...p, interval: e.target.value }))} placeholder="10000" />
            </div>
            <div className="space-y-2">
              <Label>Km da última troca</Label>
              <Input type="number" value={form.last} onChange={(e) => setForm((p) => ({ ...p, last: e.target.value }))} placeholder={`atual: ${currentKm}`} />
              <p className="text-xs text-muted-foreground">Se deixar vazio, usamos o hodômetro atual ({kmFmt(currentKm)}).</p>
            </div>
            <Button className="w-full bg-gradient-primary" onClick={handleAdd} disabled={create.isPending}>
              <Plus className="w-4 h-4 mr-2" /> {create.isPending ? "Criando..." : "Adicionar lembrete"}
            </Button>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card className="border-0 shadow-premium-md lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Seus lembretes ({sorted.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {sorted.length ? (
              <div className="divide-y divide-border">
                {sorted.map((r) => {
                  const st = maintenanceStatus(r, currentKm);
                  const lv = LEVEL[st.level];
                  const pct = Math.max(0, Math.min(100, ((r.interval_km - st.remaining) / r.interval_km) * 100));
                  return (
                    <div key={r.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate flex items-center gap-2">
                            {st.level === "overdue" && <AlertTriangle className="w-4 h-4 text-destructive" />}
                            {r.title} <Badge className={`border-0 ${lv.cls}`}>{lv.label}</Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            A cada {kmFmt(r.interval_km)} · última em {kmFmt(r.last_km)} · próxima em <b className="text-foreground">{kmFmt(st.next)}</b>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="sm" variant="outline" onClick={() => markDone.mutate({ id: r.id, last_km: currentKm }, { onSuccess: () => toast({ title: "Marcado como feito", description: `${r.title} em ${kmFmt(currentKm)}` }) })} disabled={markDone.isPending}>
                            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Feito
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <Progress value={pct} className={st.level === "overdue" ? "[&>div]:bg-destructive" : st.level === "soon" ? "[&>div]:bg-warning" : ""} />
                      <p className="text-xs text-right text-muted-foreground">
                        {st.remaining > 0 ? `Faltam ${kmFmt(st.remaining)}` : `Passou ${kmFmt(Math.abs(st.remaining))} do previsto`}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Wrench className="w-8 h-8 text-muted-foreground/50" />
                Nenhum lembrete ainda. Adicione "Troca de óleo a cada 10.000 km" para começar.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
