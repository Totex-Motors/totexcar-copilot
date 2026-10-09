import { useEffect, useState } from "react";
import { MgPanelShell } from "@/components/mg/MgPanelShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Users, KeyRound, Plus, Trash2, ShieldCheck, Save, UserPlus, MessageCircle, CreditCard, Ticket, Plug, Power, BarChart3, TrendingUp, Store, ExternalLink, Car, Gift, QrCode, Banknote, Wrench, Loader2, Eye, ScanLine, Send, Copy, Radar } from "lucide-react";
import { StandLeadsPanel } from "@/components/StandLeadsPanel";
import { useCurrentUser } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  useOwners, useCreateOwner, useDeleteOwner, useBootstrapAdmin,
  useAppSettings, useUpdateAppSettings, AI_MODELS, type AIProvider, type Owner,
  useCoupons, useCreateCoupon, useToggleCoupon, useDeleteCoupon, type Coupon,
  useSubscriptions, type Subscription,
  useDealers, useCreateDealer, useDeleteDealer, type Dealer,
  useStores,
} from "@/hooks/useAdmin";
import { useSponsorBalance, useSponsorSettle } from "@/hooks/useDealer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Seletor de loja: escolhe da lista oficial do marketplace (evita divergência de nome)
function StoreField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: stores, isLoading } = useStores(true);
  const list = stores || [];
  const inList = list.some((s) => s.name === value);
  const [manual, setManual] = useState(false);

  if (manual) {
    return (
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Nome exato da loja" />
        <Button type="button" variant="outline" onClick={() => setManual(false)}>Lista</Button>
      </div>
    );
  }
  return (
    <Select
      value={inList ? value : ""}
      onValueChange={(v) => { if (v === "__manual__") { setManual(true); } else onChange(v); }}
    >
      <SelectTrigger><SelectValue placeholder={isLoading ? "Carregando lojas..." : "Selecione a loja"} /></SelectTrigger>
      <SelectContent>
        {list.map((s) => (
          <SelectItem key={s.slug || s.name} value={s.name}>{s.name}{s.city ? ` · ${s.city}` : ""}</SelectItem>
        ))}
        <SelectItem value="__manual__">✏️ Outra loja (digitar)</SelectItem>
      </SelectContent>
    </Select>
  );
}

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: "anthropic", label: "Claude (Anthropic)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "gemini", label: "Google Gemini" },
];

const Admin = () => {
  const { userData, loading } = useCurrentUser();
  const isAdmin = userData?.role === "admin";

  const bootstrap = useBootstrapAdmin();

  if (loading) {
    return (
      <MgPanelShell title="Painel Administrativo">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MgPanelShell>
    );
  }

  if (!isAdmin) {
    return (
      <MgPanelShell title="Painel Administrativo">
        <Card className="border-0 shadow-premium-md max-w-xl mx-auto mt-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Área administrativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Esta área é restrita aos administradores do sistema. Você não tem acesso.
            </p>
            <Button className="bg-gradient-primary" onClick={() => (window.location.href = "/")}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </MgPanelShell>
    );
  }

  return (
    <MgPanelShell title="Painel Administrativo" subtitle="Gerencie proprietários, lojistas e integrações">
      <Tabs defaultValue="owners" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="owners" className="gap-2"><Users className="w-4 h-4" /> Proprietários</TabsTrigger>
          <TabsTrigger value="dealers" className="gap-2"><Store className="w-4 h-4" /> Lojistas</TabsTrigger>
          <TabsTrigger value="config" className="gap-2"><KeyRound className="w-4 h-4" /> Configurações & Integrações</TabsTrigger>
          <TabsTrigger value="growth" className="gap-2"><Ticket className="w-4 h-4" /> Cupons & Ecossistema</TabsTrigger>
          <TabsTrigger value="subs" className="gap-2"><BarChart3 className="w-4 h-4" /> Assinaturas</TabsTrigger>
          <TabsTrigger value="funil" className="gap-2"><TrendingUp className="w-4 h-4" /> Funil Grátis</TabsTrigger>
          <TabsTrigger value="stand" className="gap-2"><QrCode className="w-4 h-4" /> Stand</TabsTrigger>
          <TabsTrigger value="partners" className="gap-2"><Wrench className="w-4 h-4" /> Parceiros</TabsTrigger>
          <TabsTrigger value="prospects" className="gap-2"><Radar className="w-4 h-4" /> Prospecção</TabsTrigger>
          <TabsTrigger value="gpt" className="gap-2"><ScanLine className="w-4 h-4" /> GPT Motors</TabsTrigger>
        </TabsList>

        <TabsContent value="owners" className="mt-6">
          <OwnersTab />
        </TabsContent>
        <TabsContent value="dealers" className="mt-6">
          <DealersTab />
        </TabsContent>
        <TabsContent value="config" className="mt-6">
          <ConfigTab />
        </TabsContent>
        <TabsContent value="growth" className="mt-6">
          <GrowthTab />
        </TabsContent>
        <TabsContent value="subs" className="mt-6">
          <SubscriptionsTab />
        </TabsContent>
        <TabsContent value="funil" className="mt-6">
          <FunilValeTab />
        </TabsContent>
        <TabsContent value="stand" className="mt-6">
          <StandLeadsPanel source="admin" />
        </TabsContent>
        <TabsContent value="partners" className="mt-6">
          <PartnersTab />
        </TabsContent>
        <TabsContent value="prospects" className="mt-6">
          <ProspectsTab />
        </TabsContent>
        <TabsContent value="gpt" className="mt-6">
          <GptMotorsTab />
        </TabsContent>
      </Tabs>
    </MgPanelShell>
  );
};

