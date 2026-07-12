import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldAlert, MessageCircle, ExternalLink, FileText, Copy, Download,
  CalendarClock, AlertTriangle, CheckCircle2, Loader2,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMultas, useUpdateMultaStatus, type Multa } from "@/hooks/useMultas";
import { toast } from "@/hooks/use-toast";

const AGENT_NUMBER = "5515981615862";
const WA_LINK = `https://wa.me/${AGENT_NUMBER}?text=${encodeURIComponent("Oi! Recebi uma multa e quero analisar. Vou mandar a foto do auto de infração 📄")}`;

const brl = (v: number | null) =>
  v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

const STATUS: Record<string, { label: string; cls: string }> = {
  nova: { label: "Nova", cls: "bg-warning/15 text-warning" },
  recurso_gerado: { label: "Recurso pronto", cls: "bg-primary/15 text-primary" },
  protocolada: { label: "Protocolada", cls: "bg-blue-500/15 text-blue-600" },
  deferida: { label: "Deferida 🎉", cls: "bg-green-500/15 text-green-600" },
  indeferida: { label: "Indeferida", cls: "bg-muted text-muted-foreground" },
};

const CHANCE: Record<string, { label: string; cls: string }> = {
  alta: { label: "Chance alta", cls: "bg-green-500/15 text-green-600" },
  media: { label: "Chance média", cls: "bg-warning/15 text-warning" },
  baixa: { label: "Chance baixa", cls: "bg-muted text-muted-foreground" },
};

function diasRestantes(prazo: string | null): number | null {
  if (!prazo) return null;
  const diff = Math.ceil((new Date(prazo + "T23:59:59").getTime() - Date.now()) / 86400000);
  return diff;
}

const fmtData = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—");

export default function Multas() {
  const { userId, loading } = useCurrentUser();
  const { data: multas, isLoading } = useMultas(userId);
  const updateStatus = useUpdateMultaStatus();
  const [aberta, setAberta] = useState<Multa | null>(null);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: "Recurso copiado!", description: "Cole no site/formulário do órgão autuador." });
    } catch {
      toast({ title: "Não consegui copiar", description: "Selecione o texto manualmente.", variant: "destructive" });
    }
  };

  const baixar = (m: Multa) => {
    const blob = new Blob([m.recurso_texto || ""], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `recurso-multa-${m.auto_numero || m.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary" /> Multas
          </h1>
          <p className="text-muted-foreground">
            Mande a <strong>foto da multa</strong> (auto de infração) no WhatsApp: o TotexCar Co-pilot analisa,
            aponta possíveis falhas e gera um modelo de recurso pra você protocolar.
          </p>
        </div>

        {/* CTA WhatsApp */}
        <div className="rounded-2xl border border-green-500/30 bg-green-500/[0.06] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold leading-tight">Recebeu uma multa?</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tire uma foto nítida do auto de infração (frente) e mande no WhatsApp. Em segundos você recebe a
              análise + o recurso pronto.
            </p>
          </div>
          <a href={WA_LINK} target="_blank" rel="noreferrer" className="flex-shrink-0">
            <Button className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full sm:w-auto">
              <MessageCircle className="w-4 h-4" /> Enviar multa <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !multas?.length ? (
          <Card className="border-0 shadow-premium-md">
            <CardContent className="py-10 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              Nenhuma multa registrada. Tomara que continue assim! 🍀
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {multas.map((m) => {
              const dias = diasRestantes(m.prazo_recurso);
              const st = STATUS[m.status] || STATUS.nova;
              const ch = m.chance ? CHANCE[m.chance] : null;
              return (
                <Card key={m.id} className="border-0 shadow-premium-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{m.descricao || "Multa"}</CardTitle>
                      <Badge className={`${st.cls} shrink-0`}>{st.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ch && <Badge variant="outline" className={ch.cls}>{ch.label}</Badge>}
                      {m.pontos != null && <Badge variant="outline">{m.pontos} pts</Badge>}
                      {m.gravidade && <Badge variant="outline" className="capitalize">{m.gravidade}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                      <span>Valor: <strong className="text-foreground">{brl(m.valor)}</strong></span>
                      <span>Data: <strong className="text-foreground">{fmtData(m.data_infracao)}</strong></span>
                      {m.orgao && <span>Órgão: <strong className="text-foreground">{m.orgao}</strong></span>}
                      {m.auto_numero && <span>Auto: <strong className="text-foreground">{m.auto_numero}</strong></span>}
                    </div>

                    {m.prazo_recurso && (
                      <div className={`flex items-center gap-2 rounded-lg p-2.5 ${dias != null && dias <= 5 ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"}`}>
                        {dias != null && dias <= 5 ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CalendarClock className="w-4 h-4 shrink-0" />}
                        <span className="text-xs">
                          Prazo do recurso: <strong>{fmtData(m.prazo_recurso)}</strong>
                          {dias != null && (dias >= 0 ? ` — faltam ${dias} dia${dias === 1 ? "" : "s"}` : " — PRAZO VENCIDO")}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {m.recurso_texto && (
                        <Button size="sm" variant="default" className="gap-1.5" onClick={() => setAberta(m)}>
                          <FileText className="w-4 h-4" /> Ver recurso
                        </Button>
                      )}
                      {m.status === "recurso_gerado" && (
                        <Button size="sm" variant="outline" className="gap-1.5"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: m.id, status: "protocolada" })}>
                          <CheckCircle2 className="w-4 h-4" /> Marquei como protocolada
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          ⚖️ O recurso gerado é um <strong>modelo</strong> elaborado por IA com base nos dados informados. A decisão
          final é sempre do órgão autuador — não há garantia de deferimento.
        </p>
      </div>

      {/* Dialog do recurso */}
      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Recurso — {aberta?.descricao || "multa"}</DialogTitle>
            <DialogDescription>
              Revise, copie e protocole no órgão autuador (site, JARI ou presencial) dentro do prazo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
            {aberta?.recurso_texto}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button className="gap-1.5" onClick={() => aberta?.recurso_texto && copiar(aberta.recurso_texto)}>
              <Copy className="w-4 h-4" /> Copiar texto
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => aberta && baixar(aberta)}>
              <Download className="w-4 h-4" /> Baixar .txt
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
