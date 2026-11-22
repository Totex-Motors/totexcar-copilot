import { useState } from "react";
import { AlertTriangle, Camera, Check, CheckCheck, Copy, Loader2, MessagesSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePedirFicha, useHistoricoFicha, useFinalizarFicha, type BuybackRequest } from "@/hooks/useBuyback";

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

// Retorno do WhatsApp pra mensagem de "pedir ficha": enviada ✓ · entregue ✓✓ · lida ✓✓ (azul) · falhou ⚠
const hora = (s?: string) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
function motivoFalha(e?: { code?: number | null; titulo?: string; detalhe?: string } | null): string {
  const c = Number(e?.code);
  if (c === 131026) return "o número não tem WhatsApp ou não pode receber mensagens";
  if (c === 131049 || c === 130472) return "o WhatsApp segurou a entrega pra esse número (limite de mensagens que ele recebe de empresas). Tente outro dia ou chame pelo botão WhatsApp";
  if (c === 131047) return "passou de 24h da última conversa e a mensagem não pôde ser entregue";
  if (c === 131056) return "muitas mensagens pro mesmo número em pouco tempo. Aguarde alguns minutos";
  return e?.detalhe || e?.titulo || "o WhatsApp não informou o motivo";
}
function StatusMensagem({ m }: { m: NonNullable<BuybackRequest["ficha_msg"]> }) {
  if (m.status === "falhou") return <p className="text-xs text-destructive flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-none" /> <span>Pedido de ficha <b>não entregue</b>{m.falhou_em ? ` (${hora(m.falhou_em)})` : ""}: {motivoFalha(m.erro)}.</span></p>;
  if (m.status === "lida") return <p className="text-xs text-sky-600 flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> Pedido de ficha <b>lido</b> pelo cliente · {hora(m.lida_em)}</p>;
  if (m.status === "entregue") return <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> Pedido de ficha <b>entregue</b> · {hora(m.entregue_em)} · ainda não leu</p>;
  return <p className="text-xs text-muted-foreground flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Pedido de ficha <b>enviado</b> · {hora(m.enviada_em)}{m.sem_retorno ? " · sem confirmação de entrega neste canal" : " · aguardando entrega"}</p>;
}

// CONVERSA DA FICHA: cada mensagem do cliente, o que a ficha fez com ela e o que o Co-pilot respondeu
function ConversaFicha({ r, completa }: { r: BuybackRequest; completa: boolean }) {
  const { data, isLoading } = useHistoricoFicha(r.id, true);
  const finalizar = useFinalizarFicha();
  if (isLoading) return <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  const itens = data?.itens || [];
  const guardadas = data?.fotos || [];
  const naFicha = r.qualificacao?.fotos || [];
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
      {!completa && guardadas.length > 0 && (
        <div className="space-y-1.5">
          <p><b>{guardadas.length} foto{guardadas.length === 1 ? "" : "s"}</b> já {guardadas.length === 1 ? "chegou" : "chegaram"}, mas o cliente ainda não concluiu a ficha.</p>
          {guardadas.length > naFicha.length && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">{guardadas.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="flex-none"><img src={u} alt={`Foto ${i + 1}`} loading="lazy" className="h-14 w-20 object-cover rounded border" /></a>)}</div>
          )}
          <Button size="sm" variant="outline" disabled={finalizar.isPending}
            onClick={() => finalizar.mutate({ id: r.id }, {
              onSuccess: () => toast({ title: "Ficha finalizada ✅", description: "O pedido ficou completo com as fotos recebidas." }),
              onError: (e: any) => toast({ title: "Não deu certo", description: String(e?.message || e), variant: "destructive" }),
            })}>
            {finalizar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Finalizar ficha com ${guardadas.length === 1 ? "essa foto" : `essas ${guardadas.length} fotos`}`}
          </Button>
        </div>
      )}
      {!itens.length ? <p className="text-muted-foreground">Ainda não há mensagens dessa ficha.</p> : itens.map((it, i) => (
        <div key={i} className={it.quem === "cliente" ? "" : "pl-4"}>
          <div className="text-[10px] text-muted-foreground">{hora(it.quando)} · {it.quem === "cliente" ? "Cliente" : it.quem === "copilot" ? "Co-pilot" : "Sistema"}</div>
          <div className={`whitespace-pre-wrap ${it.alerta ? "text-destructive" : ""}`}>{it.texto}</div>
          {it.tratado && <div className="text-muted-foreground">↳ Ficha: {it.tratado}</div>}
          {it.resposta && (
            <div className={`mt-0.5 pl-3 border-l-2 whitespace-pre-wrap ${it.fora_da_ficha ? "border-amber-400 text-amber-800" : "border-primary/40"}`}>
              {it.fora_da_ficha && <b>Respondido fora da ficha (conversa geral): </b>}{it.resposta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function FichaDoPedido({ r }: { r: BuybackRequest }) {
  const pedir = usePedirFicha();
  const [conversa, setConversa] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const f = r.qualificacao?.ficha;
  const fotos = r.qualificacao?.fotos || [];
  const completa = !!f?.completa;
  const fechado = r.status === "closed" || r.status === "declined";

  const copiar = () => navigator.clipboard?.writeText(anuncioRepasse(r))
    .then(() => toast({ title: "Anúncio copiado ✅", description: "Cole no grupo de repasse e complete o valor." }))
    .catch(() => toast({ title: "Não consegui copiar", variant: "destructive" }));
  const cobrar = () => pedir.mutate({ id: r.id }, {
    onSuccess: () => toast({ title: "Ficha pedida ✅", description: "Mensagem enviada. O status (entregue, lida ou falhou) aparece aqui no pedido: atualize a página em alguns segundos." }),
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
      {r.ficha_msg && !completa && <StatusMensagem m={r.ficha_msg} />}
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
          {(f?.iniciada_em || f?.pedida_em || completa) && (
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => setConversa((v) => !v)}><MessagesSquare className="w-4 h-4" /> {conversa ? "Fechar conversa" : "Ver conversa da ficha"}</Button>
          )}
          {!completa && r.owner_phone && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={cobrar} disabled={pedir.isPending}>
              {pedir.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {f?.pedida_em || f?.iniciada_em ? "Cobrar ficha de novo" : "Pedir ficha e fotos"}
            </Button>
          )}
        </div>
      )}
      {conversa && <ConversaFicha r={r} completa={completa} />}
    </div>
  );
}
