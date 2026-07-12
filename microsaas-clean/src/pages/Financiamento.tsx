import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Banknote, Plus, Trash2, CheckCircle2, ScanLine, CalendarClock } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { toast } from "@/hooks/use-toast";
import {
  useFinancings, useCreateFinancing, useUpdateFinancing, useDeleteFinancing,
  financingStatus, type Financiamento,
} from "@/hooks/useFinancing";
import { decodeBoleto } from "@/utils/boleto";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));
const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");

const emptyForm = { banco: "", valor_parcela: "", num_parcelas: "", parcelas_pagas: "0", primeira_parcela: "", valor_total: "", valor_entrada: "", boleto_linha: "" };

export default function Financiamento() {
  const { userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data: financings } = useFinancings(userId);
  const create = useCreateFinancing();
  const update = useUpdateFinancing();
  const del = useDeleteFinancing();

  const [form, setForm] = useState(emptyForm);

  const lerBoleto = () => {
    const { valor, vencimento } = decodeBoleto(form.boleto_linha);
    if (!valor && !vencimento) {
      toast({ title: "Não reconheci o boleto", description: "Confira a linha digitável (47 dígitos do boleto bancário) ou preencha manualmente.", variant: "destructive" });
      return;
    }
    setForm((p) => ({
      ...p,
      valor_parcela: valor ? String(valor.toFixed(2)) : p.valor_parcela,
      primeira_parcela: vencimento || p.primeira_parcela,
    }));
    toast({ title: "Boleto lido! 🧾", description: `${valor ? brl(valor) : "valor —"} · vence ${vencimento ? new Date(vencimento).toLocaleDateString("pt-BR") : "—"}. Confira e complete.` });
  };

  const handleAdd = () => {
    const valor_parcela = Number(form.valor_parcela);
    const num_parcelas = Number(form.num_parcelas);
    if (!valor_parcela || !num_parcelas || !form.primeira_parcela) {
      toast({ title: "Preencha valor da parcela, nº de parcelas e a data da 1ª parcela", variant: "destructive" });
      return;
    }
    create.mutate(
      {
        user_id: userId!,
        account_id: vehicle?.id ?? null,
        banco: form.banco.trim() || null,
        valor_parcela,
        num_parcelas,
        parcelas_pagas: Number(form.parcelas_pagas) || 0,
        primeira_parcela: form.primeira_parcela,
        valor_total: form.valor_total ? Number(form.valor_total) : null,
        valor_entrada: form.valor_entrada ? Number(form.valor_entrada) : null,
        boleto_linha: form.boleto_linha.replace(/\D/g, "") || null,
      } as any,
      {
        onSuccess: () => { toast({ title: "Financiamento cadastrado" }); setForm(emptyForm); },
        onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  const pagarParcela = (f: Financiamento) => {
    if (f.parcelas_pagas >= f.num_parcelas) return;
    update.mutate({ id: f.id, parcelas_pagas: f.parcelas_pagas + 1 }, {
      onSuccess: () => toast({ title: "Parcela registrada", description: `${f.parcelas_pagas + 1}/${f.num_parcelas} pagas` }),
    });
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  const list = financings || [];

  return (
    <DashboardLayout>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Banknote className="w-7 h-7 text-primary" /> Financiamento</h1>
        <p className="text-muted-foreground">Cadastre o financiamento do seu carro e acompanhe as parcelas. Em breve, alertas no WhatsApp antes de cada vencimento.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Novo financiamento */}
        <Card className="border-0 shadow-premium-md lg:col-span-1 h-fit">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Plus className="w-5 h-5" /> Novo financiamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Leitor de boleto */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold"><ScanLine className="w-4 h-4 text-primary" /> Tem o boleto? Cole a linha digitável</Label>
              <Input value={form.boleto_linha} onChange={(e) => setForm((p) => ({ ...p, boleto_linha: e.target.value }))} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={lerBoleto}>
                <ScanLine className="w-4 h-4 mr-1.5" /> Ler valor e vencimento
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Banco / financeira</Label>
              <Input value={form.banco} onChange={(e) => setForm((p) => ({ ...p, banco: e.target.value }))} placeholder="Ex.: Banco BV, Santander..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor da parcela</Label>
                <Input type="number" step="0.01" value={form.valor_parcela} onChange={(e) => setForm((p) => ({ ...p, valor_parcela: e.target.value }))} placeholder="980.00" />
              </div>
              <div className="space-y-2">
                <Label>Nº de parcelas</Label>
                <Input type="number" value={form.num_parcelas} onChange={(e) => setForm((p) => ({ ...p, num_parcelas: e.target.value }))} placeholder="48" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Parcelas já pagas</Label>
                <Input type="number" value={form.parcelas_pagas} onChange={(e) => setForm((p) => ({ ...p, parcelas_pagas: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>1ª parcela (data)</Label>
                <Input type="date" value={form.primeira_parcela} onChange={(e) => setForm((p) => ({ ...p, primeira_parcela: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor total <span className="text-muted-foreground">(opcional)</span></Label>
                <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm((p) => ({ ...p, valor_total: e.target.value }))} placeholder="47000.00" />
              </div>
              <div className="space-y-2">
                <Label>Entrada <span className="text-muted-foreground">(opcional)</span></Label>
                <Input type="number" step="0.01" value={form.valor_entrada} onChange={(e) => setForm((p) => ({ ...p, valor_entrada: e.target.value }))} placeholder="10000.00" />
              </div>
            </div>
            <Button className="w-full bg-gradient-primary" onClick={handleAdd} disabled={create.isPending}>
              <Plus className="w-4 h-4 mr-2" /> {create.isPending ? "Salvando..." : "Cadastrar financiamento"}
            </Button>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card className="border-0 shadow-premium-md lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Seus financiamentos ({list.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {list.length ? (
              <div className="divide-y divide-border">
                {list.map((f) => {
                  const st = financingStatus(f);
                  const pct = Math.max(0, Math.min(100, (f.parcelas_pagas / f.num_parcelas) * 100));
                  const venceProx = st.dias != null && st.dias <= 5 && st.dias >= 0;
                  const atrasada = st.dias != null && st.dias < 0;
                  return (
                    <div key={f.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate flex items-center gap-2">
                            {f.banco || "Financiamento"}
                            {st.quitado
                              ? <Badge className="border-0 bg-green-500/15 text-green-600">Quitado</Badge>
                              : atrasada
                                ? <Badge className="border-0 bg-destructive/15 text-destructive">Parcela atrasada</Badge>
                                : venceProx
                                  ? <Badge className="border-0 bg-warning/15 text-warning">Vence em {st.dias}d</Badge>
                                  : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {f.parcelas_pagas}/{f.num_parcelas} parcelas · {brl(f.valor_parcela)}/mês
                            {!st.quitado && <> · próxima <b className="text-foreground inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />{fmtDate(st.proximaData)}</b></>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!st.quitado && (
                            <Button size="sm" variant="outline" onClick={() => pagarParcela(f)} disabled={update.isPending}>
                              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Paguei
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(f.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <Progress value={pct} className={atrasada ? "[&>div]:bg-destructive" : venceProx ? "[&>div]:bg-warning" : ""} />
                      <p className="text-xs text-right text-muted-foreground">
                        {st.quitado ? "Pago integralmente 🎉" : `Faltam ${st.restantes} parcelas · saldo ${brl(st.saldoDevedor)}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Banknote className="w-8 h-8 text-muted-foreground/50" />
                Nenhum financiamento ainda. Cadastre o seu (ou cole a linha digitável do boleto) para acompanhar as parcelas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
