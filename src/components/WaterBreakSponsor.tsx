import { useEffect, useRef, useState } from "react";
import {
  getWaterBreakCreative,
  recordWaterBreakImpression,
} from "@/lib/water-break-ads.functions";

type Creative = {
  id: string;
  title: string;
  creative_url: string;
  destination_url: string;
  creative_type: "image" | "video";
  timestamp: number;
  signature: string;
};
/** Sponsor media is shown ONLY at trainer-marked breaks, never during exercises. */
export function WaterBreakSponsor({
  videoId,
  second,
  playbackId,
}: {
  videoId: string;
  second: number;
  playbackId: string;
}) {
  const [creative, setCreative] = useState<Creative | null>(null);
  const recorded = useRef(false);
  const [loaded, setLoaded] = useState(false),
    [visible, setVisible] = useState(document.visibilityState === "visible");
  useEffect(() => {
    const change = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    let mounted = true;
    recorded.current = false;
    setCreative(null);
    setLoaded(false);
    void getWaterBreakCreative({ data: { videoId, second, playbackId } })
      .then((result) => {
        if (mounted && result) setCreative(result as Creative);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [videoId, second, playbackId]);
  useEffect(() => {
    if (!creative || !loaded || !visible) return;
    // Count only after sponsor creative was actually on screen for two seconds.
    const timeout = setTimeout(() => {
      if (recorded.current) return;
      recorded.current = true;
      void recordWaterBreakImpression({
        data: {
          campaignId: creative.id,
          videoId,
          second,
          playbackId,
          timestamp: creative.timestamp,
          signature: creative.signature,
        },
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timeout);
  }, [creative, videoId, second, playbackId, loaded, visible]);
  if (!creative)
    return <p className="text-sm">Hydrate and get ready to continue.</p>;
  return (
    <div className="mx-auto max-w-sm text-center">
      <p className="text-xs uppercase tracking-wide">Sponsored water break</p>
      <a
        href={creative.destination_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
      >
        {creative.creative_type === "video" ? (
          <video
            onLoadedData={() => setLoaded(true)}
            onError={() => setCreative(null)}
            src={creative.creative_url}
            autoPlay
            muted
            playsInline
            preload="metadata"
            className="mx-auto max-h-40 max-w-full"
          />
        ) : (
          <img
            onLoad={() => setLoaded(true)}
            onError={() => setCreative(null)}
            src={creative.creative_url}
            alt={creative.title}
            className="mx-auto max-h-40 max-w-full object-contain"
          />
        )}
      </a>
      <p className="text-sm">{creative.title}</p>
    </div>
  );
}