function OwnersTab() {
  const { data: owners, isLoading } = useOwners(true);
  const createOwner = useCreateOwner();
  const deleteOwner = useDeleteOwner();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [toDelete, setToDelete] = useState<Owner | null>(null);

  const handleCreate = () => {
    if (!form.email || !form.password) {
      toast({ title: "Campos obrigatórios", description: "Informe e-mail e senha.", variant: "destructive" });
      return;
    }
    createOwner.mutate(
      { email: form.email, password: form.password, name: form.name, phone: form.phone },
      {
        onSuccess: () => {
          toast({ title: "Proprietário criado", description: form.email });
          setForm({ name: "", email: "", phone: "", password: "" });
        },
        onError: (e: any) => toast({ title: "Erro ao criar", description: String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="border-0 shadow-premium-md lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="w-5 h-5" /> Novo proprietário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome do dono" />
          </div>
          <div className="space-y-2">
            <Label>E-mail (login)</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="dono@email.com" />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp (para o assistente)</Label>
            <PhoneInput value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="text" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="senha inicial" />
          </div>
          <Button className="w-full bg-gradient-primary" onClick={handleCreate} disabled={createOwner.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            {createOwner.isPending ? "Criando..." : "Criar conta"}
          </Button>
          <p className="text-xs text-muted-foreground">
            O proprietário entra com o e-mail e a senha. O WhatsApp precisa ser o mesmo número que ele vai usar para mandar gastos.
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Proprietários ({owners?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : owners && owners.length ? (
            <div className="divide-y divide-border">
              {owners.map((o) => (
                <div key={o.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {o.name || "Sem nome"}
                      {o.role === "admin" && <Badge variant="secondary">admin</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">{o.email} · {o.phone || "sem telefone"}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(o)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">Nenhum proprietário cadastrado ainda.</div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proprietário</AlertDialogTitle>
            <AlertDialogDescription>
              Remover "{toDelete?.name || toDelete?.email}"? A conta de login e os dados associados serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!toDelete) return;
                deleteOwner.mutate(toDelete.id, {
                  onSuccess: () => toast({ title: "Proprietário excluído" }),
                  onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
                });
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DealersTab() {
  const { data: dealers, isLoading } = useDealers(true);
  const createDealer = useCreateDealer();
  const deleteDealer = useDeleteDealer();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", dealership: "" });
  const [toDelete, setToDelete] = useState<Dealer | null>(null);

  const handleCreate = () => {
    if (!form.email || !form.password || !form.dealership) {
      toast({ title: "Campos obrigatórios", description: "Informe e-mail, senha e a loja.", variant: "destructive" });
      return;
    }
    createDealer.mutate(
      { email: form.email, password: form.password, name: form.name, phone: form.phone, dealership: form.dealership },
      {
        onSuccess: () => {
          toast({ title: "Lojista criado", description: `${form.email} · ${form.dealership}` });
          setForm({ name: "", email: "", phone: "", password: "", dealership: "" });
        },
        onError: (e: any) => toast({ title: "Erro ao criar", description: String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="border-0 shadow-premium-md lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Store className="w-5 h-5" /> Novo lojista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Loja (dealership)</Label>
            <StoreField value={form.dealership} onChange={(v) => setForm((p) => ({ ...p, dealership: v }))} />
            <p className="text-xs text-muted-foreground">Escolha da lista do marketplace — garante o nome idêntico em cupom, lojista e clientes.</p>
          </div>
          <div className="space-y-2">
            <Label>Nome do responsável</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome do lojista" />
          </div>
          <div className="space-y-2">
            <Label>E-mail (login)</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="loja@email.com" />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <PhoneInput value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="text" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="senha inicial" />
          </div>
          <Button className="w-full bg-gradient-primary" onClick={handleCreate} disabled={createDealer.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            {createDealer.isPending ? "Criando..." : "Criar lojista"}
          </Button>
          <p className="text-xs text-muted-foreground">
            O lojista entra com e-mail e senha e cai direto no painel <code>/lojista</code>, vendo só os clientes da loja dele.
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Lojistas ({dealers?.length || 0})</span>
            <a href="/lojista" target="_blank" rel="noreferrer" className="text-sm font-normal text-primary inline-flex items-center gap-1 hover:underline">
              Abrir painel <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : dealers && dealers.length ? (
            <div className="divide-y divide-border">
              {dealers.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {d.name || "Sem nome"}
                      <Badge variant="secondary" className="gap-1"><Store className="w-3 h-3" />{d.dealership || "sem loja"}</Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">{d.email} · {d.phone || "sem telefone"}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {d.dealership && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`/lojista?dealership=${encodeURIComponent(d.dealership)}`} target="_blank" rel="noreferrer">
                          Abrir painel <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(d)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">Nenhum lojista cadastrado ainda.</div>
          )}
        </CardContent>
      </Card>

      <div className="lg:col-span-3"><SponsorBalanceCard /></div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lojista</AlertDialogTitle>
            <AlertDialogDescription>
              Remover o acesso de "{toDelete?.name || toDelete?.email}" ({toDelete?.dealership})? Os clientes da loja NÃO são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!toDelete) return;
                deleteDealer.mutate(toDelete.id, {
                  onSuccess: () => toast({ title: "Lojista excluído" }),
                  onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
                });
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Saldo devedor de cortesias (assinaturas patrocinadas pelas lojas, pós-pago) — o admin acerta com cada loja
function SponsorBalanceCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useSponsorBalance(true);
  const settle = useSponsorSettle();
  const [toSettle, setToSettle] = useState<{ dealership: string; count: number; total: number } | null>(null);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2"><Gift className="w-5 h-5 text-primary" /> Cortesias patrocinadas (saldo a receber das lojas)</span>
          {data && <span className="text-sm font-normal text-muted-foreground">Total: <strong className="text-foreground">{brl(data.total)}</strong></span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : data && data.lojas.length ? (
          <div className="divide-y divide-border">
            {data.lojas.map((l) => (
              <div key={l.dealership} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium flex items-center gap-2"><Store className="w-4 h-4" /> {l.dealership}</p>
                  <p className="text-sm text-muted-foreground">{l.count} cortesia(s) × R$ 109,90 = <strong>{brl(l.total)}</strong></p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setToSettle(l)}>Marcar quitado</Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Nenhuma cortesia em aberto. As lojas que oferecerem 1 ano grátis aparecem aqui pra acerto.</div>
        )}
      </CardContent>

      <AlertDialog open={!!toSettle} onOpenChange={(o) => !o && setToSettle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar cortesias como quitadas</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar que a <strong>{toSettle?.dealership}</strong> acertou {toSettle?.count} cortesia(s) ({toSettle ? brl(toSettle.total) : ""})?
              Elas saem do saldo devedor. Isso não altera o acesso dos clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toSettle) return;
                settle.mutate(toSettle.dealership, {
                  onSuccess: (r: any) => { toast({ title: "Cortesias quitadas", description: `${r?.quitadas ?? 0} lançamento(s) da ${toSettle.dealership}.` }); qc.invalidateQueries({ queryKey: ["postsale-sponsor-balance"] }); },
                  onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
                });
                setToSettle(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "";
const WPP_SECRET = "TCF-uaz-2026-7Kp9Qm3Xv8Rn";

function ConfigTab() {
  const { data: settings, isLoading } = useAppSettings(true);
  const updateSettings = useUpdateAppSettings();

  const [f, setF] = useState({
    provider: "anthropic" as AIProvider,
    model: "claude-opus-4-8",
    anthropic: "", openai: "", gemini: "",
    uazapi_url: "", uazapi_token: "", uazapi_number: "",
    asaas_api_key: "", asaas_sandbox: true, asaas_webhook_token: "",
    plan_monthly_price: "19.90", plan_annual_price: "200.00", app_url: "",
    buyback_fipe_pct: "90",
    // Venda seu carro — margens (Express à vista + Vitrine por prazo). margem = max(% da FIPE, piso).
    ex_pct: "20", ex_piso: "10000",
    p1_dias: "20", p1_pct: "14", p1_piso: "3500",
    p2_dias: "45", p2_pct: "10", p2_piso: "2800",
    p3_dias: "90", p3_pct: "7", p3_piso: "2000",
    placa_bearer: "", placa_device: "", placa_url: "", apifull_token: "",
    referral_buyer_offer: "Transferência grátis",
    support_owner_phone: "",
    wa_provider: "uazapi", meta_wa_token: "", meta_wa_phone_id: "", meta_wa_verify_token: "", meta_waba_id: "",
    // Canal (carro do dia) e Status pessoal do dono — instâncias uazapi não-oficiais, só publicação
    canal_autopost: false, status_autopost: false, status_uazapi_url: "", status_uazapi_token: "", status_dealership_id: "",
    google_places_api_key: "",
  });

  useEffect(() => {
    if (settings) {
      setF({
        provider: (settings.ai_provider as AIProvider) || "anthropic",
        model: settings.ai_model || "claude-opus-4-8",
        anthropic: settings.anthropic_api_key || "",
        openai: settings.openai_api_key || "",
        gemini: settings.gemini_api_key || "",
        uazapi_url: settings.uazapi_url || "",
        uazapi_token: settings.uazapi_token || "",
        uazapi_number: settings.uazapi_number || "",
        asaas_api_key: settings.asaas_api_key || "",
        asaas_sandbox: settings.asaas_sandbox ?? true,
        asaas_webhook_token: settings.asaas_webhook_token || "",
        plan_monthly_price: (settings.plan_monthly_price ?? 19.9).toString(),
        plan_annual_price: (settings.plan_annual_price ?? 200).toString(),
        app_url: settings.app_url || "",
        buyback_fipe_pct: (settings.buyback_fipe_pct ?? 90).toString(),
        ex_pct: String((settings as any).buyback_express?.pct ?? 20),
        ex_piso: String((settings as any).buyback_express?.piso ?? 10000),
        p1_dias: String((settings as any).buyback_prazos?.[0]?.dias ?? 20),
        p1_pct: String((settings as any).buyback_prazos?.[0]?.pct ?? 14),
        p1_piso: String((settings as any).buyback_prazos?.[0]?.piso ?? 3500),
        p2_dias: String((settings as any).buyback_prazos?.[1]?.dias ?? 45),
        p2_pct: String((settings as any).buyback_prazos?.[1]?.pct ?? 10),
        p2_piso: String((settings as any).buyback_prazos?.[1]?.piso ?? 2800),
        p3_dias: String((settings as any).buyback_prazos?.[2]?.dias ?? 90),
        p3_pct: String((settings as any).buyback_prazos?.[2]?.pct ?? 7),
        p3_piso: String((settings as any).buyback_prazos?.[2]?.piso ?? 2000),
        placa_bearer: settings.placa_api_bearer || "",
        apifull_token: (settings as any).apifull_token || "",
        placa_device: settings.placa_api_device || "",
        placa_url: settings.placa_api_url || "",
        referral_buyer_offer: settings.referral_buyer_offer || "Transferência grátis",
        support_owner_phone: (settings as any).support_owner_phone || "",
        wa_provider: (settings as any).wa_provider || "uazapi",
        meta_wa_token: (settings as any).meta_wa_token || "",
        meta_wa_phone_id: (settings as any).meta_wa_phone_id || "",
        meta_wa_verify_token: (settings as any).meta_wa_verify_token || "",
        meta_waba_id: (settings as any).meta_waba_id || "",
        canal_autopost: !!(settings as any).canal_autopost,
        status_autopost: !!(settings as any).status_autopost,
        status_uazapi_url: (settings as any).status_uazapi_url || "",
        status_uazapi_token: (settings as any).status_uazapi_token || "",
        status_dealership_id: (settings as any).status_dealership_id || "",
        google_places_api_key: (settings as any).google_places_api_key || "",
      });
    }
  }, [settings]);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    updateSettings.mutate(
      {
        ai_provider: f.provider,
        ai_model: f.model,
        anthropic_api_key: f.anthropic || null,
        openai_api_key: f.openai || null,
        gemini_api_key: f.gemini || null,
        uazapi_url: f.uazapi_url || null,
        uazapi_token: f.uazapi_token || null,
        uazapi_number: f.uazapi_number || null,
        asaas_api_key: f.asaas_api_key || null,
        asaas_sandbox: f.asaas_sandbox,
        asaas_webhook_token: f.asaas_webhook_token || null,
        plan_monthly_price: Number(f.plan_monthly_price) || 19.9,
        plan_annual_price: Number(f.plan_annual_price) || 200,
        app_url: f.app_url || null,
        buyback_fipe_pct: Number(f.buyback_fipe_pct) || 90,
        buyback_express: { pct: Number(f.ex_pct) || 20, piso: Number(f.ex_piso) || 10000 },
        buyback_prazos: [
          { dias: Number(f.p1_dias) || 20, pct: Number(f.p1_pct) || 14, piso: Number(f.p1_piso) || 3500 },
          { dias: Number(f.p2_dias) || 45, pct: Number(f.p2_pct) || 10, piso: Number(f.p2_piso) || 2800 },
          { dias: Number(f.p3_dias) || 90, pct: Number(f.p3_pct) || 7, piso: Number(f.p3_piso) || 2000 },
        ].sort((a, b) => a.dias - b.dias),
        placa_api_bearer: f.placa_bearer || null,
        apifull_token: f.apifull_token || null,
        placa_api_device: f.placa_device || null,
        placa_api_url: f.placa_url || null,
        referral_buyer_offer: f.referral_buyer_offer || null,
        support_owner_phone: f.support_owner_phone.replace(/\D/g, "") || null,
        wa_provider: f.wa_provider || "uazapi",
        meta_wa_token: f.meta_wa_token || null,
        meta_wa_phone_id: f.meta_wa_phone_id || null,
        meta_wa_verify_token: f.meta_wa_verify_token || null,
        meta_waba_id: f.meta_waba_id || null,
        canal_autopost: f.canal_autopost,
        status_autopost: f.status_autopost,
        status_uazapi_url: f.status_uazapi_url.trim().replace(/\/+$/, "") || null,
        status_uazapi_token: f.status_uazapi_token.trim() || null,
        status_dealership_id: f.status_dealership_id.trim() || null,
        google_places_api_key: f.google_places_api_key.trim() || null,
      } as any,
      {
        onSuccess: () => toast({ title: "Configurações salvas" }),
        onError: (e: any) => toast({ title: "Erro ao salvar", description: String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  const wppWebhook = `${SUPA_URL}/functions/v1/whatsapp-webhook?secret=${WPP_SECRET}`;
  const asaasWebhook = `${SUPA_URL}/functions/v1/asaas-webhook`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* IA */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><KeyRound className="w-5 h-5" /> Inteligência Artificial</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provedor ativo</Label>
            <Select value={f.provider} onValueChange={(v) => setF((p) => ({ ...p, provider: v as AIProvider, model: AI_MODELS[v as AIProvider][0].value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modelo</Label>
            <Select value={f.model} onValueChange={(v) => set("model", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AI_MODELS[f.provider].map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Claude (Anthropic)</Label><Input type="password" value={f.anthropic} onChange={(e) => set("anthropic", e.target.value)} placeholder="sk-ant-..." /></div>
          <div className="space-y-2"><Label>OpenAI</Label><Input type="password" value={f.openai} onChange={(e) => set("openai", e.target.value)} placeholder="sk-..." /></div>
          <div className="space-y-2"><Label>Google Gemini</Label><Input type="password" value={f.gemini} onChange={(e) => set("gemini", e.target.value)} placeholder="AIza..." /></div>
          <div className="space-y-2 pt-2 border-t">
            <Label>Google Places (Modo Viagem: roteiro dia a dia · Radar)</Label>
            <Input type="password" value={f.google_places_api_key} onChange={(e) => set("google_places_api_key", e.target.value)} placeholder="AIza... (Google Cloud → APIs: Places API (New))" />
            <p className="text-xs text-muted-foreground">Sem a chave, o Modo Viagem funciona sem o roteiro de lugares com foto. Custo aprox. R$ 1 por roteiro.</p>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp (Uazapi) */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageCircle className="w-5 h-5" /> WhatsApp (Uazapi)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>URL da instância</Label><Input value={f.uazapi_url} onChange={(e) => set("uazapi_url", e.target.value)} placeholder="https://suainstancia.uazapi.com" /></div>
          <div className="space-y-2"><Label>Token da instância</Label><Input type="password" value={f.uazapi_token} onChange={(e) => set("uazapi_token", e.target.value)} placeholder="token..." /></div>
          <div className="space-y-2"><Label>Número central (exibição)</Label><Input value={f.uazapi_number} onChange={(e) => set("uazapi_number", e.target.value)} placeholder="+55 31 9....." /></div>
          <div className="space-y-2">
            <Label>WhatsApp do dono (escalação de suporte)</Label>
            <Input value={f.support_owner_phone} onChange={(e) => set("support_owner_phone", e.target.value)} placeholder="5511947448137 (só dígitos, com DDI)" />
            <p className="text-xs text-muted-foreground">Chamados que a IA de suporte não resolver são enviados pra este número.</p>
          </div>
          <div className="space-y-1 pt-2 border-t">
            <Label className="text-xs">Webhook (cole no Uazapi → mensagens recebidas):</Label>
            <code className="block text-xs bg-muted p-2 rounded break-all">{wppWebhook}</code>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp OFICIAL (Meta / BM) — provider ativo escolhido aqui */}
      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" /> WhatsApp Oficial (Meta / Business Manager)
            <Badge className={f.wa_provider === "meta" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}>
              {f.wa_provider === "meta" ? "ATIVO" : "em espera"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provedor de WhatsApp ATIVO</Label>
              <Select value={f.wa_provider} onValueChange={(v) => set("wa_provider", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uazapi">Uazapi (não-oficial, legado)</SelectItem>
                  <SelectItem value="meta">Meta Cloud API (oficial)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">A troca vale na hora para TODO o sistema (agente, alertas, campanhas). Só ative "Meta" com os campos abaixo preenchidos e os templates aprovados.</p>
            </div>
            <div className="space-y-2"><Label>Token permanente (System User)</Label><Input type="password" value={f.meta_wa_token} onChange={(e) => set("meta_wa_token", e.target.value)} placeholder="EAAG..." /></div>
            <div className="space-y-2"><Label>Phone Number ID</Label><Input value={f.meta_wa_phone_id} onChange={(e) => set("meta_wa_phone_id", e.target.value)} placeholder="Ex.: 123456789012345 (não é o número do telefone)" /></div>
            <div className="space-y-2"><Label>WABA ID (conta do WhatsApp Business)</Label><Input value={f.meta_waba_id} onChange={(e) => set("meta_waba_id", e.target.value)} placeholder="ID da WhatsApp Business Account" /></div>
            <div className="space-y-2"><Label>Verify Token do webhook (você inventa)</Label><Input value={f.meta_wa_verify_token} onChange={(e) => set("meta_wa_verify_token", e.target.value)} placeholder="ex.: tcf-meta-2026-xyz" /></div>
          </div>
          <div className="space-y-1 pt-2 border-t">
            <Label className="text-xs">URL de callback do webhook (cole no app do Meta → WhatsApp → Configuration):</Label>
            <code className="block text-xs bg-muted p-2 rounded break-all">{wppWebhook}</code>
            <p className="text-xs text-muted-foreground">Use o Verify Token acima na verificação. Guia completo + templates prontos: TEMPLATES-WHATSAPP-META.md no repositório.</p>
          </div>
        </CardContent>
      </Card>

      {/* Canal + Status (uazapi não-oficial, SÓ publicação — nunca mensagem) */}
      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Send className="w-5 h-5" /> Canal do WhatsApp &amp; Status do dono (publicação automática)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Dois números <strong>não-oficiais</strong> (uazapi) que só publicam: o do Canal (carro do dia 9h/12h/16h, abaixo da FIPE 19h, grupo VIP)
            e o <strong>Status pessoal do dono</strong> (só carros da loja escolhida, 10h e 18h). A instância do Status fica sem webhook e fora do
            envio de mensagens: nenhuma função do sistema consegue mandar mensagem por ela.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label>Canal: publicar automaticamente</Label><p className="text-xs text-muted-foreground">Desligado = os crons do Canal e do grupo VIP viram no-op</p></div>
              <Switch checked={f.canal_autopost} onCheckedChange={(v) => set("canal_autopost", v)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label>Status do dono: publicar automaticamente</Label><p className="text-xs text-muted-foreground">10h e 18h, só carros da loja abaixo</p></div>
              <Switch checked={f.status_autopost} onCheckedChange={(v) => set("status_autopost", v)} />
            </div>
            <div className="space-y-2"><Label>Instância uazapi do Status (URL)</Label><Input value={f.status_uazapi_url} onChange={(e) => set("status_uazapi_url", e.target.value)} placeholder="https://xxx.uazapi.com" /></div>
            <div className="space-y-2"><Label>Token da instância do Status</Label><Input type="password" value={f.status_uazapi_token} onChange={(e) => set("status_uazapi_token", e.target.value)} placeholder="token..." /></div>
            <div className="space-y-2 md:col-span-2">
              <Label>Loja cujos carros saem no Status (id no marketplace)</Label>
              <Input value={f.status_dealership_id} onChange={(e) => set("status_dealership_id", e.target.value)} placeholder="ex.: cmolwv3l105la143rmfkwzs4g (Cardoso Veículos)" />
              <p className="text-xs text-muted-foreground">É o <code>dealership.id</code> que aparece em totexmotors.com/api/vehicles. Vazio = o job de Status não publica.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagamentos (Asaas) */}
      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CreditCard className="w-5 h-5" /> Pagamentos (Asaas) & Planos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Chave de API Asaas</Label><Input type="password" value={f.asaas_api_key} onChange={(e) => set("asaas_api_key", e.target.value)} placeholder="$aact_..." /></div>
            <div className="space-y-2"><Label>Token do webhook Asaas</Label><Input value={f.asaas_webhook_token} onChange={(e) => set("asaas_webhook_token", e.target.value)} placeholder="defina um token e use no painel do Asaas" /></div>
            <div className="space-y-2"><Label>Plano mensal (R$)</Label><Input type="number" step="0.01" value={f.plan_monthly_price} onChange={(e) => set("plan_monthly_price", e.target.value)} /></div>
            <div className="space-y-2"><Label>Plano anual (R$)</Label><Input type="number" step="0.01" value={f.plan_annual_price} onChange={(e) => set("plan_annual_price", e.target.value)} /></div>
            <div className="space-y-2"><Label>URL do app (para retorno do checkout)</Label><Input value={f.app_url} onChange={(e) => set("app_url", e.target.value)} placeholder="https://seuapp.com" /></div>
            <div className="space-y-2"><Label>Recompra: % da FIPE que a loja paga</Label><Input type="number" step="1" value={f.buyback_fipe_pct} onChange={(e) => set("buyback_fipe_pct", e.target.value)} placeholder="90" /></div>
            <div className="space-y-2"><Label>Indique e Ganhe: oferta para o amigo indicado</Label><Input value={f.referral_buyer_offer} onChange={(e) => set("referral_buyer_offer", e.target.value)} placeholder="Ex.: Transferência grátis  /  Desconto na parcela do financiamento" /><p className="text-xs text-muted-foreground">Aparece na mensagem que o dono compartilha — é o gatilho do amigo.</p></div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label>Ambiente sandbox (testes)</Label><p className="text-xs text-muted-foreground">Desligue para produção</p></div>
              <Switch checked={f.asaas_sandbox} onCheckedChange={(v) => set("asaas_sandbox", v)} />
            </div>
          </div>
          <div className="space-y-1 pt-2 border-t">
            <Label className="text-xs">Webhook (cole no Asaas → Integrações → Webhooks; use o token acima no campo "Token de autenticação"):</Label>
            <code className="block text-xs bg-muted p-2 rounded break-all">{asaasWebhook}</code>
          </div>
        </CardContent>
      </Card>

      {/* Venda seu carro — margens (Express à vista + Vitrine por prazo) */}
      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Banknote className="w-5 h-5" /> Venda seu carro — margens (Express & Vitrine)</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <p className="text-xs text-muted-foreground">
            O vendedor recebe <strong>FIPE − margem</strong>. A margem é o <strong>maior valor</strong> entre o % da FIPE e o piso em R$
            (assim escala do carro barato ao caro). Este é o <strong>padrão da rede</strong> — cada loja pode definir a própria margem no painel dela (aba Recompras).
          </p>

          {/* Venda Express */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="font-semibold flex items-center gap-2">⚡ Venda Express <span className="text-xs font-normal text-muted-foreground">à vista (grupo de repasse, até 48h)</span></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>% da FIPE</Label><Input type="number" step="1" value={f.ex_pct} onChange={(e) => set("ex_pct", e.target.value)} placeholder="20" /></div>
              <div className="space-y-2"><Label>Piso (R$)</Label><Input type="number" step="100" value={f.ex_piso} onChange={(e) => set("ex_piso", e.target.value)} placeholder="10000" /></div>
            </div>
          </div>

          {/* Venda Vitrine — 3 prazos */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="font-semibold flex items-center gap-2">🏆 Venda Vitrine <span className="text-xs font-normal text-muted-foreground">a loja anuncia · quanto mais prazo, menor a margem → vendedor recebe mais</span></div>
            <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground font-medium"><span>Prazo (dias)</span><span>% da FIPE</span><span>Piso (R$)</span></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-3 gap-3">
                <Input type="number" step="1" value={(f as any)[`p${i}_dias`]} onChange={(e) => set(`p${i}_dias`, e.target.value)} />
                <Input type="number" step="1" value={(f as any)[`p${i}_pct`]} onChange={(e) => set(`p${i}_pct`, e.target.value)} />
                <Input type="number" step="100" value={(f as any)[`p${i}_piso`]} onChange={(e) => set(`p${i}_piso`, e.target.value)} />
              </div>
            ))}
          </div>

          {/* Prévia ao vivo — carro de referência R$ 70.000 */}
          {(() => {
            const FIPE = 70000;
            const calc = (pct: number, piso: number) => {
              const margem = Math.max(Math.round(FIPE * (Number(pct) || 0) / 100), Number(piso) || 0);
              return Math.max(0, Math.round((FIPE - margem) / 100) * 100);
            };
            const money = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
            const linhas = [
              { l: "⚡ Express (à vista)", v: calc(Number(f.ex_pct), Number(f.ex_piso)) },
              ...[1, 2, 3].map((i) => ({ l: `🏆 até ${(f as any)[`p${i}_dias`]} dias`, v: calc(Number((f as any)[`p${i}_pct`]), Number((f as any)[`p${i}_piso`])) })),
            ];
            return (
              <div className="rounded-lg bg-muted/40 p-4 space-y-1">
                <p className="text-xs text-muted-foreground mb-2">Prévia — num carro de <strong>FIPE {money(FIPE)}</strong>, o vendedor recebe:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {linhas.map((x, k) => (
                    <div key={k} className="rounded-md bg-background p-2 text-center">
                      <div className="text-xs text-muted-foreground">{x.l}</div>
                      <div className="font-bold">{money(x.v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Consulta por placa (PuxaPlaca) */}
      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Car className="w-5 h-5" /> Consulta por placa (autopreenche o cadastro)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Usamos a <a href="https://puxaplaca.app" target="_blank" rel="noreferrer" className="text-primary underline">PuxaPlaca</a> —
            cole abaixo o seu <strong>Token</strong>. Em "Meu Veículo" o cliente digita a placa e o sistema preenche
            marca, modelo, ano, cor, combustível, chassi e RENAVAM. Sem o token, o botão fica indisponível.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Token PuxaPlaca</Label><Input type="password" value={f.placa_bearer} onChange={(e) => set("placa_bearer", e.target.value)} placeholder="seu token da PuxaPlaca" /></div>
            <div className="space-y-2"><Label>Token API Full (consulta veicular)</Label><Input type="password" value={f.apifull_token} onChange={(e) => set("apifull_token", e.target.value)} placeholder="Bearer token da app.apifull.com.br" /></div>
            <div className="space-y-2"><Label>URL (avançado — deixe em branco p/ PuxaPlaca)</Label><Input value={f.placa_url} onChange={(e) => set("placa_url", e.target.value)} placeholder="https://api.puxaplaca.app" /></div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 flex justify-end">
        <Button size="lg" className="bg-gradient-primary" onClick={handleSave} disabled={updateSettings.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {updateSettings.isPending ? "Salvando..." : "Salvar tudo"}
        </Button>
      </div>
    </div>
  );
}

function GrowthTab() {
  const { data: coupons, isLoading } = useCoupons(true);
  const createCoupon = useCreateCoupon();
  const toggleCoupon = useToggleCoupon();
  const deleteCoupon = useDeleteCoupon();
  const { data: settings } = useAppSettings(true);
  const updateSettings = useUpdateAppSettings();

  const [c, setC] = useState({ code: "", dealership: "", discount_pct: "90", max_uses: "" });
  const [integ, setInteg] = useState({ integration_api_key: "", os_webhook_url: "" });

  useEffect(() => {
    if (settings) setInteg({ integration_api_key: settings.integration_api_key || "", os_webhook_url: settings.os_webhook_url || "" });
  }, [settings]);

  const integrationUrl = `${SUPA_URL}/functions/v1/integration`;

  const handleCreateCoupon = () => {
    if (!c.code.trim()) { toast({ title: "Informe o código", variant: "destructive" }); return; }
    createCoupon.mutate(
      { code: c.code, dealership: c.dealership, discount_pct: Number(c.discount_pct) || 90, max_uses: c.max_uses ? Number(c.max_uses) : null },
      {
        onSuccess: () => { toast({ title: "Cupom criado", description: c.code.toUpperCase() }); setC({ code: "", dealership: "", discount_pct: "90", max_uses: "" }); },
        onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e).includes("duplicate") ? "Esse código já existe." : String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  const saveInteg = () => {
    updateSettings.mutate(
      { integration_api_key: integ.integration_api_key || null, os_webhook_url: integ.os_webhook_url || null },
      { onSuccess: () => toast({ title: "Integração salva" }), onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }) },
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Novo cupom */}
      <Card className="border-0 shadow-premium-md lg:col-span-1">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5" /> Novo Bônus Totex</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Código</Label><Input value={c.code} onChange={(e) => setC((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="LOJAX90" /></div>
          <div className="space-y-2"><Label>Loja parceira</Label><StoreField value={c.dealership} onChange={(v) => setC((p) => ({ ...p, dealership: v }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Desconto %</Label><Input type="number" value={c.discount_pct} onChange={(e) => setC((p) => ({ ...p, discount_pct: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Limite de usos</Label><Input type="number" value={c.max_uses} onChange={(e) => setC((p) => ({ ...p, max_uses: e.target.value }))} placeholder="∞" /></div>
          </div>
          <Button className="w-full bg-gradient-primary" onClick={handleCreateCoupon} disabled={createCoupon.isPending}>
            <Plus className="w-4 h-4 mr-2" /> {createCoupon.isPending ? "Criando..." : "Criar cupom"}
          </Button>
          <p className="text-xs text-muted-foreground">90% = cliente paga R$10,99/mês. Cada loja com seu código rastreia a origem da venda.</p>
        </CardContent>
      </Card>

      {/* Lista de cupons */}
      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader><CardTitle className="text-lg">Cupons ({coupons?.length || 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : coupons && coupons.length ? (
            <div className="divide-y divide-border">
              {coupons.map((cp: Coupon) => (
                <div key={cp.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <code className="bg-muted px-2 py-0.5 rounded text-sm">{cp.code}</code>
                      <Badge variant="secondary">−{cp.discount_pct}%</Badge>
                      {!cp.active && <Badge variant="outline" className="text-muted-foreground">inativo</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {cp.dealership || "sem loja"} · {cp.used_count || 0}{cp.max_uses ? `/${cp.max_uses}` : ""} usos
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" title={cp.active ? "Desativar" : "Ativar"} onClick={() => toggleCoupon.mutate({ id: cp.id, active: !cp.active })}>
                      <Power className={`w-4 h-4 ${cp.active ? "text-green-600" : "text-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteCoupon.mutate(cp.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">Nenhum cupom ainda. Crie um para cada loja parceira.</div>
          )}
        </CardContent>
      </Card>

      {/* Integração com o Totexmotors OS */}
      <Card className="border-0 shadow-premium-md lg:col-span-3">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Plug className="w-5 h-5" /> Integração com o Totexmotors OS</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Chave de API da integração (X-API-Key)</Label>
              <div className="flex gap-2">
                <Input type="password" value={integ.integration_api_key} onChange={(e) => setInteg((p) => ({ ...p, integration_api_key: e.target.value }))} placeholder="chave secreta" />
                <Button variant="outline" onClick={() => setInteg((p) => ({ ...p, integration_api_key: crypto.randomUUID().replace(/-/g, "") }))}>Gerar</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL de webhook do OS (recebe eventos do TCF)</Label>
              <Input value={integ.os_webhook_url} onChange={(e) => setInteg((p) => ({ ...p, os_webhook_url: e.target.value }))} placeholder="https://totex-motors-os.vercel.app/api/tcf-webhook" />
            </div>
          </div>
          <div className="space-y-1 pt-2 border-t">
            <Label className="text-xs">Endpoint da API (o OS chama via POST com header <code>x-api-key</code>):</Label>
            <code className="block text-xs bg-muted p-2 rounded break-all">{integrationUrl}</code>
            <p className="text-xs text-muted-foreground pt-1">
              Ações: <code>provision_owner</code> (cria a conta do cliente com o Bônus), <code>create_coupon</code>, <code>validate_coupon</code>, <code>get_owner</code>, <code>list_coupons</code>.
              O TCF dispara <code>subscription.activated/deactivated</code> para a URL acima quando o cliente paga/cancela.
            </p>
          </div>
          <div className="flex justify-end">
            <Button className="bg-gradient-primary" onClick={saveInteg} disabled={updateSettings.isPending}>
              <Save className="w-4 h-4 mr-2" /> {updateSettings.isPending ? "Salvando..." : "Salvar integração"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Funil da versão grátis "Quanto Vale / Valor Vivo": consulta → opt-in → aviso → avaliação.
// Piloto com número real (topo de funil do totem/QR do shopping e do WhatsApp).
function FunilValeTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["funil_vale"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-api", { body: { action: "funil_vale" } });
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  const f = data?.funil;
  const serie = (data?.serie14 || []) as { dia: string; consultas: number; optin: number }[];
  if (!f) return <div className="p-8 text-center text-muted-foreground">Sem dados ainda.</div>;

  const maxV = Math.max(1, ...serie.map((s) => Math.max(s.consultas, s.optin)));
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  const etapas = [
    { l: "Consultaram o valor", v: f.consultas.total },
    { l: "Pediram acompanhamento (opt-in)", v: f.optin.total },
    { l: "Já receberam aviso", v: f.optin.avisados },
    { l: "Quiseram avaliar", v: f.conversas.avaliar },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Piloto da versão grátis: <b className="text-foreground">consulta de placa → acompanhamento → avaliação</b>. Topo de funil do totem/QR e do WhatsApp.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Car className="w-4 h-4" /> Consultas de valor</div>
          <div className="text-3xl font-bold mt-1">{f.consultas.total}</div>
          <div className="text-xs text-muted-foreground mt-1">{f.consultas.d7} nos últimos 7 dias</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="w-4 h-4" /> Opt-in Valor Vivo</div>
          <div className="text-3xl font-bold mt-1 text-primary">{f.optin.ativos}</div>
          <div className="text-xs text-muted-foreground mt-1">{f.taxa_optin}% das consultas · {f.optin.total} no total</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><MessageCircle className="w-4 h-4" /> Já avisados</div>
          <div className="text-3xl font-bold mt-1">{f.optin.avisados}</div>
          <div className="text-xs text-muted-foreground mt-1">receberam ≥ 1 aviso mensal</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><BarChart3 className="w-4 h-4" /> Quero avaliar</div>
          <div className="text-3xl font-bold mt-1">{f.conversas.avaliar}</div>
          <div className="text-xs text-muted-foreground mt-1">clicaram após o aviso</div>
        </CardContent></Card>
      </div>

      {/* funil de conversão */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Conversão do funil</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {etapas.map((r, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span>{r.l}</span>
                <span className="font-semibold">{r.v} <span className="text-muted-foreground font-normal">({pct(r.v, f.consultas.total)}%)</span></span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(2, pct(r.v, f.consultas.total))}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* série 14 dias */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Últimos 14 dias</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5 h-40">
            {serie.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center gap-0.5 h-32">
                  <div className="w-1/2 rounded-t bg-primary" style={{ height: `${(s.consultas / maxV) * 100}%` }} title={`${s.consultas} consultas`} />
                  <div className="w-1/2 rounded-t bg-teal-400" style={{ height: `${(s.optin / maxV) * 100}%` }} title={`${s.optin} opt-in`} />
                </div>
                <span className="text-[9px] text-muted-foreground">{s.dia.slice(8, 10)}/{s.dia.slice(5, 7)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary inline-block" /> Consultas</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-teal-400 inline-block" /> Novos opt-in</span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Origem das interações: Canal <b className="text-foreground">{f.canal.total}</b> · Comunidade <b className="text-foreground">{f.comunidade?.total ?? 0}</b> (no total).</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SubscriptionsTab() {
  const { data: subs, isLoading } = useSubscriptions(true);
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const list = subs || [];
  const monthlyOf = (s: Subscription) => (s.plan_cycle === "annual" ? Number(s.plan_value || 0) / 12 : Number(s.plan_value || 0));
  const isActive = (s: Subscription) => s.plan === "premium" && s.subscription_status === "active";

  const active = list.filter(isActive);
  const mrr = active.reduce((sum, s) => sum + monthlyOf(s), 0);
  const ticket = active.length ? mrr / active.length : 0;

  // agrupa por loja
  const byDealer = new Map<string, { count: number; mrr: number }>();
  active.forEach((s) => {
    const key = s.dealership || "Direto (sem loja)";
    const cur = byDealer.get(key) || { count: 0, mrr: 0 };
    cur.count += 1; cur.mrr += monthlyOf(s);
    byDealer.set(key, cur);
  });
  const dealers = [...byDealer.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.mrr - a.mrr);

  const statusBadge = (s: Subscription) => {
    if (isActive(s)) return <Badge className="bg-green-500/15 text-green-600 border-0">ativo</Badge>;
    if (s.subscription_status === "overdue") return <Badge className="bg-warning/15 text-warning border-0">atrasado</Badge>;
    if (s.subscription_status === "canceled") return <Badge variant="outline" className="text-muted-foreground">cancelado</Badge>;
    return <Badge variant="secondary">trial/free</Badge>;
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Consulta veicular paga: créditos pré-pagos do fornecedor + receita */}
      <ConsultaCreditosCard />
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="w-4 h-4" /> Assinantes ativos</div>
          <div className="text-3xl font-bold mt-1">{active.length}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="w-4 h-4" /> MRR</div>
          <div className="text-3xl font-bold mt-1 text-primary">{brl(mrr)}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><BarChart3 className="w-4 h-4" /> ARR (anualizado)</div>
          <div className="text-3xl font-bold mt-1">{brl(mrr * 12)}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><CreditCard className="w-4 h-4" /> Ticket médio</div>
          <div className="text-3xl font-bold mt-1">{brl(ticket)}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MRR por loja */}
        <Card className="border-0 shadow-premium-md lg:col-span-1">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Store className="w-5 h-5" /> MRR por loja</CardTitle></CardHeader>
          <CardContent className="p-0">
            {dealers.length ? (
              <div className="divide-y divide-border">
                {dealers.map((d) => (
                  <div key={d.name} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.count} assinante(s)</p>
                    </div>
                    <span className="font-semibold text-primary">{brl(d.mrr)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="p-8 text-center text-muted-foreground">Nenhuma assinatura ativa ainda.</div>}
          </CardContent>
        </Card>

        {/* Lista de assinaturas */}
        <Card className="border-0 shadow-premium-md lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Clientes ({list.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-[480px] overflow-auto">
              {list.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.name || s.email}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.dealership || "direto"}{s.coupon_code ? ` · ${s.coupon_code}` : ""}{s.plan_cycle ? ` · ${s.plan_cycle === "annual" ? "anual" : "mensal"}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {isActive(s) && <span className="text-sm font-medium">{brl(monthlyOf(s))}/mês</span>}
                    {statusBadge(s)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        MRR = assinantes <strong>ativos</strong>; planos anuais entram como valor/12. Os valores são gravados no checkout.
      </p>
    </div>
  );
}

// ===== GPT MOTORS — consultas veiculares (Raio-X / CRLV-e / Débitos) =====
const GPT_LABEL: Record<string, string> = { raiox: "Raio-X", crlv: "CRLV-e", debitos: "Débitos" };
const gbrl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const gdt = (s?: string) => s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

function GptMotorsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({ raiox: "", crlv: "", debitos: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: d } = await supabase.functions.invoke("admin-api", { body: { action: "gpt_stats" } });
    if ((d as any)?.ok) { setData(d); const p = (d as any).prices; setPrices({ raiox: String(p.raiox), crlv: String(p.crlv), debitos: String(p.debitos) }); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const salvar = async () => {
    setSaving(true);
    const { data: r } = await supabase.functions.invoke("admin-api", { body: { action: "gpt_set_prices", raiox: Number(prices.raiox), crlv: Number(prices.crlv), debitos: Number(prices.debitos) } });
    if ((r as any)?.ok) { toast({ title: "Preços atualizados" }); load(); } else { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-muted-foreground py-8 text-center">Não consegui carregar as consultas.</p>;
  const t = data.totais;
  const STATUS: Record<string, string> = { ok: "bg-green-500/15 text-green-600", erro: "bg-destructive/15 text-destructive" };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><ScanLine className="w-4 h-4" /> Consultas</div>
          <div className="text-3xl font-bold mt-1">{t.consultas}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Banknote className="w-4 h-4" /> Receita</div>
          <div className="text-3xl font-bold mt-1 text-primary">{gbrl(t.receita)}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><CreditCard className="w-4 h-4" /> Custo (GPT Motors)</div>
          <div className="text-3xl font-bold mt-1 text-warning">{gbrl(t.custo)}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="w-4 h-4" /> Margem</div>
          <div className="text-3xl font-bold mt-1">{gbrl(t.margem)}</div>
        </CardContent></Card>
      </div>

      {/* Por produto + edição de preço */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg">Produtos e preços</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {data.stats.map((s: any) => (
            <div key={s.produto} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div className="min-w-0">
                <p className="font-semibold flex items-center gap-2">{GPT_LABEL[s.produto]} <Badge variant="secondary">custo {gbrl(s.custo_unit)}</Badge></p>
                <p className="text-xs text-muted-foreground mt-1">{s.consultas_ok} consulta(s) · {s.faturadas} faturada(s) · receita {gbrl(s.receita)} · margem {gbrl(s.margem)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Preço R$</span>
                <Input type="number" step="0.01" className="w-28" value={(prices as any)[s.produto]} onChange={(e) => setPrices((p) => ({ ...p, [s.produto]: e.target.value }))} />
              </div>
            </div>
          ))}
          <Button onClick={salvar} disabled={saving} className="gap-1.5"><Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar preços"}</Button>
          <p className="text-xs text-muted-foreground">Custo = valor que a GPT Motors cobra por consulta (estimado). Receita = pedidos pagos. Admin/lojista consultam sem gerar receita.</p>
        </CardContent>
      </Card>

      {/* Consultas recentes */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Consultas recentes</CardTitle>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><Loader2 className="w-4 h-4" /> Atualizar</Button>
        </CardHeader>
        <CardContent className="p-0">
          {data.recent.length ? (
            <div className="divide-y divide-border">
              {data.recent.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{GPT_LABEL[c.produto] || c.produto} · {c.placa}</p>
                    <p className="text-xs text-muted-foreground">{gdt(c.created_at)}{c.faturado ? " · faturada" : ""}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.preco != null && <span className="text-sm font-medium">{gbrl(Number(c.preco))}</span>}
                    <Badge className={`border-0 ${STATUS[c.status] || "bg-muted text-muted-foreground"}`}>{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="p-8 text-center text-muted-foreground">Nenhuma consulta ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default Admin;

// Consulta veicular paga: relatório consolidado de requisições e créditos PRÉ-PAGOS do fornecedor
// (o dono compra créditos; cada consulta que bate no fornecedor consome 1; cache não consome)
function ConsultaCreditosCard() {
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
  const { data, isLoading } = useQuery({
    queryKey: ["vq-report"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("vehicle-debts", { body: { action: "report" } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
  });

  if (isLoading) return <Card className="border-0 shadow-premium-md"><CardContent className="p-6 text-center text-muted-foreground">Carregando consultas veiculares...</CardContent></Card>;
  if (!data) return null;
  const c = data.creditos, q = data.consultas, f = data.financeiro;
  const baixo = c.saldo <= 15;

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2"><Car className="w-5 h-5 text-primary" /> Consulta Veicular (créditos pré-pagos)</span>
          <Badge className={`border-0 ${baixo ? "bg-destructive/15 text-destructive" : "bg-green-500/15 text-green-600"}`}>
            saldo: {c.saldo} crédito(s)
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Créditos comprados</p>
            <p className="text-2xl font-bold">{c.comprados}</p>
            {c.apifull_saldo != null && <p className="text-xs text-muted-foreground">API Full: <b className="text-foreground">{brl(c.apifull_saldo)}</b></p>}
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Usados (sistema + fora)</p>
            <p className="text-2xl font-bold">{c.usados_total}</p>
            <p className="text-xs text-muted-foreground">{c.usados_sistema} pelo app · {c.usados_fora} fora</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Consultas concluídas</p>
            <p className="text-2xl font-bold">{q.concluidas}</p>
            <p className="text-xs text-muted-foreground">{q.cache_hits} via cache (sem custo)</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Receita × custo</p>
            <p className="text-2xl font-bold text-primary">{brl(f.receita)}</p>
            <p className="text-xs text-muted-foreground">custo {brl(f.custo)} · margem <b className="text-foreground">{brl(f.margem)}</b></p>
          </div>
        </div>
        {baixo && (
          <p className="text-sm text-destructive">⚠️ Créditos acabando — combine a recarga com o fornecedor pra consulta não sair do ar.</p>
        )}
        {data.ultimas?.length > 0 && (
          <div className="divide-y divide-border rounded-lg border">
            {data.ultimas.slice(0, 8).map((u: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2.5 text-sm">
                <span className="font-mono font-medium">{u.placa}</span>
                <span className="text-muted-foreground truncate mx-2 flex-1">{u.cliente || "—"}</span>
                <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("pt-BR")}</span>
                <Badge variant="secondary" className={`ml-2 ${u.status === "done" ? "" : u.status === "error" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                  {u.status === "done" ? (u.supplier_hit ? "1 crédito" : "cache") : u.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===================== PARCEIROS DO RADAR =====================
const RADAR_CATS: { value: string; label: string }[] = [
  { value: "oficina", label: "Oficina mecânica" }, { value: "freios", label: "Freios e suspensão" },
  { value: "autoeletrica", label: "Autoelétrica" }, { value: "bateria", label: "Baterias" },
  { value: "pneus", label: "Pneus" }, { value: "borracharia", label: "Borracharia" },
  { value: "chaveiro", label: "Chaveiro" }, { value: "vidros", label: "Vidros" },
  { value: "ar_condicionado", label: "Ar-condicionado" }, { value: "funilaria", label: "Funilaria e pintura" },
  { value: "estetica", label: "Estética e lavagem" }, { value: "vistoria", label: "Vistoria" },
  { value: "guincho", label: "Guincho / reboque" }, { value: "socorro", label: "Socorro mecânico" },
  { value: "eletrico_hibrido", label: "Elétricos e híbridos" }, { value: "posto", label: "Posto de gasolina" },
  { value: "alinhamento", label: "Alinhamento e balanceamento" }, { value: "escapamento", label: "Escapamento" },
  { value: "cambio", label: "Câmbio e transmissão" }, { value: "oleo", label: "Troca de óleo" },
  { value: "insulfilm", label: "Insulfilm / película" }, { value: "som", label: "Som e multimídia" },
  { value: "martelinho", label: "Martelinho de ouro" }, { value: "despachante", label: "Despachante" },
  { value: "gnv", label: "GNV / kit gás" },
];
const catLabel = (v: string) => RADAR_CATS.find((c) => c.value === v)?.label || v || "—";

type Partner = {
  id?: string; name: string; category: string; city: string; phone: string; whatsapp: string;
  address: string; website: string; priority: number; active: boolean; shown_count?: number; notes: string;
  // Clube de Parceiros (cadastro self-service em /parceiro)
  benefit?: string; status?: string; email?: string; contact_name?: string; code?: string;
  click_count?: number; redeem_count?: number; source?: string;
  benefit_value?: number; honored_count?: number; not_honored_count?: number;
};
const emptyPartner: Partner = { name: "", category: "oficina", city: "", phone: "", whatsapp: "", address: "", website: "", priority: 0, active: true, notes: "", benefit: "", benefit_value: 0, status: "approved", email: "", contact_name: "" };

// ===================== PROSPECÇÃO — o Radar como fonte de parceiros (convite 1 a 1 pelo WhatsApp) =====================
type Prospect = {
  id: string; name: string; category: string | null; category_key: string | null; city: string | null; state: string | null;
  address: string | null; phone: string | null; whatsapp: string | null; digits: string; rating: number | null; review_count: number | null;
  prospect: { status: string; ref: string | null; notes: string | null; touches: number; contacted_at: string | null; last_touch_at: string | null } | null;
  already_partner: { id: string; status: string } | null;
};
const PROSPECT_STATUS: { v: string; l: string; cls: string }[] = [
  { v: "novo", l: "novo", cls: "bg-muted text-muted-foreground" },
  { v: "contatado", l: "contatado", cls: "bg-sky-100 text-sky-800" },
  { v: "respondeu", l: "respondeu", cls: "bg-amber-100 text-amber-800" },
  { v: "cadastrou", l: "cadastrou", cls: "bg-emerald-100 text-emerald-800" },
  { v: "recusou", l: "recusou", cls: "bg-rose-100 text-rose-800" },
  { v: "sem_whatsapp", l: "sem WhatsApp", cls: "bg-muted text-muted-foreground" },
];
const MSG_PADRAO = `Oi, {nome}! Aqui é o Marcos, da Totex Motors (lojas de carro em shopping, Carapicuíba e Alphaville).

Nossos clientes usam um assistente no WhatsApp pra cuidar do carro, e quando alguém precisa de {categoria} em {cidade} ele mostra as opções perto. Hoje a {nome} aparece lá como resultado comum.

Quero colocar vocês como PARCEIRO: aparece primeiro, com selo, e o cliente já chega sabendo que tem um benefício seu (tipo "10% na primeira visita" ou "diagnóstico grátis").

Não tem mensalidade nem taxa. Você só dá o benefício quando o cliente aparecer.

É grátis pra todo mundo, inclusive pros concorrentes, e ninguém paga pra subir: quem dá o maior benefício fica no topo. Simples assim.

Cadastro leva 2 minutos, já deixei preenchido:
{link}

Faz sentido pra vocês?`;
const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } };

function ProspectsTab() {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-api", { body: { action: "list_prospects" } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      return ((data as any)?.prospects || []) as Prospect[];
    },
  });
  const [ref, setRef] = useState(() => lsGet("prospect_ref", "zap1"));
  const [msg, setMsg] = useState(() => lsGet("prospect_msg", MSG_PADRAO));
  const [city, setCity] = useState("todas");
  const [cat, setCat] = useState("todas");
  const [st, setSt] = useState("abertos");
  const [busca, setBusca] = useState("");
  useEffect(() => { lsSet("prospect_ref", ref); }, [ref]);
  useEffect(() => { lsSet("prospect_msg", msg); }, [msg]);

  const cities = [...new Set((rows || []).map((r) => (r.city || "").trim()).filter(Boolean))].sort();
  const cats = [...new Set((rows || []).map((r) => r.category || "").filter(Boolean))].sort();
  const statusOf = (r: Prospect) => r.already_partner ? "cadastrou" : (r.prospect?.status || "novo");
  const filtered = (rows || []).filter((r) => {
    if (city !== "todas" && (r.city || "").trim() !== city) return false;
    if (cat !== "todas" && r.category !== cat) return false;
    const s = statusOf(r);
    if (st === "abertos" && (s === "cadastrou" || s === "recusou" || s === "sem_whatsapp")) return false;
    if (st !== "abertos" && st !== "todos" && s !== st) return false;
    if (busca && !`${r.name} ${r.city} ${r.address}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));

  const linkDe = (r: Prospect) => {
    const q = new URLSearchParams({ ref, n: r.name, c: (r.city || "").trim(), p: r.id });
    if (r.category_key) q.set("cat", r.category_key);
    if (r.digits) q.set("w", r.digits);
    return `${window.location.origin}/parceiro?${q.toString()}`;
  };
  const textoDe = (r: Prospect) => msg
    .split("{nome}").join(r.name).split("{categoria}").join((r.category || "serviço").toLowerCase())
    .split("{cidade}").join((r.city || "sua região").trim()).split("{link}").join(linkDe(r));
  const touch = async (r: Prospect, status: string, notes?: string) => {
    const { data, error } = await supabase.functions.invoke("admin-api", { body: { action: "touch_prospect", provider_id: r.id, status, ref, notes } });
    if (error || (data as any)?.error) { toast({ title: "Erro", description: String((data as any)?.error || error?.message), variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["prospects"] });
  };
  const chamar = async (r: Prospect) => {
    const d = r.digits.replace(/^0+/, "");
    if (!d || d.length < 10) { toast({ title: "Esse estabelecimento não tem telefone válido", variant: "destructive" }); return; }
    const num = d.startsWith("55") ? d : `55${d}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(textoDe(r))}`, "_blank", "noopener");
    await touch(r, "contatado");
  };
  const copiar = async (r: Prospect) => { await navigator.clipboard?.writeText(linkDe(r)); toast({ title: "Link copiado" }); };

  const tot = { abertos: 0, contatado: 0, respondeu: 0, cadastrou: 0 };
  for (const r of rows || []) { const s = statusOf(r); if (s === "cadastrou") tot.cadastrou++; else if (s === "respondeu") tot.respondeu++; else if (s === "contatado") tot.contatado++; else if (s === "novo") tot.abertos++; }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="border-0 shadow-premium-md lg:col-span-1">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Send className="w-5 h-5" /> Mensagem e número</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            A lista ao lado vem do próprio Radar: todo estabelecimento que apareceu numa busca, com telefone. Falta algum? Faça a busca na tela <a href="/servicos" className="text-primary underline">Serviços</a> (categoria + cidade) e ele entra aqui.
          </p>
          <div className="space-y-2">
            <Label>Qual WhatsApp está mandando? (vai no link como origem)</Label>
            <div className="flex gap-2">
              {["zap1", "zap2", "zap3"].map((z) => <Button key={z} size="sm" variant={ref === z ? "default" : "outline"} className={ref === z ? "bg-gradient-primary" : ""} onClick={() => setRef(z)}>{z}</Button>)}
              <Input value={ref} onChange={(e) => setRef(e.target.value.replace(/[^a-z0-9_-]/gi, "").toLowerCase())} placeholder="ou outro nome" className="max-w-[140px]" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mensagem de abertura</Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={14} className="text-sm" />
            <p className="text-xs text-muted-foreground">Troca automática: <code>{"{nome}"}</code>, <code>{"{categoria}"}</code>, <code>{"{cidade}"}</code>, <code>{"{link}"}</code>. Até 25 por dia por número, respondendo quem responde. Follow-up só uma vez, 48 h depois.</p>
            <Button size="sm" variant="ghost" onClick={() => setMsg(MSG_PADRAO)}>Voltar ao texto padrão</Button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[["novos", tot.abertos], ["contatados", tot.contatado], ["responderam", tot.respondeu], ["cadastraram", tot.cadastrou]].map(([l, n]) => (
              <div key={String(l)} className="rounded-lg border p-2"><div className="text-lg font-bold">{n}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wide">{l}</div></div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Radar className="w-5 h-5" /> Estabelecimentos do Radar ({filtered.length})</CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
            <Select value={city} onValueChange={setCity}><SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas as cidades</SelectItem>{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            <Select value={cat} onValueChange={setCat}><SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas as categorias</SelectItem>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            <Select value={st} onValueChange={setSt}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="abertos">Em aberto</SelectItem><SelectItem value="todos">Todos</SelectItem>{PROSPECT_STATUS.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent></Select>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome / endereço" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            : !filtered.length ? <div className="p-8 text-center text-muted-foreground">Nada aqui com esses filtros. Faça uma busca no Radar (tela Serviços) pra descobrir estabelecimentos novos.</div>
            : <div className="divide-y divide-border">
              {filtered.map((r) => {
                const s = statusOf(r); const sd = PROSPECT_STATUS.find((x) => x.v === s) || PROSPECT_STATUS[0];
                return (
                  <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate flex items-center gap-2">{r.name}<Badge className={`border-0 ${sd.cls}`}>{sd.l}</Badge>{r.already_partner && <Badge className="border-0 bg-emerald-100 text-emerald-800">parceiro {r.already_partner.status}</Badge>}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.category || "—"}{r.city ? ` · ${r.city}` : ""}{r.rating ? ` · ★ ${Number(r.rating).toFixed(1)}${r.review_count ? ` (${r.review_count})` : ""}` : ""}{r.digits ? ` · ${r.digits}` : " · sem telefone"}</p>
                      {r.prospect && <p className="text-xs text-muted-foreground">{r.prospect.touches || 0} contato{(r.prospect.touches || 0) === 1 ? "" : "s"}{r.prospect.last_touch_at ? ` · último ${new Date(r.prospect.last_touch_at).toLocaleDateString("pt-BR")}` : ""}{r.prospect.ref ? ` · via ${r.prospect.ref}` : ""}{r.prospect.notes ? ` · ${r.prospect.notes}` : ""}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                      {!r.already_partner && <Button size="sm" className="bg-gradient-primary gap-1" onClick={() => chamar(r)}><MessageCircle className="w-4 h-4" /> WhatsApp</Button>}
                      <Button size="sm" variant="ghost" onClick={() => copiar(r)} title="Copiar link personalizado"><Copy className="w-4 h-4" /></Button>
                      {!r.already_partner && (
                        <Select value={s} onValueChange={(v) => touch(r, v)}>
                          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{PROSPECT_STATUS.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>}
        </CardContent>
      </Card>
    </div>
  );
}

function PartnersTab() {
  const qc = useQueryClient();
  const { data: partners, isLoading } = useQuery({
    queryKey: ["radar-partners"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-api", { body: { action: "list_partners" } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      return ((data as any)?.partners || []) as Partner[];
    },
  });
  const [f, setF] = useState<Partner>(emptyPartner);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Partner, v: any) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) { toast({ title: "Informe o nome do parceiro", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-api", { body: { action: "save_partner", ...f } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: f.id ? "Parceiro atualizado" : "Parceiro cadastrado ✅" });
      setF(emptyPartner);
      qc.invalidateQueries({ queryKey: ["radar-partners"] });
    } catch (e: any) { toast({ title: "Erro ao salvar", description: String(e?.message || e), variant: "destructive" }); }
    finally { setSaving(false); }
  };
  const remove = async (id?: string) => {
    if (!id) return;
    await supabase.functions.invoke("admin-api", { body: { action: "delete_partner", id } });
    qc.invalidateQueries({ queryKey: ["radar-partners"] });
    toast({ title: "Parceiro removido" });
  };
  const toggle = async (p: Partner) => {
    await supabase.functions.invoke("admin-api", { body: { action: "save_partner", ...p, active: !p.active } });
    qc.invalidateQueries({ queryKey: ["radar-partners"] });
  };
  // Clube de Parceiros: aprova/recusa cadastro self-service. Aprovado = entra no Radar na hora.
  const setStatus = async (id: string | undefined, status: "approved" | "rejected" | "pending") => {
    if (!id) return;
    const { data, error } = await supabase.functions.invoke("admin-api", { body: { action: "set_partner_status", id, status } });
    if (error || (data as any)?.error) { toast({ title: "Erro", description: String((data as any)?.error || error?.message), variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["radar-partners"] });
    toast({ title: status === "approved" ? "Parceiro aprovado ✅ — já aparece no Radar" : status === "rejected" ? "Cadastro recusado" : "Voltou pra pendente" });
  };
  const pend = (partners || []).filter((x) => x.status === "pending").length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wrench className="w-5 h-5" /> {f.id ? "Editar parceiro" : "Novo parceiro do Radar"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Parceiros aparecem com selo <strong>“Parceiro Totex”</strong> e no <strong>topo</strong> da categoria/cidade dele quando um motorista buscar no Radar.</p>
          <div className="space-y-2"><Label>Nome</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Auto Center do Zé" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Categoria</Label>
              <Select value={f.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RADAR_CATS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Cidade / bairro</Label><Input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Barueri" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Telefone</Label><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="11 3xxx-xxxx" /></div>
            <div className="space-y-2"><Label>WhatsApp</Label><Input value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="11 9xxxx-xxxx" /></div>
          </div>
          <div className="space-y-2"><Label>Endereço</Label><Input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, bairro" /></div>
          <div className="space-y-2">
            <Label>Benefício pro usuário Co-pilot</Label>
            <Input value={f.benefit || ""} onChange={(e) => set("benefit", e.target.value)} placeholder='Ex.: "10% na primeira visita" ou "Diagnóstico grátis"' maxLength={160} />
            <p className="text-xs text-muted-foreground">Aparece em destaque no Radar (app e WhatsApp) com o botão “Resgatar”.</p>
          </div>
          <div className="space-y-2">
            <Label>Valor do benefício pro cliente (R$) — regra do topo</Label>
            <Input type="number" min={0} value={f.benefit_value ?? 0} onChange={(e) => set("benefit_value", Number(e.target.value))} placeholder="80" />
            <p className="text-xs text-muted-foreground">Os 3 maiores valores da categoria/cidade ficam no topo com selo. Quem não honra (feedback do cliente após resgate) desce. Ninguém paga pra subir.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Contato (opcional)</Label><Input value={f.contact_name || ""} onChange={(e) => set("contact_name", e.target.value)} placeholder="Nome do responsável" /></div>
            <div className="space-y-2"><Label>E-mail (opcional)</Label><Input value={f.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="contato@..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Site (opcional)</Label><Input value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." /></div>
            <div className="space-y-2"><Label>Prioridade</Label><Input type="number" value={f.priority} onChange={(e) => set("priority", Number(e.target.value))} placeholder="0" /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><Label>Ativo</Label><p className="text-xs text-muted-foreground">Desligue pra tirar do Radar sem apagar</p></div>
            <Switch checked={f.active} onCheckedChange={(v) => set("active", v)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="bg-gradient-primary gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {f.id ? "Salvar" : "Cadastrar"}</Button>
            {f.id && <Button variant="ghost" onClick={() => setF(emptyPartner)}>Cancelar edição</Button>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2">Parceiros cadastrados ({partners?.length || 0}){pend > 0 && <Badge className="border-0 bg-amber-100 text-amber-800">{pend} pendente{pend > 1 ? "s" : ""}</Badge>}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            : !partners?.length ? <div className="p-8 text-center text-muted-foreground">Nenhum parceiro ainda. Cadastre o primeiro ao lado — ele já entra no Radar com selo e prioridade.</div>
            : <div className="divide-y divide-border">
              {[...partners].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1)).map((p) => (
                <div key={p.id} className={`p-4 flex items-center justify-between gap-3 ${p.status === "pending" ? "bg-amber-50/60" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-medium truncate flex items-center gap-2">{p.name}
                      {p.status === "pending" && <Badge className="border-0 bg-amber-100 text-amber-800">pendente</Badge>}
                      {p.status === "rejected" && <Badge className="border-0 bg-muted text-muted-foreground">recusado</Badge>}
                      {p.status !== "pending" && p.status !== "rejected" && !p.active && <Badge className="border-0 bg-muted text-muted-foreground">inativo</Badge>}
                      {p.priority > 0 && <Badge className="border-0 bg-primary/15 text-primary">prio {p.priority}</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{catLabel(p.category)}{p.city ? ` · ${p.city}` : ""}{p.whatsapp ? ` · zap ${p.whatsapp}` : ""}{p.contact_name ? ` · ${p.contact_name}` : ""}{p.source && p.source !== "self_service" ? ` · via ${p.source}` : ""}</p>
                    {p.benefit && <p className="text-xs text-primary truncate">🎁 {p.benefit}{p.benefit_value ? ` · vale R$ ${Math.round(Number(p.benefit_value))}` : " · sem valor (fora do topo)"}{p.code ? ` · cód. ${p.code.toUpperCase()}` : ""}{(p.honored_count || p.not_honored_count) ? ` · honrou ${p.honored_count || 0}/${(p.honored_count || 0) + (p.not_honored_count || 0)}` : ""}</p>}
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> {p.shown_count || 0} aparições · {p.click_count || 0} cliques · {p.redeem_count || 0} resgates</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {p.status === "pending" ? (
                      <>
                        <Button size="sm" className="bg-gradient-primary" onClick={() => setStatus(p.id, "approved")}>Aprovar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatus(p.id, "rejected")}>Recusar</Button>
                      </>
                    ) : (
                      <Switch checked={p.active} onCheckedChange={() => toggle(p)} />
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setF({ ...emptyPartner, ...p })}>Editar</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>}
        </CardContent>
      </Card>
    </div>
  );
}
