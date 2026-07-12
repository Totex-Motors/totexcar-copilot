import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Crown, Check, Star, Tag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useTrialControl } from "@/hooks/useTrialControl";
import { useCurrentUser } from "@/hooks/useAuth";
import { PaymentSuccess } from "@/components/PaymentSuccess";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Quote { full: number; value: number; discount_pct: number; coupon_valid: boolean; coupon_error: string | null; plan_name: string; }

export default function Plans() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [coupon, setCoupon] = useState(searchParams.get("coupon") || "");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [checking, setChecking] = useState(false);
  const [quotes, setQuotes] = useState<{ monthly?: Quote; annual?: Quote }>({});
  const { toast } = useToast();
  const { trialInfo } = useTrialControl();
  const navigate = useNavigate();
  const { user, userData } = useCurrentUser();

  const planName = quotes.monthly?.plan_name || quotes.annual?.plan_name || "Totex Care";
  // Motorista de app sem cupom vê o preço PRO (o cupom de loja sempre vence: membro = 10,99 c/ PRO incluso)
  const isPro = Boolean((userData as any)?.driver_mode);

  const fetchQuotes = useCallback(async (couponCode: string, pro = false) => {
    setChecking(true);
    try {
      const [m, a] = await Promise.all([
        supabase.functions.invoke("create-checkout", { body: { plan: "monthly", coupon: couponCode, preview: true, pro } }),
        supabase.functions.invoke("create-checkout", { body: { plan: "annual", coupon: couponCode, preview: true, pro } }),
      ]);
      const mq = m.data as Quote | undefined;
      const aq = a.data as Quote | undefined;
      setQuotes({ monthly: mq, annual: aq });
      if (couponCode) {
        if (mq?.coupon_valid) toast({ title: "Bônus Totex aplicado!", description: `${mq.discount_pct}% de desconto.` });
        else if (mq?.coupon_error) toast({ title: "Cupom inválido", description: "Confira o código com a loja.", variant: "destructive" });
      }
    } finally {
      setChecking(false);
    }
  }, [toast]);

  useEffect(() => {
    const initial = searchParams.get("coupon") || "";
    setAppliedCoupon(initial);
    fetchQuotes(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cliente já vinculado a uma loja: aplica o cupom dele automaticamente
  useEffect(() => {
    if (userData?.coupon_code && !appliedCoupon && !searchParams.get("coupon")) {
      setCoupon(userData.coupon_code);
      setAppliedCoupon(userData.coupon_code);
      fetchQuotes(userData.coupon_code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.coupon_code]);

  // motorista PRO sem cupom: recotiza com o preço PRO quando o perfil carrega
  useEffect(() => {
    if (isPro && !appliedCoupon && !userData?.coupon_code) fetchQuotes("", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  const applyCoupon = () => {
    setAppliedCoupon(coupon.trim());
    fetchQuotes(coupon.trim(), isPro);
  };

  const handleUpgrade = async (plan: "monthly" | "annual") => {
    // visitante deslogado: guarda o cupom e manda pro cadastro (ganha 7 dias grátis);
    // o desconto fica salvo e é aplicado quando ele for assinar de verdade.
    if (!user) {
      if (appliedCoupon) localStorage.setItem("totex_pending_coupon", appliedCoupon);
      navigate(`/entrar?tab=register${appliedCoupon ? `&coupon=${encodeURIComponent(appliedCoupon)}` : ""}`);
      return;
    }
    try {
      setLoading(plan);
      const { data, error } = await supabase.functions.invoke("create-checkout", { body: { plan, coupon: appliedCoupon, pro: isPro } });
      // Num erro 4xx o corpo {error} vem em error.context; tenta lê-lo p/ mensagem precisa
      let payload: any = data;
      if (error) {
        try { payload = await (error as any).context.json(); } catch { throw error; }
      }
      if (payload?.error) throw new Error(payload.error);
      if (payload?.url) window.location.href = payload.url;
      else throw new Error("Checkout não retornou URL");
    } catch (error: any) {
      const msg = error?.message;
      toast({
        title: "Erro",
        description: msg === "asaas_nao_configurado" ? "Pagamento ainda não configurado pelo administrador."
          : msg?.startsWith("cupom_") ? "Cupom inválido ou esgotado."
          : "Não foi possível iniciar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const features = [
    "Controle ilimitado de gastos do carro",
    "Assistente no WhatsApp (foto, áudio e texto)",
    "Alertas de vencimento (IPVA, licenciamento, seguro, CNH)",
    "Histórico completo do veículo + hodômetro",
    "Relatórios e análises",
    "Acesso completo no celular",
  ];

  const renderCard = (plan: "monthly" | "annual") => {
    const q = quotes[plan];
    const best = plan === "annual";
    const hasDiscount = !!q && q.coupon_valid && q.discount_pct > 0;
    const price = q ? q.value : (plan === "annual" ? 1099 : 109.9);
    const full = q ? q.full : (plan === "annual" ? 1099 : 109.9);
    const perMonth = plan === "annual" ? price / 12 : price;

    return (
      <Card className={best ? "border-2 border-primary relative bg-gradient-to-br from-primary/5 to-primary/10" : "border-2 hover:border-primary/50 transition-all duration-300"}>
        {best && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4" /> Melhor Oferta
            </div>
          </div>
        )}
        <CardHeader className={`text-center ${best ? "pt-8" : ""}`}>
          <CardTitle className="text-xl">{planName} {plan === "annual" ? "Anual" : "Mensal"}</CardTitle>
          <div className="space-y-1">
            {hasDiscount && <div className="text-sm line-through text-muted-foreground">{brl(plan === "annual" ? full / 12 : full)}/mês</div>}
            <div className="text-3xl font-bold text-primary">{brl(perMonth)}<span className="text-base text-muted-foreground font-normal">/mês</span></div>
            {plan === "annual" && <div className="text-sm text-muted-foreground">{brl(price)} por ano</div>}
            {hasDiscount && (
              <div className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                <Tag className="w-3 h-3" /> Bônus Totex −{q!.discount_pct}%
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            className={`w-full ${best ? "bg-primary hover:bg-primary/90" : ""}`}
            size="lg"
            onClick={() => handleUpgrade(plan)}
            disabled={loading !== null || trialInfo.isPremium}
          >
            {loading === plan ? <Loader2 className="w-4 h-4 animate-spin" /> : !user ? "Começar grátis" : trialInfo.isPremium ? "Plano Atual" : `Assinar ${plan === "annual" ? "Anual" : "Mensal"}`}
          </Button>
          <div className="space-y-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Retorno do pagamento (Asaas → /plans?status=success): tela de boas-vindas
  if (searchParams.get("status") === "success") {
    return <PaymentSuccess planName={planName} />;
  }

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/totexmotors-logo.png" alt="Totexmotors" className="h-7 w-auto" />
          <span className="font-bold tracking-tight hidden sm:inline">Totex <span className="text-primary">CAR FINANCE</span></span>
        </Link>
        {user
          ? <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Voltar ao app</Link>
          : <Link to="/entrar" className="text-sm font-medium text-primary">Entrar</Link>}
      </header>
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
          <Crown className="w-4 h-4" /> Plano {planName}
        </div>
        <h1 className="text-3xl font-bold text-foreground">Tenha o controle total dos gastos do seu carro</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Tem um <strong>Bônus Totex</strong> de uma loja parceira? Aplique o código e ganhe seu desconto.
          {!trialInfo.isPremium && trialInfo.daysRemaining > 0 && (
            <span className="block mt-2 text-primary font-medium">Você ainda tem {trialInfo.daysRemaining} dias de teste grátis!</span>
          )}
        </p>
      </div>

      {/* Cupom Bônus Totex */}
      <div className="max-w-md mx-auto flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            placeholder="Cupom da loja (ex.: LOJAX90)"
            className="pl-10"
            onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
          />
        </div>
        <Button variant="outline" onClick={applyCoupon} disabled={checking}>
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
        </Button>
      </div>
      {appliedCoupon && quotes.monthly?.coupon_valid && (
        <p className="text-center text-sm text-green-600 -mt-4">
          🎉 Bônus Totex <strong>{appliedCoupon}</strong> ativo — você paga só {brl(quotes.monthly.value)}/mês!
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {renderCard("monthly")}
        {renderCard("annual")}
      </div>
    </div>
  );
}
