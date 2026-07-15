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

      // Bloqueio: só vale para o dono (owner). Admin/lojista nunca bloqueiam.
      const role = userDataResult?.role || 'owner';
      const status = (userDataResult?.subscription_status || '').toLowerCase();
      const isBlocked =
        role === 'owner' &&
        !isPremium &&
        (status === 'overdue' || status === 'canceled' || daysRemaining <= 0 || premiumExpired);

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

  const blockAccess = (feature: string) => {
    if (trialInfo.isPremium) return false;
    if (trialInfo.isExpired) {
      console.log(`Acesso bloqueado para: ${feature}. Trial expirado.`);
      return true;
    }
    return false;
  };

  const getTrialMessage = () => {
    // Premium (assinatura avulsa): avisa quando está perto de vencer, pra renovar
    if (trialInfo.isPremium) {
      const d = trialInfo.subscriptionDaysRemaining;
      if (d != null && d >= 0 && d <= 5) {
        return {
          type: (d <= 1 ? 'urgent' : 'warning') as 'urgent' | 'warning',
          message: d === 0 ? 'Sua assinatura vence hoje. Renove para não perder o acesso.'
            : `Sua assinatura vence em ${d} dia${d > 1 ? 's' : ''}. Renove para continuar sem interrupção.`,
        };
      }
      return null;
    }

    if (trialInfo.isExpired) {
      return {
        type: 'expired' as const,
        message: trialInfo.subscriptionEndsAt
          ? 'Sua assinatura venceu. Renove para continuar usando o TotexCar Co-pilot.'
          : 'Seu trial de 7 dias expirou. Faça upgrade para continuar usando todas as funcionalidades.',
      };
    }

    if (trialInfo.daysRemaining <= 1) {
      return {
        type: 'urgent' as const,
        message: `Resta apenas ${trialInfo.daysRemaining} dia do seu trial. Não perca o acesso!`,
      };
    }

    if (trialInfo.daysRemaining <= 3) {
      return {
        type: 'warning' as const,
        message: `${trialInfo.daysRemaining} dias restantes no seu trial. Considere fazer upgrade!`,
      };
    }

    return {
      type: 'info' as const,
      message: `${trialInfo.daysRemaining} dias restantes no seu trial gratuito.`,
    };
  };

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