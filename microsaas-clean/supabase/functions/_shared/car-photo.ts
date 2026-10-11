// FOTO DO CARRO (card "Meu carro"): recorta o fundo no Photoroom e guarda no Storage (bucket car-photos).
// Duas origens:
//  - 'estoque': na VENDA pela loja parceira, a foto de CAPA do anúncio do marketplace é puxada
//    obrigatoriamente (escolhida no pós-venda ou casada pelo texto do carro com o estoque da loja).
//  - 'cliente': o dono manda a foto (app ou WhatsApp).
// Sem chave do Photoroom, guarda a foto original (o card mostra com fundo, em moldura arredondada).

const MKT = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
const BUCKET = "car-photos";

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// ---------- marketplace ----------
export async function mktDealerIdByName(name: string | null | undefined): Promise<string | null> {
  if (!name) return null;
  try {
    const res = await fetch(`${MKT}/api/dealerships`, { headers: { Accept: "application/json" } });
    const d = await res.json().catch(() => []);
    const arr = Array.isArray(d) ? d : (d?.data || []);
    const alvo = norm(name);
    const hit = arr.find((x: any) => norm(x?.name) === alvo) || arr.find((x: any) => norm(x?.name).includes(alvo) || alvo.includes(norm(x?.name)));
    return hit?.id || null;
  } catch { return null; }
}

export async function mktStock(dealerId: string): Promise<any[]> {
  try {
    const u = new URL(`${MKT}/api/vehicles`);
    u.searchParams.set("dealershipId", dealerId); u.searchParams.set("limit", "200");
    const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
    const d = await res.json().catch(() => ({}));
    return Array.isArray(d) ? d : (d?.data || []);
  } catch { return []; }
}

