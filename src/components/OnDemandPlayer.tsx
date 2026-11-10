import { WorkoutComments } from "./WorkoutComments";
import { supabase } from "@/integrations/supabase/client";
import { WorkoutFeedback } from "./WorkoutFeedback";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { Droplets, X } from "lucide-react";
import { toast } from "sonner";
import { nextWaterBreak } from "@/lib/adBreaks";
import { getVideoUrl } from "@/lib/videos.functions";
import { WaterBreakSponsor } from "./WaterBreakSponsor";
export function OnDemandPlayer({
  video,
  onClose,
  initialUrl,
  synchronization,
}: {
  video: {
    id: string;
    title: string;
    minutes: number;
    breaks: number[];
    break_seconds: number;
  };
  initialUrl?: string;
  synchronization?: {
    elapsed: number;
    paused: boolean;
    onPlay: () => void;
    onPause: () => void;
  };
  onClose: () => void;
}) {
  const synchronizationRef = useRef(synchronization);
  synchronizationRef.current = synchronization;
  const [url, setUrl] = useState<string | null>(null);
  const [ad, setAd] = useState(0);
  const [activeBreak, setActiveBreak] = useState<number | null>(null);
  const [soon, setSoon] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [playbackId] = useState(() => {
    const key = `tryumph-playback:${video.id}`;
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  });
  const ref = useRef<HTMLVideoElement>(null);
  const previous = useRef(0);
  const watched = useRef(0);
  const [feedbackEligible, setFeedbackEligible] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const sign = useServerFn(getVideoUrl);
  const bunny =
    !!url && /https:\/\/(?:iframe|player)\.mediadelivery\.net\//.test(url);
  const command = useCallback(
    (method: string) =>
      frameRef.current?.contentWindow?.postMessage(
        {
          context: "player.js",
          version: "0.0.11",
          method,
        },
        new URL(url ?? "https://player.mediadelivery.net").origin,
      ),
    [url],
  );
  const resume = () => {
    setAd(0);
    setActiveBreak(null);
    if (bunny) command("play");
    else void ref.current?.play().catch(() => {});
  };
  const metricStarted = useRef(false);
  const recordStart = useRef(() => {});
  recordStart.current = () => {
    if (metricStarted.current) return;
    metricStarted.current = true;
    void supabase.rpc("start_creator_playback", { p_video: video.id }).then(
      () => {},
      () => {},
    );
  };
  useEffect(() => {
    metricStarted.current = false;
  }, [video.id]);
  const progress = useCallback(
    (seconds: number) => {
      if (ad > 0 || !Number.isFinite(seconds)) return;
      if (seconds > 0) recordStart.current();
      const last = previous.current;
      previous.current = seconds;
      const delta = seconds - last;
      if (delta > 0 && delta <= 3) {
        watched.current += delta;
        if (watched.current >= video.minutes * 60 * 0.7)
          setFeedbackEligible(true);
      }
      if (seconds - last > 3) {
        setDone(
          (old) =>
            new Set([
              ...old,
              ...(video.breaks ?? []).filter((b) => b <= seconds + 2),
            ]),
        );
        return;
      }
      const hit = nextWaterBreak(
        video.breaks ?? [],
        done,
        last,
        seconds,
        video.minutes,
      );
      if (hit !== null) {
        if (bunny) command("pause");
        else ref.current?.pause();
        setDone((old) => new Set([...old, hit]));
        setActiveBreak(hit);
        setAd(
          [15, 30].includes(video.break_seconds) ? video.break_seconds : 15,
        );
        setSoon(false);
        return;
      }
      setSoon(
        (video.breaks ?? []).some(
          (b) => !done.has(b) && b - seconds > 0 && b - seconds <= 5,
        ),
      );
    },
    [
      ad,
      done,
      video.breaks,
      video.minutes,
      video.break_seconds,
      bunny,
      command,
    ],
  );
  useEffect(() => {
    setDone(new Set());
    previous.current = 0;
    watched.current = 0;
    setFeedbackEligible(false);
    setAd(0);
    setActiveBreak(null);
    setUrl(null);
    (initialUrl
      ? Promise.resolve(initialUrl)
      : sign({ data: { id: video.id } })
    )
      .then(setUrl)
      .catch(() => {
        setUrl(null);
        toast.error("Unable to open this workout. Please try again.");
      });
  }, [video.id, initialUrl, sign]);
  useLayoutEffect(() => {
    if (!bunny) return;
    const frame = frameRef.current;
    const origin = new URL(url!).origin;
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame?.contentWindow)
        return;
      const msg =
        typeof event.data === "string"
          ? (() => {
              try {
                return JSON.parse(event.data);
              } catch {
                return null;
              }
            })()
          : event.data;
      if (msg?.context !== "player.js") return;
      if (msg.event === "play") synchronizationRef.current?.onPlay();
      if (msg.event === "pause") synchronizationRef.current?.onPause();
      if (msg.event === "ready" && synchronizationRef.current) {
        const sync = synchronizationRef.current;
        frame?.contentWindow?.postMessage(
          {
            context: "player.js",
            version: "0.0.11",
            method: "setCurrentTime",
            value: Math.min(sync.elapsed, Math.max(0, video.minutes * 60 - 1)),
          },
          origin,
        );
        frame?.contentWindow?.postMessage(
          {
            context: "player.js",
            version: "0.0.11",
            method: sync.paused ? "pause" : "play",
          },
          origin,
        );
      }
      if (msg.event === "ready")
        frame?.contentWindow?.postMessage(
          {
            context: "player.js",
            version: "0.0.11",
            method: "addEventListener",
            value: "timeupdate",
          },
          origin,
        );
      if (msg.event === "timeupdate" && typeof msg.value?.seconds === "number")
        progress(msg.value.seconds);
    };
    window.addEventListener("message", receive);
    // The player.js protocol works on both the modern and legacy Bunny players.
    const register = () => {
      if (synchronizationRef.current)
        for (const event of ["play", "pause"])
          frame?.contentWindow?.postMessage(
            {
              context: "player.js",
              version: "0.0.11",
              method: "addEventListener",
              value: event,
            },
            origin,
          );
      frame?.contentWindow?.postMessage(
        {
          context: "player.js",
          version: "0.0.11",
          method: "addEventListener",
          value: "timeupdate",
        },
        origin,
      );
    };
    frame?.addEventListener("load", register);
    register();
    return () => {
      window.removeEventListener("message", receive);
      frame?.removeEventListener("load", register);
    };
  }, [url, bunny, progress, video.minutes]);
  const synchronizationPaused = synchronization?.paused;
  useEffect(() => {
    const synchronization = synchronizationRef.current;
    if (synchronization && url) {
      if (bunny) command(synchronization.paused ? "pause" : "play");
      else if (synchronization.paused) ref.current?.pause();
      else void ref.current?.play().catch(() => {});
    }
  }, [synchronizationPaused, url, bunny, command]);
  useEffect(() => {
    if (ad <= 0) return;
    const timeout = setTimeout(
      () =>
        setAd((a) => {
          if (a === 1) {
            if (bunny) command("play");
            else void ref.current?.play().catch(() => {});
            setActiveBreak(null);
          }
          return Math.max(0, a - 1);
        }),
      1000,
    );
    return () => clearTimeout(timeout);
  }, [ad, bunny, url, command]);
  return (
    <div className="card mb-6 overflow-hidden">
      <div className="relative bg-secondary">
        {bunny ? (
          <iframe
            ref={frameRef}
            src={url!}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="aspect-video w-full"
          />
        ) : url ? (
          <video
            ref={ref}
            src={url}
            controls={ad === 0}
            autoPlay
            onPlay={() => synchronizationRef.current?.onPlay()}
            onPause={() => synchronizationRef.current?.onPause()}
            onTimeUpdate={(e) => progress(e.currentTarget.currentTime)}
            className="aspect-video w-full"
          />
        ) : (
          <div className="grid aspect-video place-items-center text-muted-foreground">
            Loading…
          </div>
        )}
        {ad > 0 && (
          <div className="absolute inset-0 grid place-items-center bg-background/95 text-center">
            <div>
              <Droplets className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-display text-2xl font-bold">
                Water break 💧
              </p>
              <p className="text-muted-foreground">
                Grab some water — resuming in {ad}s
              </p>
              {activeBreak !== null && (
                <WaterBreakSponsor
                  videoId={video.id}
                  second={activeBreak}
                  playbackId={playbackId}
                />
              )}
              <button className="btn btn-ghost mt-3" onClick={resume}>
                Resume now
              </button>
            </div>
          </div>
        )}
        {soon && ad === 0 && (
          <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
            💧 Water break soon
          </div>
        )}
        <button
          onClick={onClose}
          className="btn btn-ghost absolute right-3 top-3"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="p-4 font-semibold">{video.title}</p>
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Trainer focus labels are not medical clearance. Pregnancy, postpartum
        recovery and individual health needs vary. Seek appropriate professional
        guidance and do not assume exercising while holding a baby is safe.
      </p>
      <WorkoutFeedback videoId={video.id} eligible={feedbackEligible} />
      <WorkoutComments videoId={video.id} />
    </div>
  );
}
