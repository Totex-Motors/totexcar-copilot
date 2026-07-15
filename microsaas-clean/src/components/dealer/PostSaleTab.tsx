import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, UserPlus, Star, Settings2, Smile, Meh, Frown, Send, FileCheck, ShieldCheck, Gift } from "lucide-react";
import {
  usePostsaleList, usePostsaleStats, usePostsaleConfig, usePostsaleCreate, usePostsaleConfigSave, usePostsaleTransferSave,
  type PostsaleJourney,
} from "@/hooks/useDealer";

const TRANSFER_STEPS: Array<[string, string]> = [
  ["vistoria", "Vistoria (se exigida)"],
  ["atpv", "ATPV-e (autorização) assinada"],
  ["taxas", "Taxas do DETRAN pagas"],
  ["debitos", "Débitos quitados (IPVA/multas)"],
  ["comunicacao", "Comunicação de venda"],
  ["crlv_novo", "Novo CRLV-e em nome do comprador"],
];

const STATUS: Record<string, { label: string; cls: string; Icon: any }> = {
  ativo: { label: "Aguardando", cls: "bg-muted text-muted-foreground", Icon: Send },
  promotor: { label: "Promotor", cls: "bg-green-500/15 text-green-600", Icon: Smile },
  passivo: { label: "Neutro", cls: "bg-amber-500/15 text-amber-600", Icon: Meh },
  detrator: { label: "Detrator", cls: "bg-red-500/15 text-red-600", Icon: Frown },
  encerrado: { label: "Encerrado", cls: "bg-muted text-muted-foreground", Icon: Send },
};

