import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, Car, TrendingUp, Loader2, CheckCircle2, Info } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  useFipeBrands, useFipeModels, useFipeYears, useFipePrice,
  useMyBuyback, useCreateBuyback,
} from "@/hooks/useBuyback";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Enviado", cls: "bg-warning/15 text-warning" },
  contacted: { label: "Em contato", cls: "bg-primary/15 text-primary" },
  closed: { label: "Concluído", cls: "bg-green-500/15 text-green-600" },
  declined: { label: "Recusado", cls: "bg-muted text-muted-foreground" },
};

export default function Recompra() {
  const { userData, userId, loading } = useCurrentUser();
  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);

  const { data: brands, isLoading: lb } = useFipeBrands(!!userId);
  const { data: models, isLoading: lm } = useFipeModels(brand);
  const { data: years, isLoading: ly } = useFipeYears(brand, model);
  const { data: price, isLoading: lp } = useFipePrice(brand, model, year);
  const { data: myReqs } = useMyBuyback(!!userId);
  const create = useCreateBuyback();

  const dealership = userData?.dealership as string | undefined;

  const onBrand = (v: string) => { setBrand(v); setModel(null); setYear(null); };
  const onModel = (v: string) => { setModel(v); setYear(null); };

  const handleRequest = () => {
    if (!price) return;
    create.mutate(
      {
        brand: price.fipe.brand, model: price.fipe.model, year: String(price.fipe.year),
        fuel: price.fipe.fuel, fipe_code: price.fipe.code, fipe_value: price.fipe.value, offer_pct: price.offer_pct,
      },
      {
        onSuccess: () => { toast({ title: "Proposta solicitada! 🎉", description: "A loja vai entrar em contato." }); setBrand(null); setModel(null); setYear(null); },
        onError: (e: any) => toast({
          title: "Não foi possível enviar",
          description: e?.message === "owner_without_dealership" ? "Sua conta não está vinculada a uma loja." : String(e?.message || e),
          variant: "destructive",
        }),
      },
    );
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Banknote className="w-7 h-7 text-primary" /> Recompra do seu carro</h1>
        <p className="text-muted-foreground">
          {dealership ? <>A <strong>{dealership}</strong> recompra o seu carro por até <strong>{price?.offer_pct ?? 90}% da tabela FIPE</strong>. Avalie agora.</>
            : "Avalie seu carro pela tabela FIPE e receba uma proposta de recompra da loja parceira."}
        </p>
      </div>

      {!dealership && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <Info className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
          <span>Sua conta ainda não está vinculada a uma loja parceira — você consegue avaliar, mas o pedido só é enviado quando houver uma loja vinculada.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avaliação FIPE */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Car className="w-5 h-5" /> Avalie seu carro (FIPE)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Marca</Label>
              <Select value={brand ?? undefined} onValueChange={onBrand} disabled={lb}>
                <SelectTrigger><SelectValue placeholder={lb ? "Carregando..." : "Selecione a marca"} /></SelectTrigger>
                <SelectContent>{(brands || []).map((b) => <SelectItem key={String(b.codigo)} value={String(b.codigo)}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model ?? undefined} onValueChange={onModel} disabled={!brand || lm}>
                <SelectTrigger><SelectValue placeholder={!brand ? "Escolha a marca antes" : lm ? "Carregando..." : "Selecione o modelo"} /></SelectTrigger>
                <SelectContent>{(models || []).map((m) => <SelectItem key={String(m.codigo)} value={String(m.codigo)}>{m.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={year ?? undefined} onValueChange={setYear} disabled={!model || ly}>
                <SelectTrigger><SelectValue placeholder={!model ? "Escolha o modelo antes" : ly ? "Carregando..." : "Selecione o ano"} /></SelectTrigger>
                <SelectContent>{(years || []).map((y) => <SelectItem key={String(y.codigo)} value={String(y.codigo)}>{y.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Oferta */}
        <Card className="border-0 shadow-premium-md bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Sua oferta de recompra</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {lp ? (
              <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : price ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tabela FIPE</span>
                  <span className="font-medium line-through text-muted-foreground">{brl(price.fipe.value)}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">A loja paga até ({price.offer_pct}% da FIPE)</p>
                  <p className="text-4xl font-bold text-primary">{brl(price.offer_value)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{price.fipe.brand} {price.fipe.model} · {price.fipe.year} · {price.fipe.fuel}</p>
                <Button className="w-full bg-gradient-primary" onClick={handleRequest} disabled={create.isPending}>
                  {create.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : "Quero receber a proposta"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">Valor de referência. A oferta final depende da avaliação do veículo pela loja.</p>
              </>
            ) : (
              <div className="py-10 text-center text-muted-foreground">Selecione marca, modelo e ano para ver a oferta.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Meus pedidos */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg">Meus pedidos de recompra ({myReqs?.length || 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {myReqs && myReqs.length ? (
            <div className="divide-y divide-border">
              {myReqs.map((r) => {
                const st = STATUS[r.status] || STATUS.new;
                return (
                  <div key={r.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{[r.brand, r.model, r.year].filter(Boolean).join(" ")}</p>
                      <p className="text-xs text-muted-foreground">FIPE {brl(Number(r.fipe_value))} · oferta {brl(Number(r.offer_value))} · {new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <Badge className={`border-0 ${st.cls}`}>{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground/50" />
              Você ainda não pediu nenhuma recompra.
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
