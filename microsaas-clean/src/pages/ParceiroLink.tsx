import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { OrdemServico } from "@/hooks/useDealer";
import { STATUS_OS, msgErro, kmBR, quando, carroOS, servicosOS, oleoOS, filtrosOS, FotoInput, FotosOS, LinhaDoTempo } from "@/components/oficina/comum";

// LINK DA OFICINA PARCEIRA: /parceiro/{token}. Sem login, no celular do mecânico: os carros que a loja
// mandou, "recebi o carro" (km + foto do painel), o registro do serviço (campos obrigatórios) e o pedido de
// aprovação quando encontrar algo além do pedido.
type Info = { oficina: { nome: string; responsavel: string | null; loja: string }; servicos: Record<string, string>; ordens: OrdemServico[] };
const chamar = async (token: string, action: string, payload: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke("dealer-api", { body: { action, t: token, ...payload } });
  if (data?.error) throw new Error(data.error);
  if (error) throw error;
  return data;
};

type Servico = { km_servico: string; oleo_viscosidade: string; oleo_norma: string; oleo_marca: string; oleo_litros: string; filtro_oleo: boolean; filtro_ar: boolean; filtro_combustivel: boolean; filtro_cabine: boolean; servico_obs: string; valor: string; foto_painel: string | null; foto_etiqueta: string | null; foto_nota: string | null };
const servicoVazio = (o: OrdemServico): Servico => ({ km_servico: o.km_chegada ? String(o.km_chegada) : "", oleo_viscosidade: "", oleo_norma: "", oleo_marca: "", oleo_litros: "", filtro_oleo: true, filtro_ar: false, filtro_combustivel: false, filtro_cabine: false, servico_obs: "", valor: "", foto_painel: null, foto_etiqueta: null, foto_nota: null });

