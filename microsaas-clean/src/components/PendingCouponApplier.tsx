import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";

// Após o cadastro, aplica APENAS o cupom que o usuário digitou antes (totex_pending_coupon):
// grava coupon_code (+ dealership, se for cupom de loja). NÃO existe cupom automático —
// quem não digitou cupom segue sem desconto.
export function PendingCouponApplier() {
  const { user, userData } = useCurrentUser();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !user || !userData) return;

    let coupon: string | null = null;
    try { coupon = localStorage.getItem("totex_pending_coupon"); } catch { /* */ }
    if (!coupon) return; // sem cupom digitado → não faz nada

    // já vinculado a uma loja? só limpa.
    if (userData.coupon_code) {
      try { localStorage.removeItem("totex_pending_coupon"); } catch { /* */ }
      return;
    }

    done.current = true;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("create-checkout", {
          body: { plan: "monthly", coupon, preview: true },
        });
        if (data?.coupon_valid) {
          const update: Record<string, string> = { coupon_code: String(coupon).toUpperCase() };
          if (data.dealership) update.dealership = data.dealership;
          await supabase.from("users").update(update).eq("id", user.id);
        }
      } catch { /* silencioso */ }
      try { localStorage.removeItem("totex_pending_coupon"); } catch { /* */ }
    })();
  }, [user, userData]);

  return null;
}
