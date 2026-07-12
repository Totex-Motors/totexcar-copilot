import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { userId, userData } = await req.json();

    console.log('Enviando webhook de boas-vindas para:', userData.email);

    // Enviar para webhook externo (ex: n8n, iAutomatize, etc.)
    const webhookUrl = Deno.env.get("WEBHOOK_URL");
    if (!webhookUrl) throw new Error("WEBHOOK_URL não configurada");
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        email: userData.email,
        name: userData.name || 'Usuário',
        phone: userData.phone || '',
        plan: 'free',
        trial_status: 'active',
        trial_days: 7,
        created_at: new Date().toISOString(),
        source: 'totex_car_finance_signup'
      }),
    });

    if (!webhookResponse.ok) {
      console.error('Erro ao enviar webhook:', await webhookResponse.text());
      throw new Error('Falha ao enviar webhook para iAutomatize');
    }

    console.log('Webhook enviado com sucesso para:', userData.email);

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook enviado com sucesso' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro na função send-welcome-webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});