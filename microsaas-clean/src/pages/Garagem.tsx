import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Warehouse, Search, Sparkles, RadarIcon, Banknote, Loader2, ExternalLink,
  Heart, Car, Trash2, CheckCircle2, Gauge, CalendarDays, ChevronDown, MousePointerClick,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { toast } from "@/hooks/use-toast";
import {
  useGaragemSearch, useGaragemBrands, useOportunidades, useInteresse,
  useVenderAvaliar, useRadars, useSalvarRadar, useExcluirRadar,
  type GaragemCar, type GaragemFilters,
} from "@/hooks/useGaragem";

const brl = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v) : "—";

function CarCard({ car }: { car: GaragemCar }) {
  const interesse = useInteresse();
  const [sent, setSent] = useState(false);
  return (
    <Card className="border-0 shadow-premium-md overflow-hidden flex flex-col">
      <div className="h-40 bg-muted/60 relative">
        {car.photo
          ? <img src={car.photo} alt={car.title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center"><Car className="w-10 h-10 text-muted-foreground/40" /></div>}
        {car.fipe_price != null && car.price < car.fipe_price && (
          <Badge className="absolute top-2 left-2 bg-green-500/90 text-white">Abaixo da FIPE</Badge>
        )}
      </div>
      <CardContent className="p-4 flex flex-col gap-2 flex-1">
        <div>
          <h3 className="font-bold leading-tight line-clamp-1">{car.title}</h3>
          <p className="text-xs text-muted-foreground">
            {car.year} · {Number(car.km).toLocaleString("pt-BR")} km{car.dealership ? ` · ${car.dealership}` : ""}
          </p>
        </div>
        <p className="text-xl font-extrabold text-primary">{brl(car.price)}</p>
        <div className="mt-auto flex gap-2 pt-1">
          <Button size="sm" className="flex-1 gap-1.5" disabled={interesse.isPending || sent}
            onClick={() => interesse.mutate({ vehicle_id: car.id }, {
              onSuccess: () => { setSent(true); toast({ title: "Interesse enviado! 🎉", description: "A loja vai entrar em contato com você." }); },
              onError: (e: any) => toast({ title: "Não foi possível enviar", description: String(e?.message || e), variant: "destructive" }),
            })}>
            {sent ? <CheckCircle2 className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
            {sent ? "Enviado" : "Tenho interesse"}
          </Button>
          <a href={car.url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline"><ExternalLink className="w-4 h-4" /></Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function CarGrid({ cars, loading, empty }: { cars?: GaragemCar[]; loading: boolean; empty: string }) {
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  if (!cars?.length) return <p className="text-sm text-muted-foreground text-center py-10">{empty}</p>;
  return <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{cars.map((c) => <CarCard key={c.id} car={c} />)}</div>;
}

export default function Garagem() {
  const { userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);

  // busca (com paginação acumulada — "mostrar mais carros")
  const [f, setF] = useState<GaragemFilters>({ limit: 12, page: 1 });
  const [applied, setApplied] = useState<GaragemFilters>({ limit: 12, page: 1 });
  const search = useGaragemSearch(applied, !!userId);
  const { data: brands } = useGaragemBrands(!!userId);
  const [accumCars, setAccumCars] = useState<GaragemCar[]>([]);

  useEffect(() => {
    const d = search.data;
    if (!d) return;
    setAccumCars((prev) => ((applied.page || 1) > 1 ? [...prev, ...d.cars] : d.cars));
  }, [search.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // oportunidades / radar / vender
  const oport = useOportunidades(!!userId);
  const radars = useRadars(!!userId);
  const salvarRadar = useSalvarRadar();
  const excluirRadar = useExcluirRadar();
  const vender = useVenderAvaliar();

  const [radarForm, setRadarForm] = useState({ brand: "", model: "", color: "", max_price: "", min_year: "", max_km: "", notes: "" });
  const [sellForm, setSellForm] = useState({ modo: "avaliar" as "vender" | "avaliar", data: "", horario: "10:00" });
  const [sellOk, setSellOk] = useState(false);

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  const aplicar = () => setApplied({ ...f, page: 1 });
  const carregarMais = () => setApplied((p) => ({ ...p, page: (p.page || 1) + 1 }));
  const totalCars = search.data?.total ?? 0;
  const temMais = accumCars.length > 0 && accumCars.length < totalCars;

  const enviarRadar = () => {
    salvarRadar.mutate({
      brand: radarForm.brand || undefined, model: radarForm.model || undefined, color: radarForm.color || undefined,
      max_price: Number(radarForm.max_price) || undefined, min_year: Number(radarForm.min_year) || undefined,
      max_km: Number(radarForm.max_km) || undefined, notes: radarForm.notes || undefined,
    }, {
      onSuccess: (r) => {
        toast({ title: "Radar ativado! 📡", description: r.matches.length ? `Já achamos ${r.matches.length} carro(s) parecidos!` : "A loja foi avisada — te chamamos quando aparecer." });
        setRadarForm({ brand: "", model: "", color: "", max_price: "", min_year: "", max_km: "", notes: "" });
      },
      onError: (e: any) => toast({ title: "Não foi possível salvar", description: e?.message === "informe_marca_modelo_ou_preco" ? "Informe pelo menos marca, modelo ou preço máximo." : String(e?.message || e), variant: "destructive" }),
    });
  };

  const enviarVenda = () => {
    vender.mutate({ modo: sellForm.modo, data: sellForm.data || undefined, horario: sellForm.horario || undefined }, {
      onSuccess: () => { setSellOk(true); toast({ title: sellForm.modo === "vender" ? "Pedido de venda enviado! 🎉" : "Avaliação agendada! 🎉", description: "A loja entra em contato pra confirmar." }); },
      onError: (e: any) => toast({ title: "Não foi possível enviar", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HERO */}
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-primary" /> Garagem Totex
          </h1>
          <p className="text-xl font-semibold text-foreground/90">Seu carro atual e o caminho para o próximo.</p>
          <p className="text-muted-foreground">
            Encontre seu próximo carro, avalie o atual e receba oportunidades selecionadas pelo seu Co-pilot.
          </p>
          {vehicle && (
            <Badge variant="outline" className="mt-1 gap-1.5"><Car className="w-3.5 h-3.5" />
              Seu carro: {[vehicle.marca, vehicle.modelo, vehicle.ano_modelo].filter(Boolean).join(" ")}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="buscar">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
            <MousePointerClick className="w-3.5 h-3.5 text-primary" /> Toque em uma opção para começar:
          </p>
          <TabsList className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-auto bg-transparent p-0">
            {[
              { v: "buscar", icon: Search, label: "Buscar carro", sub: "Todo o estoque Totexmotors" },
              { v: "oportunidades", icon: Sparkles, label: "Oportunidades", sub: "Selecionadas pro seu perfil" },
              { v: "radar", icon: RadarIcon, label: "Ofertas para mim", sub: "Deixe seu desejo no radar" },
              { v: "vender", icon: Banknote, label: "Vender / Avaliar", sub: "Agende vistoria grátis" },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="flex flex-col items-start justify-start gap-1 h-auto whitespace-normal text-left rounded-xl border bg-card p-4 shadow-premium-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-premium-md data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:shadow-premium-md"
              >
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  <t.icon className="w-4 h-4 text-primary shrink-0" /> {t.label}
                </span>
                <span className="text-xs text-muted-foreground font-normal leading-snug">{t.sub}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ============ BUSCAR / TROCAR ============ */}
          <TabsContent value="buscar" className="space-y-4 pt-4">
            <Card className="border-0 shadow-premium-md">
              <CardContent className="pt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Buscar</Label>
                  <Input placeholder="Ex.: Corolla, SUV, Onix…" value={f.search || ""} onChange={(e) => setF((p) => ({ ...p, search: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && aplicar()} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Marca</Label>
                  <Select value={f.brand || "all"} onValueChange={(v) => setF((p) => ({ ...p, brand: v === "all" ? undefined : v }))}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {(brands || []).map((b: any) => { const name = typeof b === "string" ? b : b?.brand || b?.name; return name ? <SelectItem key={name} value={name}>{name}</SelectItem> : null; })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preço até</Label>
                  <Input type="number" placeholder="120000" value={f.max_price || ""} onChange={(e) => setF((p) => ({ ...p, max_price: Number(e.target.value) || undefined }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ano a partir de</Label>
                  <Input type="number" placeholder="2020" value={f.min_year || ""} onChange={(e) => setF((p) => ({ ...p, min_year: Number(e.target.value) || undefined }))} />
                </div>
                <div className="flex items-end">
                  <Button className="w-full gap-1.5" onClick={aplicar} disabled={search.isFetching}>
                    {search.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
                  </Button>
                </div>
              </CardContent>
            </Card>
            {search.data && <p className="text-sm text-muted-foreground">{totalCars} carro(s) no estoque Totexmotors</p>}
            <CarGrid cars={accumCars} loading={search.isLoading && (applied.page || 1) === 1} empty="Nenhum carro encontrado com esses filtros. Tente ampliar a busca — ou deixe um radar em 'Ofertas para mim'. 😉" />
            {temMais && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="lg" className="gap-2" onClick={carregarMais} disabled={search.isFetching}>
                  {search.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                  Mostrar mais carros
                  <span className="text-muted-foreground">({accumCars.length} de {totalCars})</span>
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ============ OPORTUNIDADES ============ */}
          <TabsContent value="oportunidades" className="space-y-4 pt-4">
            <Card className="border-0 shadow-premium-md">
              <CardContent className="pt-5 text-sm text-muted-foreground flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                {oport.data?.base?.tipo === "valor_compra" ? (
                  <span>Selecionadas pelo Co-pilot com base no seu <strong className="text-foreground">{oport.data.base.carro}</strong>{oport.data.base.ano ? ` ${oport.data.base.ano}` : ""} (valor de referência {brl(oport.data.base.valor)}): upgrades que cabem no seu momento.</span>
                ) : (
                  <span>Destaques do estoque. 💡 Preencha o <strong className="text-foreground">valor pago no seu carro</strong> em Meu Veículo pra eu personalizar as oportunidades pro seu caso.</span>
                )}
              </CardContent>
            </Card>
            <CarGrid cars={oport.data?.cars} loading={oport.isLoading} empty="Sem oportunidades no momento — o estoque muda todo dia, volte em breve!" />
          </TabsContent>

          {/* ============ RADAR / OFERTAS PARA MIM ============ */}
          <TabsContent value="radar" className="space-y-4 pt-4">
            <Card className="border-0 shadow-premium-md">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><RadarIcon className="w-4 h-4 text-primary" /> Deixe seu próximo carro no radar</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Descreva o carro que você quer. A loja fica sabendo na hora e, quando ele aparecer no estoque, você é avisado.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Marca</Label><Input placeholder="Ex.: Toyota" value={radarForm.brand} onChange={(e) => setRadarForm((p) => ({ ...p, brand: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Modelo</Label><Input placeholder="Ex.: Corolla Cross" value={radarForm.model} onChange={(e) => setRadarForm((p) => ({ ...p, model: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Cor (opcional)</Label><Input placeholder="Ex.: Branco" value={radarForm.color} onChange={(e) => setRadarForm((p) => ({ ...p, color: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Valor até (R$)</Label><Input type="number" placeholder="150000" value={radarForm.max_price} onChange={(e) => setRadarForm((p) => ({ ...p, max_price: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Ano a partir de</Label><Input type="number" placeholder="2021" value={radarForm.min_year} onChange={(e) => setRadarForm((p) => ({ ...p, min_year: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Km até</Label><Input type="number" placeholder="60000" value={radarForm.max_km} onChange={(e) => setRadarForm((p) => ({ ...p, max_km: e.target.value }))} /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Observações (opcional)</Label><Input placeholder="Ex.: prefiro automático, teto solar…" value={radarForm.notes} onChange={(e) => setRadarForm((p) => ({ ...p, notes: e.target.value }))} /></div>
                <Button onClick={enviarRadar} disabled={salvarRadar.isPending} className="gap-1.5">
                  {salvarRadar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RadarIcon className="w-4 h-4" />} Ativar radar
                </Button>
              </CardContent>
            </Card>

            {(radars.data || []).map((r) => (
              <Card key={r.id} className="border-0 shadow-premium-md">
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">{[r.brand, r.model].filter(Boolean).join(" ") || "Qualquer carro"}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {[r.min_year ? `a partir de ${r.min_year}` : "", r.max_km ? `até ${Number(r.max_km).toLocaleString("pt-BR")} km` : "", r.max_price ? `até ${brl(r.max_price)}` : "", r.color || ""].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.lead_sent && <Badge className="bg-green-500/15 text-green-600">Loja avisada</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => excluirRadar.mutate(r.id)} title="Remover radar"><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {r.matches?.length
                    ? <><p className="text-sm font-medium mb-3 text-primary">🎯 {r.matches.length} carro(s) no estoque agora:</p><CarGrid cars={r.matches} loading={false} empty="" /></>
                    : <p className="text-sm text-muted-foreground">Nenhum carro assim no estoque ainda — seguimos de olho. 👀</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ============ VENDER / AVALIAR ============ */}
          <TabsContent value="vender" className="space-y-4 pt-4">
            <Card className="border-0 shadow-premium-md max-w-xl">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Banknote className="w-4 h-4 text-primary" /> {vehicle ? `${[vehicle.marca, vehicle.modelo, vehicle.ano_modelo].filter(Boolean).join(" ")}` : "Seu veículo"}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {sellOk ? (
                  <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/[0.07] p-4 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <span>Pedido enviado! A equipe Totexmotors entra em contato pra confirmar a vistoria. Você também pode acompanhar pela loja.</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Agende uma <strong>vistoria gratuita</strong>: a loja avalia seu carro{vehicle?.hodometro ? ` (km atual: ${Number(vehicle.hodometro).toLocaleString("pt-BR")})` : ""} e te faz uma proposta — pra vender ou dar de entrada na troca.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Quero…</Label>
                        <Select value={sellForm.modo} onValueChange={(v) => setSellForm((p) => ({ ...p, modo: v as any }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="avaliar">Avaliar meu veículo</SelectItem>
                            <SelectItem value="vender">Vender meu carro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Melhor dia</Label>
                        <Input type="date" min={new Date().toISOString().split("T")[0]} value={sellForm.data} onChange={(e) => setSellForm((p) => ({ ...p, data: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Horário</Label>
                        <Select value={sellForm.horario} onValueChange={(v) => setSellForm((p) => ({ ...p, horario: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"].map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button className="w-full gap-1.5" onClick={enviarVenda} disabled={vender.isPending || !vehicle}>
                          {vender.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />} Solicitar
                        </Button>
                      </div>
                    </div>
                    {!vehicle && <p className="text-xs text-warning">Cadastre seu veículo em "Meu Veículo" primeiro.</p>}
                    <p className="text-xs text-muted-foreground">💡 Quer só uma referência rápida de valor? Veja também <a href="/recompra" className="text-primary underline">Recompra FIPE</a>.</p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
