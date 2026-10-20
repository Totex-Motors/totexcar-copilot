import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Headset, Users, Trash2, Plus, Search, Send, MessageCircle, Clock, Star, CheckCircle2, Link2, Copy } from "lucide-react";
import { usePosvenda, usePosvendaCasos, usePosvendaCaso, usePosvendaAcao, usePosvendaStats, usePosvendaOportunidades, usePosvendaRespostas, type PapelEquipe, type PosvendaCaso } from "@/hooks/useDealer";
import { Textarea } from "@/components/ui/textarea";

// CENTRAL DE ATENDIMENTO DO PÓS-VENDA — o Co-pilot atende primeiro; quando precisa de gente, abre um caso,
// avisa o grupo da equipe (número do Canal, só grupo) e quem tocar no link "#assumir N" conversa com o
// cliente pelo próprio WhatsApp, através do Co-pilot. Escada: vendedor → gerente de manutenção → gerente geral.
const PAPEL: Record<PapelEquipe, string> = { vendedor: "Vendedor", gerente_manutencao: "Gerente de manutenção", gerente_geral: "Gerente geral" };
const STATUS: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Esperando alguém", cls: "bg-amber-500/15 text-amber-700" },
  em_atendimento: { label: "Em atendimento", cls: "bg-green-500/15 text-green-700" },
  encerrado: { label: "Encerrado", cls: "bg-muted text-muted-foreground" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};
