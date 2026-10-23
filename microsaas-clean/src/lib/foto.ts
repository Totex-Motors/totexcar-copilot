// Foto do celular → JPEG comprimido (lado maior 1280 px) em data URL, pronto pra mandar no JSON da dealer-api.
// Foto do painel/etiqueta precisa ser legível, não pesada: ~150–300 KB.
export async function fotoComprimida(file: File, lado = 1280, qualidade = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error("foto_invalida"));
      i.src = url;
    });
    const esc = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * esc);
    c.height = Math.round(img.naturalHeight * esc);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", qualidade);
  } finally {
    URL.revokeObjectURL(url);
  }
}