export function PostSaleTab({ dealership }: { dealership?: string }) {
  const qc = useQueryClient();
  const enabled = true;
  const { data: stats } = usePostsaleStats(enabled, dealership);
  const { data: list, isLoading } = usePostsaleList(enabled, dealership);
  const { data: cfgData } = usePostsaleConfig(enabled, dealership);
  const create = usePostsaleCreate();
  const saveCfg = usePostsaleConfigSave();

  const [form, setForm] = useState({ customer_name: "", customer_phone: "", car_desc: "", purchase_date: "", placa: "", valor_compra: "" });
  const [cortesia, setCortesia] = useState(false);
  const [reviewUrl, setReviewUrl] = useState("");
  const [delay, setDelay] = useState("");
  const [editing, setEditing] = useState<PostsaleJourney | null>(null);

  // sincroniza os campos de config quando carregam
  const cfg = cfgData?.config;
  useEffect(() => {
    if (!cfg) return;
    setReviewUrl(cfg.google_review_url || "");
    setDelay(String(cfg.nps_delay_days ?? 3));
  }, [cfg]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["postsale-list"] });
    qc.invalidateQueries({ queryKey: ["postsale-stats"] });
  };

  const registrar = () => {
    if (form.customer_phone.replace(/\D/g, "").length < 10) {
      toast({ title: "Telefone inválido", description: "Informe o WhatsApp com DDD.", variant: "destructive" });
      return;
    }
    create.mutate({
      customer_name: form.customer_name || undefined,
      customer_phone: form.customer_phone,
      car_desc: form.car_desc || undefined,
      purchase_date: form.purchase_date || undefined,
      cortesia: cortesia || undefined,
      placa: cortesia && form.placa ? form.placa : undefined,
      valor_compra: cortesia && Number(form.valor_compra) > 0 ? Number(form.valor_compra) : undefined,
      dealership: dealership || undefined,
    }, {
      onSuccess: (r: any) => {
        toast({
          title: "Cliente registrado! 🎉",
          description: r?.sponsored
            ? `Cortesia de 1 ano ativada — conta premium criada${r?.vehicle_created ? " e veículo cadastrado" : ""}.`
            : r?.welcome_sent ? "Mensagem de boas-vindas enviada no WhatsApp." : "Jornada criada (WhatsApp não enviou — confira as credenciais).",
        });
        setForm({ customer_name: "", customer_phone: "", car_desc: "", purchase_date: "", placa: "", valor_compra: "" });
        setCortesia(false);
        refresh();
      },
      onError: (e: any) => toast({ title: "Não foi possível registrar", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  const salvarConfig = () => {
    saveCfg.mutate({ google_review_url: reviewUrl || undefined, nps_delay_days: Number(delay) || 3, dealership: dealership || undefined }, {
      onSuccess: () => { toast({ title: "Configuração salva ✅" }); qc.invalidateQueries({ queryKey: ["postsale-config"] }); },
      onError: (e: any) => toast({ title: "Erro ao salvar", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      {/* KPIs de NPS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="NPS" value={stats?.nps != null ? String(stats.nps) : "—"} hint={`${stats?.respondidos ?? 0} respostas`} accent="text-primary" />
        <Kpi label="Promotores" value={String(stats?.promotores ?? 0)} accent="text-green-600" />
        <Kpi label="Neutros" value={String(stats?.passivos ?? 0)} accent="text-amber-600" />
        <Kpi label="Detratores" value={String(stats?.detratores ?? 0)} accent="text-red-600" />
      </div>

      {/* Cortesias patrocinadas pela loja (pós-pago) */}
      {(stats?.cortesias_ativas ?? 0) > 0 && (
        <Card className="border-0 shadow-premium-md bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Gift className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm">
              <strong>{stats?.cortesias_ativas}</strong> cortesia(s) ativa(s) — saldo a acertar:{" "}
              <strong>{(stats?.cortesias_valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
              <span className="text-muted-foreground"> · você oferece 1 ano do Co-pilot e acerta com a Totex depois (pós-pago).</span>
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registrar cliente */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" /> Registrar cliente (pós-venda)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Ao registrar, o cliente recebe boas-vindas no WhatsApp com o bônus do Co-pilot, e a jornada de NPS começa automaticamente.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={form.customer_name} onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))} placeholder="Nome do cliente" /></div>
              <div className="space-y-1"><Label className="text-xs">WhatsApp (com DDD)</Label><Input value={form.customer_phone} onChange={(e) => setForm((p) => ({ ...p, customer_phone: e.target.value }))} placeholder="11987654321" /></div>
              <div className="space-y-1"><Label className="text-xs">Carro</Label><Input value={form.car_desc} onChange={(e) => setForm((p) => ({ ...p, car_desc: e.target.value }))} placeholder="Ex.: Onix 2020" /></div>
              <div className="space-y-1"><Label className="text-xs">Data da compra</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm((p) => ({ ...p, purchase_date: e.target.value }))} /></div>
            </div>

            {/* Cortesia da loja: assinatura patrocinada (pós-pago) */}
            <label className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3 cursor-pointer">
              <Checkbox checked={cortesia} onCheckedChange={(v) => setCortesia(v === true)} className="mt-0.5" />
              <span className="text-sm">
                <span className="font-medium flex items-center gap-1.5"><Gift className="w-4 h-4 text-primary" /> Oferecer 1 ano de cortesia (por conta da loja)</span>
                <span className="text-[12px] text-muted-foreground">A conta premium é criada na hora e o cliente usa grátis por 12 meses. Você não paga agora — vira saldo a acertar (R$ 109,90) e, ao vencer, o cliente continua por R$ 10,99/mês.</span>
              </span>
            </label>

            {/* Com cortesia, já provisionamos o veículo do cliente — placa autopreenche marca/modelo/ano */}
            {cortesia && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed p-3">
                <div className="col-span-2 text-[12px] text-muted-foreground -mb-1">Dados do veículo (opcional) — deixa a conta do cliente pronta pra usar. A placa autopreenche marca, modelo, ano e mais.</div>
                <div className="space-y-1"><Label className="text-xs">Placa</Label><Input value={form.placa} onChange={(e) => setForm((p) => ({ ...p, placa: e.target.value.toUpperCase() }))} placeholder="ABC1D23" maxLength={8} /></div>
                <div className="space-y-1"><Label className="text-xs">Valor de compra (R$)</Label><Input type="number" inputMode="decimal" value={form.valor_compra} onChange={(e) => setForm((p) => ({ ...p, valor_compra: e.target.value }))} placeholder="Ex.: 55000" /></div>
              </div>
            )}

            <Button onClick={registrar} disabled={create.isPending} className="gap-1.5">
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} {cortesia ? "Registrar e ativar cortesia" : "Registrar e dar boas-vindas"}
            </Button>
          </CardContent>
        </Card>

        {/* Config */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary" /> Configuração</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Link de avaliação no Google</Label>
              <Input value={reviewUrl ?? ""} onChange={(e) => setReviewUrl(e.target.value)} placeholder="https://g.page/r/... (link de avaliação da sua loja)" />
              <p className="text-[11px] text-muted-foreground">Clientes que dão nota alta recebem este link pra avaliar. Pegue em: Google Meu Negócio → “Peça avaliações”.</p>
            </div>
            <div className="space-y-1 max-w-[200px]">
              <Label className="text-xs">Enviar NPS após (dias da compra)</Label>
              <Input type="number" min={1} value={delay} onChange={(e) => setDelay(e.target.value)} placeholder="3" />
            </div>
            <Button variant="outline" onClick={salvarConfig} disabled={saveCfg.isPending} className="gap-1.5">
              {saveCfg.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />} Salvar
            </Button>
            {cfgData?.coupon && <p className="text-[11px] text-muted-foreground">Cupom da loja no link de boas-vindas: <strong>{cfgData.coupon}</strong></p>}
          </CardContent>
        </Card>
      </div>

      {/* Lista de jornadas */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader className="pb-2"><CardTitle className="text-base">Clientes ({list?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !list?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente registrado ainda. Comece pelo formulário acima. 👆</p>
          ) : (
            <div className="divide-y divide-border">
              {list.map((j) => {
                const st = STATUS[j.status] || STATUS.ativo;
                return (
                  <div key={j.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{j.customer_name || j.customer_phone}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[j.car_desc, `comprou ${new Date(j.purchase_date + "T00:00").toLocaleDateString("pt-BR")}`, j.customer_phone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {j.sponsored && <Badge className="gap-1 bg-primary/15 text-primary"><Gift className="w-3 h-3" /> {j.sponsor_settled ? "Cortesia (quitada)" : "Cortesia"}</Badge>}
                      {j.nps_score != null && <span className="text-sm font-bold">{j.nps_score}<span className="text-muted-foreground text-xs">/10</span></span>}
                      <Badge className={`gap-1 ${st.cls}`}><st.Icon className="w-3 h-3" /> {st.label}</Badge>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setEditing(j)}>
                        <FileCheck className="w-3.5 h-3.5" />
                        {j.transfer_status === "concluida" ? "Transf. ✅" : "Documentação"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && <TransferDialog journey={editing} dealership={dealership} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

// Editor do checklist de transferência + garantia/revisão (a loja atualiza; o cliente consulta pelo agente)
function TransferDialog({ journey, dealership, onClose, onSaved }: { journey: PostsaleJourney; dealership?: string; onClose: () => void; onSaved: () => void }) {
  const save = usePostsaleTransferSave();
  const [steps, setSteps] = useState<Record<string, boolean>>({ ...(journey.transfer || {}) });
  const [status, setStatus] = useState(journey.transfer_status || "pendente");
  const [warranty, setWarranty] = useState(journey.warranty_until || "");
  const [revisao, setRevisao] = useState(journey.revisao_proxima || "");

  const done = TRANSFER_STEPS.filter(([k]) => steps[k]).length;
  const toggle = (k: string) => setSteps((p) => ({ ...p, [k]: !p[k] }));

  const salvar = () => {
    // se marcou tudo, sugere concluída; se marcou algo, em andamento
    const autoStatus = done === TRANSFER_STEPS.length ? "concluida" : done > 0 ? "em_andamento" : status;
    save.mutate(
      { id: journey.id, transfer: steps, transfer_status: status === "concluida" ? "concluida" : autoStatus, warranty_until: warranty || null, revisao_proxima: revisao || null, dealership: dealership || undefined },
      {
        onSuccess: (r: any) => {
          toast({ title: "Salvo ✅", description: r?.notificado ? "Cliente avisado da conclusão no WhatsApp." : undefined });
          onSaved(); onClose();
        },
        onError: (e: any) => toast({ title: "Erro ao salvar", description: String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileCheck className="w-5 h-5 text-primary" /> Transferência — {journey.customer_name || journey.customer_phone}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Checklist ({done}/{TRANSFER_STEPS.length})</Label>
            {TRANSFER_STEPS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => toggle(k)}
                className="w-full flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm hover:bg-muted/50 transition-colors">
                <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${steps[k] ? "bg-primary text-white" : "border"}`}>{steps[k] ? "✓" : ""}</span>
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <div className="flex gap-2">
              {[["pendente", "Pendente"], ["em_andamento", "Em andamento"], ["concluida", "Concluída"]].map(([v, l]) => (
                <Button key={v} type="button" size="sm" variant={status === v ? "default" : "outline"} className="flex-1" onClick={() => setStatus(v)}>{l}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Garantia até</Label><Input type="date" value={warranty} onChange={(e) => setWarranty(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Próxima revisão</Label><Input type="date" value={revisao} onChange={(e) => setRevisao(e.target.value)} /></div>
          </div>

          <p className="text-[11px] text-muted-foreground">Ao marcar tudo (ou status “Concluída”), o cliente recebe um WhatsApp avisando que a documentação está em dia. Ele também pode consultar o andamento perguntando “como está minha transferência?”.</p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={salvar} disabled={save.isPending} className="gap-1.5">
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />} Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="border-0 shadow-premium-md">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${accent || ""}`}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default PostSaleTab;
