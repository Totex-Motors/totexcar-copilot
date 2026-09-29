import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TrialInfo {
  isActive: boolean;
  daysRemaining: number;
  isPremium: boolean;
  isExpired: boolean;
  trialEndsAt: string | null;
  /** validade da assinatura avulsa (premium) — null se não for premium pago */
  subscriptionEndsAt: string | null;
  /** dias até a assinatura premium vencer (null se não aplicável; negativo se já venceu) */
  subscriptionDaysRemaining: number | null;
  /** true quando o dono não pode usar o app: trial expirou e não assinou, ou assinatura vencida/cancelada. Admin/lojista nunca bloqueiam. */
  isBlocked: boolean;
}

export function useTrialControl() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [trialInfo, setTrialInfo] = useState<TrialInfo>({
    isActive: false,
    daysRemaining: 0,
    isPremium: false,
    isExpired: false,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    subscriptionDaysRemaining: null,
    isBlocked: false,
  });
  const [loading, setLoading] = useState(true);

  const checkTrialStatus = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Buscar dados do usuário na tabela users
      const { data: userDataResult, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Erro ao buscar dados do usuário:', userError);
        return;
      }

      setUserData(userDataResult);

      // Verificar se o trial está ativo
      const { data: isActiveData, error: activeError } = await supabase
        .rpc('is_trial_active', { user_id: user.id });

      if (activeError) {
        console.error('Erro ao verificar trial ativo:', activeError);
        return;
      }

      // Verificar dias restantes
      const { data: daysData, error: daysError } = await supabase
        .rpc('trial_days_remaining', { user_id: user.id });

      if (daysError) {
        console.error('Erro ao verificar dias restantes:', daysError);
        return;
      }

      // Assinatura AVULSA: premium vale até plan_expires_at. Venceu → deixa de ser premium (bloqueia),
      // mesmo antes do cron rodar no servidor.
      const planExpiresAt = (userDataResult as any)?.plan_expires_at || null;
      const expMs = planExpiresAt ? new Date(planExpiresAt).getTime() : null;
      const premiumExpired = userDataResult?.plan === 'premium' && expMs != null && expMs < Date.now();
      const isPremium = userDataResult?.plan === 'premium' && !premiumExpired;
      const daysRemaining = daysData || 0;
      const isActive = isActiveData || isPremium;
      const isExpired = !isPremium && (daysRemaining <= 0 || premiumExpired);

      // DECISÃO DE PRODUTO: PRO liberado pra todo mundo, de graça (donos E motoristas de app).
      // A receita vem de produtos de terceiros (laudos, emissão de CRLV, vistorias etc.), não de
      // mensalidade. Por isso NÃO bloqueamos mais o acesso ao app. O cálculo de trial/premium fica
      // preservado só para exibição/telemetria; o gate (isBlocked) é sempre falso.
      const isBlocked = false;

      const subDays = expMs != null ? Math.ceil((expMs - Date.now()) / 86400000) : null;
      setTrialInfo({
        isActive,
        daysRemaining: isPremium ? -1 : daysRemaining,
        isPremium,
        isExpired,
        trialEndsAt: userDataResult?.trial_ends_at || null,
        subscriptionEndsAt: planExpiresAt,
        subscriptionDaysRemaining: subDays,
        isBlocked,
      });

    } catch (error) {
      console.error('Erro ao verificar status do trial:', error);
    } finally {
      setLoading(false);
    }
  };

  // PRO grátis pra todo mundo: nenhuma feature é bloqueada. (Mantido para compatibilidade
  // com as telas que ainda chamam blockAccess.)
  const blockAccess = (_feature: string) => false;

  // PRO grátis: sem contagem regressiva de trial nem convite pra assinar. Sem mensagem = sem banner.
  const getTrialMessage = (): { type: 'expired' | 'urgent' | 'warning' | 'info'; message: string } | null => null;

  useEffect(() => {
    checkTrialStatus();
  }, [user?.id]);

  // Recarregar a cada 30 segundos para manter atualizado
  useEffect(() => {
    const interval = setInterval(checkTrialStatus, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return {
    trialInfo,
    loading,
    blockAccess,
    getTrialMessage,
    refreshTrialStatus: checkTrialStatus,
  };
}