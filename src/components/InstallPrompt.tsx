import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "tryumph-install-dismissed";

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone || window.self !== window.top) return;
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua)) {
      setIos(true);
      setShow(true);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;
  const close = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-lg">
      <img src="/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Get the Tryumph app</p>
        <p className="text-muted-foreground">
          {ios ? "Tap Share, then “Add to Home Screen”." : "Install it on your home screen."}
        </p>
      </div>
      {!ios && evt && (
        <button
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice;
            close();
          }}
        >
          Install
        </button>
      )}
      <button aria-label="Dismiss" className="px-2 text-muted-foreground" onClick={close}>
        ✕
      </button>
    </div>
  );
}
