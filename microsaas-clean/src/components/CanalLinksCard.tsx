import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Radio, Copy, Loader2, Link2 } from "lucide-react";

const brl = (v: any) => (v != null ? `R$ ${Number(v).toLocaleString("pt-BR")}` : "consulte");

// Link do CANAL: em vez do wa.me cru (que vira card vazio da logo), usamos o resolvedor "oferta",
// que mostra a FOTO + título + preço do carro na PRÉVIA do post e, ao tocar, abre o Co-pilot naquele
// carro (marcado origem=canal). Cole o link no post do Canal — o WhatsApp monta o card sozinho.
const OFERTA_BASE = "https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/oferta";

// Gera os links do CANAL do WhatsApp por carro do estoque da loja. Reaproveita o action stand_qr_kit
// do dealer-api (mesma lista de carros).
export function CanalLinksCard() {
  const [loading, setLoading] = useState(false);
  const [cars, setCars] = useState<any[] | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dealer-api", { body: { action: "stand_qr_kit" } });
      if (error) throw error;
      setCars(((data as any)?.cars || []) as any[]);
    } catch (e: any) {
      toast({ title: "Não consegui carregar", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const linkGeral = OFERTA_BASE;
  const linkCarro = (id: string) => `${OFERTA_BASE}?c=${encodeURIComponent(id)}`;
  const copiar = async (link: string, label: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copiado ✅", description: label });
    } catch {
      toast({ title: "Copie manualmente", description: link });
    }
  };

  return (
    <Card className="border-0 shadow-premium-md">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold flex items-center gap-2"><Radio className="w-5 h-5 text-primary" /> Links do Canal do WhatsApp</div>
            <p className="text-sm text-muted-foreground mt-1">
              Copia o link e <strong>cola no post do Canal</strong> — o WhatsApp monta o card sozinho, com a
              <strong> foto, o modelo e o preço</strong> do carro. Quem tocar cai no Co-pilot naquele carro (marcado
              <strong> origem canal</strong> pra medir o funil).
            </p>
          </div>
          <Button variant="outline" className="gap-2 h-9 shrink-0" onClick={() => copiar(linkGeral, "Link geral do Canal")}>
            <Link2 className="w-4 h-4" /> Link geral
          </Button>
        </div>

        {!cars && (
          <Button onClick={carregar} disabled={loading} className="gap-2 h-9">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Carregar carros da loja
          </Button>
        )}

        {cars && cars.length === 0 && (
          <p className="text-sm text-muted-foreground">Não achei estoque desta loja no marketplace.</p>
        )}

        {cars && cars.length > 0 && (
          <div className="max-h-96 overflow-y-auto divide-y rounded-lg border">
            {cars.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2.5">
                {c.photo
                  ? <img src={c.photo} className="w-14 h-14 rounded-md object-cover bg-muted shrink-0" alt="" />
                  : <div className="w-14 h-14 rounded-md bg-muted shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{[c.brand, c.model].filter(Boolean).join(" ")} {c.year || ""}</div>
                  <div className="text-xs text-muted-foreground">{brl(c.price)}</div>
                </div>
                <Button size="sm" variant="secondary" className="gap-1.5 shrink-0"
                  onClick={() => copiar(linkCarro(c.id), [c.brand, c.model].filter(Boolean).join(" "))}>
                  <Copy className="w-3.5 h-3.5" /> Copiar link
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
