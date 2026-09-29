import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
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
  Megaphone, Sparkles, Send, Loader2, MessageCircle, Banknote, HeartHandshake,
  ExternalLink, KanbanSquare, MessagesSquare, Bot, UserRound, XCircle, Gift, Star, QrCode,
} from "lucide-react";
import { MgPanelShell } from "@/components/mg/MgPanelShell";
import { PostSaleTab } from "@/components/dealer/PostSaleTab";
import { StandLeadsPanel } from "@/components/StandLeadsPanel";
import { useSearchParams } from "react-router-dom";
import { useCurrentUser, useAuth } from "@/hooks/useAuth";
import { AuthPage } from "@/pages/Auth";
import { toast } from "@/hooks/use-toast";
import {
  useDealerMe, useDealerClients, useClientJourney,
  useCampaignRecipients, useDraftMessage, useSendCampaign,
  useConversas, useConversaTimeline,
  type DealerClient, type ClientNextDue, type CampaignAudience,
  type ConversaClient, type ConversaItem,
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

// Campanhas prontas: divulgam os recursos do Co-pilot pra base da loja. O template oficial já abre com
// "Olá {nome}! Mensagem da {loja}: ..." — por isso os textos NÃO se apresentam de novo. Sem quebra de
// linha (parâmetro de template Meta não aceita \n).
const CAMPANHAS_PRONTAS: { titulo: string; texto: string }[] = [
  {
    titulo: "💰 Indique e Ganhe",
    texto: "Você já conhece o Indique e Ganhe? Compartilhe carros do nosso estoque com amigos pelo TotexCar Co-pilot e ganhe comissão em PIX quando a venda sair. Abra o app e toque em Indique e Ganhe para pegar seu link. 💰",
  },
  {
    titulo: "💵 Avaliação FIPE / Recompra",
    texto: "Quer saber quanto o seu {veiculo} vale hoje? Responda 'avaliar meu carro' e veja a tabela FIPE ao vivo — e a {loja} pode te fazer uma proposta de recompra. 💵",
  },
  {
    titulo: "🔎 Radar de Serviços",
    texto: "Precisando de oficina, borracharia, guincho ou elétrica pro {veiculo}? Manda /radar aqui no WhatsApp que o Co-pilot encontra os serviços mais perto de você, com telefone e endereço. 🔎",
  },
  {
    titulo: "🏖️ Modo Viagem",
    texto: "Vai pegar estrada com o {veiculo}? Responda 'planejar viagem' que o Co-pilot monta seu roteiro com pedágios, consumo real do seu carro e boas paradas no caminho. 🏖️",
  },
  {
    titulo: "🗓️ Calendário do Carro",
    texto: "Tá tudo em dia com o {veiculo}? Pergunte 'o que vence?' que o Co-pilot mostra IPVA, licenciamento, parcelas e a próxima revisão no ritmo real do seu carro. 🗓️",
  },
  {
    titulo: "🚗 Vitrine da loja",
    texto: "Pensando em trocar de carro? Responda 'quero ver carros' que o Co-pilot mostra o estoque da {loja} com fotos e preços, direto aqui no WhatsApp. 🚗",
  },
  {
    titulo: "📄 Relatório IR/MEI (motoristas)",
    texto: "Dirige de aplicativo? O Co-pilot gera seu relatório de ganhos e gastos pronto pra IR/MEI. Responda 'relatório' e receba o PDF na hora. 📄",
  },
];

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
    <MgPanelShell
      home={false}
      title="Painel do Lojista"
      subtitle={`${viewStore || dealer?.dealership || (userData?.role === "admin" ? "Todas as lojas (admin)" : "Sua loja")}${viewStore ? " (visão admin)" : ""}`}
      right={
        <>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href="https://totexgest.vercel.app/" target="_blank" rel="noreferrer" title="Abrir o CRM TotexGest (seus leads)">
              <KanbanSquare className="w-4 h-4" /> <span className="hidden sm:inline">CRM TotexGest</span><span className="sm:hidden">CRM</span> <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
          <span className="hidden md:block text-sm text-muted-foreground">{userData?.name}</span>
          <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="space-y-6">
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
            <TabsTrigger value="conversas" className="gap-2"><MessagesSquare className="w-4 h-4" /> Conversas</TabsTrigger>
            <TabsTrigger value="campanhas" className="gap-2"><Megaphone className="w-4 h-4" /> Campanhas</TabsTrigger>
            <TabsTrigger value="recompras" className="gap-2"><Banknote className="w-4 h-4" /> Recompras</TabsTrigger>
            <TabsTrigger value="posvenda" className="gap-2"><HeartHandshake className="w-4 h-4" /> Sucesso do Cliente</TabsTrigger>
            <TabsTrigger value="stand" className="gap-2"><QrCode className="w-4 h-4" /> Stand</TabsTrigger>
            <TabsTrigger value="indicacoes" className="gap-2"><Gift className="w-4 h-4" /> Indicações</TabsTrigger>
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

          <TabsContent value="conversas" className="mt-6">
            <ConversasTab dealership={viewStore} />
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

          <TabsContent value="recompras" className="mt-6 space-y-6">
            <SellMarginsCard />
            <BuybackTab dealership={viewStore} />
          </TabsContent>

          <TabsContent value="posvenda" className="mt-6">
            <PostSaleTab dealership={viewStore} />
          </TabsContent>

          <TabsContent value="stand" className="mt-6">
            <StandLeadsPanel source="dealer" dealership={viewStore} />
          </TabsContent>

          <TabsContent value="indicacoes" className="mt-6">
            <ReferralTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Ficha / jornada do cliente */}
      <ClientSheet client={selected} onClose={() => setSelected(null)} />
    </MgPanelShell>
  );
}