export default function ParceiroLink() {
  const { token = "" } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["parceiro", token], queryFn: async () => (await chamar(token, "parceiro_info")) as Info, retry: false, refetchInterval: 60_000 });
  const acao = useMutation({ mutationFn: ({ action, ...p }: { action: string } & Record<string, unknown>) => chamar(token, action, p) });
  const [receber, setReceber] = useState<{ o: OrdemServico; km: string; foto: string | null } | null>(null);
  const [servico, setServico] = useState<{ o: OrdemServico; f: Servico } | null>(null);
  const [extra, setExtra] = useState<{ o: OrdemServico; desc: string; valor: string; foto: string | null } | null>(null);
  const [ver, setVer] = useState<OrdemServico | null>(null);

  const rodar = (p: { action: string } & Record<string, unknown>, ok: string, depois: () => void) =>
    acao.mutate(p, {
      onSuccess: () => { toast({ title: ok }); depois(); qc.invalidateQueries({ queryKey: ["parceiro", token] }); },
      onError: (e) => toast({ title: "Falta coisa", description: msgErro(e), variant: "destructive" }),
    });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="text-center max-w-sm space-y-3"><p className="text-3xl">🔒</p><h1 className="text-lg font-semibold">Este link não vale mais. Peça um novo à loja.</h1></div>
    </div>
  );
  const nomes = data.servicos;
  const chegando = data.ordens.filter((o) => o.status === "enviada");
  const naOficina = data.ordens.filter((o) => o.status === "recebida");
  const feitas = data.ordens.filter((o) => o.status === "concluida" || o.status === "devolvida");
  const oleo = (o: OrdemServico) => (o.servicos || []).includes("troca_oleo");
  const outros = (o: OrdemServico) => (o.servicos || []).some((s) => s !== "troca_oleo");

  const registrar = () => {
    if (!servico) return;
    const { o, f } = servico;
    if (!(Number(f.km_servico) > 0)) return toast({ title: "Informe o km do painel", variant: "destructive" });
    if (oleo(o) && (!f.oleo_viscosidade || !f.oleo_norma || !f.oleo_marca || !(Number(String(f.oleo_litros).replace(",", ".")) > 0))) return toast({ title: "Preencha viscosidade, norma, marca e litros do óleo", variant: "destructive" });
    if (!f.foto_painel) return toast({ title: "Tire a foto do painel", variant: "destructive" });
    if (oleo(o) && !f.foto_etiqueta) return toast({ title: "Tire a foto da etiqueta de troca de óleo", variant: "destructive" });
    if (outros(o) && f.servico_obs.trim().length < 5) return toast({ title: "Descreva o que foi feito", variant: "destructive" });
    rodar({ action: "parceiro_concluir", id: o.id, ...f, km_servico: Number(f.km_servico) }, "Serviço registrado ✅ A loja foi avisada.", () => setServico(null));
  };
  const setF = (k: keyof Servico, v: any) => setServico((s) => (s ? { ...s, f: { ...s.f, [k]: v } } : s));

  const Bloco = ({ titulo, itens, vazio, children }: { titulo: string; itens: OrdemServico[]; vazio: string; children: (o: OrdemServico) => ReactNode }) => (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{titulo} ({itens.length})</h2>
      {!itens.length ? <p className="text-sm text-muted-foreground">{vazio}</p> : itens.map((o) => (
        <Card key={o.id} className="border-0 shadow-md"><CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">OS #{o.numero} · {carroOS(o)}</div>
              <div className="text-sm text-muted-foreground">{servicosOS(o, nomes)}</div>
              {o.pedido_obs && <div className="text-sm">📝 {o.pedido_obs}</div>}
              <div className="text-xs text-muted-foreground">Saiu da loja {quando(o.enviada_em)}{o.km_saida ? ` com ${kmBR(o.km_saida)}` : ""}</div>
              {o.atrasada && <div className="text-xs font-medium text-red-700">⏰ Passou do prazo de 1 dia</div>}
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_OS[o.status].cls}`}>{STATUS_OS[o.status].label}</span>
          </div>
          {o.extra_status && (
            <div className={`rounded p-2 text-sm ${o.extra_status === "pendente" ? "bg-amber-50 text-amber-900" : o.extra_status === "aprovado" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
              {o.extra_status === "pendente" ? "⏳ Extra aguardando aprovação da loja: " : o.extra_status === "aprovado" ? "✅ Extra APROVADO: " : "❌ Extra RECUSADO (não fazer): "}{o.extra_descricao}
            </div>
          )}
          {children(o)}
        </CardContent></Card>
      ))}
    </section>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-[#0b1f6b] text-white px-4 pt-5 pb-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-bold tracking-widest text-teal-300 uppercase">{data.oficina.loja} · Oficina parceira</div>
          <h1 className="text-xl font-extrabold mt-0.5">{data.oficina.nome}</h1>
          {data.oficina.responsavel && <div className="text-sm text-blue-100">Olá, <b className="text-white">{data.oficina.responsavel}</b></div>}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 space-y-5">
        <Bloco titulo="Chegando" itens={chegando} vazio="Nenhum carro a caminho.">
          {(o) => <Button className="w-full" onClick={() => setReceber({ o, km: "", foto: null })}>📥 Recebi o carro</Button>}
        </Bloco>
        <Bloco titulo="Na oficina" itens={naOficina} vazio="Nenhum carro na oficina agora.">
          {(o) => (
            <div className="grid grid-cols-1 gap-2">
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setServico({ o, f: servicoVazio(o) })}>✅ Registrar o serviço feito</Button>
              {o.extra_status !== "pendente" && <Button variant="outline" className="w-full" onClick={() => setExtra({ o, desc: "", valor: "", foto: null })}>⚠️ Encontrei algo além do pedido</Button>}
            </div>
          )}
        </Bloco>
        <Bloco titulo="Serviços feitos" itens={feitas.slice(0, 20)} vazio="Nenhum serviço registrado ainda.">
          {(o) => (
            <div className="text-sm space-y-1">
              {oleoOS(o) && <div>🛢️ {oleoOS(o)}{filtrosOS(o) ? ` · filtros: ${filtrosOS(o)}` : ""}</div>}
              <div className="text-xs text-muted-foreground">Registrado {quando(o.concluida_em)} · {kmBR(o.km_servico)}</div>
              <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setVer(o)}>Ver detalhes</Button>
            </div>
          )}
        </Bloco>
      </main>

      <Dialog open={!!receber} onOpenChange={(v) => { if (!v) setReceber(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Recebi o carro</DialogTitle></DialogHeader>
          {receber && (
            <div className="space-y-3">
              <p className="text-sm">OS #{receber.o.numero} · {carroOS(receber.o)}</p>
              <div className="space-y-1"><Label className="text-xs">Km do painel na chegada <span className="text-red-600">*</span></Label><Input type="number" inputMode="numeric" value={receber.km} onChange={(e) => setReceber({ ...receber, km: e.target.value })} /></div>
              <FotoInput label="Foto do painel (km aparecendo)" obrigatoria valor={receber.foto} onChange={(v) => setReceber({ ...receber, foto: v })} />
              <Button className="w-full" disabled={acao.isPending} onClick={() => {
                if (!(Number(receber.km) > 0)) return toast({ title: "Informe o km", variant: "destructive" });
                if (!receber.foto) return toast({ title: "Tire a foto do painel", variant: "destructive" });
                rodar({ action: "parceiro_receber", id: receber.o.id, km_chegada: Number(receber.km), foto_chegada: receber.foto }, "Chegada confirmada ✅", () => setReceber(null));
              }}>{acao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar chegada"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!servico} onOpenChange={(v) => { if (!v) setServico(null); }}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar o serviço</DialogTitle></DialogHeader>
          {servico && (
            <div className="space-y-3">
              <p className="text-sm">OS #{servico.o.numero} · {carroOS(servico.o)} · {servicosOS(servico.o, nomes)}</p>
              <div className="space-y-1"><Label className="text-xs">Km do painel <span className="text-red-600">*</span></Label><Input type="number" inputMode="numeric" value={servico.f.km_servico} onChange={(e) => setF("km_servico", e.target.value)} /></div>
              {oleo(servico.o) && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-xs">Viscosidade <span className="text-red-600">*</span></Label><Input value={servico.f.oleo_viscosidade} onChange={(e) => setF("oleo_viscosidade", e.target.value.toUpperCase())} placeholder="5W30" /></div>
                    <div className="space-y-1"><Label className="text-xs">Litros <span className="text-red-600">*</span></Label><Input inputMode="decimal" value={servico.f.oleo_litros} onChange={(e) => setF("oleo_litros", e.target.value)} placeholder="4,5" /></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Norma / especificação <span className="text-red-600">*</span></Label><Input value={servico.f.oleo_norma} onChange={(e) => setF("oleo_norma", e.target.value)} placeholder="API SP · ACEA C3 · VW 508.00" /></div>
                  <div className="space-y-1"><Label className="text-xs">Marca do óleo <span className="text-red-600">*</span></Label><Input value={servico.f.oleo_marca} onChange={(e) => setF("oleo_marca", e.target.value)} placeholder="Mobil, Shell, Castrol, Lubrax…" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Filtros trocados</Label>
                    {([["filtro_oleo", "Filtro de óleo"], ["filtro_ar", "Filtro de ar"], ["filtro_combustivel", "Filtro de combustível"], ["filtro_cabine", "Filtro de cabine (ar-condicionado)"]] as [keyof Servico, string][]).map(([k, l]) => (
                      <label key={k} className="flex items-center gap-2 text-sm"><Checkbox checked={!!servico.f[k]} onCheckedChange={(v) => setF(k, v === true)} /> {l}</label>
                    ))}
                  </div>
                </>
              )}
              <div className="space-y-1"><Label className="text-xs">O que foi feito {outros(servico.o) ? <span className="text-red-600">*</span> : "(opcional)"}</Label><Textarea rows={3} value={servico.f.servico_obs} onChange={(e) => setF("servico_obs", e.target.value)} placeholder="Ex.: revisão dos freios, pastilhas ok, fluido completado" /></div>
              <FotoInput label="Foto do painel (km aparecendo)" obrigatoria valor={servico.f.foto_painel} onChange={(v) => setF("foto_painel", v)} />
              {oleo(servico.o) && <FotoInput label="Foto da etiqueta de troca de óleo (no para-brisa)" obrigatoria valor={servico.f.foto_etiqueta} onChange={(v) => setF("foto_etiqueta", v)} />}
              <div className="space-y-1"><Label className="text-xs">Valor (opcional)</Label><Input inputMode="decimal" value={servico.f.valor} onChange={(e) => setF("valor", e.target.value)} placeholder="R$" /></div>
              <FotoInput label="Foto da nota (opcional)" valor={servico.f.foto_nota} onChange={(v) => setF("foto_nota", v)} />
              <Button className="w-full" disabled={acao.isPending} onClick={registrar}>{acao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar serviço"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!extra} onOpenChange={(v) => { if (!v) setExtra(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Encontrei algo além do pedido</DialogTitle></DialogHeader>
          {extra && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Nada além do pedido é feito sem a aprovação da loja. Descreva e mande a foto: o gerente aprova ou recusa pelo link dele e você é avisado.</p>
              <div className="space-y-1"><Label className="text-xs">O que encontrou <span className="text-red-600">*</span></Label><Textarea rows={3} value={extra.desc} onChange={(e) => setExtra({ ...extra, desc: e.target.value })} placeholder="Ex.: pastilhas dianteiras no fim, precisam trocar" /></div>
              <FotoInput label="Foto" obrigatoria valor={extra.foto} onChange={(v) => setExtra({ ...extra, foto: v })} />
              <div className="space-y-1"><Label className="text-xs">Valor (opcional)</Label><Input inputMode="decimal" value={extra.valor} onChange={(e) => setExtra({ ...extra, valor: e.target.value })} placeholder="R$" /></div>
              <Button className="w-full" disabled={acao.isPending} onClick={() => {
                if (extra.desc.trim().length < 5) return toast({ title: "Descreva o que encontrou", variant: "destructive" });
                if (!extra.foto) return toast({ title: "Tire a foto", variant: "destructive" });
                rodar({ action: "parceiro_extra", id: extra.o.id, extra_descricao: extra.desc, extra_valor: extra.valor, extra_foto: extra.foto }, "Enviado pra aprovação da loja ✅", () => setExtra(null));
              }}>{acao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pedir aprovação"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!ver} onOpenChange={(v) => { if (!v) setVer(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>OS #{ver?.numero} · {ver && carroOS(ver)}</DialogTitle></DialogHeader>
          {ver && (
            <div className="space-y-3 text-sm">
              <LinhaDoTempo o={ver} />
              {oleoOS(ver) && <div>🛢️ {oleoOS(ver)}</div>}
              {filtrosOS(ver) && <div>🧰 Filtros: {filtrosOS(ver)}</div>}
              {ver.servico_obs && <div>📝 {ver.servico_obs}</div>}
              <FotosOS o={ver} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
