import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Star, Settings2, Smile, Meh, Frown, Send } from "lucide-react";
import {
  usePostsaleList, usePostsaleStats, usePostsaleConfig, usePostsaleCreate, usePostsaleConfigSave,
} from "@/hooks/useDealer";

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

  const [form, setForm] = useState({ customer_name: "", customer_phone: "", car_desc: "", purchase_date: "" });
  const [reviewUrl, setReviewUrl] = useState("");
  const [delay, setDelay] = useState("");

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
    }, {
      onSuccess: (r: any) => {
        toast({ title: "Cliente registrado! 🎉", description: r?.welcome_sent ? "Mensagem de boas-vindas enviada no WhatsApp." : "Jornada criada (WhatsApp não enviou — confira as credenciais)." });
        setForm({ customer_name: "", customer_phone: "", car_desc: "", purchase_date: "" });
        refresh();
      },
      onError: (e: any) => toast({ title: "Não foi possível registrar", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  const salvarConfig = () => {
    saveCfg.mutate({ google_review_url: reviewUrl || undefined, nps_delay_days: Number(delay) || 3 }, {
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
            <Button onClick={registrar} disabled={create.isPending} className="gap-1.5">
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Registrar e dar boas-vindas
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
                      {j.nps_score != null && <span className="text-sm font-bold">{j.nps_score}<span className="text-muted-foreground text-xs">/10</span></span>}
                      <Badge className={`gap-1 ${st.cls}`}><st.Icon className="w-3 h-3" /> {st.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
