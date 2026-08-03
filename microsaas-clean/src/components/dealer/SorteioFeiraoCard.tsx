import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Gift, Trophy, ExternalLink, CheckCircle2, Camera, Store, CalendarPlus, Zap, BarChart3 } from "lucide-react";
import { usePostsaleCreate, usePostsaleList, useDealerMe } from "@/hooks/useDealer";

// App do sorteio (feirao-cardoso/) — banco próprio no projeto TotexMotors OS, chave publishable (uso público).
const FEIRAO_URL = "https://fbgtqiqovwxccinbzvmx.supabase.co";
const FEIRAO_KEY = "sb_publishable_7FBkjLTMpozEHHcgucNA1g_xTNWsrfp";
const FEIRAO_APP_URL = "https://totexcar-copilot-s5zs.vercel.app";

interface Ganhador {
  posicao: number; voucher: string; nome: string; zap: string;
  insta: string | null; sorteado_em: string;
}
interface AutoEtapa { on: boolean; dias?: number; msg: string }
interface AutoCfg { pos1: AutoEtapa; pos2: AutoEtapa; vip: AutoEtapa }
interface FeiraoLoja {
  id: string; nome: string; foto_url: string | null;
  whatsapp: string | null; instagram: string | null;
  automacao?: Partial<AutoCfg> | null;
}

// Defaults das automações — cada loja ajusta prazos e textos do seu jeito ({nome}, {acao}, {quando})
const AUTO_DEFAULT: AutoCfg = {
  pos1: { on: false, dias: 1, msg: "Você participou do nosso sorteio e não foi sorteado dessa vez… mas tem prêmio de consolação: condição especial esta semana no carro que você procura. Responda esta mensagem que te atendo agora! 🚗" },
  pos2: { on: false, dias: 7, msg: "Ainda procurando seu próximo carro? Chegaram novidades no estoque — me conta o que você procura que eu te mando as melhores opções. 😉" },
  vip: { on: false, msg: "Você é cliente especial da loja e já está convidado para {acao}! Sorteio {quando}. Vem participar! 🎉" },
};
interface FeiraoEvento {
  id: string; loja: string; titulo: string; premio: string;
  ganhadores: number; sorteio_em: string; ativo: boolean; tipo?: string;
}

const TIPOS: Record<string, { rotulo: string; icone: string }> = {
  feirao: { rotulo: "Feirão na loja", icone: "🎪" },
  live: { rotulo: "Live no Instagram", icone: "📱" },
  promocao: { rotulo: "Promoção", icone: "🏷️" },
};

const HEADERS = { apikey: FEIRAO_KEY, Authorization: `Bearer ${FEIRAO_KEY}` };

