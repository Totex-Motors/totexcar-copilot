import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Radar, Loader2, MapPin, Phone, MessageCircle, Globe, Star, Clock,
  Truck, ShieldCheck, Info, Search, AlertTriangle, RotateCcw,
} from "lucide-react";
import { useRadar, SERVICOS, type RadarProvider } from "@/hooks/useRadar";

const MODOS = [
  { value: "balanced", label: "Melhor combinação" },
  { value: "nearest", label: "Mais perto" },
  { value: "best_rated", label: "Melhor avaliado" },
  { value: "open_now", label: "Aberto agora" },
  { value: "mobile_service", label: "Vai até mim" },
];

function ProviderCard({
  p, searchId, onAction,
}: {
  p: RadarProvider;
  searchId: string | null;
  onAction: (id: string, tipo: string) => void;
}) {
  const parceiro = p.provider_status === "parceiro_totex";
  const abrir = (url: string | null | undefined, tipo: string) => {
    if (!url) return;
    if (p.provider_id) onAction(p.provider_id, tipo);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="border-0 shadow-premium-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{p.name}</h3>
              {parceiro ? (
                <Badge className="bg-primary/15 text-primary border-0 shrink-0">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Parceiro Totex
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground shrink-0">Resultado público</Badge>
              )}
            </div>
            {p.address && (
              <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {p.address}
              </p>
            )}
          </div>
          {p.distance_km != null && (
            <span className="text-sm font-medium text-primary shrink-0">{p.distance_km} km</span>
          )}
        </div>

        {/* Sinais objetivos. O que não veio na busca simplesmente não aparece —
            nada de placeholder que pareça informação. */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          {p.rating != null && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <strong className="text-foreground">{p.rating.toFixed(1)}</strong>
              {p.review_count != null && <span>({p.review_count})</span>}
            </span>
          )}
          {p.open_now === true && <span className="flex items-center gap-1 text-emerald-600"><Clock className="w-3 h-3" /> Aberto agora</span>}
          {p.open_24h && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 24 horas</span>}
          {p.mobile_service && <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Vai até você</span>}
        </div>

        {p.matched_reasons?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {p.matched_reasons.slice(0, 3).map((r, i) => (
              <span key={i} className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{r}</span>
            ))}
          </div>
        )}

        <div className="flex gap-2 flex-wrap pt-1">
          {p.maps_uri && (
            <Button size="sm" variant="outline" onClick={() => abrir(p.maps_uri, "opened_route")}>
              <MapPin className="w-3.5 h-3.5 mr-1.5" /> Rota
            </Button>
          )}
          {p.call_uri && (
            <Button size="sm" variant="outline" onClick={() => abrir(p.call_uri, "opened_phone")}>
              <Phone className="w-3.5 h-3.5 mr-1.5" /> Ligar
            </Button>
          )}
          {p.whatsapp_uri && (
            <Button size="sm" onClick={() => abrir(p.whatsapp_uri, "opened_whatsapp")}>
              <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
            </Button>
          )}
          {p.website_uri && (
            <Button size="sm" variant="ghost" onClick={() => abrir(p.website_uri, "opened_website")}>
              <Globe className="w-3.5 h-3.5 mr-1.5" /> Site
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Servicos() {
  const { loading, result, buscar, registrarAcao, setResult } = useRadar();
  const [form, setForm] = useState({ service_type: "oficina", location_text: "", mode: "balanced" });

  const servicoAtual = SERVICOS.find((s) => s.value === form.service_type);

  const rodar = async () => {
    await buscar({
      service_type: form.service_type,
      location_text: form.location_text || undefined,
      mode: form.mode,
      emergency: servicoAtual?.emergencia,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radar className="w-6 h-6 text-primary" /> Radar de Serviços
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Oficina, borracharia, guincho, chaveiro — a gente procura, compara e mostra as opções.
            <strong> Você escolhe.</strong> Sem intermediário e sem empurrar ninguém.
          </p>
        </div>

        <Card className="border-0 shadow-premium-md">
          <CardHeader className="pb-2"><CardTitle className="text-base">Do que você precisa?</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Serviço</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm((p) => ({ ...p, service_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICOS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}{s.emergencia ? " ⚡" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Onde</Label>
                <Input
                  value={form.location_text}
                  onChange={(e) => setForm((p) => ({ ...p, location_text: e.target.value }))}
                  placeholder="Cidade ou bairro (ex.: Barueri)"
                  onKeyDown={(e) => e.key === "Enter" && rodar()}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ordenar por</Label>
              <Select value={form.mode} onValueChange={(v) => setForm((p) => ({ ...p, mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {servicoAtual?.emergencia && (
              <div className="flex gap-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Se o carro está parado na via, saia do veículo pelo lado seguro, fique atrás da barreira
                  e sinalize com o triângulo <strong>antes</strong> de resolver o resto.
                </p>
              </div>
            )}

            <Button onClick={rodar} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procurando…</> : <><Search className="w-4 h-4 mr-2" /> Procurar</>}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{result.total}</strong> {result.total === 1 ? "opção" : "opções"} de{" "}
                {result.service_label.toLowerCase()}
                {result.location_text ? ` em ${result.location_text}` : ""}
                {result.cache && " · resultados recentes"}
              </p>
              <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Nova busca
              </Button>
            </div>

            {result.raio_ampliado && (
              <p className="text-xs text-muted-foreground">
                Não encontrei nada perto, então ampliei a busca para {result.raio_ampliado} km.
              </p>
            )}

            {result.providers.map((p) => (
              <ProviderCard
                key={p.provider_id || `${p.name}-${p.rank_position}`}
                p={p}
                searchId={result.search_id}
                onAction={(id, tipo) => registrarAcao(id, tipo, result.search_id)}
              />
            ))}

            {result.total === 0 && (
              <Card className="border-0 shadow-premium-sm">
                <CardContent className="p-6 text-center space-y-2">
                  <p className="font-medium">Não achei nada confiável por aqui</p>
                  <p className="text-sm text-muted-foreground">
                    Prefiro não mostrar resultado duvidoso. Tente outra região ou uma categoria parecida —
                    ou chame o Co-pilot no WhatsApp que a gente procura junto.
                  </p>
                </CardContent>
              </Card>
            )}

            {result.total > 0 && (
              <p className="text-[11px] text-muted-foreground flex gap-1.5 items-start leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {result.disclaimer}
              </p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
