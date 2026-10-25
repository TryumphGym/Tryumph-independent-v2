import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Signed photo links live for 1 hour; re-mint a cached one before it goes stale.
const urlCache = new Map<string, { url: string; at: number }>();

function useAvatarUrl(src?: string) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!src) { setUrl(undefined); return; }
    if (src.startsWith("http")) { setUrl(src); return; }
    const cached = urlCache.get(src);
    if (cached && Date.now() - cached.at < 45 * 60 * 1000) { setUrl(cached.url); return; }
    let alive = true;
    supabase.storage.from("avatars").createSignedUrl(src, 3600).then(({ data }) => {
      if (data?.signedUrl && alive) {
        urlCache.set(src, { url: data.signedUrl, at: Date.now() });
        setUrl(data.signedUrl);
      }
    });
    return () => { alive = false; };
  }, [src]);
  return url;
}

export function Avatar({ initials, src, size = "md" }: { initials: string; src?: string | undefined; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-12 w-12 text-sm";
  const url = useAvatarUrl(src);
  if (url) return <img src={url} alt={initials} className={`${s} shrink-0 rounded-full object-cover`} />;
  return <div className={`${s} bg-brand text-primary-foreground grid shrink-0 place-items-center rounded-full font-display font-bold`}>{initials}</div>;
}

export function PageHeader({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
