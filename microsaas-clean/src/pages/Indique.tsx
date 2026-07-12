import { useMemo, useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Gift, Wallet, BadgeCheck, Hourglass, Share2, Copy, Store, Car, KeyRound, Save, ExternalLink,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  useMarketplaceFeed, useReferralEvents, useUpdatePixKey,
  carReferralLink, storeReferralLink, type MarketplaceCar,
} from "@/hooks/useReferral";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// abre o WhatsApp do dono para ele escolher um amigo e enviar o link
function shareToFriend(link: string, msg: string) {
  try { navigator.clipboard?.writeText(link); } catch { /* */ }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${msg} ${link}`)}`, "_blank", "noopener");
}

export default function Indique() {
  const { userData, userId, loading } = useCurrentUser();
  const { data: feed, isLoading: loadingFeed } = useMarketplaceFeed(!!userId);
  const { data: events } = useReferralEvents(userId);
  const updatePix = useUpdatePixKey();

  const [pix, setPix] = useState("");
  useEffect(() => { if (userData?.pix_key != null) setPix(userData.pix_key); }, [userData?.pix_key]);

  const code = (feed?.referral_code || userData?.referral_code) as string | undefined;
  const storeName = feed?.dealership?.name || userData?.dealership || "sua loja";
  const offer = feed?.buyer_offer || "Transferência grátis";
  const cars = feed?.cars || [];

  const stats = useMemo(() => {
    const list = events || [];
    const sales = list.filter((e) => e.type === "sale");
    const aReceber = sales.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.value || 0), 0);
    const pago = sales.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.value || 0), 0);
    return { vendas: sales.length, aReceber, pago };
  }, [events]);

  const copy = async (link: string) => {
    try { await navigator.clipboard.writeText(link); toast({ title: "Link copiado!" }); }
    catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
  };

  const shareStore = () => {
    const link = storeReferralLink(feed?.dealership?.url, code);
    if (!link) { toast({ title: "Loja indisponível no marketplace", variant: "destructive" }); return; }
    shareToFriend(link, `Conheça os carros da ${storeName}! 🎁 Pela minha indicação você ganha ${offer}:`);
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Gift className="w-7 h-7 text-primary" /> Indique e Ganhe</h1>
        <p className="text-muted-foreground">
          Compartilhe os carros da {storeName}: <strong className="text-foreground">você ganha comissão em dinheiro</strong> por venda
          e <strong className="text-primary">seu amigo ganha {offer}</strong> 🎁 — esse é o gancho que fecha a indicação.
        </p>
      </div>

      {/* KPIs de ganhos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><BadgeCheck className="w-4 h-4" /> Vendas</div>
          <div className="text-3xl font-bold mt-1">{stats.vendas}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Hourglass className="w-4 h-4" /> A receber</div>
          <div className="text-3xl font-bold mt-1 text-warning">{brl(stats.aReceber)}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Wallet className="w-4 h-4" /> Recebido</div>
          <div className="text-3xl font-bold mt-1 text-primary">{brl(stats.pago)}</div>
        </CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Share2 className="w-4 h-4" /> Seu código</div>
          <div className="text-2xl font-bold mt-1 tracking-wider">{code || "—"}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chave PIX + link da loja */}
        <Card className="border-0 shadow-premium-md lg:col-span-1 h-fit">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><KeyRound className="w-5 h-5" /> Recebimento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Sua chave PIX (para receber as comissões)</Label>
              <div className="flex gap-2">
                <Input value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" />
                <Button
                  variant="outline" className="flex-shrink-0"
                  disabled={updatePix.isPending || !userId}
                  onClick={() => userId && updatePix.mutate({ userId, pixKey: pix.trim() }, {
                    onSuccess: () => toast({ title: "Chave PIX salva" }),
                    onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
                  })}
                ><Save className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">A loja usa essa chave para te pagar a comissão das vendas confirmadas.</p>
            </div>

            {feed?.dealership?.url && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="flex items-center gap-1.5"><Store className="w-4 h-4" /> Indicar a {storeName}</Label>
                <Button className="w-full bg-gradient-primary" onClick={shareStore}>
                  <Share2 className="w-4 h-4 mr-2" /> Compartilhar a loja
                </Button>
                <p className="text-xs text-muted-foreground">Link da loja no marketplace com o seu código de indicação.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de indicações */}
        <Card className="border-0 shadow-premium-md lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Minhas indicações ({events?.length || 0})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {events && events.length ? (
              <div className="divide-y divide-border max-h-[320px] overflow-auto">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.car_title || e.dealership || "Indicação"}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.type === "sale" ? "Venda" : e.type === "lead" ? "Lead" : "Clique"} · {new Date(e.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {e.type === "sale" && <span className="font-semibold">{brl(e.value)}</span>}
                      {e.type === "sale" && (
                        e.status === "paid"
                          ? <Badge className="bg-green-500/15 text-green-600 border-0">pago</Badge>
                          : <Badge className="bg-warning/15 text-warning border-0">a receber</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">Você ainda não tem indicações. Compartilhe um carro abaixo para começar!</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feed do marketplace — só da loja do dono */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2">
          <Car className="w-5 h-5" /> Carros da {storeName} para indicar ({cars.length})
        </CardTitle></CardHeader>
        <CardContent>
          {loadingFeed ? (
            <div className="p-8 text-center text-muted-foreground">Carregando estoque da sua loja...</div>
          ) : cars.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {cars.map((c) => <CarCard key={c.id} car={c} code={code} storeName={storeName} offer={offer} onCopy={copy} />)}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {feed?.reason === "owner_without_dealership" ? "Sua conta ainda não está vinculada a uma loja."
                : feed?.reason === "dealership_not_found" ? `Não encontramos a loja "${storeName}" no marketplace.`
                : "Sua loja não tem carros ativos no momento."}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function CarCard({ car, code, storeName, offer, onCopy }: {
  car: MarketplaceCar;
  code?: string;
  storeName: string;
  offer: string;
  onCopy: (link: string) => void;
}) {
  const link = carReferralLink(car.url, code);
  return (
    <div className="rounded-xl border overflow-hidden flex flex-col">
      <a href={link} target="_blank" rel="noreferrer" className="aspect-[3/2] bg-muted block">
        {car.photo_url
          ? <img src={car.photo_url} alt={car.title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Car className="w-10 h-10" /></div>}
      </a>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="font-semibold truncate">{car.title}</p>
        {car.version && <p className="text-xs text-muted-foreground truncate">{car.version}</p>}
        <p className="text-lg font-bold text-primary">{car.price != null ? brl(Number(car.price)) : "Consulte"}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[car.km != null ? `${Number(car.km).toLocaleString("pt-BR")} km` : null, car.color, car.fuel].filter(Boolean).join(" · ")}
        </p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" className="flex-1 bg-gradient-primary" onClick={() => shareToFriend(link, `Olha esse ${car.title} na ${storeName}! 🎁 Pela minha indicação você ganha ${offer}:`)}>
            <Share2 className="w-4 h-4 mr-1.5" /> Indicar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCopy(link)} title="Copiar link">
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" asChild title="Abrir no marketplace">
            <a href={link} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
          </Button>
        </div>
      </div>
    </div>
  );
}
