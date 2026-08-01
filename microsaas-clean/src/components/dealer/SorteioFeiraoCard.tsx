import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Gift, Trophy, ExternalLink, CheckCircle2, Camera, Store } from "lucide-react";
import { usePostsaleCreate, usePostsaleList, useDealerMe } from "@/hooks/useDealer";

// App do sorteio (feirao-cardoso/) — banco próprio no projeto TotexMotors OS, chave publishable (uso público).
const FEIRAO_URL = "https://fbgtqiqovwxccinbzvmx.supabase.co";
const FEIRAO_KEY = "sb_publishable_7FBkjLTMpozEHHcgucNA1g_xTNWsrfp";
const FEIRAO_APP_URL = "https://totexcar-copilot.vercel.app";

interface Ganhador {
  posicao: number; voucher: string; nome: string; zap: string;
  insta: string | null; sorteado_em: string;
}
interface FeiraoLoja {
  id: string; nome: string; foto_url: string | null;
  whatsapp: string | null; instagram: string | null;
}

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

  const { data: ganhadores, isLoading } = useQuery({
    queryKey: ["feirao-ganhadores", slug],
    queryFn: () => feirao<Ganhador[]>(`feirao_ganhadores?select=*&order=posicao.asc&loja=eq.${slug}`),
    refetchInterval: 60_000,
    enabled: !!lojaNome,
  });
  const { data: cadastros } = useQuery({
    queryKey: ["feirao-total", slug],
    queryFn: () => feirao<{ id: string }[]>(`feirao_cadastros?select=id&loja=eq.${slug}`),
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