// ===== Conversas: engajamento do cliente com o Co-pilot (somente leitura) =====
const relTime = (s?: string | null) => {
  if (!s) return null;
  const days = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days}d`;
  const m = Math.floor(days / 30);
  return `há ${m} ${m === 1 ? "mês" : "meses"}`;
};
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
  new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const KIND_LABEL: Record<string, string> = {
  text: "mensagem de texto", audio: "áudio", image: "foto", pdf: "documento", other: "mensagem",
};
const ACAO_LABEL: Record<string, string> = {
  garagem_flow: "se interessou por um carro da vitrine",
  radar_flow: "buscou oficina/serviço no Radar",
  viagem_flow: "montou um plano de viagem",
  recompra_flow: "avaliou o carro na FIPE",
  nps_flow: "respondeu a pesquisa NPS",
  nps: "respondeu a pesquisa NPS",
  transferencia: "consultou a transferência/documentação",
};

function ConversasTab({ dealership }: { dealership?: string }) {
  const { data: clients, isLoading } = useConversas(true, dealership);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ConversaClient | null>(null);

  const filtered = useMemo(() => {
    const list = clients || [];
    const term = q.trim().toLowerCase();
    const base = term
      ? list.filter((c) => [c.name, c.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)))
      : list;
    // mais recente primeiro; quem nunca conversou vai pro fim
    return [...base].sort((a, b) => String(b.last_client_msg_at || "").localeCompare(String(a.last_client_msg_at || "")));
  }, [clients, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          Aqui você acompanha o <b className="text-foreground">engajamento</b> de cada cliente com o Co-pilot no WhatsApp:
          o que a loja mandou, se entregou e como o cliente interage. O conteúdo das mensagens do cliente com o
          assistente é privado e não é exibido.
        </span>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por nome ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card className="border-0 shadow-premium-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><MessagesSquare className="w-5 h-5" /> Conversas ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando conversas...</div>
          ) : filtered.length ? (
            <div className="divide-y divide-border">
              {filtered.map((c) => (
                <button key={c.id} onClick={() => setSelected(c)}
                  className="w-full text-left flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate flex items-center gap-2">
                      {c.name || "Sem nome"}
                      {c.sponsored && <Badge className="bg-primary/15 text-primary border-0 gap-1"><Gift className="w-3 h-3" /> Cortesia</Badge>}
                      {c.nps_score != null && (
                        <Badge className={`border-0 gap-1 ${c.nps_score >= 9 ? "bg-green-500/15 text-green-600" : c.nps_score <= 6 ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                          <Star className="w-3 h-3" /> NPS {c.nps_score}
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{c.phone || "sem telefone"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs">
                    {c.last_client_msg_at ? (
                      <span className="text-foreground font-medium">respondeu {relTime(c.last_client_msg_at)}</span>
                    ) : c.last_sent_at || c.welcome_sent ? (
                      <span className="text-warning font-medium">sem resposta ainda</span>
                    ) : (
                      <span className="text-muted-foreground">sem conversa</span>
                    )}
                    <span className="text-muted-foreground">{c.msgs_30d} interação(ões) em 30d</span>
                    {c.fails_30d > 0 && (
                      <span className="text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" /> {c.fails_30d} falha(s) de entrega</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">Nenhum cliente com WhatsApp nesta loja ainda.</div>
          )}
        </CardContent>
      </Card>

      <ConversaSheet client={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function TimelineItem({ it }: { it: ConversaItem }) {
  const when = <span className="text-xs text-muted-foreground flex-shrink-0">{fmtDateTime(it.at)}</span>;
  if (it.type === "cliente") {
    return (
      <div className="flex items-start gap-3">
        <UserRound className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Cliente</span>{" "}
          {it.acao && ACAO_LABEL[it.acao] ? ACAO_LABEL[it.acao] : `enviou ${KIND_LABEL[it.kind || "other"] || "mensagem"} ao Co-pilot`}
        </div>
        {when}
      </div>
    );
  }
  if (it.type === "proativa" || it.type === "campanha") {
    const rotulo = it.type === "campanha" ? "Campanha da loja" : `Co-pilot (proativa${it.assunto ? `: ${it.assunto}` : ""})`;
    return (
      <div className="flex items-start gap-3">
        {it.type === "campanha" ? <Megaphone className="w-4 h-4 mt-0.5 text-foreground flex-shrink-0" /> : <Bot className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />}
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-medium">{rotulo}</span>
          {it.ok === false && <span className="text-destructive text-xs ml-2">falhou</span>}
          {it.texto && <p className="mt-1 rounded-lg bg-[#075E54]/5 border border-[#075E54]/20 p-2 text-xs whitespace-pre-wrap">{it.texto}</p>}
        </div>
        {when}
      </div>
    );
  }
  if (it.type === "boas_vindas") {
    return (
      <div className="flex items-start gap-3">
        <Gift className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Boas-vindas {it.cortesia ? "(cortesia da loja)" : "(convite do Co-pilot)"}</span>{" "}
          {it.ok ? "enviada" : <span className="text-destructive">falhou</span>}
        </div>
        {when}
      </div>
    );
  }
  if (it.type === "registro") {
    return (
      <div className="flex items-start gap-3">
        <Store className="w-4 h-4 mt-0.5 text-foreground flex-shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Cliente registrado pela loja</span>
          {it.car ? ` — ${it.car}` : ""}{it.cortesia ? " · cortesia de 1 ano" : ""}
        </div>
        {when}
      </div>
    );
  }
  if (it.type === "nps") {
    return (
      <div className="flex items-start gap-3">
        <Star className="w-4 h-4 mt-0.5 text-warning flex-shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-medium">NPS respondido: nota {it.nota ?? "—"}</span>
          {it.comentario && <p className="mt-1 text-xs text-muted-foreground">"{it.comentario}"</p>}
        </div>
        {when}
      </div>
    );
  }
  // falha de entrega
  return (
    <div className="flex items-start gap-3">
      <XCircle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
      <div className="min-w-0 flex-1 text-sm text-destructive">Mensagem do WhatsApp não entregue</div>
      {when}
    </div>
  );
}

function ConversaSheet({ client, onClose }: { client: ConversaClient | null; onClose: () => void }) {
  const { data, isLoading } = useConversaTimeline(client?.id || null);
  const items = data?.items || [];
  return (
    <Sheet open={!!client} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{client?.name || "Cliente"}</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> {client?.phone || "—"}
          </SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Carregando linha do tempo...</div>
        ) : items.length ? (
          <div className="mt-6 space-y-4">
            {items.map((it, i) => <TimelineItem key={i} it={it} />)}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Nenhuma interação registrada ainda para este cliente.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

const BUYBACK_STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Novo", cls: "bg-warning/15 text-warning" },
  contacted: { label: "Em contato", cls: "bg-primary/15 text-primary" },
  closed: { label: "Concluído", cls: "bg-green-500/15 text-green-600" },
  declined: { label: "Recusado", cls: "bg-muted text-muted-foreground" },
};

// Margens da "Venda seu carro" da PRÓPRIA loja (Express + Vitrine por prazo). Sem override, usa o padrão da rede.
function SellMarginsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usandoPadrao, setUsandoPadrao] = useState(true);
  const [exPct, setExPct] = useState("20");
  const [exPiso, setExPiso] = useState("10000");
  const [p, setP] = useState([
    { dias: "20", pct: "14", piso: "3500" },
    { dias: "45", pct: "10", piso: "2800" },
    { dias: "90", pct: "7", piso: "2000" },
  ]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("dealer-api", { body: { action: "sell_config" } });
      const d: any = data || {};
      const src = d?.own && (d.own.prazos || d.own.express)
        ? { prazos: d.own.prazos || d.padrao?.prazos, express: d.own.express || d.padrao?.express }
        : d?.padrao;
      setUsandoPadrao(!!d?.usando_padrao);
      setExPct(String(src?.express?.pct ?? 20));
      setExPiso(String(src?.express?.piso ?? 10000));
      const pr = (src?.prazos || []).slice(0, 3);
      while (pr.length < 3) pr.push({ dias: 0, pct: 0, piso: 0 });
      setP(pr.map((x: any) => ({ dias: String(x.dias), pct: String(x.pct), piso: String(x.piso) })));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const setPi = (i: number, k: string, v: string) => setP((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        action: "sell_config_save",
        buyback_express: { pct: Number(exPct) || 20, piso: Number(exPiso) || 10000 },
        buyback_prazos: p.map((x) => ({ dias: Number(x.dias) || 0, pct: Number(x.pct) || 0, piso: Number(x.piso) || 0 }))
          .filter((x) => x.dias > 0).sort((a, b) => a.dias - b.dias),
      };
      const { data, error } = await supabase.functions.invoke("dealer-api", { body });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      setUsandoPadrao(false);
      toast({ title: "Margens salvas ✅", description: "As avaliações da sua loja passam a usar a sua margem." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: String(e?.message || e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const resetPadrao = async () => {
    setSaving(true);
    try {
      await supabase.functions.invoke("dealer-api", { body: { action: "sell_config_save", reset: true } });
      await load();
      toast({ title: "Voltou ao padrão da rede" });
    } finally { setSaving(false); }
  };

  const FIPE = 70000;
  const calc = (pct: string, piso: string) => {
    const margem = Math.max(Math.round(FIPE * (Number(pct) || 0) / 100), Number(piso) || 0);
    return Math.max(0, Math.round((FIPE - margem) / 100) * 100);
  };
  const money = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Banknote className="w-5 h-5" /> Venda seu carro — sua margem
          {loading ? null : usandoPadrao
            ? <Badge className="border-0 bg-muted text-muted-foreground">usando padrão da rede</Badge>
            : <Badge className="border-0 bg-success/15 text-success">margem da sua loja</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          O vendedor recebe <strong>FIPE − margem</strong>. A margem é o <strong>maior valor</strong> entre o % da FIPE e o piso em R$.
          Enquanto você não salvar, sua loja usa o padrão da rede.
        </p>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-semibold flex items-center gap-2">⚡ Venda Express <span className="text-xs font-normal text-muted-foreground">à vista (grupo de repasse, até 48h)</span></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>% da FIPE</Label><Input type="number" step="1" value={exPct} onChange={(e) => setExPct(e.target.value)} /></div>
            <div className="space-y-2"><Label>Piso (R$)</Label><Input type="number" step="100" value={exPiso} onChange={(e) => setExPiso(e.target.value)} /></div>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-semibold flex items-center gap-2">🏆 Venda Vitrine <span className="text-xs font-normal text-muted-foreground">quanto mais prazo, menor a margem → vendedor recebe mais</span></div>
          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground font-medium"><span>Prazo (dias)</span><span>% da FIPE</span><span>Piso (R$)</span></div>
          {p.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-3">
              <Input type="number" step="1" value={row.dias} onChange={(e) => setPi(i, "dias", e.target.value)} />
              <Input type="number" step="1" value={row.pct} onChange={(e) => setPi(i, "pct", e.target.value)} />
              <Input type="number" step="100" value={row.piso} onChange={(e) => setPi(i, "piso", e.target.value)} />
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground mb-2">Prévia — num carro de <strong>FIPE {money(FIPE)}</strong>, o vendedor recebe:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-md bg-background p-2 text-center"><div className="text-xs text-muted-foreground">⚡ Express</div><div className="font-bold">{money(calc(exPct, exPiso))}</div></div>
            {p.map((row, i) => (
              <div key={i} className="rounded-md bg-background p-2 text-center"><div className="text-xs text-muted-foreground">🏆 até {row.dias} dias</div><div className="font-bold">{money(calc(row.pct, row.piso))}</div></div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving || loading} className="bg-gradient-primary gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />} Salvar minha margem
          </Button>
          {!usandoPadrao && (
            <Button variant="ghost" onClick={resetPadrao} disabled={saving} className="text-muted-foreground">Voltar ao padrão da rede</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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
                      {r.modalidade === "express" && <Badge className="border-0 ml-2 bg-amber-500/15 text-amber-600">Venda Express ⚡</Badge>}
                      {r.modalidade === "vitrine" && <Badge className="border-0 ml-2 bg-primary/15 text-primary">Venda Vitrine 🏆</Badge>}
                    </p>
                    {r.qualificacao ? (
                      <p className="text-xs text-muted-foreground">
                        {r.modalidade === "express" ? "À vista (repasse 48h)" : `Vitrine · até ${r.qualificacao.prazo_dias ?? "—"} dias`}
                        {" · vendedor recebe "}<b className="text-foreground">{brl(Number(r.offer_value))}</b>
                        {r.qualificacao.margem ? <> · margem {brl(Number(r.qualificacao.margem))}</> : null}
                        {r.fipe_value ? <> · FIPE {brl(Number(r.fipe_value))}</> : null}
                        {" · "}{new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        FIPE {brl(Number(r.fipe_value))} · oferta ({r.offer_pct}%) <b className="text-foreground">{brl(Number(r.offer_value))}</b> · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    )}
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
  // seleção manual de clientes (audience === "selected")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickQ, setPickQ] = useState("");

  // na seleção manual buscamos a base TODA da loja; a escolha é feita aqui no front
  const fetchAudience: CampaignAudience = audience === "selected" ? "all" : audience;
  const { data: rec, isLoading: loadingRec } = useCampaignRecipients(fetchAudience, fixedClient?.id ?? null, true, dealership);
  const draft = useDraftMessage();
  const send = useSendCampaign();

  const recipients = rec?.recipients || [];
  const chosen = audience === "selected" ? recipients.filter((r) => selectedIds.has(r.id)) : recipients;
  const count = single ? 1 : (audience === "selected" ? chosen.length : (rec?.count || 0));
  const previewClient = single ? fixedClient : (audience === "selected" ? chosen[0] : recipients[0]);
  const preview = message ? previewPersonalize(message, previewClient) : "";

  const pickFiltered = useMemo(() => {
    const term = pickQ.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter((r) =>
      [r.name, r.phone, r.vehicle?.marca, r.vehicle?.modelo, r.vehicle?.placa]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [recipients, pickQ]);

  const togglePick = (id: string, on: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

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
    send.mutate({ audience, message, clientId: fixedClient?.id, clientIds: audience === "selected" ? [...selectedIds] : undefined, dealership }, {
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
          <RadioGroup value={audience} onValueChange={(v) => setAudience(v as CampaignAudience)} className="grid sm:grid-cols-3 gap-3">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="due_soon" className="mt-0.5" />
              <span><span className="font-medium block">Vencimento próximo</span><span className="text-xs text-muted-foreground">Quem tem licenciamento/IPVA/seguro/CNH vencendo em até 30 dias</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="all" className="mt-0.5" />
              <span><span className="font-medium block">Todos os clientes</span><span className="text-xs text-muted-foreground">Toda a base da loja com WhatsApp cadastrado</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="selected" className="mt-0.5" />
              <span><span className="font-medium block">Escolher clientes</span><span className="text-xs text-muted-foreground">Busque pelo nome e marque quem vai receber</span></span>
            </label>
          </RadioGroup>
        </div>
      )}

      {/* Seletor de clientes (busca + marcação) */}
      {!single && audience === "selected" && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" placeholder="Digite o nome, placa ou telefone..." value={pickQ} onChange={(e) => setPickQ(e.target.value)} />
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border divide-y divide-border">
            {loadingRec ? (
              <p className="p-3 text-sm text-muted-foreground">Carregando clientes...</p>
            ) : pickFiltered.length ? (
              pickFiltered.map((r) => (
                <label key={r.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                  <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={(v) => togglePick(r.id, v === true)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{r.name || "Sem nome"}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {[r.vehicle?.marca, r.vehicle?.modelo].filter(Boolean).join(" ") || "sem veículo"}{r.phone ? ` · ${r.phone}` : ""}
                    </span>
                  </span>
                </label>
              ))
            ) : (
              <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado{pickQ ? " para essa busca" : ""}.</p>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span><b className="text-foreground">{selectedIds.size}</b> selecionado(s)</span>
            <span className="flex gap-3">
              <button type="button" className="hover:text-foreground transition-colors"
                onClick={() => setSelectedIds(new Set([...selectedIds, ...pickFiltered.map((r) => r.id)]))}>
                Marcar {pickQ ? "os filtrados" : "todos"}
              </button>
              <button type="button" className="hover:text-foreground transition-colors" onClick={() => setSelectedIds(new Set())}>
                Limpar
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Contagem */}
      <div className="text-sm text-muted-foreground">
        {single ? (
          <>Enviando para <b className="text-foreground">{fixedClient?.name || "este cliente"}</b> ({fixedClient?.phone})</>
        ) : loadingRec ? "Calculando destinatários..." : (
          <><b className="text-foreground">{count}</b> destinatário(s) com WhatsApp{count === 0 ? (audience === "selected" ? " — marque pelo menos 1 cliente acima." : " — ninguém se encaixa nesse público.") : "."}</>
        )}
      </div>

      {/* Campanhas prontas (recursos do Co-pilot) */}
      <div className="space-y-2">
        <Label>Campanhas prontas</Label>
        <div className="flex flex-wrap gap-1.5">
          {CAMPANHAS_PRONTAS.map((cp) => (
            <button key={cp.titulo} type="button" onClick={() => setMessage(cp.texto)}
              className="text-xs rounded-full border px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={cp.texto}>
              {cp.titulo}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Toque numa campanha pra preencher a mensagem — dá pra editar antes de enviar.</p>
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

// INDIQUE E GANHE (lado do lojista): confirma a venda indicada e libera a comissão.
// Lead = clique/interesse que veio por indicação; Venda = comissão a pagar (pending → paid).
function ReferralTab() {
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("dealer-api", { body: { action: "referral_list" } });
      setEventos(((data as any)?.eventos) || []);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const leads = eventos.filter((e) => e.type !== "sale");
  const vendas = eventos.filter((e) => e.type === "sale");
  const aReceber = vendas.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.value || 0), 0);
  const pago = vendas.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.value || 0), 0);

  const confirmarVenda = async (leadId: string) => {
    const v = Number(String(valores[leadId] || "").replace(/[^\d,.-]/g, "").replace(".", "").replace(",", "."));
    if (!(v > 0)) { toast({ title: "Informe o valor da comissão", variant: "destructive" }); return; }
    setBusy(leadId);
    try {
      const { data } = await supabase.functions.invoke("dealer-api", { body: { action: "referral_confirm_sale", lead_id: leadId, value: v } });
      if ((data as any)?.ok) { toast({ title: "Venda confirmada ✅", description: "Comissão lançada como 'a receber'." }); setValores((s) => ({ ...s, [leadId]: "" })); await carregar(); }
      else toast({ title: "Não deu", description: String((data as any)?.error || ""), variant: "destructive" });
    } catch (e: any) { toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const liberar = async (id: string) => {
    setBusy(id);
    try {
      const { data } = await supabase.functions.invoke("dealer-api", { body: { action: "referral_mark_paid", id } });
      if ((data as any)?.ok) { toast({ title: "Comissão liberada 💸", description: "Marcada como paga." }); await carregar(); }
    } catch (e: any) { toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="w-4 h-4" /> Leads por indicação</div>
          <div className="text-3xl font-bold mt-1">{leads.length}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Gift className="w-4 h-4" /> Vendas indicadas</div>
          <div className="text-3xl font-bold mt-1">{vendas.length}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Wallet className="w-4 h-4" /> A pagar</div>
          <div className="text-3xl font-bold mt-1 text-warning">{brl(aReceber)}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Wallet className="w-4 h-4" /> Já pago</div>
          <div className="text-3xl font-bold mt-1 text-primary">{brl(pago)}</div>
        </CardContent></Card>
      </div>

      {/* Leads por indicação → confirmar venda */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Gift className="w-5 h-5" /> Confirmar venda indicada</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            : leads.length ? (
              <div className="divide-y divide-border">
                {leads.map((e) => (
                  <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.car_title || "Carro indicado"}</p>
                      <p className="text-xs text-muted-foreground">Indicado por <b className="text-foreground">{e.indicador}</b> · {new Date(e.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input className="w-32" placeholder="Comissão R$" value={valores[e.id] || ""} onChange={(ev) => setValores((s) => ({ ...s, [e.id]: ev.target.value }))} />
                      <Button size="sm" disabled={busy === e.id} onClick={() => confirmarVenda(e.id)}>Confirmar venda</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="p-8 text-center text-muted-foreground">Nenhum lead por indicação ainda. Quando alguém abrir um carro pelo link de indicação, ele aparece aqui.</div>}
        </CardContent>
      </Card>

      {/* Comissões (a pagar / pagas) */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wallet className="w-5 h-5" /> Comissões</CardTitle></CardHeader>
        <CardContent className="p-0">
          {vendas.length ? (
            <div className="divide-y divide-border">
              {vendas.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{e.car_title || "Venda indicada"}</p>
                    <p className="text-xs text-muted-foreground">{e.indicador} · {new Date(e.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold">{brl(e.value)}</span>
                    {e.status === "paid"
                      ? <Badge className="bg-green-500/15 text-green-600 border-0">pago</Badge>
                      : <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => liberar(e.id)}>Liberar comissão</Button>}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="p-8 text-center text-muted-foreground">Sem vendas indicadas ainda.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
