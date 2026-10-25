import { useState } from "react";
import { Download, X } from "lucide-react";

export function GetAppButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" /> Get the App
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Get the Tryumph app">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Get the Tryumph app</h2>
              <button aria-label="Close" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-2 text-sm font-semibold">iPhone (Safari)</p>
            <p className="mb-4 text-sm text-muted-foreground">Tap the Share button, then “Add to Home Screen.”</p>
            <p className="mb-2 text-sm font-semibold">Android (Chrome)</p>
            <p className="text-sm text-muted-foreground">Tap the ⋮ menu, then “Install app” or “Add to Home screen.”</p>
          </div>
        </div>
      )}
    </>
  );
}
