import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
import { Users, KeyRound, Plus, Trash2, ShieldCheck, Save, UserPlus, MessageCircle, CreditCard, Ticket, Plug, Power, BarChart3, TrendingUp, Store, ExternalLink, Car, Navigation } from "lucide-react";
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
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-muted-foreground">Gerencie proprietários e as integrações de IA</p>
      </div>

      <Tabs defaultValue="owners" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="owners" className="gap-2"><Users className="w-4 h-4" /> Proprietários</TabsTrigger>
          <TabsTrigger value="dealers" className="gap-2"><Store className="w-4 h-4" /> Lojistas</TabsTrigger>
          <TabsTrigger value="config" className="gap-2"><KeyRound className="w-4 h-4" /> Configurações & Integrações</TabsTrigger>
          <TabsTrigger value="growth" className="gap-2"><Ticket className="w-4 h-4" /> Cupons & Ecossistema</TabsTrigger>
          <TabsTrigger value="subs" className="gap-2"><BarChart3 className="w-4 h-4" /> Assinaturas</TabsTrigger>
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
      </Tabs>
    </DashboardLayout>
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
    placa_bearer: "", placa_device: "", placa_url: "",
    referral_buyer_offer: "Transferência grátis",
    smartgps_enabled: false, smartgps_base_url: "https://web.smartgps.com.br", smartgps_email: "", smartgps_password: "",
    support_owner_phone: "",
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
        placa_bearer: settings.placa_api_bearer || "",
        placa_device: settings.placa_api_device || "",
        placa_url: settings.placa_api_url || "",
        referral_buyer_offer: settings.referral_buyer_offer || "Transferência grátis",
        smartgps_enabled: (settings as any).smartgps_enabled ?? false,
        smartgps_base_url: (settings as any).smartgps_base_url || "https://web.smartgps.com.br",
        smartgps_email: (settings as any).smartgps_email || "",
        smartgps_password: (settings as any).smartgps_password || "",
        support_owner_phone: (settings as any).support_owner_phone || "",
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
        placa_api_bearer: f.placa_bearer || null,
        placa_api_device: f.placa_device || null,
        placa_api_url: f.placa_url || null,
        referral_buyer_offer: f.referral_buyer_offer || null,
        smartgps_enabled: f.smartgps_enabled,
        smartgps_base_url: f.smartgps_base_url || null,
        smartgps_email: f.smartgps_email || null,
        smartgps_password: f.smartgps_password || null,
        support_owner_phone: f.support_owner_phone.replace(/\D/g, "") || null,
      },
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
            <div className="space-y-2"><Label>URL (avançado — deixe em branco p/ PuxaPlaca)</Label><Input value={f.placa_url} onChange={(e) => set("placa_url", e.target.value)} placeholder="https://api.puxaplaca.app" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Rastreador (SmartGPS) */}
      <Card className="border-0 shadow-premium-md lg:col-span-2">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Navigation className="w-5 h-5" /> Rastreador (SmartGPS)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Conta-mestre do <strong>SmartGPS</strong>: o sistema loga uma vez e vincula cada carro ao seu rastreador
            pela <strong>placa</strong> (ou IMEI). O dono vê a localização ao vivo, o trajeto e o hodômetro é
            sincronizado sozinho. Use o host do seu tenant (ex.: <code>https://sc.smartgps.com.br</code>).
          </p>
          <div className="flex items-center gap-3">
            <Switch checked={f.smartgps_enabled} onCheckedChange={(v) => set("smartgps_enabled", v)} />
            <Label>Ativar rastreamento</Label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>URL base (tenant)</Label><Input value={f.smartgps_base_url} onChange={(e) => set("smartgps_base_url", e.target.value)} placeholder="https://web.smartgps.com.br" /></div>
            <div className="space-y-2"><Label>E-mail da conta-mestre</Label><Input type="email" value={f.smartgps_email} onChange={(e) => set("smartgps_email", e.target.value)} placeholder="conta@totexmotors.com" /></div>
            <div className="space-y-2"><Label>Senha da conta-mestre</Label><Input type="password" value={f.smartgps_password} onChange={(e) => set("smartgps_password", e.target.value)} placeholder="••••••••" /></div>
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

export default Admin;