const PRIO: Record<string, string> = { urgente: "bg-red-500/15 text-red-700", alta: "bg-orange-500/15 text-orange-700", media: "bg-sky-500/15 text-sky-700", baixa: "bg-muted text-muted-foreground" };
const DEGRAU = ["", "Vendedor", "Gerente de manutenção", "Gerente geral"];
const fmtTel = (p: string) => String(p || "").replace(/^55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
const tempo = (s?: string | null) => {
  if (!s) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(s).getTime()) / 60_000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d`;
};
const selCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm";
const DIAS: [string, string][] = [["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"], ["0", "Dom"]];
const HORARIO_PADRAO: Record<string, [string, string]> = { "1": ["08:00", "18:00"], "2": ["08:00", "18:00"], "3": ["08:00", "18:00"], "4": ["08:00", "18:00"], "5": ["08:00", "18:00"], "6": ["08:00", "12:00"] };

export function AtendimentoTab({ dealership }: { dealership?: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = usePosvenda(true, dealership);
  const [filtro, setFiltro] = useState<"ativos" | "encerrados" | "todos">("ativos");
  const { data: casosData, isLoading: loadingCasos } = usePosvendaCasos(true, filtro, dealership);
  const acao = usePosvendaAcao();
  const [aberto, setAberto] = useState<string | null>(null);

  const [novo, setNovo] = useState({ nome: "", phone: "", papel: "vendedor" as PapelEquipe });
  // link pessoal do vendedor: abre só o cadastro da venda, sem login (a venda já sai no nome dele)
  const [linkDlg, setLinkDlg] = useState<{ nome: string; phone: string; link: string } | null>(null);
  const [grupo, setGrupo] = useState({ id: "", nome: "" });
  const [grupos, setGrupos] = useState<{ id: string; nome: string }[] | null>(null);
  const [sla, setSla] = useState("15");
  const [horario, setHorario] = useState<Record<string, [string, string]>>(HORARIO_PADRAO);

  const cfg = data?.config;
  useEffect(() => {
    if (!cfg) return;
    setGrupo({ id: cfg.grupo_id || "", nome: cfg.grupo_nome || "" });
    setSla(String(cfg.sla_min || 15));
    setHorario(cfg.horario && Object.keys(cfg.horario).length ? cfg.horario : HORARIO_PADRAO);
  }, [cfg?.grupo_id, cfg?.sla_min, JSON.stringify(cfg?.horario || null)]); // eslint-disable-line react-hooks/exhaustive-deps

  const equipe = data?.equipe || [];
  const casos = casosData?.casos || [];
  const motivos = casosData?.motivos || {};
  const refresh = () => { qc.invalidateQueries({ queryKey: ["posvenda"] }); qc.invalidateQueries({ queryKey: ["posvenda-casos"] }); };
  const base = dealership ? { dealership } : {};
  const rodar = (action: string, payload: Record<string, unknown>, ok: string, depois?: () => void) =>
    acao.mutate({ action, ...base, ...payload }, {
      onSuccess: (r: any) => { if (r?.ok === false) { toast({ title: "Não deu certo", description: r?.error || "", variant: "destructive" }); return; } toast({ title: ok }); refresh(); depois?.(); },
      onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
    });

  const abrirLink = (id: string, trocar = false) =>
    acao.mutate({ action: "posvenda_membro_link", id, trocar, ...base }, {
      onSuccess: (r: any) => { if (!r?.link) { toast({ title: "Não deu certo", description: r?.error || "", variant: "destructive" }); return; } setLinkDlg({ nome: r.nome, phone: r.phone, link: r.link }); if (trocar) toast({ title: "Link trocado", description: "O link anterior parou de funcionar." }); },
      onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
    });
  const copiar = (t: string) => { navigator.clipboard?.writeText(t).then(() => toast({ title: "Link copiado ✅" })).catch(() => toast({ title: "Copie o link manualmente", variant: "destructive" })); };

  const resumoEscada = useMemo(() => {
    const g = (p: PapelEquipe) => equipe.filter((m) => m.ativo && m.papel === p).map((m) => m.nome.split(" ")[0]).join(", ");
    return { vend: equipe.filter((m) => m.ativo && m.papel === "vendedor").length, man: g("gerente_manutencao"), ger: g("gerente_geral") };
  }, [equipe]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const ativos = casos.filter((c) => c.status === "aberto" || c.status === "em_atendimento");
  const esperando = ativos.filter((c) => c.status === "aberto").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-premium-md"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Esperando alguém</div><div className="text-2xl font-bold text-amber-600">{filtro === "ativos" ? esperando : "—"}</div></CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Em atendimento</div><div className="text-2xl font-bold text-green-600">{filtro === "ativos" ? ativos.length - esperando : "—"}</div></CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Equipe ativa</div><div className="text-2xl font-bold">{equipe.filter((m) => m.ativo).length}</div></CardContent></Card>
        <Card className="border-0 shadow-premium-md"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Grupo da equipe</div><div className="text-sm font-semibold truncate mt-1">{cfg?.grupo_id ? (cfg.grupo_nome || "Configurado") : "Não configurado"}</div></CardContent></Card>
      </div>

      <Indicadores dealership={dealership} />

      {/* CASOS */}
      <Card className="border-0 shadow-premium-md">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Headset className="w-4 h-4 text-primary" /> Atendimentos</CardTitle>
          <div className="flex gap-1">
            {(["ativos", "encerrados", "todos"] as const).map((f) => (
              <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} className="h-8" onClick={() => setFiltro(f)}>{f === "ativos" ? "Em andamento" : f === "encerrados" ? "Encerrados" : "Todos"}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loadingCasos ? <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : !casos.length ? (
            <p className="text-sm text-muted-foreground py-4">{filtro === "ativos" ? "Nenhum atendimento em andamento. Quando um cliente pedir a loja pelo Co-pilot, ele aparece aqui e no grupo." : "Nada por aqui ainda."}</p>
          ) : (
            <div className="divide-y">
              {casos.map((c) => (
                <button key={c.id} className="w-full text-left py-3 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-muted/40 rounded px-2" onClick={() => setAberto(c.id)}>
                  <span className="font-mono text-sm font-bold">#{c.numero}</span>
                  <span className="font-medium">{c.customer_name || fmtTel(c.customer_phone)}</span>
                  {c.car_desc && <span className="text-sm text-muted-foreground">{c.car_desc}</span>}
                  <Badge className={`border-0 ${STATUS[c.status]?.cls}`}>{STATUS[c.status]?.label}</Badge>
                  <Badge className={`border-0 ${PRIO[c.prioridade]}`}>{c.prioridade}</Badge>
                  <span className="text-xs text-muted-foreground">{motivos[c.motivo] || c.motivo}</span>
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    {c.status === "aberto" && <><Clock className="w-3 h-3" /> {DEGRAU[c.nivel] || ""} · há {tempo(c.created_at)}</>}
                    {c.status === "em_atendimento" && <>com <b className="text-foreground">{c.agente_nome || "?"}</b> · há {tempo(c.assumido_at)}</>}
                    {c.status === "encerrado" && <>{c.encerrado_por ? `por ${c.encerrado_por}` : ""}{c.nota ? <span className="flex items-center gap-0.5 ml-2"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {c.nota}</span> : null}</>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Oportunidades dealership={dealership} />

      <RespostasLoja dealership={dealership} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EQUIPE */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Equipe e escada</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Quem pode assumir atendimentos. O caso vai primeiro pro <b>vendedor que vendeu o carro</b> (escolhido no Sucesso do Cliente);
              sem resposta em {sla} min passa pro <b>gerente de manutenção</b>{resumoEscada.man ? ` (${resumoEscada.man})` : ""} e depois pro <b>gerente geral</b>{resumoEscada.ger ? ` (${resumoEscada.ger})` : ""}.
              Use o WhatsApp que a pessoa usa no dia a dia.
            </p>
            <div className="divide-y rounded-md border">
              {!equipe.length && <div className="p-3 text-sm text-muted-foreground">Ninguém cadastrado ainda.</div>}
              {equipe.map((m) => (
                <div key={m.id} className="p-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.nome} {!m.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}</div>
                    <div className="text-xs text-muted-foreground">{PAPEL[m.papel]} · {fmtTel(m.phone)}</div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => abrirLink(m.id)} disabled={acao.isPending}><Link2 className="w-3.5 h-3.5" /> Link de venda</Button>
                  <Switch checked={m.ativo} onCheckedChange={(v) => rodar("posvenda_membro_save", { id: m.id, nome: m.nome, phone: m.phone, papel: m.papel, ativo: v }, v ? "Ativado" : "Desativado")} />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => { if (confirm(`Remover ${m.nome} da equipe?`)) rodar("posvenda_membro_del", { id: m.id }, "Removido"); }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={novo.nome} onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))} placeholder="Glauter" /></div>
              <div className="space-y-1"><Label className="text-xs">WhatsApp (com DDD)</Label><Input value={novo.phone} onChange={(e) => setNovo((p) => ({ ...p, phone: e.target.value }))} placeholder="11987654321" /></div>
              <div className="space-y-1 col-span-2"><Label className="text-xs">Papel</Label>
                <select className={selCls} value={novo.papel} onChange={(e) => setNovo((p) => ({ ...p, papel: e.target.value as PapelEquipe }))}>
                  {(Object.keys(PAPEL) as PapelEquipe[]).map((k) => <option key={k} value={k}>{PAPEL[k]}</option>)}
                </select>
              </div>
            </div>
            <Button size="sm" className="gap-1.5" disabled={acao.isPending || !novo.nome.trim() || novo.phone.replace(/\D/g, "").length < 10}
              onClick={() => rodar("posvenda_membro_save", novo, `${novo.nome} adicionado`, () => setNovo({ nome: "", phone: "", papel: novo.papel }))}>
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </CardContent>
        </Card>

        {/* GRUPO + HORÁRIO */}
        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" /> Grupo, prazo e horário</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Grupo do WhatsApp da equipe</Label>
              <p className="text-[11px] text-muted-foreground">Coloque o número do Canal (o que só posta em grupo) dentro do grupo com vendedores e gerentes, depois toque em "Buscar grupos".</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={acao.isPending}
                  onClick={() => acao.mutate({ action: "posvenda_grupos", ...base }, { onSuccess: (r: any) => { setGrupos(r?.grupos || []); if (!r?.grupos?.length) toast({ title: "Nenhum grupo encontrado", description: "Confira se o número do Canal já está no grupo." }); } })}>
                  <Search className="w-4 h-4" /> Buscar grupos
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={acao.isPending || !cfg?.grupo_id} onClick={() => rodar("posvenda_teste", {}, "Mensagem de teste enviada ao grupo")}>
                  <Send className="w-4 h-4" /> Testar
                </Button>
              </div>
              {grupos && grupos.length > 0 && (
                <select className={selCls} value={grupo.id} onChange={(e) => setGrupo({ id: e.target.value, nome: grupos.find((g) => g.id === e.target.value)?.nome || "" })}>
                  <option value="">Escolha o grupo…</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              )}
              <Input value={grupo.id} onChange={(e) => setGrupo((g) => ({ ...g, id: e.target.value.trim() }))} placeholder="ou cole o id: 1203630xxxxxxxx@g.us" />
              {grupo.nome && <p className="text-xs text-muted-foreground">Grupo: <b>{grupo.nome}</b></p>}
            </div>
            <div className="space-y-1 max-w-[220px]">
              <Label className="text-xs">Prazo por degrau (minutos)</Label>
              <Input type="number" min={5} max={120} value={sla} onChange={(e) => setSla(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Horário de atendimento (o relógio da escada só corre dentro dele)</Label>
              <div className="space-y-1.5">
                {DIAS.map(([d, nome]) => {
                  const f = horario[d];
                  return (
                    <div key={d} className="flex items-center gap-2 text-sm">
                      <Switch checked={!!f} onCheckedChange={(v) => setHorario((h) => { const n = { ...h }; if (v) n[d] = h[d] || ["08:00", "18:00"]; else delete n[d]; return n; })} />
                      <span className="w-9">{nome}</span>
                      {f ? (
                        <>
                          <Input type="time" className="h-8 w-28" value={f[0]} onChange={(e) => setHorario((h) => ({ ...h, [d]: [e.target.value, h[d][1]] }))} />
                          <span className="text-muted-foreground">às</span>
                          <Input type="time" className="h-8 w-28" value={f[1]} onChange={(e) => setHorario((h) => ({ ...h, [d]: [h[d][0], e.target.value] }))} />
                        </>
                      ) : <span className="text-xs text-muted-foreground">fechado</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            <Button size="sm" disabled={acao.isPending} onClick={() => rodar("posvenda_config_save", { grupo_id: grupo.id, grupo_nome: grupo.nome, sla_min: Number(sla) || 15, horario }, "Configuração salva")}>
              {acao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-premium-md">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
          <div className="font-medium text-foreground">Como a equipe atende (tudo pelo WhatsApp)</div>
          <div>1. O aviso chega no grupo com o link <b>#assumir N</b>. Quem tocar e enviar, assume.</div>
          <div>2. Daí em diante, o que a pessoa escrever pro Co-pilot vai pro cliente, com o nome dela (foto, áudio e PDF também). O que o cliente responder chega pra ela.</div>
          <div>3. <b>fim</b> encerra (o cliente dá nota de 1 a 5) · <b>#sair</b> devolve o caso pro grupo · <b>#casos</b> lista o que está em andamento.</div>
        </CardContent>
      </Card>

      <CasoDialog id={aberto} dealership={dealership} onClose={() => setAberto(null)} onEncerrar={(id) => rodar("posvenda_caso_encerrar", { id }, "Atendimento encerrado", () => setAberto(null))} />
      <Dialog open={!!linkDlg} onOpenChange={(o) => { if (!o) setLinkDlg(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Link de venda · {linkDlg?.nome}</DialogTitle></DialogHeader>
          {linkDlg && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Abre no celular <b>só o cadastro da venda</b>, sem login. A venda já sai no nome de {linkDlg.nome.split(" ")[0]} como vendedor. É pessoal: não compartilhe com outra pessoa.</p>
              <div className="flex gap-2"><Input readOnly value={linkDlg.link} className="text-xs" onFocus={(e) => e.target.select()} /><Button size="sm" variant="outline" onClick={() => copiar(linkDlg.link)}><Copy className="w-4 h-4" /></Button></div>
              <a className="block" target="_blank" rel="noreferrer"
                href={`https://wa.me/${String(linkDlg.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Oi ${linkDlg.nome.split(" ")[0]}! Esse é o seu link pra cadastrar as vendas no Co-pilot (é só seu, salva nos favoritos ou na tela inicial do celular): ${linkDlg.link}`)}`}>
                <Button className="w-full gap-2"><MessageCircle className="w-4 h-4" /> Enviar pelo WhatsApp</Button>
              </a>
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { const id = equipe.find((m) => m.nome === linkDlg.nome)?.id; if (id && confirm("Gerar um link novo? O atual para de funcionar.")) abrirLink(id, true); }}>Trocar o link (se ele vazou ou a pessoa saiu)</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CasoDialog({ id, dealership, onClose, onEncerrar }: { id: string | null; dealership?: string; onClose: () => void; onEncerrar: (id: string) => void }) {
  const { data, isLoading } = usePosvendaCaso(id, dealership);
  const c = data?.caso as PosvendaCaso | undefined;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{c ? `Atendimento #${c.numero}` : "Atendimento"}</DialogTitle></DialogHeader>
        {isLoading || !c ? <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : (
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium">{c.customer_name || "Cliente"} · {fmtTel(c.customer_phone)}</div>
              <div className="text-muted-foreground">{[c.car_desc, c.placa].filter(Boolean).join(" · ")}</div>
            </div>
            {c.resumo && (
              <div className="rounded-md bg-amber-500/10 p-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-0.5">O que o cliente precisa</div>
                {c.resumo}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {c.status === "em_atendimento" ? <>Com <b className="text-foreground">{c.agente_nome || "?"}</b> desde {c.assumido_at ? new Date(c.assumido_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "?"}</>
                : c.status === "aberto" ? <>Esperando alguém assumir · degrau: {DEGRAU[c.nivel] || c.nivel}</>
                : <>Encerrado{c.encerrado_por ? ` por ${c.encerrado_por}` : ""}{c.nota ? ` · nota ${c.nota}/5` : ""}</>}
              {" · "}a conversa atualiza sozinha
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Conversa completa</div>
              {(data?.mensagens || []).map((m, i) => (
                <div key={i} className={`rounded-md p-2 ${m.de === "cliente" ? "bg-sky-500/10 mr-6" : m.de === "agente" ? "bg-green-500/10 ml-6" : "bg-muted/40 text-muted-foreground text-xs"}`}>
                  <div className="text-[11px] text-muted-foreground">{m.de === "cliente" ? "👤 " : m.de === "agente" ? "🧑‍💼 " : ""}{m.autor || m.de} · {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                  <Midia tipo={m.midia_tipo} url={m.midia_url} />
                  {m.texto && <div className="whitespace-pre-wrap">{m.texto}</div>}
                  {!m.texto && !m.midia_url && m.midia_tipo && <div className="text-muted-foreground">({m.midia_tipo})</div>}
                </div>
              ))}
            </div>
            {c.status !== "encerrado" && c.status !== "cancelado" && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { if (confirm("Encerrar este atendimento? O cliente recebe o pedido de nota.")) onEncerrar(c.id); }}>
                <CheckCircle2 className="w-4 h-4" /> Encerrar pelo painel
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// foto / áudio / vídeo / PDF guardados do atendimento (link temporário do servidor)
function Midia({ tipo, url }: { tipo: string | null; url: string | null }) {
  if (!url) return null;
  if (tipo === "image") return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="foto" className="mt-1 mb-1 max-h-60 rounded-md border" /></a>;
  if (tipo === "audio") return <audio controls src={url} className="mt-1 mb-1 w-full" />;
  if (tipo === "video") return <video controls src={url} className="mt-1 mb-1 max-h-72 w-full rounded-md" />;
  return <a href={url} target="_blank" rel="noreferrer" className="inline-block mt-1 mb-1 text-primary underline">📄 Abrir arquivo</a>;
}

// INDICADORES — quanto a equipe demora pra assumir, quanto resolve no 1º degrau, nota e o que mais aparece
const fmtMin = (m: number | null) => m == null ? "—" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
function Indicadores({ dealership }: { dealership?: string }) {
  const [dias, setDias] = useState(30);
  const { data: st, isLoading } = usePosvendaStats(true, dias, dealership);
  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Indicadores do atendimento</CardTitle>
        <div className="flex gap-1">
          {[30, 90].map((d) => <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} className="h-8" onClick={() => setDias(d)}>{d} dias</Button>)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !st ? <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : !st.total ? (
          <p className="text-sm text-muted-foreground">Ainda sem atendimentos nesse período.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Atendimentos</div><div className="text-xl font-bold">{st.total}</div><div className="text-[11px] text-muted-foreground">{st.encerrados} encerrados{st.vindos_do_nps ? ` · ${st.vindos_do_nps} de NPS baixo` : ""}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Tempo até assumir</div><div className="text-xl font-bold">{fmtMin(st.min_ate_assumir)}</div><div className="text-[11px] text-muted-foreground">média</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Assumidos pelo vendedor</div><div className="text-xl font-bold">{st.pct_primeiro_degrau == null ? "—" : `${st.pct_primeiro_degrau}%`}</div><div className="text-[11px] text-muted-foreground">sem precisar subir a escada</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Até encerrar</div><div className="text-xl font-bold">{st.horas_ate_encerrar == null ? "—" : `${st.horas_ate_encerrar} h`}</div><div className="text-[11px] text-muted-foreground">média</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Oportunidades ganhas</div><div className="text-xl font-bold">{st.oportunidades_ganhas}<span className="text-sm font-normal text-muted-foreground">/{st.oportunidades}</span></div><div className="text-[11px] text-muted-foreground">{st.oportunidades_valor ? st.oportunidades_valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "do pós-venda"}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Nota dos clientes</div><div className="text-xl font-bold flex items-center gap-1">{st.nota_media ?? "—"}{st.nota_media != null && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}</div><div className="text-[11px] text-muted-foreground">{st.qtd_notas} avaliações</div></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1.5">Por pessoa</div>
                {!st.por_pessoa.length ? <p className="text-sm text-muted-foreground">Ninguém assumiu ainda.</p> : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-[11px] text-muted-foreground text-left"><th className="font-medium">Quem</th><th className="font-medium">Casos</th><th className="font-medium">Assumiu em</th><th className="font-medium">Nota</th></tr></thead>
                    <tbody>{st.por_pessoa.map((p) => <tr key={p.nome} className="border-t"><td className="py-1">{p.nome}</td><td>{p.casos}</td><td>{fmtMin(p.min_ate_assumir)}</td><td>{p.nota_media ?? "—"}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1.5">O que os clientes mais pedem</div>
                <div className="space-y-1">
                  {st.por_motivo.map((m) => (
                    <div key={m.motivo} className="flex items-center gap-2 text-sm">
                      <span className="w-44 truncate">{m.motivo}</span>
                      <div className="flex-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.round(100 * m.n / st.total)}%` }} /></div>
                      <span className="w-6 text-right text-muted-foreground">{m.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// OPORTUNIDADES — nascem do pós-venda (garantia acabando, FIPE em queda, 1 ano de compra) e vão pro vendedor
const ST_OP: Record<string, { label: string; cls: string }> = {
  nova: { label: "Nova", cls: "bg-amber-500/15 text-amber-700" }, em_contato: { label: "Em contato", cls: "bg-sky-500/15 text-sky-700" },
  ganha: { label: "Ganha", cls: "bg-green-500/15 text-green-700" }, perdida: { label: "Perdida", cls: "bg-muted text-muted-foreground" },
};
function Oportunidades({ dealership }: { dealership?: string }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"abertas" | "todas">("abertas");
  const { data, isLoading } = usePosvendaOportunidades(true, filtro, dealership);
  const acao = usePosvendaAcao();
  const salvar = (id: string, campos: Record<string, unknown>) =>
    acao.mutate({ action: "posvenda_oportunidade_save", id, ...campos, ...(dealership ? { dealership } : {}) }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["posvenda-oport"] }); qc.invalidateQueries({ queryKey: ["posvenda-stats"] }); },
      onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
    });
  const ops = data?.oportunidades || [];
  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">💡 Oportunidades do pós-venda</CardTitle>
        <div className="flex gap-1">
          {(["abertas", "todas"] as const).map((f) => <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} className="h-8" onClick={() => setFiltro(f)}>{f === "abertas" ? "Abertas" : "Todas"}</Button>)}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">O Co-pilot cria sozinho e avisa o grupo, endereçado ao vendedor da venda: garantia acabando (vistoria / garantia estendida), FIPE caindo 2 meses seguidos (troca) e 1 ano de compra. Marque aqui o andamento.</p>
        {isLoading ? <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : !ops.length ? (
          <p className="text-sm text-muted-foreground">{filtro === "abertas" ? "Nenhuma oportunidade aberta agora." : "Nenhuma oportunidade ainda."}</p>
        ) : (
          <div className="divide-y">
            {ops.map((o) => (
              <div key={o.id} className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-sm font-bold">O{o.numero}</span>
                  <span className="font-medium">{o.customer_name || fmtTel(o.customer_phone)}</span>
                  {o.car_desc && <span className="text-sm text-muted-foreground">{o.car_desc}</span>}
                  <Badge className="border-0 bg-primary/10 text-primary">{data?.tipos?.[o.tipo] || o.tipo}</Badge>
                  <Badge className={`border-0 ${ST_OP[o.status]?.cls}`}>{ST_OP[o.status]?.label}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{o.vendedor_nome ? `para ${o.vendedor_nome} · ` : ""}{new Date(o.created_at).toLocaleDateString("pt-BR")} · <a className="underline" href={`tel:+${o.customer_phone}`}>{fmtTel(o.customer_phone)}</a></span>
                </div>
                {o.detalhe && <div className="text-sm text-muted-foreground">{o.detalhe}</div>}
                <div className="flex flex-wrap items-center gap-2">
                  <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={o.status} onChange={(e) => salvar(o.id, { status: e.target.value })}>
                    {Object.entries(ST_OP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {o.status === "ganha" && (
                    <Input className="h-8 w-36 text-xs" type="number" placeholder="Valor (R$)" defaultValue={o.valor ?? ""} onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== (o.valor || 0)) salvar(o.id, { valor: v }); }} />
                  )}
                  <Input className="h-8 flex-1 min-w-[180px] text-xs" placeholder="Anotação (ex.: ligou, vem sábado)" defaultValue={o.obs ?? ""} onBlur={(e) => { if (e.target.value !== (o.obs || "")) salvar(o.id, { obs: e.target.value }); }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// RESPOSTAS DA LOJA — perguntas que se repetem, com a resposta oficial; o Co-pilot responde sozinho
function RespostasLoja({ dealership }: { dealership?: string }) {
  const qc = useQueryClient();
  const { data: rs, isLoading } = usePosvendaRespostas(true, dealership);
  const acao = usePosvendaAcao();
  const [nova, setNova] = useState({ pergunta: "", resposta: "" });
  const [edit, setEdit] = useState<string | null>(null);
  const [ed, setEd] = useState({ pergunta: "", resposta: "" });
  const base = dealership ? { dealership } : {};
  const rodar = (action: string, payload: Record<string, unknown>, ok: string, depois?: () => void) =>
    acao.mutate({ action, ...base, ...payload }, {
      onSuccess: () => { toast({ title: ok }); qc.invalidateQueries({ queryKey: ["posvenda-respostas"] }); depois?.(); },
      onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
    });
  const exemplos = [
    ["Qual o horário da oficina?", "Segunda a sexta das 8h às 18h e sábado das 8h às 12h, na Rua …"],
    ["O que a garantia cobre?", "Motor e câmbio por 3 meses ou 3.000 km, o que vier primeiro. Não cobre itens de desgaste (pneus, freios, bateria)."],
    ["Quais documentos preciso pra transferência?", "RG e CPF, comprovante de residência e … A loja cuida da vistoria e do ATPV-e."],
  ];
  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" /> Respostas da loja (o Co-pilot responde sozinho)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Cadastre as perguntas que os clientes sempre fazem, com a resposta oficial da loja. O Co-pilot responde com elas na hora e só chama a equipe se o cliente ainda precisar de alguém. Vale só para os clientes que compraram na loja.</p>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <div className="divide-y rounded-md border">
            {!rs?.length && <div className="p-3 text-sm text-muted-foreground">Nenhuma resposta cadastrada ainda. Exemplos: {exemplos.map((e) => `"${e[0]}"`).join(", ")}.</div>}
            {(rs || []).map((r) => edit === r.id ? (
              <div key={r.id} className="p-3 space-y-2">
                <Input value={ed.pergunta} onChange={(e) => setEd((x) => ({ ...x, pergunta: e.target.value }))} />
                <Textarea rows={3} value={ed.resposta} onChange={(e) => setEd((x) => ({ ...x, resposta: e.target.value }))} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={acao.isPending} onClick={() => rodar("posvenda_resposta_save", { id: r.id, ...ed, ativo: r.ativo }, "Resposta atualizada", () => setEdit(null))}>Salvar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div key={r.id} className="p-3 flex items-start gap-2">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEdit(r.id); setEd({ pergunta: r.pergunta, resposta: r.resposta }); }}>
                  <div className={`text-sm font-medium ${r.ativo ? "" : "text-muted-foreground line-through"}`}>{r.pergunta}</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{r.resposta}</div>
                </div>
                <Switch checked={r.ativo} onCheckedChange={(v) => rodar("posvenda_resposta_save", { id: r.id, pergunta: r.pergunta, resposta: r.resposta, ativo: v }, v ? "Ativada" : "Desativada")} />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => { if (confirm("Apagar esta resposta?")) rodar("posvenda_resposta_del", { id: r.id }, "Apagada"); }}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <Input value={nova.pergunta} onChange={(e) => setNova((x) => ({ ...x, pergunta: e.target.value }))} placeholder={`Pergunta (ex.: ${exemplos[0][0]})`} />
          <Textarea rows={3} value={nova.resposta} onChange={(e) => setNova((x) => ({ ...x, resposta: e.target.value }))} placeholder={`Resposta oficial (ex.: ${exemplos[0][1]})`} />
          <Button size="sm" className="gap-1.5" disabled={acao.isPending || !nova.pergunta.trim() || !nova.resposta.trim()}
            onClick={() => rodar("posvenda_resposta_save", nova, "Resposta adicionada", () => setNova({ pergunta: "", resposta: "" }))}>
            <Plus className="w-4 h-4" /> Adicionar resposta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
