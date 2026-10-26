import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, Search, Wrench, Copy, MessageCircle, Pencil, Plus, FileText } from "lucide-react";
import { useEstoqueLista, useOficinasParceiras, useOrdensServico, usePosvendaAcao, type EstoqueCarro, type OficinaParceira, type OrdemServico } from "@/hooks/useDealer";
import { STATUS_OS, msgErro, kmBR, quando, carroOS, servicosOS, nomeServico, oleoOS, filtrosOS, FotoInput, FotosOS, LinhaDoTempo } from "./comum";

// ORDENS DE SERVIÇO nas OFICINAS PARCEIRAS — o gerente de manutenção manda um carro do estoque pra uma
// oficina (km + foto do painel na saída); a oficina confirma a chegada e registra o serviço pelo link dela;
// extraordinário só com aprovação; o gerente confirma a volta. modo "leitura" = gerente geral (só acompanha).
type Modo = "dono" | "gerente" | "leitura";
// guia em PDF da parte da oficina (public/guias): vai junto com o link
const guiaOficina = (link: string) => { try { return `${new URL(link).origin}/guias/guia-oficina-parceira.pdf`; } catch { return "/guias/guia-oficina-parceira.pdf"; } };
type Envio = { carro: EstoqueCarro | null; car_desc: string; placa: string; oficina_id: string; servicos: string[]; pedido_obs: string; km_saida: string; foto_saida: string | null };
const envioVazio = (): Envio => ({ carro: null, car_desc: "", placa: "", oficina_id: "", servicos: ["troca_oleo"], pedido_obs: "", km_saida: "", foto_saida: null });

// Abre o "Mandar carro pra oficina" já com o carro escolhido (botão em cada carro da lista do estoque).
export const abrirEnvioOficina = (carro?: EstoqueCarro) => window.dispatchEvent(new CustomEvent("os:enviar", { detail: carro || null }));

