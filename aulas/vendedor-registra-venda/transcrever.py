# Transcreve os áudios localmente (faster-whisper) com tempo por palavra → JSON por cena.
import sys, json, glob, os, re
from faster_whisper import WhisperModel
pasta, saida = sys.argv[1], sys.argv[2]
model = WhisperModel("small", device="cpu", compute_type="int8")
arqs = sorted(glob.glob(os.path.join(pasta, "*S*.m4a")), key=lambda f: int(re.search(r"S(\d+)\.m4a$", f).group(1)))
for f in arqs:
    cena = re.search(r"(S\d+)\.m4a$", f).group(1)
    segs, info = model.transcribe(f, language="pt", word_timestamps=True, vad_filter=False)
    palavras, texto = [], []
    for s in segs:
        texto.append(s.text.strip())
        for w in (s.words or []):
            palavras.append({"p": w.word.strip(), "ini": round(w.start, 2), "fim": round(w.end, 2)})
    json.dump({"cena": cena, "arquivo": os.path.basename(f), "duracao": round(info.duration, 2), "texto": " ".join(texto), "palavras": palavras},
              open(os.path.join(saida, f"{cena}.json"), "w"), ensure_ascii=False, indent=1)
    print(cena, round(info.duration, 1), "s:", " ".join(texto)[:400], flush=True)
