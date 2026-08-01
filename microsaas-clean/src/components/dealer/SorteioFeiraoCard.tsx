import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Gift, Trophy, ExternalLink, CheckCircle2, Camera, Store, CalendarPlus } from "lucide-react";
import { usePostsaleCreate, usePostsaleList, useDealerMe } from "@/hooks/useDealer";

// App do sorteio (feirao-cardoso/) — banco próprio no projeto TotexMotors OS, chave publishable (uso público).
const FEIRAO_URL = "https://fbgtqiqovwxccinbzvmx.supabase.co";
const FEIRAO_KEY = "sb_publishable_7FBkjLTMpozEHHcgucNA1g_xTNWsrfp";
const FEIRAO_APP_URL = "https://totexcar-copilot-s5zs.vercel.app";

interface Ganhador {
  posicao: number; voucher: string; nome: string; zap: string;
  insta: string | null; sorteado_em: string;
}
interface FeiraoLoja {
  id: string; nome: string; foto_url: string | null;
  whatsapp: string | null; instagram: string | null;
}
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

  // ação ativa da loja — os cadastros/ganhadores exibidos são sempre os dela
  const { data: evento } = useQuery({
    queryKey: ["feirao-evento", slug],
    queryFn: async () =>
      (await feirao<FeiraoEvento[]>(`feirao_eventos?select=*&loja=eq.${slug}&ativo=eq.true&order=criado_em.desc&limit=1`))[0] || null,
    enabled: !!lojaNome,
  });
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
  const [acao, setAcao] = useState({ titulo: "", premio: "1 ano grátis do TotexCar Co-pilot", ganhadores: "5", quando: "", tipo: "feirao" });

  // Link público de auto-cadastro: o cliente se inscreve sozinho (colar na bio/comentários da live ou virar QR no evento)
  const linkParticipar = appLink.includes("?") ? `${appLink}&participar=1` : `${appLink}/?participar=1`;
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkParticipar);
      toast({ title: "Link copiado! 🔗", description: "Cole na live do Instagram ou gere um QR code para o evento." });
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
          ativo: true,
        }),
      });
      if (!r.ok) throw new Error("Não foi possível criar a ação.");
      toast({ title: "Nova ação criada! 🎪", description: "O app do sorteio já está mostrando a nova data, prêmio e contagem zerada." });
      setNovaAcao(false);
      setAcao({ titulo: "", premio: "1 ano grátis do TotexCar Co-pilot", ganhadores: "5", quando: "" });
      qc.invalidateQueries({ queryKey: ["feirao-evento", slug] });
      qc.invalidateQueries({ queryKey: ["feirao-ganhadores", slug] });
      qc.invalidateQueries({ queryKey: ["feirao-total", slug] });
    } catch (e: any) {
      toast({ title: "Erro ao criar a ação", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSalvandoAcao(false);
    }
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
          <Button variant="outline" size="sm" className="gap-1.5 h-8" asChild>
            <a href={appLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" /> Abrir app do sorteio
            </a>
          </Button>
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

          {/* Link público: o cliente se cadastra sozinho (live do Instagram ou QR no evento) */}
          <div className="flex items-center gap-2 border-t pt-3">
            <p className="text-[12px] text-muted-foreground min-w-0 flex-1 truncate">
              🔗 Link de participação: <span className="font-mono">{linkParticipar}</span>
            </p>
            <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={copiarLink}>Copiar</Button>
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
      </CardContent>
    </Card>
  );
}

export default SorteioFeiraoCard;
