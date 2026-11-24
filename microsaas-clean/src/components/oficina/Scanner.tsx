import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, ScanLine, Upload, Send } from "lucide-react";
import { useScannerLaudos, subirScannerDaLoja, registrarScanner, type ScannerLaudo } from "@/hooks/useDealer";
import { msgErro, ScannerResumo, seloScanner, kmBR } from "./comum";
import { abrirEnvioOficinaAvulso } from "./OrdensServico";

// SCANNER DE ENTRADA (Doutor-IE) — o carro chega, passa o scanner e o relatório em PDF entra aqui. O sistema
// lê placa, km, códigos de falha e teste de bateria. Com falha, o laudo vai junto na ordem de serviço da
// oficina; depois do reparo entra o scanner de conferência; na entrega, o cliente recebe o laudo mais recente.
type Modo = "dono" | "gerente" | "leitura";
const dia = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) : "");

export function ScannerEntrada({ dealership, modo }: { dealership?: string; modo: Modo }) {
  const qc = useQueryClient();
  const pode = modo !== "leitura";
  const { data: laudos, isLoading, error } = useScannerLaudos(true, dealership);
  const ref = useRef<HTMLInputElement>(null);
  const [momento, setMomento] = useState<"entrada" | "conferencia">("entrada");
  const [enviando, setEnviando] = useState(false);
  const [novo, setNovo] = useState<{ laudo: ScannerLaudo; os: number | null } | null>(null);
  const [todas, setTodas] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const enviar = async (f?: File) => {
    if (!f) return;
    setEnviando(true);
    try {
      const path = await subirScannerDaLoja(f, dealership);
      const r = await registrarScanner({ path, momento, ...(dealership ? { dealership } : {}) });
      setNovo({ laudo: r.laudo, os: r.os_numero });
      toast({ title: r.laudo.n_falhas ? `Scanner registrado: ${r.laudo.n_falhas} falha(s)` : "Scanner registrado ✅", description: `${r.laudo.car_desc || "Carro"} · ${r.laudo.placa}` });
      qc.invalidateQueries({ queryKey: ["scanner-laudos"] }); qc.invalidateQueries({ queryKey: ["ordens-servico"] });
    } catch (e) { toast({ title: "Não deu certo", description: msgErro(e), variant: "destructive" }); }
    finally { setEnviando(false); }
  };
  const mandar = (l: ScannerLaudo) => abrirEnvioOficinaAvulso({ car_desc: l.car_desc || "", placa: l.placa || "", km: l.km });
  const lista = laudos || [];
  const mostrar = todas ? lista : lista.slice(0, 6);

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ScanLine className="w-4 h-4 text-primary" /> Scanner do carro (Doutor-IE)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          <b>Na entrada do carro:</b> passe o scanner, exporte o relatório em PDF pelo app e envie aqui. O sistema lê a placa, o km, os códigos de falha e o teste de bateria.
          Com falha, o laudo vai junto na ordem de serviço da oficina. Depois do reparo, envie o scanner de conferência: fica o antes e o depois. Na entrega, o cliente recebe o laudo mais recente no checklist da etiqueta.
        </p>
        {pode && (
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant={momento === "entrada" ? "default" : "outline"} className="h-8" onClick={() => setMomento("entrada")}>Entrada do carro</Button>
              <Button size="sm" variant={momento === "conferencia" ? "default" : "outline"} className="h-8" onClick={() => setMomento("conferencia")}>Conferência depois do reparo</Button>
            </div>
            <Button className="w-full sm:w-auto gap-2" disabled={enviando} onClick={() => ref.current?.click()}>
              {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando e lendo o relatório…</> : <><Upload className="w-4 h-4" /> Enviar relatório do scanner (PDF)</>}
            </Button>
            <input ref={ref} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        )}
        {novo && (
          <div className="space-y-2">
            <ScannerResumo l={novo.laudo} titulo={`${novo.laudo.car_desc || "Carro"} · ${novo.laudo.placa}`} />
            {novo.os ? <p className="text-xs text-muted-foreground">Esse laudo entrou na OS #{novo.os} do carro.</p>
              : pode && !!novo.laudo.n_falhas && <Button size="sm" className="gap-1.5" onClick={() => mandar(novo.laudo)}><Send className="w-3.5 h-3.5" /> Mandar pra oficina com o laudo</Button>}
          </div>
        )}
        {isLoading ? <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          : error ? <p className="text-xs text-red-600">{msgErro(error)}</p>
          : !lista.length ? <p className="text-sm text-muted-foreground">Nenhum relatório enviado ainda.</p> : (
            <div className="divide-y">
              {mostrar.map((l) => {
                const selo = seloScanner(l);
                return (
                  <div key={l.id} className="py-2 space-y-1.5">
                    <div className="flex items-start gap-2 cursor-pointer" onClick={() => setAberto(aberto === l.id ? null : l.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{l.car_desc || "Carro"}{l.placa && <b className="ml-1.5 text-[11px] tracking-wider px-1 py-0.5 rounded border bg-muted/60">{l.placa}</b>}</div>
                        <div className="text-xs text-muted-foreground">{l.momento === "conferencia" ? "Conferência" : "Entrada"} · {dia(l.gerado_em)}{l.km ? ` · ${kmBR(l.km)}` : ""}{l.bateria?.status ? ` · bateria ${l.bateria.status}` : ""}{l.enviado_por ? ` · ${l.enviado_por}` : ""}</div>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${selo.cls}`}>{selo.t}</span>
                    </div>
                    {aberto === l.id && <ScannerResumo l={l} titulo="Laudo" />}
                    {pode && !!l.n_falhas && l.momento === "entrada" && !l.os_id && <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => mandar(l)}><Send className="w-3.5 h-3.5" /> Mandar pra oficina</Button>}
                  </div>
                );
              })}
            </div>
          )}
        {lista.length > 6 && <Button size="sm" variant="outline" className="h-8" onClick={() => setTodas(!todas)}>{todas ? "Mostrar menos" : `Ver todos (${lista.length})`}</Button>}
      </CardContent>
    </Card>
  );
}
