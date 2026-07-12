import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Gauge, Clock, Power, RefreshCw, Route, Loader2, AlertCircle, Car } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useLivePosition, useTrackHistory, type TrackPoint } from "@/hooks/useTracker";

// ícone do marcador (Leaflet quebra os assets padrão com bundlers → usamos um SVG inline)
const carIcon = L.divIcon({
  className: "",
  html: `<div style="background:hsl(176 80% 40%);width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);border:2px solid #fff">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom() < 13 ? 15 : map.getZoom()); }, [lat, lng, map]);
  return null;
}

function FitBounds({ points }: { points: TrackPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(b, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function Rastreador() {
  const { userId, loading } = useCurrentUser();
  const live = useLivePosition(!!userId);
  const history = useTrackHistory();

  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [track, setTrack] = useState<TrackPoint[]>([]);

  const pos = live.data?.position;
  const hasPos = pos?.lat != null && pos?.lng != null;
  const errMsg = (live.error as any)?.message as string | undefined;

  const center = useMemo<[number, number]>(
    () => (hasPos ? [pos!.lat!, pos!.lng!] : [-23.55, -46.63]),
    [hasPos, pos],
  );

  const loadHistory = () => {
    history.mutate(
      { from: `${from} 00:00`, to: `${to} 23:59` },
      {
        onSuccess: (d) => {
          setTrack(d.positions);
          if (!d.positions.length) toast({ title: "Sem trajeto no período", description: "Nenhuma posição registrada nessas datas." });
        },
        onError: (e: any) => toast({ title: "Erro ao buscar histórico", description: String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  const online = String(live.data?.device?.online ?? "").toLowerCase() === "online" || live.data?.device?.online === "1" || live.data?.device?.online === true as any;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Navigation className="w-7 h-7 text-primary" /> Rastreador</h1>
          <p className="text-muted-foreground">Veja a localização do seu carro em tempo real e o histórico de trajetos.</p>
        </div>

        {/* Estado de erro / não configurado / não vinculado */}
        {live.isError && (
          <Card className="border-warning/40">
            <CardContent className="flex items-start gap-3 py-5">
              <AlertCircle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                {errMsg === "rastreador_nao_vinculado" || errMsg === "sem_veiculo" ? (
                  <>Seu carro ainda não tem um rastreador vinculado. Fale com a loja para ativar o rastreamento SmartGPS.</>
                ) : errMsg === "smartgps_desativado" || errMsg === "smartgps_nao_configurado" ? (
                  <>O rastreamento ainda não foi ativado pela administração.</>
                ) : (
                  <>Não foi possível obter a localização agora. {errMsg}</>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards de status ao vivo */}
        {live.data?.ok && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="py-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Power className="w-3.5 h-3.5" /> Status</div>
              <Badge className={online ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}>{online ? "Online" : "Offline"}</Badge>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Gauge className="w-3.5 h-3.5" /> Velocidade</div>
              <div className="text-lg font-bold">{pos?.speed != null ? `${Math.round(pos.speed)} km/h` : "—"}</div>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Car className="w-3.5 h-3.5" /> Hodômetro</div>
              <div className="text-lg font-bold">{pos?.odometer != null ? `${Math.round(pos.odometer).toLocaleString("pt-BR")} km` : "—"}</div>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Clock className="w-3.5 h-3.5" /> Atualizado</div>
              <div className="text-sm font-medium">{live.data?.device?.last_update || "—"}</div>
            </CardContent></Card>
          </div>
        )}

        {/* Endereço atual */}
        {hasPos && pos?.address && (
          <Card><CardContent className="flex items-center gap-3 py-4">
            <MapPin className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm">{pos.address}</span>
          </CardContent></Card>
        )}

        {/* Mapa */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">{live.data?.device?.name || "Meu carro"}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => live.refetch()} disabled={live.isFetching}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${live.isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {/* isolate: cria um stacking context próprio — os z-index internos do Leaflet (400–1000)
                ficam contidos aqui e não passam por cima da sidebar/menus (z-50) no mobile */}
            <div className="h-[420px] w-full relative z-0 isolate">
              <MapContainer center={center} zoom={hasPos ? 15 : 11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {hasPos && (
                  <>
                    <Marker position={[pos!.lat!, pos!.lng!]} icon={carIcon}>
                      <Popup>{live.data?.device?.name || "Meu carro"}<br />{pos?.address || ""}</Popup>
                    </Marker>
                    {!track.length && <Recenter lat={pos!.lat!} lng={pos!.lng!} />}
                  </>
                )}
                {track.length > 1 && (
                  <>
                    <Polyline positions={track.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "hsl(176 80% 40%)", weight: 4 }} />
                    <FitBounds points={track} />
                  </>
                )}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de trajeto */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Route className="w-4 h-4 text-primary" /> Histórico de trajeto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              <Button onClick={loadHistory} disabled={history.isPending}>
                {history.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Route className="w-4 h-4 mr-1.5" />} Ver trajeto
              </Button>
              {track.length > 0 && (
                <Button variant="ghost" onClick={() => setTrack([])}>Limpar</Button>
              )}
            </div>
            {track.length > 0 && (
              <p className="text-sm text-muted-foreground">{track.length} posições no período. A rota está desenhada no mapa acima.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
