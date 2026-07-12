import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { QRCodeSVG } from "qrcode.react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Cpu, BatteryCharging, Gauge, Zap, MapPin, Link2, Loader2, Copy, Smartphone,
  Car, Unlink, RefreshCw, Route, DoorOpen, Power,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { useCarLink, useCreatePair, useUnlinkCar, useCarEvents, type PairInfo } from "@/hooks/useCarLink";
import { toast } from "@/hooks/use-toast";

const carIcon = L.divIcon({
  className: "",
  html: `<div style="background:hsl(176 80% 40%);width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);border:2px solid #fff"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></div>`,
  iconSize: [30, 30], iconAnchor: [15, 30],
});
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useMemo(() => { map.setView([lat, lng], map.getZoom() < 13 ? 15 : map.getZoom()); }, [lat, lng]); // eslint-disable-line
  return null;
}

const EVENT_ICON: Record<string, any> = { door: DoorOpen, ignition: Power, trip_start: Route, trip_end: Route };

export default function CarroConectado() {
  const { userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data, isFetching, refetch } = useCarLink(userId);
  const { data: events } = useCarEvents(data?.linked ? vehicle?.id : null);
  const createPair = useCreatePair();
  const unlink = useUnlinkCar();
  const [pair, setPair] = useState<PairInfo | null>(null);

  const link = data?.link;
  const connected = link?.status === "connected";
  const st = link?.last_state;
  const hasPos = st?.lat != null && st?.lng != null;

  const copy = (txt: string, label: string) => {
    navigator.clipboard?.writeText(txt).then(
      () => toast({ title: `${label} copiado!` }),
      () => toast({ title: "Não consegui copiar", variant: "destructive" }),
    );
  };

  const gerarPareamento = () => {
    createPair.mutate(undefined, {
      onSuccess: (p) => setPair(p),
      onError: (e: any) => toast({ title: "Erro ao gerar pareamento", description: String(e?.message || e), variant: "destructive" }),
    });
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Cpu className="w-7 h-7 text-primary" /> Carro Conectado</h1>
            <p className="text-muted-foreground">Telemetria do seu carro em tempo real, direto da tela do veículo — sem aparelho, sem instalação de fios.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        {/* NÃO conectado → pareamento */}
        {!connected && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /> Conectar meu carro</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li><strong className="text-foreground">Instale o TotexCar Link</strong> na tela do seu carro (app do veículo) — passo a passo enviado na ativação.</li>
                <li>Abra o app no carro e escaneie o <strong className="text-foreground">QR Code</strong> abaixo (ou digite o código).</li>
                <li>Pronto! A telemetria começa a aparecer aqui automaticamente.</li>
              </ol>

              {!pair ? (
                <Button onClick={gerarPareamento} disabled={createPair.isPending || !vehicle}>
                  {createPair.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Smartphone className="w-4 h-4 mr-2" />}
                  {link?.status === "pending" ? "Gerar novo pareamento" : "Gerar pareamento"}
                </Button>
              ) : (
                <div className="rounded-xl border p-5 flex flex-col sm:flex-row items-center gap-5 bg-muted/30">
                  <div className="bg-white p-3 rounded-lg shrink-0"><QRCodeSVG value={pair.qr} size={148} /></div>
                  <div className="space-y-3 min-w-0">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Código de pareamento</p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-2xl font-bold tracking-widest">{pair.pair_code}</span>
                        <Button variant="ghost" size="icon" onClick={() => copy(pair.token, "Token")} title="Copiar token"><Copy className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Escaneie o QR no app do carro. Se preferir digitar, cole o <button onClick={() => copy(pair.token, "Token")} className="underline text-primary">token</button> na configuração do TotexCar Link.
                    </p>
                    {link?.status === "pending" && <Badge className="bg-warning/15 text-warning">Aguardando o carro conectar…</Badge>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Conectado → painel ao vivo */}
        {connected && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-green-500/15 text-green-600 gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Conectado</Badge>
              {link?.device_label && <Badge variant="outline"><Car className="w-3.5 h-3.5 mr-1" />{link.device_label}</Badge>}
              {link?.last_seen && <span className="text-xs text-muted-foreground">Atualizado {new Date(link.last_seen).toLocaleTimeString("pt-BR")}</span>}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card><CardContent className="py-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><BatteryCharging className="w-3.5 h-3.5" /> Bateria</div>
                <div className="text-2xl font-bold">{st?.battery_pct != null ? `${Math.round(st.battery_pct)}%` : "—"}</div>
                {st?.range_km != null && <div className="text-xs text-muted-foreground">~{Math.round(st.range_km)} km de autonomia</div>}
              </CardContent></Card>
              <Card><CardContent className="py-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Gauge className="w-3.5 h-3.5" /> Velocidade</div>
                <div className="text-2xl font-bold">{st?.speed != null ? `${Math.round(st.speed)}` : "0"} <span className="text-sm font-normal">km/h</span></div>
              </CardContent></Card>
              <Card><CardContent className="py-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Zap className="w-3.5 h-3.5" /> Potência</div>
                <div className="text-2xl font-bold">{st?.power_kw != null ? `${Math.round(st.power_kw)}` : "—"} <span className="text-sm font-normal">kW</span></div>
              </CardContent></Card>
              <Card><CardContent className="py-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Car className="w-3.5 h-3.5" /> Hodômetro</div>
                <div className="text-2xl font-bold">{st?.odometer != null ? `${Math.round(st.odometer).toLocaleString("pt-BR")}` : "—"} <span className="text-sm font-normal">km</span></div>
              </CardContent></Card>
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Localização</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="h-[360px] w-full relative z-0 isolate">
                  {hasPos ? (
                    <MapContainer center={[st!.lat!, st!.lng!]} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[st!.lat!, st!.lng!]} icon={carIcon}><Popup>{link?.device_label || "Meu carro"}</Popup></Marker>
                      <Recenter lat={st!.lat!} lng={st!.lng!} />
                    </MapContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem posição GPS ainda.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {!!events?.length && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Route className="w-4 h-4 text-primary" /> Eventos recentes</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {events.map((e, i) => {
                    const Icon = EVENT_ICON[e.type] || Cpu;
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="flex-1">{e.label || e.type}</span>
                        <span className="text-xs text-muted-foreground">{new Date(e.ts).toLocaleString("pt-BR")}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <Button variant="ghost" size="sm" className="text-muted-foreground"
              disabled={unlink.isPending}
              onClick={() => { if (confirm("Desconectar o carro? A telemetria vai parar.")) unlink.mutate(undefined, { onSuccess: () => { setPair(null); toast({ title: "Carro desconectado" }); } }); }}>
              <Unlink className="w-4 h-4 mr-1.5" /> Desconectar carro
            </Button>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
