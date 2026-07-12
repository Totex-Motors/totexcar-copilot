import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";

const DISMISS_KEY = "totex_install_dismissed";

// Pop-up no rodapé que convida a instalar o app (PWA / adicionar à tela inicial).
// Aparece após 5s. No Android/Chrome dispara a instalação nativa (beforeinstallprompt);
// no iPhone mostra a instrução manual. Fecha e não repete (localStorage).
export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);
  const [showHelp, setShowHelp] = useState(false);

  const isIos =
    typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, "1");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const t = setTimeout(() => setVisible(true), 5000);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        /* ignore */
      }
      setDeferred(null);
      dismiss();
    } else {
      // iOS e navegadores sem instalação automática: mostra o passo a passo
      setShowHelp((v) => !v);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-teal-500/30 bg-[#0b1220] p-4 shadow-2xl shadow-black/50 animate-slide-up">
        <div className="flex items-start gap-3">
          <img
            src="/icon-192.png"
            alt="TotexCar Co-pilot"
            className="h-12 w-12 flex-shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold leading-tight text-white">
              Instalar TotexCar Co-pilot
            </p>
            <p className="mt-0.5 text-sm leading-snug text-gray-400">
              Adicione à tela inicial para acesso rápido de manutenções e gastos do carro.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            className="-mr-1 -mt-1 flex-shrink-0 p-1 text-gray-500 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showHelp ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/5 p-2.5 text-xs leading-relaxed text-gray-300">
            <Share className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-400" />
            {isIos ? (
              <span>
                Toque no botão <strong>Compartilhar</strong> e depois em{" "}
                <strong>“Adicionar à Tela de Início”</strong>.
              </span>
            ) : (
              <span>
                Abra o menu do navegador (⋮) e escolha{" "}
                <strong>“Instalar app”</strong> ou <strong>“Adicionar à tela inicial”</strong>.
              </span>
            )}
          </p>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Instalar
            </button>
            <button
              onClick={dismiss}
              className="px-4 text-sm text-gray-400 transition-colors hover:text-white"
            >
              Agora não
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default InstallPrompt;
