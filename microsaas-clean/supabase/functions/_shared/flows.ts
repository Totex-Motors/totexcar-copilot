// WhatsApp Flows: publicar uma versão nova pela API da Meta e achar qual versão está no ar.
// Flow publicado não se edita: cada versão é um flow NOVO (cria → aponta o endpoint → sobe o JSON →
// publica). O webhook acha a versão mais nova pelo prefixo do nome, sem precisar de coluna/secret novo.

const GRAPH = "https://graph.facebook.com/v21.0";

// avaliação FIPE com o campo "Ou digite o modelo" (v2). Nome = prefixo + data.
export const RECOMPRA_V2_PREFIXO = "avaliar_carro_v2";
export const FLOW_ENDPOINT = `${(Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "")}/functions/v1/wa-flow-endpoint`;

export async function publicarFlow(token: string, waba: string, name: string, flowJson: unknown, endpointUri?: string) {
  const auth = { Authorization: `Bearer ${token}` };
  const c = await fetch(`${GRAPH}/${waba}/flows`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ name, categories: ["OTHER"], ...(endpointUri ? { endpoint_uri: endpointUri } : {}) }),
  });
  const cj = await c.json().catch(() => null);
  if (!c.ok || !cj?.id) return { ok: false, etapa: "criar", status: c.status, body: cj };
  const flowId = String(cj.id);
  if (endpointUri) {
    // garante o endpoint mesmo se a criação ignorou o campo
    await fetch(`${GRAPH}/${flowId}`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ endpoint_uri: endpointUri }) }).catch(() => null);
  }
  const fd = new FormData();
  fd.append("name", "flow.json");
  fd.append("asset_type", "FLOW_JSON");
  fd.append("file", new Blob([JSON.stringify(flowJson)], { type: "application/json" }), "flow.json");
  const u = await fetch(`${GRAPH}/${flowId}/assets`, { method: "POST", headers: auth, body: fd });
  const uj = await u.json().catch(() => null);
  if (!u.ok || !uj?.success) return { ok: false, etapa: "asset", flow_id: flowId, status: u.status, body: uj };
  const erros = Array.isArray(uj?.validation_errors) ? uj.validation_errors : [];
  if (erros.length) return { ok: false, etapa: "validacao", flow_id: flowId, validation_errors: erros };
  const p = await fetch(`${GRAPH}/${flowId}/publish`, { method: "POST", headers: auth });
  const pj = await p.json().catch(() => null);
  if (!p.ok || !pj?.success) return { ok: false, etapa: "publicar", flow_id: flowId, status: p.status, body: pj };
  return { ok: true, flow_id: flowId, name };
}

// id do flow PUBLICADO mais novo com o prefixo (nome termina na data → o maior é o mais novo).
// Cache de 30 min (5 min quando não acha), pra não chamar a Graph a cada mensagem.
const cache: Record<string, { em: number; id: string | null }> = {};
export async function flowPublicado(token: string, waba: string, prefixo: string): Promise<string | null> {
  const c = cache[prefixo];
  if (c && Date.now() - c.em < (c.id ? 30 : 5) * 60_000) return c.id;
  let id: string | null = null;
  try {
    if (token && waba) {
      const r = await fetch(`${GRAPH}/${waba}/flows?fields=id,name,status&limit=100`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => null);
      const lista = (Array.isArray(j?.data) ? j.data : [])
        .filter((f: any) => f?.status === "PUBLISHED" && String(f?.name || "").startsWith(prefixo))
        .sort((a: any, b: any) => String(b.name).localeCompare(String(a.name)));
      id = lista[0]?.id ? String(lista[0].id) : null;
    }
  } catch { id = c?.id ?? null; }
  cache[prefixo] = { em: Date.now(), id };
  return id;
}
