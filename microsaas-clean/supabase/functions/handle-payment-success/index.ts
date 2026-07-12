import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Verificar webhook do Stripe
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    let event;

    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    console.log('Evento recebido do Stripe:', event.type);

    // Processar eventos de checkout completado ou assinatura ativa
    if (event.type === 'checkout.session.completed' || event.type === 'invoice.payment_succeeded') {
      const session = event.data.object;
      
      // Usar service role para atualizar o usuário
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      let userId;
      let customerId;

      if (event.type === 'checkout.session.completed') {
        userId = session.metadata?.user_id;
        customerId = session.customer;
      } else {
        // Para invoice.payment_succeeded, buscar pelo customer_id
        customerId = session.customer;
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();
        userId = userData?.id;
      }

      if (userId) {
        // Atualizar usuário para premium
        const { error } = await supabase
          .from('users')
          .update({
            plan: 'premium',
            subscription_status: 'active',
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (error) {
          console.error('Erro ao atualizar usuário:', error);
          throw error;
        }

        console.log('Usuário atualizado para premium:', userId);

        // Enviar notificação para iAutomatize sobre upgrade
        // Opcional: enviar notificação para webhook externo (ex: n8n, iAutomatize, etc.)
        const webhookUrl = Deno.env.get("WEBHOOK_URL");
        if (webhookUrl) {
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: userId,
                event: 'plan_upgraded',
                plan: 'premium',
                timestamp: new Date().toISOString()
              }),
            });
          } catch (webhookError) {
            console.error('Erro ao enviar webhook de upgrade:', webhookError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro no webhook de pagamento:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});