async function feirao<T>(path: string): Promise<T> {
  const r = await fetch(`${FEIRAO_URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!r.ok) throw new Error("Não foi possível consultar o app do sorteio.");
  return r.json();
}

// Cada loja parceira vira um "tenant" do app de sorteio: slug estável derivado do nome da loja.
function slugify(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "loja";
}

// Telefones vêm em formatos diferentes dos dois lados — compara só os dígitos, sem o DDI 55.
function fone(s: string | null | undefined): string {
  let d = String(s || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  return d;
}

export function SorteioFeiraoCard({ dealership }: { dealership?: string }) {
  const qc = useQueryClient();
  const create = usePostsaleCreate();
  const { data: meData } = useDealerMe(true);
  const { data: journeys } = usePostsaleList(true, dealership);
  const [ativando, setAtivando] = useState<string | null>(null); // voucher em andamento ("*" = todos)
  const [subindo, setSubindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const lojaNome = dealership || meData?.dealership || "";
  // A Cardoso é a loja original do app (dados antigos sem coluna loja) — slug fixo pra casar com o histórico.
  const slug = /cardoso/i.test(lojaNome) ? "cardoso" : slugify(lojaNome);
  const appLink = slug === "cardoso" ? FEIRAO_APP_URL : `${FEIRAO_APP_URL}/?loja=${slug}`;

  // TODAS as ações da loja (histórico preservado) — a exibida por padrão é a ativa,
  // mas o lojista pode navegar pelas anteriores sem perder nada
  const { data: eventos } = useQuery({
    queryKey: ["feirao-eventos", slug],
    queryFn: () => feirao<FeiraoEvento[]>(`feirao_eventos?select=*&loja=eq.${slug}&order=criado_em.desc&limit=20`),
    enabled: !!lojaNome,
  });
  const eventoAtivo = (eventos || []).find((e) => e.ativo) || null;
  const [eventoSelId, setEventoSelId] = useState<string | null>(null);
  const evento = (eventos || []).find((e) => e.id === eventoSelId) || eventoAtivo;
  const fEvento = evento ? `&evento_id=eq.${evento.id}` : "";

  const { data: ganhadores, isLoading } = useQuery({
    queryKey: ["feirao-ganhadores", slug, evento?.id || null],
    queryFn: () => feirao<Ganhador[]>(`feirao_ganhadores?select=*&order=posicao.asc&loja=eq.${slug}${fEvento}`),
    refetchInterval: 60_000,
    enabled: !!lojaNome,
  });
  const { data: cadastros } = useQuery({
    queryKey: ["feirao-total", slug, evento?.id || null],
    queryFn: () => feirao<{ id: string }[]>(`feirao_cadastros?select=id&loja=eq.${slug}${fEvento}`),
    enabled: !!lojaNome,
  });
  const { data: lojaCfg } = useQuery({
    queryKey: ["feirao-loja", slug],
    queryFn: async () => (await feirao<FeiraoLoja[]>(`feirao_lojas?select=*&id=eq.${slug}`))[0] || null,
    enabled: !!lojaNome,
  });

  const jaAtivado = (g: Ganhador) =>
    (journeys || []).some((j) => j.sponsored && fone(j.customer_phone) === fone(g.zap));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["postsale-list"] });
    qc.invalidateQueries({ queryKey: ["postsale-stats"] });
  };

  const ativar = async (g: Ganhador) => {
    setAtivando(g.voucher);
    try {
      const r: any = await create.mutateAsync({
        customer_name: g.nome,
        customer_phone: fone(g.zap),
        car_desc: undefined,
        cortesia: true,
        dealership: dealership || undefined,
      });
      toast({
        title: `Prêmio ativado — ${g.nome.split(" ")[0]} 🏆`,
        description: r?.welcome_sent
          ? "Conta premium de 1 ano criada e boas-vindas enviadas no WhatsApp."
          : "Conta premium de 1 ano criada (WhatsApp não enviou — confira as credenciais).",
      });
      refresh();
    } catch (e: any) {
      toast({ title: `Falhou para ${g.nome}`, description: String(e?.message || e), variant: "destructive" });
    } finally {
      setAtivando(null);
    }
  };

  const pendentes = (ganhadores || []).filter((g) => !jaAtivado(g));

  const ativarTodos = async () => {
    setAtivando("*");
    for (const g of pendentes) {
      // sequencial de propósito: cada ativação cria conta + envia WhatsApp
      // eslint-disable-next-line no-await-in-loop
      await ativar(g);
    }
    setAtivando(null);
  };

  // Nova ação de feirão/sorteio: título, prêmio, nº de ganhadores e data/hora — o app se adapta sozinho.
  const [novaAcao, setNovaAcao] = useState(false);
  const [salvandoAcao, setSalvandoAcao] = useState(false);
  const [acao, setAcao] = useState({ titulo: "", premio: "1 ano grátis do TotexCar Co-pilot", ganhadores: "5", quando: "", tipo: "feirao", beneficios: "" });

  // Link público de auto-cadastro, ETIQUETADO POR CANAL: cada mídia usa seu link
  // (lista de marketing, bio, live...) e os cadastros não se misturam com os do balcão.
  const [canalLink, setCanalLink] = useState("lista");
  const canalSlug = canalLink.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) || "link";
  const linkParticipar = (appLink.includes("?") ? `${appLink}&participar=1` : `${appLink}/?participar=1`)
    + `&canal=${canalSlug}`;
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkParticipar);
      toast({ title: `Link do canal "${canalSlug}" copiado! 🔗`, description: "Cada canal com seu link — o relatório separa tudo." });
    } catch {
      toast({ title: "Copie manualmente", description: linkParticipar });
    }
  };

  const criarAcao = async () => {
    if (!acao.quando) {
      toast({ title: "Informe a data e hora do sorteio", variant: "destructive" });
      return;
    }
    setSalvandoAcao(true);
    try {
      // encerra a ação ativa anterior (o histórico fica guardado no banco)
      await fetch(`${FEIRAO_URL}/rest/v1/feirao_eventos?loja=eq.${slug}&ativo=eq.true`, {
        method: "PATCH",
        headers: { ...HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: false }),
      });
      const r = await fetch(`${FEIRAO_URL}/rest/v1/feirao_eventos`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          loja: slug,
          tipo: acao.tipo,
          titulo: acao.titulo.trim() || `${TIPOS[acao.tipo]?.rotulo || "Feirão"} ${lojaNome}`,
          premio: acao.premio.trim() || "1 ano grátis do TotexCar Co-pilot",
          ganhadores: Math.min(100, Math.max(1, Number(acao.ganhadores) || 5)),
          sorteio_em: new Date(acao.quando).toISOString(),
          beneficios: acao.beneficios.split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 12),
          ativo: true,
        }),
      });
      if (!r.ok) throw new Error("Não foi possível criar a ação.");
      toast({ title: "Nova ação criada! 🎪", description: "O app já mostra a nova ação — as anteriores ficam no Histórico deste card." });
      setNovaAcao(false);
      setEventoSelId(null);
      setAcao({ titulo: "", premio: "1 ano grátis do TotexCar Co-pilot", ganhadores: "5", quando: "", tipo: "feirao", beneficios: "" });
      qc.invalidateQueries({ queryKey: ["feirao-eventos", slug] });
      qc.invalidateQueries({ queryKey: ["feirao-ganhadores", slug] });
      qc.invalidateQueries({ queryKey: ["feirao-total", slug] });
      qc.invalidateQueries({ queryKey: ["feirao-relatorio", slug] });
    } catch (e: any) {
      toast({ title: "Erro ao criar a ação", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSalvandoAcao(false);
    }
  };

  // Automações configuráveis (pós-ação + convite VIP) — o cron diário feirao-automacao lê essa config
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoCfg, setAutoCfg] = useState<AutoCfg>(AUTO_DEFAULT);
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  useEffect(() => {
    const a = lojaCfg?.automacao;
    if (a) setAutoCfg({
      pos1: { ...AUTO_DEFAULT.pos1, ...(a.pos1 || {}) },
      pos2: { ...AUTO_DEFAULT.pos2, ...(a.pos2 || {}) },
      vip: { ...AUTO_DEFAULT.vip, ...(a.vip || {}) },
    });
  }, [lojaCfg]);

  const salvarAuto = async () => {
    setSalvandoAuto(true);
    try {
      const r = await fetch(`${FEIRAO_URL}/rest/v1/feirao_lojas`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ id: slug, nome: lojaNome, automacao: autoCfg }),
      });
      if (!r.ok) throw new Error("Não foi possível salvar.");
      toast({ title: "Automações salvas ⚡", description: "O robô roda todo dia às 11:00 e segue exatamente esta configuração." });
      qc.invalidateQueries({ queryKey: ["feirao-loja", slug] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar automações", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSalvandoAuto(false);
    }
  };

  const setEtapa = (k: keyof AutoCfg, patch: Partial<AutoEtapa>) =>
    setAutoCfg((p) => ({ ...p, [k]: { ...p[k], ...patch } }));

  // Relatório da ação: de onde vieram os participantes e o que procuram
  const { data: relatorio } = useQuery({
    queryKey: ["feirao-relatorio", slug, evento?.id || null],
    queryFn: () => feirao<{ origem: string | null; interesse: string | null; cliente: string | null; canal: string | null; chegou_em: string | null }[]>(
      `feirao_cadastros?select=origem,interesse,cliente,canal,chegou_em&loja=eq.${slug}${fEvento}`),
    enabled: !!lojaNome && !!(cadastros?.length),
  });
  const contagem = (campo: "origem" | "interesse" | "cliente") => {
    const m: Record<string, number> = {};
    (relatorio || []).forEach((r) => { const v = r[campo] || "—"; m[v] = (m[v] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  // Foto da fachada: sobe pro storage público do app de sorteio e grava na config da loja.
  const subirFachada = async (file: File) => {
    setSubindo(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${slug}/fachada-${Date.now()}.${ext}`;
      const up = await fetch(`${FEIRAO_URL}/storage/v1/object/feirao/${path}`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!up.ok) throw new Error("Falha ao enviar a foto.");
      const fotoUrl = `${FEIRAO_URL}/storage/v1/object/public/feirao/${path}`;
      const save = await fetch(`${FEIRAO_URL}/rest/v1/feirao_lojas`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ id: slug, nome: lojaNome, foto_url: fotoUrl }),
      });
      if (!save.ok) throw new Error("Foto enviada, mas não foi possível salvar a configuração.");
      toast({ title: "Fachada atualizada! 📸", description: "O app do sorteio e a página do voucher já mostram a foto da sua loja." });
      qc.invalidateQueries({ queryKey: ["feirao-loja", slug] });
    } catch (e: any) {
      toast({ title: "Não foi possível atualizar a fachada", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSubindo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Sorteio do Feirão — TotexCar Co-pilot</span>
          <span className="flex gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 h-8" asChild>
              <a href={`${FEIRAO_APP_URL}/guia.html`} target="_blank" rel="noopener noreferrer">📖 Guia</a>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8" asChild>
              <a href={appLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Abrir app do sorteio
              </a>
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ação atual + criar nova ação (data/hora, prêmio e nº de ganhadores) */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {evento ? (
                <>
                  <p className="text-sm font-medium truncate">
                    {TIPOS[evento.tipo || "feirao"]?.icone} {evento.titulo}
                    <Badge className="ml-2 bg-primary/15 text-primary align-middle">{TIPOS[evento.tipo || "feirao"]?.rotulo}</Badge>
                    {!evento.ativo && <Badge className="ml-1.5 bg-amber-500/15 text-amber-600 align-middle">Encerrada — histórico</Badge>}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Sorteio {new Date(evento.sorteio_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {" · "}{evento.ganhadores} ganhador{evento.ganhadores > 1 ? "es" : ""} · {evento.premio}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma ação configurada — o app usa o padrão (hoje 18:00, 5 ganhadores).</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 shrink-0" onClick={() => setNovaAcao((v) => !v)}>
              <CalendarPlus className="w-3.5 h-3.5" /> Nova ação
            </Button>
          </div>

          {/* Histórico: nenhuma ação se perde — navegue pelas anteriores (participantes, relatório e ganhadores) */}
          {(eventos?.length || 0) > 1 && (
            <div className="flex items-center gap-2 border-t pt-2">
              <span className="text-[11px] font-medium text-muted-foreground shrink-0">📚 Histórico de ações:</span>
              <select
                className="border rounded-md px-2 py-1 text-xs bg-background flex-1 min-w-0"
                value={evento?.id || ""}
                onChange={(e) => setEventoSelId(e.target.value)}
              >
                {eventos!.map((e) => (
                  <option key={e.id} value={e.id}>
                    {TIPOS[e.tipo || "feirao"]?.icone} {e.titulo} · {new Date(e.sorteio_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{e.ativo ? " (ativa)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Link público etiquetado: um link por canal (lista de marketing, bio, live...) */}
          <div className="border-t pt-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-medium">🔗 Link de participação — canal:</span>
              {["lista", "bio", "live", "facebook"].map((c) => (
                <Button key={c} type="button" size="sm" variant={canalSlug === c ? "default" : "outline"}
                  className="h-6 px-2 text-[11px]" onClick={() => setCanalLink(c)}>{c}</Button>
              ))}
              <Input className="w-24 h-6 text-[11px]" placeholder="outro…" value={canalLink}
                onChange={(e) => setCanalLink(e.target.value)} />
              <Button variant="outline" size="sm" className="h-7 shrink-0 ml-auto" onClick={copiarLink}>Copiar</Button>
            </div>
            <p className="text-[11px] text-muted-foreground truncate font-mono">{linkParticipar}</p>
            <p className="text-[11px] text-muted-foreground">
              Cadastros do balcão entram como <b>loja</b>; cada link marca seu canal — o relatório e a planilha separam tudo,
              e a promotora confirma com "✓ Chegou na loja" quem veio por causa do link.
            </p>
          </div>

          {novaAcao && (
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Tipo de ação</Label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(TIPOS).map(([k, t]) => (
                    <Button key={k} type="button" size="sm" variant={acao.tipo === k ? "default" : "outline"}
                      onClick={() => setAcao((p) => ({ ...p, tipo: k }))}>
                      {t.icone} {t.rotulo}
                    </Button>
                  ))}
                </div>
                {acao.tipo === "live" && (
                  <p className="text-[11px] text-muted-foreground">
                    Na live, compartilhe o link de participação acima — o espectador se cadastra sozinho e a origem já entra como "Live Instagram".
                  </p>
                )}
              </div>
              <div className="space-y-1 col-span-2 md:col-span-1">
                <Label className="text-xs">Nome da ação</Label>
                <Input value={acao.titulo} onChange={(e) => setAcao((p) => ({ ...p, titulo: e.target.value }))} placeholder={`Ex.: Feirão ${lojaNome || "da loja"}`} />
              </div>
              <div className="space-y-1 col-span-2 md:col-span-1">
                <Label className="text-xs">Data e hora do sorteio</Label>
                <Input type="datetime-local" value={acao.quando} onChange={(e) => setAcao((p) => ({ ...p, quando: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2 md:col-span-1">
                <Label className="text-xs">Prêmio</Label>
                <Input value={acao.premio} onChange={(e) => setAcao((p) => ({ ...p, premio: e.target.value }))} placeholder="1 ano grátis do TotexCar Co-pilot" />
              </div>
              <div className="space-y-1 max-w-[140px]">
                <Label className="text-xs">Nº de ganhadores</Label>
                <Input type="number" min={1} max={100} value={acao.ganhadores} onChange={(e) => setAcao((p) => ({ ...p, ganhadores: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Benefícios do feirão (um por linha — aparecem no link público como a lista da ação)</Label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm bg-background min-h-[90px]"
                  placeholder={"Taxa zero no financiamento\nAvaliação acima da FIPE\nPrimeira parcela para 90 dias\n…"}
                  value={acao.beneficios}
                  onChange={(e) => setAcao((p) => ({ ...p, beneficios: e.target.value }))}
                />
              </div>
              <div className="col-span-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">Criar uma nova ação zera a lista do app (os dados das ações anteriores ficam guardados no banco).</p>
                <Button size="sm" className="gap-1.5 shrink-0" disabled={salvandoAcao} onClick={criarAcao}>
                  {salvandoAcao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />} Criar ação
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Personalização: foto da fachada da loja no app e no voucher do cliente */}
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
          {lojaCfg?.foto_url ? (
            <img src={lojaCfg.foto_url} alt={`Fachada ${lojaNome}`} className="w-20 h-14 rounded-md object-cover shrink-0" />
          ) : (
            <div className="w-20 h-14 rounded-md bg-muted flex items-center justify-center shrink-0"><Store className="w-6 h-6 text-muted-foreground" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Foto da fachada da loja</p>
            <p className="text-[12px] text-muted-foreground">Personaliza o app do sorteio e o voucher que o cliente recebe no WhatsApp.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && subirFachada(e.target.files[0])} />
          <Button variant="outline" size="sm" className="gap-1.5 h-8 shrink-0" disabled={subindo} onClick={() => fileRef.current?.click()}>
            {subindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {lojaCfg?.foto_url ? "Trocar foto" : "Enviar foto"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : !ganhadores?.length ? (
          <p className="text-sm text-muted-foreground">
            Sorteio ainda sem resultado{cadastros?.length ? ` — ${cadastros.length} participante(s) cadastrados até agora` : ""}.
            Faça o sorteio no app e os 5 ganhadores aparecem aqui para ativar o prêmio.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {cadastros?.length ? `${cadastros.length} participantes · ` : ""}Ativar o prêmio cria a conta premium
              de 1 ano (mesmo fluxo da cortesia) e envia as boas-vindas no WhatsApp do ganhador.
            </p>
            <div className="divide-y divide-border">
              {ganhadores.map((g) => {
                const ok = jaAtivado(g);
                return (
                  <div key={g.posicao} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">{g.posicao}º</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{g.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[g.voucher, g.zap, g.insta].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                    {ok ? (
                      <Badge className="gap-1 bg-green-500/15 text-green-600 shrink-0"><CheckCircle2 className="w-3 h-3" /> Prêmio ativado</Badge>
                    ) : (
                      <Button size="sm" className="gap-1.5 h-8 shrink-0" disabled={ativando !== null} onClick={() => ativar(g)}>
                        {ativando === g.voucher ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                        Ativar 1 ano grátis
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            {pendentes.length > 1 && (
              <Button variant="outline" className="gap-1.5" disabled={ativando !== null} onClick={ativarTodos}>
                {ativando === "*" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                Ativar os {pendentes.length} pendentes
              </Button>
            )}
          </>
        )}

        {/* Relatório da ação: qual canal trouxe gente e o que o público procura */}
        {!!relatorio?.length && (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-primary" /> Relatório da ação · {relatorio.length} participantes</p>
            {(() => {
              const remotos = relatorio.filter((r) => r.canal && r.canal !== "loja");
              if (!remotos.length) return null;
              const naLoja = relatorio.length - remotos.length;
              const vieram = remotos.filter((r) => r.chegou_em).length;
              const porCanal: Record<string, number> = {};
              remotos.forEach((r) => { porCanal[r.canal!] = (porCanal[r.canal!] || 0) + 1; });
              return (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5 text-[12px] space-y-0.5">
                  <p>🏬 Cadastrados <b>na loja</b>: <b>{naLoja}</b> · 🔗 <b>pelo link</b>: <b>{remotos.length}</b>
                    {" "}({Object.entries(porCanal).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}: ${n}`).join(" · ")})</p>
                  <p>✓ Do link que <b>vieram à loja</b>: <b className="text-green-600">{vieram}</b>
                    {remotos.length ? <span className="text-muted-foreground"> — conversão de {Math.round((vieram / remotos.length) * 100)}% da campanha</span> : null}</p>
                </div>
              );
            })()}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
              <div>
                <p className="font-medium text-muted-foreground mb-1">Onde viu</p>
                {contagem("origem").map(([k, n]) => (
                  <div key={k} className="flex items-center gap-2 py-0.5">
                    <span className="w-28 truncate">{k}</span>
                    <div className="flex-1 h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.round((n / relatorio.length) * 100)}%` }} /></div>
                    <span className="w-8 text-right font-medium">{n}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Interesse</p>
                {contagem("interesse").map(([k, n]) => <p key={k} className="py-0.5">{k}: <strong>{n}</strong></p>)}
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Já é cliente</p>
                {contagem("cliente").map(([k, n]) => <p key={k} className="py-0.5">{k}: <strong>{n}</strong></p>)}
              </div>
            </div>
          </div>
        )}

        {/* Automações configuráveis por loja (cron diário 11:00) */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5"><Zap className="w-4 h-4 text-primary" /> Automações da ação</p>
              <p className="text-[12px] text-muted-foreground">
                Mensagens automáticas no WhatsApp: consolação pra quem não ganhou e convite VIP.
                {" "}{(autoCfg.pos1.on || autoCfg.pos2.on || autoCfg.vip.on) ? "Ativas ✅" : "Desligadas"}
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setAutoOpen((v) => !v)}>
              {autoOpen ? "Fechar" : "Configurar"}
            </Button>
          </div>

          {autoOpen && (
            <div className="space-y-3 border-t pt-3">
              {([
                ["pos1", "1ª mensagem pós-sorteio (quem não ganhou)", true],
                ["pos2", "2ª mensagem de follow-up", true],
                ["vip", "Convite VIP da próxima ação (clientes Selo Prata/Ouro)", false],
              ] as Array<[keyof AutoCfg, string, boolean]>).map(([k, titulo, temDias]) => (
                <div key={k} className="rounded-lg border border-dashed p-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={autoCfg[k].on} onCheckedChange={(v) => setEtapa(k, { on: v === true })} />
                    <span className="text-sm font-medium">{titulo}</span>
                    {temDias && (
                      <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        enviar <Input type="number" min={0} max={30} className="w-16 h-7 text-center"
                          value={String(autoCfg[k].dias ?? 1)}
                          onChange={(e) => setEtapa(k, { dias: Number(e.target.value) })} /> dia(s) após o sorteio
                      </span>
                    )}
                  </label>
                  <Textarea rows={2} value={autoCfg[k].msg} onChange={(e) => setEtapa(k, { msg: e.target.value })} />
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Variáveis: {"{nome}"} — e no convite VIP também {"{acao}"} e {"{quando}"}. O robô roda todo dia às 11:00,
                  nunca envia duas vezes pra mesma pessoa e quem responder SAIR deixa de receber.
                  A renovação da cortesia (30/15/7/1 dias antes de vencer) já é automática pra todas as lojas.
                </p>
                <Button size="sm" className="gap-1.5 shrink-0" disabled={salvandoAuto} onClick={salvarAuto}>
                  {salvandoAuto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Salvar automações
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SorteioFeiraoCard;
