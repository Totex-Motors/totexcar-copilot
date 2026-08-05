import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, SearchCheck, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  Gauge, FileText, RefreshCw,
} from "lucide-react";

// Card "Consulta Veicular Completa" (Meu Veículo) — consulta PAGA (PIX/cartão via Asaas).
// O backend (edge vehicle-debts) consulta a placa DO PRÓPRIO usuário no fornecedor parceiro
// (cobertura nacional, multas RENAINF) e devolve o resultado sanitizado.
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

async function callDebts(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("vehicle-debts", { body: { action, ...payload } });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).detail || (data as any).error);
  return data as any;
}

export function ConsultaVeicularCard({ vehicle }: { vehicle: any }) {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const voltouDoPagamento = searchParams.get("consulta") === "ok";
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(voltouDoPagamento);

  const quote = useQuery({ queryKey: ["vq-quote"], queryFn: () => callDebts("quote"), staleTime: 60_000 });
  // o "result" tem SELF-HEAL no servidor: confere o pagamento direto no Asaas e conclui a
  // consulta mesmo se o webhook atrasar — cada refetch é uma verificação real.
  const result = useQuery({
    queryKey: ["vq-result"],
    queryFn: () => callDebts("result"),
    refetchInterval: polling ? 5000 : false,
  });

  const row = result.data?.query;
  const resumo = result.data?.resumo;
  const ficha = result.data?.ficha as { titulo: string; campos: { k: string; v: string }[] }[] | null;

  // com consulta em aberto (pending/paid), verifica sozinho por até 5 min
  useEffect(() => {
    if (row?.status === "pending" || row?.status === "paid") setPolling(true);
    if (row?.status === "done" && polling) {
      setPolling(false);
      toast({ title: "Consulta concluída ✅", description: "O relatório do seu veículo está pronto." });
    }
  }, [row?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!polling) return;
    const t = setTimeout(() => setPolling(false), 300_000);
    return () => clearTimeout(t);
  }, [polling]);

  const verificarAgora = async () => {
    const r = await result.refetch();
    const st = r.data?.query?.status;
    if (st === "done") return; // o efeito acima avisa
    toast({
      title: st === "pending" ? "Pagamento ainda não confirmado" : "Verificando…",
      description: st === "pending"
        ? "O PIX pode levar alguns instantes pra compensar. Vou continuar verificando automaticamente."
        : "Pagamento confirmado — buscando os dados do veículo.",
    });
    setPolling(true);
  };

  const consultar = async () => {
    setStarting(true);
    try {
      const r = await callDebts("start");
      if (r.cached) {
        // dado fresco em cache: entra de graça, sem checkout
        qc.invalidateQueries({ queryKey: ["vq-result"] });
        toast({ title: "Consulta pronta ✅", description: "Sua placa foi consultada há pouco — relatório atualizado sem custo." });
      } else if (r.url) {
        window.location.href = r.url; // checkout Asaas (PIX/cartão)
      }
    } catch (e: any) {
      toast({ title: "Não foi possível iniciar", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const price = Number(quote.data?.price) || 5.9;
  const placa = quote.data?.placa;
  const temResultado = row?.status === "done" && row?.result;

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <SearchCheck className="w-5 h-5 text-primary" /> Consulta Veicular Completa
        </CardTitle>
        {temResultado && (
          <Badge variant="secondary" className="font-normal">
            {new Date(row.created_at).toLocaleDateString("pt-BR")}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Informativo persuasivo — o que a consulta entrega */}
        {!temResultado && (
          <>
            <p className="text-sm text-muted-foreground">
              Será que está <b className="text-foreground">tudo em dia</b> com o seu carro? Em 1 minuto você descobre —
              direto das bases oficiais, com <b className="text-foreground">cobertura nacional</b>:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <span><b>Multas em todo o Brasil (RENAINF)</b> — inclusive as de outros estados, com valores e pontos, antes que virem surpresa na sua CNH.</span></li>
              <li className="flex items-start gap-2"><FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span><b>Débitos e licenciamento</b> — situação real do documento, sem fila e sem despachante.</span></li>
              <li className="flex items-start gap-2"><ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <span><b>Restrições e roubo/furto</b> — essencial antes de vender, comprar ou transferir.</span></li>
              <li className="flex items-start gap-2"><Gauge className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span><b>Dados cadastrais completos</b> — RENAVAM, chassi e situação do veículo, conferidos na fonte.</span></li>
            </ul>
            <div className="rounded-xl bg-primary/[0.06] border border-primary/20 p-3 text-sm">
              💡 Uma multa não paga no prazo pode <b>dobrar de valor</b> e travar seu licenciamento.
              A consulta custa <b>{brl(price)}</b> — menos que um lanche — e pode te poupar centenas de reais.
            </div>
          </>
        )}

        {/* Resultado */}
        {temResultado && resumo && (
          <div className="space-y-3">
            <div className={`rounded-xl border p-3 flex items-center gap-2 ${resumo.ok ? "border-green-500/30 bg-green-500/[0.06]" : "border-warning/40 bg-warning/[0.07]"}`}>
              {resumo.ok
                ? <><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /><p className="text-sm font-medium">Tudo certo com a placa {row.placa}: sem multas e sem restrições. 🎉</p></>
                : <><AlertTriangle className="w-5 h-5 text-warning shrink-0" /><p className="text-sm font-medium">A placa {row.placa} tem pendências — veja abaixo.</p></>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Multas</p>
                <p className={`text-xl font-bold ${resumo.multas_qtd ? "text-destructive" : "text-green-600"}`}>{resumo.multas_qtd}</p>
                {resumo.multas_qtd > 0 && <p className="text-xs text-muted-foreground">{brl(resumo.multas_valor)}{resumo.pontos ? ` · ${resumo.pontos} pts` : ""}</p>}
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Roubo/furto</p>
                <p className={`text-xl font-bold ${resumo.roubo_furto ? "text-destructive" : "text-green-600"}`}>
                  {resumo.roubo_furto == null ? "—" : resumo.roubo_furto ? "CONSTA" : "Nada consta"}
                </p>
              </div>
            </div>
            {resumo.restricoes.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/[0.06] p-3">
                <p className="text-sm font-semibold flex items-center gap-1.5 mb-1"><ShieldAlert className="w-4 h-4 text-warning" /> Restrições</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5">{resumo.restricoes.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
              </div>
            )}
            {resumo.licenciamento && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" /> Último licenciamento: <b className="text-foreground">{resumo.licenciamento}</b>
              </p>
            )}

            {/* Relatório completo — todos os campos retornados pelas bases (sem dados pessoais) */}
            {ficha && ficha.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><FileText className="w-4 h-4 text-primary" /> Relatório completo</p>
                  <Button size="sm" variant="outline" onClick={() => {
                    // versão para impressão: o "Salvar como PDF" do navegador gera o arquivo
                    const win = window.open("", "_blank");
                    if (!win) return;
                    const secs = ficha.map((s) =>
                      `<h2>${s.titulo}</h2><table>${s.campos.map((c) => `<tr><td>${c.k}</td><td><b>${c.v}</b></td></tr>`).join("")}</table>`
                    ).join("");
                    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Consulta Veicular — ${row.placa}</title>
                      <style>body{font-family:Segoe UI,Arial,sans-serif;color:#0f172a;padding:28px;max-width:720px;margin:auto}
                      h1{font-size:20px;margin-bottom:2px} .sub{color:#64748b;font-size:12px;margin-bottom:18px}
                      h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#0d9488;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:18px 0 6px}
                      table{width:100%;border-collapse:collapse;font-size:13px} td{padding:4px 6px;border-bottom:1px solid #f1f5f9;vertical-align:top}
                      td:first-child{color:#64748b;width:42%} .foot{margin-top:22px;font-size:10px;color:#94a3b8}</style></head><body>
                      <h1>Consulta Veicular Completa — placa ${row.placa}</h1>
                      <div class="sub">Emitida em ${new Date(row.created_at).toLocaleString("pt-BR")} · TotexCar Co-pilot · Ecossistema Totexmotors</div>
                      ${secs}
                      <div class="foot">Dados retornados pelas bases oficiais no momento da consulta. Documento sem dados pessoais de terceiros (LGPD).</div>
                      <script>window.onload=()=>window.print()</script></body></html>`);
                    win.document.close();
                  }}>
                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Imprimir / PDF
                  </Button>
                </div>
                {ficha.map((sec) => (
                  <div key={sec.titulo} className="rounded-xl border overflow-hidden">
                    <p className="bg-muted/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sec.titulo}</p>
                    <div className="divide-y divide-border">
                      {sec.campos.map((c) => (
                        <div key={c.k} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                          <span className="text-muted-foreground">{c.k}</span>
                          <span className="font-medium text-right break-all">{c.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground/80">
              Dados retornados pelas bases oficiais no momento da consulta. Guarde este relatório — ele também vale como conferência antes de vender ou transferir.
            </p>
          </div>
        )}

        {/* Estados em aberto — SEMPRE explícitos (dinheiro envolvido, zero ambiguidade) */}
        {row?.status === "pending" && (
          <div className="rounded-xl border border-warning/40 bg-warning/[0.07] p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-warning" /> Aguardando a confirmação do pagamento…
            </p>
            <p className="text-xs text-muted-foreground">
              Pagou agora? O PIX compensa em instantes e eu verifico sozinho. Se preferir, confira já:
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={verificarAgora} disabled={result.isFetching}>
                {result.isFetching ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />} Já paguei — verificar agora
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={consultar} disabled={starting}>
                Abrir o pagamento de novo
              </Button>
            </div>
          </div>
        )}
        {row?.status === "paid" && (
          <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3 flex items-center gap-2 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Pagamento confirmado! Buscando os dados do seu veículo…
          </div>
        )}
        {row?.status === "error" && row.error === "placa_nao_encontrada" && (
          <div className="rounded-xl border border-warning/40 bg-warning/[0.07] p-3 space-y-2">
            <p className="text-sm font-medium">A base nacional não retornou dados para a placa <b>{row.placa}</b>.</p>
            <p className="text-xs text-muted-foreground">
              Confira se a placa está correta no seu cadastro (logo acima). Corrigiu? Toque abaixo que
              refazemos a sua consulta <b>sem nova cobrança</b>.
            </p>
            <Button size="sm" variant="outline" disabled={result.isFetching || starting} onClick={async () => {
              setStarting(true);
              try {
                await callDebts("run", { query_id: row.id });
                await result.refetch();
              } catch (e: any) {
                toast({ title: "Ainda sem dados", description: String(e?.message || e), variant: "destructive" });
              } finally { setStarting(false); }
            }}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refazer com a placa do cadastro
            </Button>
          </div>
        )}
        {row?.status === "error" && row.error !== "placa_nao_encontrada" && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/[0.06] p-3 space-y-2">
            <p className="text-sm font-medium text-destructive">
              {row.error === "checkout_expirado"
                ? "O pagamento não foi concluído e o link expirou — nada foi cobrado."
                : "Tivemos um problema ao processar sua consulta."}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.error === "checkout_expirado"
                ? "É só iniciar uma nova consulta quando quiser."
                : "Se o pagamento foi feito, toque em verificar — nós concluímos sem cobrar de novo."}
            </p>
            {row.error !== "checkout_expirado" && (
              <Button size="sm" variant="outline" onClick={verificarAgora} disabled={result.isFetching}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Verificar de novo
              </Button>
            )}
          </div>
        )}

        {/* CTA */}
        {row?.status !== "pending" && row?.status !== "paid" && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-sm">
              <span className="text-2xl font-bold text-primary">{brl(price)}</span>
              <span className="text-muted-foreground"> · PIX ou cartão</span>
            </div>
            <Button className="bg-gradient-primary" disabled={starting || quote.isLoading || !placa} onClick={consultar}>
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : temResultado ? <RefreshCw className="w-4 h-4 mr-2" /> : <SearchCheck className="w-4 h-4 mr-2" />}
              {temResultado ? "Consultar novamente" : "Consultar meu veículo"}
            </Button>
          </div>
        )}
        {!placa && !quote.isLoading && (
          <p className="text-xs text-warning">Cadastre a placa do seu veículo acima para liberar a consulta.</p>
        )}
      </CardContent>
    </Card>
  );
}
