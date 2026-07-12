import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Car, Users, LogOut, Search, Store, CalendarClock, Wallet,
  Phone, Mail, Gauge, AlertTriangle, ShieldCheck, BadgeCheck, Fuel,
  Megaphone, Sparkles, Send, Loader2, MessageCircle, Banknote,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useCurrentUser, useAuth } from "@/hooks/useAuth";
import { AuthPage } from "@/pages/Auth";
import { toast } from "@/hooks/use-toast";
import {
  useDealerMe, useDealerClients, useClientJourney,
  useCampaignRecipients, useDraftMessage, useSendCampaign,
  type DealerClient, type ClientNextDue, type CampaignAudience,
} from "@/hooks/useDealer";
import { useBuybackRequests, useUpdateBuyback, type BuybackRequest } from "@/hooks/useBuyback";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");

// Espelho client-side do personalize() do backend, só para a pré-visualização
function previewPersonalize(tpl: string, c: any): string {
  const veiculo = c?.vehicle ? [c.vehicle.marca, c.vehicle.modelo].filter(Boolean).join(" ") : "seu veículo";
  const nd = c?.next_due;
  return String(tpl || "")
    .replace(/\{nome\}/gi, (c?.name || "").split(" ")[0] || "tudo bem")
    .replace(/\{nome_completo\}/gi, c?.name || "")
    .replace(/\{veiculo\}/gi, veiculo)
    .replace(/\{placa\}/gi, c?.vehicle?.placa || "")
    .replace(/\{vencimento\}/gi, nd ? `${nd.tipo} em ${fmtDate(nd.date)}` : "")
    .replace(/\{tipo_vencimento\}/gi, nd?.tipo || "")
    .replace(/\{dias\}/gi, nd?.days != null ? String(nd.days) : "")
    .replace(/\{loja\}/gi, c?.dealership || "");
}

const VARIAVEIS = ["{nome}", "{veiculo}", "{placa}", "{vencimento}", "{dias}", "{loja}"];

function dueTone(days: number | null): { cls: string; label: string } {
  if (days == null) return { cls: "bg-muted text-muted-foreground", label: "—" };
  if (days < 0) return { cls: "bg-destructive/15 text-destructive", label: `vencido há ${Math.abs(days)}d` };
  if (days <= 15) return { cls: "bg-destructive/15 text-destructive", label: `em ${days}d` };
  if (days <= 30) return { cls: "bg-warning/15 text-warning", label: `em ${days}d` };
  return { cls: "bg-green-500/15 text-green-600", label: `em ${days}d` };
}