export function OrdensServico({ dealership, modo }: { dealership?: string; modo: Modo }) {
  const qc = useQueryClient();
  const pode = modo !== "leitura";
  const { data, isLoading } = useOrdensServico(true, dealership);
  const { data: oficinas } = useOficinasParceiras(true, dealership);
  const acao = usePosvendaAcao();
  const [aba, setAba] = useState<"abertas" | "todas">("abertas");
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [detalhe, setDetalhe] = useState<OrdemServico | null>(null);
  const [volta, setVolta] = useState<{ o: OrdemServico; km: string } | null>(null);
  const [ofForm, setOfForm] = useState<Partial<OficinaParceira> | null>(null);
  useEffect(() => {
    if (!pode) return;
    const abrir = (e: Event) => {
      const carro = (e as CustomEvent).detail as EstoqueCarro | null;
      setEnvio({ ...envioVazio(), carro, km_saida: carro?.km ? String(carro.km) : "" });
    };
    window.addEventListener("os:enviar", abrir);
    return () => window.removeEventListener("os:enviar", abrir);
  }, [pode]);

  const ordens = data?.ordens || [];
  const nomes = data?.servicos || {};
  const abertas = ordens.filter((o) => ["enviada", "recebida", "concluida"].includes(o.status) || o.extra_status === "pendente");
  const lista = aba === "abertas" ? abertas : ordens;
  const k = {
    oficina: ordens.filter((o) => o.status === "enviada" || o.status === "recebida").length,
    prontas: ordens.filter((o) => o.status === "concluida").length,
    extra: ordens.filter((o) => o.extra_status === "pendente").length,
    atrasadas: ordens.filter((o) => o.atrasada).length,
  };
  const ativas = (oficinas || []).filter((o) => o.ativo);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ordens-servico"] }); qc.invalidateQueries({ queryKey: ["estoque-lista"] }); qc.invalidateQueries({ queryKey: ["preparacoes"] }); };
  const extra = dealership ? { dealership } : {};
  const rodar = (payload: Record<string, unknown>, ok: string, depois?: () => void) =>
    acao.mutate({ ...payload, ...extra } as any, {
      onSuccess: () => { toast({ title: ok }); depois?.(); refresh(); },
      onError: (e) => toast({ title: "Não deu certo", description: msgErro(e), variant: "destructive" }),
    });

  const enviar = () => {
    if (!envio) return;
    if (!envio.carro && !envio.car_desc.trim()) return toast({ title: "Escolha o carro", variant: "destructive" });
    if (!envio.oficina_id) return toast({ title: "Escolha a oficina", variant: "destructive" });
    if (!envio.servicos.length) return toast({ title: "Escolha o serviço", variant: "destructive" });
    if (!(Number(envio.km_saida) > 0)) return toast({ title: "Informe o km do painel na saída", variant: "destructive" });
    if (!envio.foto_saida) return toast({ title: "Tire a foto do painel na saída", variant: "destructive" });
    rodar({
      action: "os_criar", oficina_id: envio.oficina_id, servicos: envio.servicos, pedido_obs: envio.pedido_obs, km_saida: Number(envio.km_saida), foto_saida: envio.foto_saida,
      ...(envio.carro ? { vehicle_id: envio.carro.id, car_desc: [envio.carro.desc, envio.carro.cor].filter(Boolean).join(" ") } : { car_desc: envio.car_desc, placa: envio.placa }),
    }, "Carro enviado ✅ A oficina foi avisada no WhatsApp.", () => setEnvio(null));
  };

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Oficinas parceiras · ordens de serviço</CardTitle>
        {pode && <Button size="sm" className="h-8 gap-1" onClick={() => setEnvio(envioVazio())}><Send className="w-3.5 h-3.5" /> Mandar carro pra oficina</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          O carro sai com km e foto do painel; a oficina confirma a chegada e registra o serviço no link dela (óleo, filtros, km, foto do painel e da etiqueta — tudo obrigatório).
          Algo além do pedido só com aprovação. Prazo: 1 dia. A troca de óleo registrada já vira a preparação do carro.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {([["Na oficina", k.oficina, ""], ["Prontos p/ buscar", k.prontas, "text-green-600"], ["Extra p/ aprovar", k.extra, k.extra ? "text-red-600" : ""], ["Passou do prazo", k.atrasadas, k.atrasadas ? "text-red-600" : ""]] as const).map(([l, v, c]) => (
            <div key={l} className="rounded-lg bg-muted/50 p-2"><div className="text-[11px] text-muted-foreground">{l}</div><div className={`text-xl font-bold ${c}`}>{v}</div></div>
          ))}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={aba === "abertas" ? "default" : "outline"} className="h-8" onClick={() => setAba("abertas")}>Em aberto ({abertas.length})</Button>
          <Button size="sm" variant={aba === "todas" ? "default" : "outline"} className="h-8" onClick={() => setAba("todas")}>Todas ({ordens.length})</Button>
        </div>
        {isLoading ? <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : !lista.length ? (
          <p className="text-sm text-muted-foreground py-2">{aba === "abertas" ? "Nenhum carro na oficina agora." : "Nenhuma ordem de serviço ainda."}</p>
        ) : (
          <div className="divide-y">
            {lista.map((o) => (
              <div key={o.id} className="py-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetalhe(o)}>
                    <div className="text-sm font-medium truncate">#{o.numero} · {carroOS(o)}</div>
                    <div className="text-xs text-muted-foreground">{o.oficina_nome} · {servicosOS(o, nomes)} · saiu {quando(o.enviada_em)}</div>
                    {o.atrasada && <div className="text-xs font-medium text-red-700">⏰ Passou do prazo de 1 dia ({o.horas_na_oficina}h)</div>}
                    {o.km_ida != null && o.km_ida > 50 && <div className="text-xs font-medium text-red-700">⚠️ Rodou {kmBR(o.km_ida)} entre a loja e a oficina</div>}
                    {o.status === "concluida" && <div className="text-xs text-green-700">🛢️ {oleoOS(o) || o.servico_obs || "Serviço registrado"} · {kmBR(o.km_servico)}</div>}
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_OS[o.status].cls}`}>{STATUS_OS[o.status].label}</span>
                </div>
                {o.extra_status === "pendente" && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm space-y-1.5">
                    <div><b>⚠️ Extra pedido pela oficina:</b> {o.extra_descricao}{o.extra_valor ? ` · R$ ${Number(o.extra_valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}</div>
                    {o.fotos?.extra_foto && <a href={o.fotos.extra_foto} target="_blank" rel="noreferrer"><img src={o.fotos.extra_foto} alt="" className="w-24 h-24 rounded object-cover border" /></a>}
                    {pode && <div className="flex gap-2">
                      <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700" disabled={acao.isPending} onClick={() => rodar({ action: "os_extra_decidir", id: o.id, aprovado: true }, "Extra aprovado ✅ A oficina foi avisada.")}>Aprovar</Button>
                      <Button size="sm" variant="outline" className="h-8 text-red-700" disabled={acao.isPending} onClick={() => rodar({ action: "os_extra_decidir", id: o.id, aprovado: false }, "Extra recusado. A oficina foi avisada.")}>Recusar</Button>
                    </div>}
                  </div>
                )}
                {pode && (o.status === "concluida" || o.status === "enviada" || o.status === "recebida") && (
                  <div className="flex gap-2">
                    {o.status === "concluida" && <Button size="sm" className="h-8" onClick={() => setVolta({ o, km: o.km_servico ? String(o.km_servico) : "" })}>Carro voltou pra loja</Button>}
                    {o.status !== "concluida" && <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => { if (confirm(`Cancelar a OS #${o.numero}?`)) rodar({ action: "os_cancelar", id: o.id }, "OS cancelada"); }}>Cancelar</Button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Oficinas oficinas={oficinas || []} modo={modo} onEditar={(o) => setOfForm(o)} />
      </CardContent>

      {/* mandar carro pra oficina */}
      <Dialog open={!!envio} onOpenChange={(o) => { if (!o) setEnvio(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Mandar carro pra oficina</DialogTitle></DialogHeader>
          {envio && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs font-semibold">1. Para qual oficina? <span className="text-red-600">*</span></Label>
                {!ativas.length ? (
                  <div className="rounded-lg bg-amber-50 text-amber-900 text-sm p-2">Nenhuma oficina parceira cadastrada. {modo === "dono" ? "Cadastre em “Oficinas parceiras”, no fim desta seção." : "Peça ao gerente para cadastrar."}</div>
                ) : (
                  <div className="grid gap-2">
                    {ativas.map((o) => {
                      const sel = envio.oficina_id === o.id;
                      return (
                        <button key={o.id} type="button" onClick={() => setEnvio({ ...envio, oficina_id: o.id })}
                          className={`w-full text-left rounded-lg border-2 p-2.5 flex items-center gap-3 ${sel ? "border-primary bg-primary/5" : "border-muted hover:border-primary/40"}`}>
                          <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${sel ? "border-primary" : "border-muted-foreground/40"}`}>{sel && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}</span>
                          <span className="min-w-0"><span className="block text-sm font-semibold">{o.nome}</span><span className="block text-xs text-muted-foreground">{[o.responsavel, o.cidade].filter(Boolean).join(" · ")}</span></span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-xs font-semibold">2. Qual carro?</div>
              <EscolherCarro dealership={dealership} envio={envio} setEnvio={setEnvio} />
              <div className="space-y-1.5"><Label className="text-xs font-semibold">3. Serviço <span className="text-red-600">*</span></Label>
                {Object.keys(nomes).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={envio.servicos.includes(s)} onCheckedChange={(v) => setEnvio({ ...envio, servicos: v === true ? [...envio.servicos, s] : envio.servicos.filter((x) => x !== s) })} /> {nomeServico(s, nomes)}
                  </label>
                ))}
              </div>
              <div className="space-y-1"><Label className="text-xs">Observação pra oficina</Label><Input value={envio.pedido_obs} onChange={(e) => setEnvio({ ...envio, pedido_obs: e.target.value })} placeholder="Ex.: conferir barulho na suspensão" /></div>
              <div className="space-y-1"><Label className="text-xs">Km do painel na saída <span className="text-red-600">*</span></Label><Input type="number" inputMode="numeric" value={envio.km_saida} onChange={(e) => setEnvio({ ...envio, km_saida: e.target.value })} placeholder="48200" /></div>
              <FotoInput label="Foto do painel na saída (km aparecendo)" obrigatoria valor={envio.foto_saida} onChange={(v) => setEnvio({ ...envio, foto_saida: v })} />
              <Button className="w-full" disabled={acao.isPending} onClick={enviar}>{acao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar e avisar a oficina"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* carro voltou */}
      <Dialog open={!!volta} onOpenChange={(o) => { if (!o) setVolta(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Carro voltou pra loja</DialogTitle></DialogHeader>
          {volta && (
            <div className="space-y-3">
              <p className="text-sm">#{volta.o.numero} · {carroOS(volta.o)} · {volta.o.oficina_nome}</p>
              <div className="space-y-1"><Label className="text-xs">Km do painel na volta <span className="text-red-600">*</span></Label><Input type="number" inputMode="numeric" value={volta.km} onChange={(e) => setVolta({ ...volta, km: e.target.value })} /></div>
              <Button className="w-full" disabled={acao.isPending} onClick={() => {
                if (!(Number(volta.km) > 0)) return toast({ title: "Informe o km", variant: "destructive" });
                rodar({ action: "os_devolver", id: volta.o.id, km_volta: Number(volta.km) }, "Volta registrada ✅", () => setVolta(null));
              }}>{acao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(o) => { if (!o) setDetalhe(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>OS #{detalhe?.numero} · {detalhe && carroOS(detalhe)}</DialogTitle></DialogHeader>
          {detalhe && <DetalheOS o={detalhe} nomes={nomes} />}
        </DialogContent>
      </Dialog>

      {/* cadastro de oficina (dono) */}
      <Dialog open={!!ofForm} onOpenChange={(o) => { if (!o) setOfForm(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ofForm?.id ? "Editar oficina" : "Nova oficina parceira"}</DialogTitle></DialogHeader>
          {ofForm && (
            <div className="space-y-2">
              {([["nome", "Nome fantasia *"], ["responsavel", "Responsável"], ["whatsapp", "WhatsApp do responsável (avisos)"], ["telefone", "Telefone"], ["razao_social", "Razão social"], ["cnpj", "CNPJ"], ["endereco", "Endereço"], ["cidade", "Cidade"]] as [keyof OficinaParceira, string][]).map(([c, l]) => (
                <div key={c} className="space-y-1"><Label className="text-xs">{l}</Label><Input value={String(ofForm[c] ?? "")} onChange={(e) => setOfForm({ ...ofForm, [c]: e.target.value })} /></div>
              ))}
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={ofForm.ativo !== false} onCheckedChange={(v) => setOfForm({ ...ofForm, ativo: v === true })} /> Ativa</label>
              {ofForm.id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!(ofForm as any).trocar_link} onCheckedChange={(v) => setOfForm({ ...ofForm, trocar_link: v === true } as any)} /> Gerar link novo (o antigo deixa de valer)</label>}
              <Button className="w-full" disabled={acao.isPending} onClick={() => rodar({ action: "oficina_parceira_save", ...ofForm, link: undefined }, "Oficina salva ✅", () => { setOfForm(null); qc.invalidateQueries({ queryKey: ["oficinas-parceiras"] }); })}>
                {acao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EscolherCarro({ dealership, envio, setEnvio }: { dealership?: string; envio: Envio; setEnvio: (e: Envio) => void }) {
  const { data: estoque, isLoading } = useEstoqueLista(true, dealership);
  const [busca, setBusca] = useState("");
  const [fora, setFora] = useState(false);
  const lista = useMemo(() => (estoque || []).filter((c) => !busca.trim() || `${c.desc} ${c.versao || ""} ${c.cor || ""}`.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 30), [estoque, busca]);
  if (envio.carro) return (
    <div className="flex items-center gap-2 rounded-lg border p-2">
      {envio.carro.capa ? <img src={envio.carro.capa} alt="" className="w-14 h-10 rounded object-cover" /> : <div className="w-14 h-10 rounded bg-muted" />}
      <div className="flex-1 min-w-0 text-sm font-medium truncate">{envio.carro.desc}{envio.carro.cor ? ` · ${envio.carro.cor}` : ""}</div>
      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEnvio({ ...envio, carro: null })}>Trocar</Button>
    </div>
  );
  if (fora) return (
    <div className="space-y-2">
      <div className="space-y-1"><Label className="text-xs">Carro <span className="text-red-600">*</span></Label><Input value={envio.car_desc} onChange={(e) => setEnvio({ ...envio, car_desc: e.target.value })} placeholder="Ex.: Onix 2022 prata" /></div>
      <div className="space-y-1"><Label className="text-xs">Placa</Label><Input value={envio.placa} onChange={(e) => setEnvio({ ...envio, placa: e.target.value.toUpperCase() })} maxLength={8} placeholder="ABC1D23" /></div>
      <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setFora(false)}>Escolher do estoque</Button>
    </div>
  );
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Carro do estoque <span className="text-red-600">*</span></Label>
      <div className="relative"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" /><Input className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar modelo, ano ou cor" /></div>
      <div className="max-h-56 overflow-y-auto divide-y rounded border">
        {isLoading ? <div className="p-3 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></div> : lista.map((c) => (
          <button key={c.id} type="button" className="w-full flex items-center gap-2 p-2 text-left hover:bg-muted/60" onClick={() => setEnvio({ ...envio, carro: c, km_saida: c.km ? String(c.km) : envio.km_saida })}>
            {c.capa ? <img src={c.capa} alt="" loading="lazy" className="w-12 h-9 rounded object-cover" /> : <div className="w-12 h-9 rounded bg-muted" />}
            <span className="text-sm truncate">{c.desc}{c.cor ? ` · ${c.cor}` : ""}</span>
          </button>
        ))}
      </div>
      <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setFora(true)}>Carro fora do estoque</Button>
    </div>
  );
}

export function DetalheOS({ o, nomes }: { o: OrdemServico; nomes: Record<string, string> }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2 items-center">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_OS[o.status].cls}`}>{STATUS_OS[o.status].label}</span>
        <span className="text-muted-foreground">{o.oficina_nome} · {servicosOS(o, nomes)}</span>
      </div>
      {o.pedido_obs && <div><b>Pedido:</b> {o.pedido_obs}</div>}
      <LinhaDoTempo o={o} />
      {o.concluida_em && (
        <div className="rounded-lg bg-muted/50 p-2 space-y-0.5">
          {oleoOS(o) && <div>🛢️ <b>Óleo:</b> {oleoOS(o)}</div>}
          {filtrosOS(o) && <div>🧰 <b>Filtros:</b> {filtrosOS(o)}</div>}
          {o.servico_obs && <div>📝 {o.servico_obs}</div>}
          {o.valor ? <div>💵 R$ {Number(o.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div> : null}
          {o.preparacao_id && <div className="text-green-700">✅ Virou a preparação do carro (ponto zero do Co-pilot na venda)</div>}
        </div>
      )}
      {o.extra_status && <div><b>Extra ({o.extra_status}):</b> {o.extra_descricao}{o.extra_decidido_por ? ` · decidido por ${o.extra_decidido_por}` : ""}</div>}
      <FotosOS o={o} />
    </div>
  );
}

// Lista das oficinas com o link de cada uma (copiar / mandar no WhatsApp)
function Oficinas({ oficinas, modo, onEditar }: { oficinas: OficinaParceira[]; modo: Modo; onEditar: (o: Partial<OficinaParceira>) => void }) {
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); toast({ title: "Link copiado" }); } catch { prompt("Copie o link:", t); } };
  const zap = (o: OficinaParceira) => `https://wa.me/${String(o.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Olá${o.responsavel ? `, ${o.responsavel}` : ""}! Este é o link da ${o.nome} no Co-pilot da loja. Por ele você recebe os carros que mandarmos, confirma a chegada e registra o serviço:\n${o.link}\n\n📄 Como funciona (guia em PDF):\n${guiaOficina(o.link!)}`)}`;
  return (
    <div className="pt-2 border-t space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Oficinas parceiras ({oficinas.filter((o) => o.ativo).length})</div>
        {modo === "dono" && <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onEditar({ ativo: true })}><Plus className="w-3.5 h-3.5" /> Nova</Button>}
      </div>
      {!oficinas.length ? <p className="text-xs text-muted-foreground">Nenhuma oficina cadastrada (rode o SQL das oficinas parceiras).</p> : oficinas.map((o) => (
        <div key={o.id} className={`rounded-lg border p-2 text-sm ${o.ativo ? "" : "opacity-50"}`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{o.nome}{!o.ativo && " (inativa)"}</div>
              <div className="text-xs text-muted-foreground">{[o.responsavel, o.whatsapp ? `WhatsApp ${String(o.whatsapp).replace(/^55/, "").replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3")}` : null, o.cidade].filter(Boolean).join(" · ")}</div>
            </div>
            {modo === "dono" && <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEditar(o)}><Pencil className="w-4 h-4" /></Button>}
          </div>
          {o.link && o.ativo && (
            <div className="flex flex-wrap gap-2 mt-1.5">
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => copiar(o.link!)}><Copy className="w-3.5 h-3.5" /> Copiar link</Button>
              {o.whatsapp && <Button size="sm" variant="outline" className="h-8 gap-1" asChild><a href={zap(o)} target="_blank" rel="noreferrer"><MessageCircle className="w-3.5 h-3.5" /> Mandar no WhatsApp</a></Button>}
              <Button size="sm" variant="ghost" className="h-8 gap-1" asChild><a href={guiaOficina(o.link)} target="_blank" rel="noreferrer"><FileText className="w-3.5 h-3.5" /> Guia em PDF</a></Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
