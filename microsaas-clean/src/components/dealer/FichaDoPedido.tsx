import { useState } from "react";
import { Camera, Copy, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePedirFicha, type BuybackRequest } from "@/hooks/useBuyback";

// FICHA DO CARRO À VENDA dentro do pedido de recompra: o Co-pilot coleta no WhatsApp placa, km, situação e
// fotos. Completa → dá pra copiar o anúncio pronto pro grupo de repasse. Faltando → 1 toque cobra o cliente.
const QUITADO: Record<string, string> = { quitado: "Quitado", financiado: "Financiado" };
const SINISTRO: Record<string, string> = { nunca_bateu: "Nunca bateu", reparo: "Já teve reparo", leilao_sinistro: "Leilão/sinistro" };
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

export function anuncioRepasse(r: BuybackRequest): string {
  const f = r.qualificacao?.ficha || {};
  const fotos = r.qualificacao?.fotos || [];
  return [
    `🚗 *${[r.brand, r.model, r.year].filter(Boolean).join(" ")}*`,
    r.fuel ? `⛽ ${r.fuel}` : null,
    f.km ? `🛣️ ${Number(f.km).toLocaleString("pt-BR")} km` : null,
    f.placa ? `🔖 Placa final ${String(f.placa).slice(-1)}` : null,
    f.quitado ? `📄 ${QUITADO[f.quitado] || f.quitado}` : null,
    f.sinistro ? `🛠️ ${SINISTRO[f.sinistro] || f.sinistro}` : null,
    r.fipe_value ? `📊 FIPE ${brl(Number(r.fipe_value))}` : null,
    "💰 Valor: ",
    fotos.length ? `\n📸 Fotos:\n${fotos.join("\n")}` : null,
  ].filter(Boolean).join("\n");
}

export function FichaDoPedido({ r }: { r: BuybackRequest }) {
  const pedir = usePedirFicha();
  const [zoom, setZoom] = useState<string | null>(null);
  const f = r.qualificacao?.ficha;
  const fotos = r.qualificacao?.fotos || [];
  const completa = !!f?.completa;
  const fechado = r.status === "closed" || r.status === "declined";

  const copiar = () => navigator.clipboard?.writeText(anuncioRepasse(r))
    .then(() => toast({ title: "Anúncio copiado ✅", description: "Cole no grupo de repasse e complete o valor." }))
    .catch(() => toast({ title: "Não consegui copiar", variant: "destructive" }));
  const cobrar = () => pedir.mutate({ id: r.id }, {
    onSuccess: () => toast({ title: "Ficha pedida ✅", description: "O Co-pilot chamou o cliente no WhatsApp pedindo placa, km e fotos." }),
    onError: (e: any) => toast({ title: "Não consegui pedir", description: e?.message === "whatsapp_falhou" ? "O WhatsApp não aceitou o envio. Tente de novo mais tarde." : String(e?.message || e), variant: "destructive" }),
  });

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {completa
          ? <Badge className="border-0 bg-green-500/15 text-green-700">Ficha completa ✅</Badge>
          : f?.iniciada_em || f?.pedida_em
            ? <Badge className="border-0 bg-amber-500/15 text-amber-700">Ficha em andamento</Badge>
            : <Badge className="border-0 bg-muted text-muted-foreground">Sem ficha</Badge>}
        {f?.placa && <span className="font-mono font-semibold">{f.placa}</span>}
        {f?.km ? <span>{Number(f.km).toLocaleString("pt-BR")} km</span> : null}
        {f?.quitado && <span>{QUITADO[f.quitado] || f.quitado}</span>}
        {f?.sinistro && <span className={f.sinistro === "nunca_bateu" ? "" : "text-amber-700"}>{SINISTRO[f.sinistro] || f.sinistro}</span>}
        {fotos.length > 0 && <span className="flex items-center gap-1 text-muted-foreground"><Camera className="w-3.5 h-3.5" /> {fotos.length}</span>}
      </div>
      {fotos.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {fotos.map((u, i) => (
            <button key={i} type="button" onClick={() => setZoom(zoom === u ? null : u)} className="flex-none">
              <img src={u} alt={`Foto ${i + 1}`} loading="lazy" className="h-16 w-24 object-cover rounded-md border" />
            </button>
          ))}
        </div>
      )}
      {zoom && <a href={zoom} target="_blank" rel="noreferrer"><img src={zoom} alt="Foto ampliada" className="max-h-80 rounded-lg border" /></a>}
      {!fechado && (
        <div className="flex gap-2 flex-wrap">
          {completa && <Button size="sm" variant="outline" className="gap-1.5" onClick={copiar}><Copy className="w-4 h-4" /> Copiar anúncio pro repasse</Button>}
          {!completa && r.owner_phone && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={cobrar} disabled={pedir.isPending}>
              {pedir.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {f?.pedida_em || f?.iniciada_em ? "Cobrar ficha de novo" : "Pedir ficha e fotos"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
