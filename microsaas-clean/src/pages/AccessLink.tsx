import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Link curto de acesso enviado pelo agente no WhatsApp ({app_url}/a/{code}).
// Troca o código de uso único pelo link mágico real (edge `go`) e redireciona —
// o bot de preview do WhatsApp só faz GET nesta página e não consome o token.
export default function AccessLink() {
  const { code } = useParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("go", { body: { code } });
        if (cancelled) return;
        if (error || !data?.link) { setError(true); return; }
        window.location.replace(data.link);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {error ? (
        <div className="text-center max-w-sm space-y-4">
          <p className="text-2xl">🔒</p>
          <h1 className="text-lg font-semibold">Este link de acesso expirou ou já foi usado</h1>
          <p className="text-sm text-muted-foreground">
            Por segurança, cada link vale por 1 hora e só funciona uma vez.
            Peça um novo no WhatsApp — é só mandar <strong>"quero o painel"</strong> pro Co-pilot.
          </p>
          <Button asChild variant="outline"><Link to="/entrar">Entrar com minha conta</Link></Button>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Abrindo seu painel com segurança…</p>
        </div>
      )}
    </div>
  );
}