function DueChip({ due }: { due: ClientNextDue | null }) {
  if (!due) return <span className="text-xs text-muted-foreground">sem vencimentos</span>;
  const t = dueTone(due.days);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${t.cls}`}>
      <CalendarClock className="w-3 h-3" /> {due.tipo} {t.label}
    </span>
  );
}

function planBadge(c: { plan: string | null; subscription_status: string | null }) {
  if (c.plan === "premium" && c.subscription_status === "active")
    return <Badge className="bg-green-500/15 text-green-600 border-0">Totex Care ativo</Badge>;
  if (c.subscription_status === "overdue")
    return <Badge className="bg-warning/15 text-warning border-0">atrasado</Badge>;
  if (c.subscription_status === "canceled")
    return <Badge variant="outline" className="text-muted-foreground">cancelado</Badge>;
  return <Badge variant="secondary">trial/free</Badge>;
}

export default function Dealer() {
  const { user, userData, loading } = useCurrentUser();
  const { signOut } = useAuth();
  const isDealerOrAdmin = userData?.role === "dealer" || userData?.role === "admin";

  // admin pode abrir o painel de uma loja específica via /lojista?dealership=...
  const [searchParams] = useSearchParams();
  const viewStore = userData?.role === "admin" ? (searchParams.get("dealership") || undefined) : undefined;

  const { data: dealer } = useDealerMe(!!user && isDealerOrAdmin);
  const { data: clients, isLoading } = useDealerClients(!!user && isDealerOrAdmin, viewStore);

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<DealerClient | null>(null);

  const filtered = useMemo(() => {
    const list = clients || [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((c) =>
      [c.name, c.email, c.phone, c.vehicle?.placa, c.vehicle?.marca, c.vehicle?.modelo]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [clients, q]);

  const kpis = useMemo(() => {
    const list = clients || [];
    const active = list.filter((c) => c.plan === "premium" && c.subscription_status === "active").length;
    const trial = list.filter((c) => c.subscription_status === "trial" || c.plan === "free").length;
    const urgent = list.filter((c) => c.next_due && c.next_due.days != null && c.next_due.days <= 30).length;
    return { total: list.length, active, trial, urgent };
  }, [clients]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <AuthPage />;

  if (!isDealerOrAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-secondary p-6">
        <Card className="border-0 shadow-premium-lg max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Esta área é exclusiva para lojistas parceiros.</p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-tight truncate">Painel do Lojista</p>
              <p className="text-xs text-muted-foreground truncate">
                {viewStore || dealer?.dealership || (userData?.role === "admin" ? "Todas as lojas (admin)" : "Sua loja")}
                {viewStore && <span className="ml-1 text-primary">(visão admin)</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-muted-foreground">{userData?.name}</span>
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="w-4 h-4" /> Clientes</div>
            <div className="text-3xl font-bold mt-1">{kpis.total}</div>
          </CardContent></Card>
          <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><BadgeCheck className="w-4 h-4" /> Assinantes ativos</div>
            <div className="text-3xl font-bold mt-1 text-primary">{kpis.active}</div>
          </CardContent></Card>
          <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Wallet className="w-4 h-4" /> Em trial/free</div>
            <div className="text-3xl font-bold mt-1">{kpis.trial}</div>
          </CardContent></Card>
          <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertTriangle className="w-4 h-4" /> Vencendo (30d)</div>
            <div className="text-3xl font-bold mt-1 text-warning">{kpis.urgent}</div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="clientes" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="clientes" className="gap-2"><Users className="w-4 h-4" /> Clientes</TabsTrigger>
            <TabsTrigger value="campanhas" className="gap-2"><Megaphone className="w-4 h-4" /> Campanhas</TabsTrigger>
            <TabsTrigger value="recompras" className="gap-2"><Banknote className="w-4 h-4" /> Recompras</TabsTrigger>
          </TabsList>

          <TabsContent value="clientes" className="mt-6 space-y-6">
            {/* Busca */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Buscar por nome, e-mail, placa..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            {/* Lista de clientes */}
            <Card className="border-0 shadow-premium-md">
              <CardHeader>
                <CardTitle className="text-lg">Clientes ({filtered.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando clientes...</div>
                ) : filtered.length ? (
                  <div className="divide-y divide-border">
                    {filtered.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className="w-full text-left flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{c.name || c.email || "Sem nome"}</p>
                          <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                            <Car className="w-3.5 h-3.5" />
                            {c.vehicle
                              ? [c.vehicle.marca, c.vehicle.modelo].filter(Boolean).join(" ") + (c.vehicle.placa ? ` · ${c.vehicle.placa}` : "")
                              : "sem veículo cadastrado"}
                          </p>
                          <div className="mt-1.5"><DueChip due={c.next_due} /></div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {planBadge(c)}
                          <span className="text-sm text-muted-foreground">{brl(c.total_expenses)} · {c.expense_count} gastos</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    {clients && clients.length ? "Nenhum cliente encontrado para a busca." : "Nenhum cliente cadastrado para esta loja ainda."}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campanhas" className="mt-6">
            <Card className="border-0 shadow-premium-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Megaphone className="w-5 h-5" /> Nova campanha de WhatsApp</CardTitle>
              </CardHeader>
              <CardContent>
                <CampaignComposer dealership={viewStore} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recompras" className="mt-6">
            <BuybackTab dealership={viewStore} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Ficha / jornada do cliente */}
      <ClientSheet client={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const BUYBACK_STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Novo", cls: "bg-warning/15 text-warning" },
  contacted: { label: "Em contato", cls: "bg-primary/15 text-primary" },
  closed: { label: "Concluído", cls: "bg-green-500/15 text-green-600" },
  declined: { label: "Recusado", cls: "bg-muted text-muted-foreground" },
};

function BuybackTab({ dealership }: { dealership?: string }) {
  const { data: reqs, isLoading } = useBuybackRequests(true, dealership);
  const update = useUpdateBuyback();

  const setStatus = (id: string, status: string) =>
    update.mutate({ id, status }, {
      onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
    });

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Banknote className="w-5 h-5" /> Pedidos de recompra ({reqs?.length || 0})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : reqs && reqs.length ? (
          <div className="divide-y divide-border">
            {reqs.map((r: BuybackRequest) => {
              const st = BUYBACK_STATUS[r.status] || BUYBACK_STATUS.new;
              const wa = r.owner_phone ? `https://wa.me/${String(r.owner_phone).replace(/\D/g, "")}` : null;
              return (
                <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate flex items-center gap-2">
                      {r.owner_name || "Cliente"} <Badge className={`border-0 ${st.cls}`}>{st.label}</Badge>
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      <Car className="w-3.5 h-3.5 inline mr-1" />{[r.brand, r.model, r.year].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      FIPE {brl(Number(r.fipe_value))} · oferta ({r.offer_pct}%) <b className="text-foreground">{brl(Number(r.offer_value))}</b> · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {wa && (
                      <Button asChild size="sm" variant="outline">
                        <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp</a>
                      </Button>
                    )}
                    {r.status !== "contacted" && r.status !== "closed" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "contacted")} disabled={update.isPending}>Em contato</Button>
                    )}
                    {r.status !== "closed" && (
                      <Button size="sm" className="bg-gradient-primary" onClick={() => setStatus(r.id, "closed")} disabled={update.isPending}>Concluir</Button>
                    )}
                    {r.status !== "declined" && r.status !== "closed" && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setStatus(r.id, "declined")} disabled={update.isPending}>Recusar</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Nenhum pedido de recompra ainda. Quando um cliente avaliar o carro em "Vender meu carro", aparece aqui.</div>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignComposer({ fixedClient, dealership }: { fixedClient?: DealerClient; dealership?: string }) {
  const single = !!fixedClient;
  const [audience, setAudience] = useState<CampaignAudience>(single ? "single" : "due_soon");
  const [message, setMessage] = useState("");
  const [brief, setBrief] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: rec, isLoading: loadingRec } = useCampaignRecipients(audience, fixedClient?.id ?? null, true, dealership);
  const draft = useDraftMessage();
  const send = useSendCampaign();

  const recipients = rec?.recipients || [];
  const count = single ? 1 : (rec?.count || 0);
  const previewClient = single ? fixedClient : recipients[0];
  const preview = message ? previewPersonalize(message, previewClient) : "";

  const insertVar = (v: string) => setMessage((m) => (m ? `${m} ${v}` : v));

  const handleDraft = () => {
    const b = brief.trim() || (audience === "due_soon"
      ? "Lembrar o cliente do vencimento próximo e oferecer ajuda da loja"
      : "Mensagem cordial de relacionamento da loja com o cliente");
    draft.mutate(b, {
      onSuccess: (msg) => setMessage(msg),
      onError: (e: any) => toast({ title: "Erro ao gerar", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  const handleSend = () => {
    send.mutate({ audience, message, clientId: fixedClient?.id, dealership }, {
      onSuccess: (r) => { toast({ title: "Campanha enviada ✅", description: `${r.sent} enviada(s)${r.failed ? `, ${r.failed} falhou(aram)` : ""}.` }); setConfirmOpen(false); },
      onError: (e: any) => { toast({ title: "Erro ao enviar", description: String(e?.message || e), variant: "destructive" }); setConfirmOpen(false); },
    });
  };

  return (
    <div className="space-y-5">
      {/* Público */}
      {!single && (
        <div className="space-y-2">
          <Label>Para quem enviar</Label>
          <RadioGroup value={audience} onValueChange={(v) => setAudience(v as CampaignAudience)} className="grid sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="due_soon" className="mt-0.5" />
              <span><span className="font-medium block">Vencimento próximo</span><span className="text-xs text-muted-foreground">Quem tem licenciamento/IPVA/seguro/CNH vencendo em até 30 dias</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="all" className="mt-0.5" />
              <span><span className="font-medium block">Todos os clientes</span><span className="text-xs text-muted-foreground">Toda a base da loja com WhatsApp cadastrado</span></span>
            </label>
          </RadioGroup>
        </div>
      )}

      {/* Contagem */}
      <div className="text-sm text-muted-foreground">
        {single ? (
          <>Enviando para <b className="text-foreground">{fixedClient?.name || "este cliente"}</b> ({fixedClient?.phone})</>
        ) : loadingRec ? "Calculando destinatários..." : (
          <><b className="text-foreground">{count}</b> destinatário(s) com WhatsApp{count === 0 ? " — ninguém se encaixa nesse público." : "."}</>
        )}
      </div>

      {/* Gerar com IA */}
      <div className="space-y-2">
        <Label>Gerar com IA (opcional)</Label>
        <div className="flex gap-2">
          <Input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Ex.: avisar da revisão dos 10 mil km e oferecer 10% de desconto" />
          <Button type="button" variant="outline" onClick={handleDraft} disabled={draft.isPending} className="flex-shrink-0">
            {draft.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="ml-2 hidden sm:inline">Gerar</span>
          </Button>
        </div>
      </div>

      {/* Mensagem */}
      <div className="space-y-2">
        <Label>Mensagem</Label>
        <div className="flex flex-wrap gap-1.5">
          {VARIAVEIS.map((v) => (
            <button key={v} type="button" onClick={() => insertVar(v)}
              className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              {v}
            </button>
          ))}
        </div>
        <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Olá {nome}! Tudo bem com o seu {veiculo}? ..." />
        <p className="text-xs text-muted-foreground">As variáveis são trocadas pelos dados de cada cliente no envio.</p>
      </div>

      {/* Pré-visualização */}
      {preview && (
        <div className="space-y-1">
          <Label className="text-xs">Pré-visualização {previewClient?.name ? `(${previewClient.name})` : ""}</Label>
          <div className="rounded-lg bg-[#075E54]/5 border border-[#075E54]/20 p-3 text-sm whitespace-pre-wrap">{preview}</div>
        </div>
      )}

      <div className="flex justify-end">
        <Button className="bg-gradient-primary" disabled={!message.trim() || count === 0 || send.isPending} onClick={() => setConfirmOpen(true)}>
          <Send className="w-4 h-4 mr-2" /> Enviar {single ? "" : `para ${count}`}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              {single
                ? `Enviar esta mensagem no WhatsApp para ${fixedClient?.name || "o cliente"}?`
                : `Enviar esta mensagem no WhatsApp para ${count} cliente(s) da loja? Esta ação dispara mensagens reais.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={send.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-gradient-primary" disabled={send.isPending} onClick={(e) => { e.preventDefault(); handleSend(); }}>
              {send.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : "Confirmar e enviar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientSheet({ client, onClose }: { client: DealerClient | null; onClose: () => void }) {
  const { data: journey, isLoading } = useClientJourney(client?.id || null);
  const [msgOpen, setMsgOpen] = useState(false);
  const v = journey?.vehicle;

  return (
    <Sheet open={!!client} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{client?.name || client?.email || "Cliente"}</SheetTitle>
          <SheetDescription className="flex flex-col gap-1">
            {client?.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {client.email}</span>}
            {client?.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {client.phone}</span>}
          </SheetDescription>
        </SheetHeader>

        {client?.phone && (
          <Button className="mt-4 w-full bg-gradient-primary" onClick={() => setMsgOpen(true)}>
            <MessageCircle className="w-4 h-4 mr-2" /> Enviar WhatsApp
          </Button>
        )}

        <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5" /> Mensagem para {client?.name || "o cliente"}</DialogTitle>
            </DialogHeader>
            {client && <CampaignComposer fixedClient={client} />}
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Carregando jornada...</div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Veículo */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Car className="w-4 h-4" /> Veículo</h3>
              {v ? (
                <div className="rounded-lg border p-3 space-y-1 text-sm">
                  <p className="font-medium">{[v.marca, v.modelo].filter(Boolean).join(" ") || v.name || "—"}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                    {v.placa && <span>Placa: <b className="text-foreground">{v.placa}</b></span>}
                    {v.cor && <span>Cor: <b className="text-foreground">{v.cor}</b></span>}
                    {v.combustivel && <span>Comb.: <b className="text-foreground">{v.combustivel}</b></span>}
                    {v.hodometro != null && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> {Number(v.hodometro).toLocaleString("pt-BR")} km</span>}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">Cliente ainda não cadastrou o veículo.</p>}
            </section>

            {/* Vencimentos */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> Vencimentos</h3>
              {journey?.vencimentos?.length ? (
                <div className="space-y-2">
                  {journey.vencimentos.map((d) => {
                    const t = dueTone(d.days);
                    return (
                      <div key={d.tipo} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                        <span className="font-medium">{d.tipo}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">{fmtDate(d.date)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.cls}`}>{t.label}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-muted-foreground">Nenhum vencimento cadastrado.</p>}
            </section>

            {/* Gastos */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Gastos</h3>
              <div className="rounded-lg border p-3 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{brl(journey?.expenses.total || 0)}</p>
                  <p className="text-xs text-muted-foreground">{journey?.expenses.count || 0} lançamentos</p>
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-0.5">
                  {Object.entries(journey?.expenses.by_category || {})
                    .sort((a, b) => b[1] - a[1]).slice(0, 4)
                    .map(([cat, val]) => (
                      <div key={cat} className="flex items-center justify-end gap-2">
                        <span>{cat}</span><b className="text-foreground">{brl(val)}</b>
                      </div>
                    ))}
                </div>
              </div>
              <div className="space-y-1.5">
                {(journey?.recent_expenses || []).slice(0, 12).map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Fuel className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{t.description || t.category || "Gasto"}</span>
                    </span>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{fmtDate(t.date)}</span>
                      <b>{brl(Math.abs(t.amount))}</b>
                    </span>
                  </div>
                ))}
                {!journey?.recent_expenses?.length && <p className="text-sm text-muted-foreground">Sem gastos registrados ainda.</p>}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
