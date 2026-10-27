import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Casca das telas do LINK PESSOAL da equipe (sem login): valida o token, mostra loja + pessoa no topo
// e só então renderiza o conteúdo (que chama a dealer-api com o mesmo token via setLinkToken).
export function LinkShell({ token, titulo, children }: { token: string; titulo: string; children: (me: { nome: string; papel: string; loja: string }) => ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["link-me", token],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("dealer-api", { body: { action: "link_me", t: token } });
      if (error || data?.error) throw new Error(data?.error || "link_invalido");
      return data as { nome: string; papel: string; loja: string };
    },
    retry: false,
    // voltar da câmera/galeria não recarrega a casca (nem derruba a tela se a rede oscilar)
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  if (!data) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="text-center max-w-sm space-y-3"><p className="text-3xl">🔒</p><h1 className="text-lg font-semibold">Este link não vale mais. Peça um novo ao gerente.</h1></div>
    </div>
  );
  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-[#0b1f6b] text-white px-4 pt-5 pb-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-bold tracking-widest text-teal-300 uppercase">{data.loja} · Co-pilot</div>
          <h1 className="text-xl font-extrabold mt-0.5">{titulo}</h1>
          <div className="text-sm text-blue-100">Olá, <b className="text-white">{data.nome.split(" ")[0]}</b></div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 space-y-4">{children(data)}</main>
    </div>
  );
}
