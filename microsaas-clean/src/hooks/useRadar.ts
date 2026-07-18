import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// RADAR DE SERVIÇOS — busca de oficina/borracharia/guincho perto do motorista.
// Não é CRM: estabelecimento é opção de serviço, não lead.

export interface RadarProvider {
  provider_id?: string | null;
  name: string;
  category?: string | null;
  provider_status: "publico" | "parceiro_totex" | "assistencia_contratada";
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  rating?: number | null;
  review_count?: number | null;
  distance_km?: number | null;
  open_now?: boolean | null;
  open_24h?: boolean | null;
  mobile_service?: boolean | null;
  matched_reasons: string[];
  rank_position: number;
  call_uri?: string | null;
  whatsapp_uri?: string | null;
  maps_uri?: string | null;
  website_uri?: string | null;
}

export interface RadarResult {
  search_id: string | null;
  service_type: string;
  service_label: string;
  location_text: string | null;
  raio_km: number;
  raio_ampliado: number | null;
  cache: boolean;
  fontes: string[];
  total: number;
  providers: RadarProvider[];
  disclaimer: string;
  erro_busca?: string | null;
}

export const SERVICOS: { value: string; label: string; emergencia?: boolean }[] = [
  { value: "oficina", label: "Oficina mecânica" },
  { value: "freios", label: "Freios e suspensão" },
  { value: "autoeletrica", label: "Autoelétrica" },
  { value: "bateria", label: "Bateria" },
  { value: "pneus", label: "Pneus" },
  { value: "borracharia", label: "Borracharia", emergencia: true },
  { value: "chaveiro", label: "Chaveiro", emergencia: true },
  { value: "vidros", label: "Vidros" },
  { value: "ar_condicionado", label: "Ar-condicionado" },
  { value: "funilaria", label: "Funilaria e pintura" },
  { value: "estetica", label: "Estética e lavagem" },
  { value: "vistoria", label: "Vistoria" },
  { value: "guincho", label: "Guincho / reboque", emergencia: true },
  { value: "socorro", label: "Socorro mecânico", emergencia: true },
  { value: "eletrico_hibrido", label: "Elétricos e híbridos" },
];

export function useRadar() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadarResult | null>(null);

  const buscar = async (params: {
    service_type: string;
    location_text?: string;
    mode?: string;
    emergency?: boolean;
    latitude?: number;
    longitude?: number;
  }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("radar", {
        body: { action: "search", ...params },
      });
      if (error) throw error;
      if (data?.error && data.error !== "localizacao_ausente") throw new Error(data.error);
      if (data?.error === "localizacao_ausente") {
        toast({ title: "Onde você está?", description: data.message });
        setResult(null);
        return null;
      }
      setResult(data as RadarResult);
      return data as RadarResult;
    } catch (e: any) {
      const msg = String(e?.message || e);
      toast({
        title: msg.includes("rate_limit") ? "Muitas buscas seguidas" : "Não consegui buscar agora",
        description: msg.includes("rate_limit")
          ? "Tente de novo em alguns minutos."
          : msg,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // telemetria de produto (abriu rota/telefone). NÃO cria cadastro do
  // motorista no estabelecimento.
  const registrarAcao = async (provider_id: string, action_type: string, search_id?: string | null) => {
    if (!provider_id) return;
    try {
      await supabase.functions.invoke("radar", {
        body: { action: "record_action", provider_id, action_type, search_id },
      });
    } catch {
      /* telemetria nunca atrapalha o uso */
    }
  };

  return { loading, result, buscar, registrarAcao, setResult };
}