export async function mktVehicle(id: string): Promise<any | null> {
  try {
    const res = await fetch(`${MKT}/api/vehicles/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const d = await res.json().catch(() => null);
    return d?.data || d || null;
  } catch { return null; }
}

// foto de CAPA do anúncio: a marcada como principal; senão a de menor ordem
export function capaDoVeiculo(v: any): string | null {
  const imgs: any[] = Array.isArray(v?.images) ? v.images : [];
  if (!imgs.length) return typeof v?.image === "string" ? v.image : null;
  const capa = imgs.find((i) => i?.isPrimary) || [...imgs].sort((a, b) => Number(a?.order ?? 99) - Number(b?.order ?? 99))[0];
  return capa?.url || null;
}

export const descVeiculo = (v: any) => [v?.brand, v?.model, v?.year].filter(Boolean).join(" ");

// casa o texto do pós-venda ("Hyundai Tucson 2017 prata") com UM carro do estoque.
// Exige MODELO e ANO batendo, e o melhor claramente acima do 2º — "Ranger" sozinho não casa
// (poderia ser outra Ranger do estoque = foto do carro errado). O caminho certo é escolher na lista.
export function casarNoEstoque(cars: any[], carDesc: string | null | undefined): any | null {
  const toks = norm(carDesc).split(" ").filter((t) => t.length >= 2);
  if (!toks.length || !cars.length) return null;
  const scored = cars.map((v) => {
    const alvo = norm([v.brand, v.model, v.version, v.year, v.color].filter(Boolean).join(" "));
    let sc = 0;
    for (const t of toks) if (alvo.split(" ").includes(t)) sc += /^\d{4}$/.test(t) ? 2 : 1;
    if (v.model && !toks.some((t) => norm(v.model).split(" ").includes(t))) sc -= 3; // o modelo tem que aparecer
    return { v, sc };
  }).filter((x) => x.sc >= 2 && toks.includes(String(x.v.year))).sort((a, b) => b.sc - a.sc); // ano tem que bater
  if (!scored.length) return null;
  if (scored.length > 1 && scored[1].sc >= scored[0].sc) return null; // empate = não arrisca
  return scored[0].v;
}

// ---------- recorte + storage ----------
async function photoroomKey(admin: any): Promise<string | null> {
  const { data } = await admin.from("app_settings").select("photoroom_api_key").eq("id", 1).single();
  const k = String(data?.photoroom_api_key || "").trim();
  return k || null;
}

// Recorta o fundo (Photoroom v1/segment, recortado no carro, WebP com transparência).
// Devolve null se não houver chave ou se o recorte falhar (aí guarda a original).
async function recortar(key: string, bytes: Uint8Array, mime: string): Promise<Uint8Array | null> {
  try {
    const form = new FormData();
    form.append("image_file", new Blob([bytes], { type: mime || "image/jpeg" }), "carro.jpg");
    form.append("format", "webp");
    form.append("crop", "true");
    form.append("size", "medium");
    const res = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST", headers: { "x-api-key": key }, body: form, signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.error("photoroom:", res.status, (await res.text()).slice(0, 200)); return null; }
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) { console.error("photoroom:", String(e).slice(0, 200)); return null; }
}

export async function baixarImagem(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!mime.startsWith("image/")) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
  } catch { return null; }
}

// Recorta (se der) e guarda. Devolve a URL pública e se ficou sem fundo.
export async function salvarFotoCarro(admin: any, pasta: string, img: { bytes: Uint8Array; mime: string }): Promise<{ url: string; recortada: boolean } | null> {
  const key = await photoroomKey(admin);
  const cut = key ? await recortar(key, img.bytes, img.mime) : null;
  const bytes = cut || img.bytes;
  const mime = cut ? "image/webp" : img.mime;
  const ext = cut ? "webp" : (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `${pasta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) { console.error("car-photos upload:", error.message); return null; }
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ? { url: data.publicUrl, recortada: !!cut } : null;
}

// FOTO DE CAPA DO ESTOQUE → jornada (e conta, quando já existe). Usado na venda (pós-venda).
// vehicleId escolhido pela loja tem prioridade; sem ele, casa pelo texto com o estoque da loja.
export async function fotoDeCapaNaVenda(admin: any, opts: {
  journeyId: string; dealership: string; vehicleId?: string | null; carDesc?: string | null; userId?: string | null;
}): Promise<{ vehicleId: string | null; fotoUrl: string | null; casado: "escolhido" | "texto" | null }> {
  let v: any = null;
  let casado: "escolhido" | "texto" | null = null;
  if (opts.vehicleId) { v = await mktVehicle(opts.vehicleId); if (v) casado = "escolhido"; }
  if (!v) {
    const did = await mktDealerIdByName(opts.dealership);
    if (did) { v = casarNoEstoque(await mktStock(did), opts.carDesc); if (v) casado = "texto"; }
  }
  if (!v?.id) return { vehicleId: null, fotoUrl: null, casado: null };
  const capa = capaDoVeiculo(v);
  const img = capa ? await baixarImagem(capa) : null;
  const salvo = img ? await salvarFotoCarro(admin, `estoque/${v.id}`, img) : null;
  await admin.from("postsale_journeys").update({ vehicle_id: v.id, foto_url: salvo?.url || null }).eq("id", opts.journeyId);
  if (salvo?.url && opts.userId) {
    await admin.from("accounts").update({ foto_url: salvo.url, foto_fonte: "estoque", foto_at: new Date().toISOString() })
      .eq("user_id", opts.userId).eq("is_active", true).is("foto_url", null);
  }
  return { vehicleId: v.id, fotoUrl: salvo?.url || null, casado };
}

// Conta sem foto → herda a foto de capa da venda (jornada do mesmo telefone/usuário)
export async function herdarFotoDaVenda(admin: any, acc: { id: string; user_id: string }, phone?: string | null): Promise<string | null> {
  let q = admin.from("postsale_journeys").select("foto_url, created_at").not("foto_url", "is", null);
  q = phone ? q.or(`user_id.eq.${acc.user_id},customer_phone.eq.${String(phone).replace(/\D/g, "")}`) : q.eq("user_id", acc.user_id);
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  const url = data?.[0]?.foto_url || null;
  if (url) await admin.from("accounts").update({ foto_url: url, foto_fonte: "estoque", foto_at: new Date().toISOString() }).eq("id", acc.id).is("foto_url", null);
  return url;
}
