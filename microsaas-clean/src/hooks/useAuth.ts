import { useState, useEffect } from 'react';
import { normalizePhone } from '@/utils/phone';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

// Context para armazenar o usuário atual
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão atual
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signInWithPhone = async (phone: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${phone}@totexcarfinance.app`, // Usando phone como email temporário
      password,
    });
    return { data, error };
  };

  const signUpWithEmail = async (email: string, password: string, name?: string, phone?: string) => {
    const phoneNormalized = normalizePhone(phone);
    console.log('🔐 signUpWithEmail - params:', { email, name, phone });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          phone: phoneNormalized,
          name,
          email
        }
      }
    });
    console.log('🔐 signUpWithEmail - response:', { data, error });

    if (error) {
      console.error('❌ signUpWithEmail - error:', error);
    }
    
    // Se o cadastro foi bem-sucedido, forçar reload da página para recarregar o estado
    if (!error && data.user) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    
    return { data, error };
  };

  const signUpWithPhone = async (phone: string, password: string, name?: string, email?: string) => {
    const phoneNormalized = normalizePhone(phone);
    console.log('🔐 signUpWithPhone - params:', { phone, name, email });
    const { data, error } = await supabase.auth.signUp({
      email: email || `${phoneNormalized}@totexcarfinance.app`, // Usar email fornecido ou phone como fallback
      password,
      options: {
        data: {
          phone: phoneNormalized,
          name,
          email: email || `${phoneNormalized}@totexcarfinance.app`
        }
      }
    });
    console.log('🔐 signUpWithPhone - response:', { data, error });

    if (error) {
      console.error('❌ signUpWithPhone - error:', error);
    }
    
    // Se o cadastro foi bem-sucedido, forçar reload da página para recarregar o estado
    if (!error && data.user) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    loading,
    signInWithEmail,
    signInWithPhone,
    signUpWithEmail,
    signUpWithPhone,
    signOut,
  };
};

// Hook para obter dados do usuário do TotexCar Co-pilot
export const useCurrentUser = () => {
  // IMPORTANTE: propagar o loading do auth. Sem ele, ao trocar de rota o layout remonta,
  // vê user=null (sessão/refresh de token ainda carregando) com loading=false e joga o
  // usuário pra tela de login mesmo com sessão válida (bug de "desloga ao mudar de módulo").
  const { user, loading: authLoading } = useAuth();

  console.log('🔍 useCurrentUser - user:', user?.id, user?.email);

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      console.log('🔍 useCurrentUser fetchUserData - user:', user?.id);
      if (!user) {
        console.log('❌ useCurrentUser - No user, returning null');
        setUserData(null);
        setLoading(false);
        return;
      }

      setLoading(true); // novo user chegou (ex.: pós-refresh de token): volta a carregar o perfil
      try {
        console.log('🔍 useCurrentUser - Fetching user data for user.id:', user.id);
        // Buscar dados do usuário na tabela users usando o ID do auth.users
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('🔍 useCurrentUser - Supabase response:', { data, error });

        if (error && error.code !== 'PGRST116') { // Não erro se não encontrar
          console.error('Erro ao buscar dados do usuário:', error);
        }
        
        console.log('🔍 useCurrentUser - Setting userData:', data);
        setUserData(data);
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  return {
    user,
    userData,
    // loading combinado: só é false quando a SESSÃO já resolveu E o perfil já foi buscado
    loading: authLoading || loading,
    userId: userData?.id,
    phone: userData?.phone || user?.user_metadata?.phone,
  };
};