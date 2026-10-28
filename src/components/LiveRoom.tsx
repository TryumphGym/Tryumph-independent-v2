import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  Room as LKRoom,
  RemoteParticipant,
  RemoteTrackPublication,
} from "livekit-client";
import { getLiveKitToken } from "@/lib/livekit.functions";
import { startClassRecording } from "@/lib/recordings.functions";
import { useStore } from "@/lib/store";
import { PrivatePaymentGate } from "./PrivatePaymentGate";
import { Avatar } from "@/components/Avatar";

// Real LiveKit video room. Loaded only on the client (dynamic import from the route).
export default function LiveRoom({
  roomId,
  title,
  hostName,
  onLeave,
  isHost = false,
}: {
  roomId: string;
  title: string;
  hostName: string;
  onLeave: () => void;
  isHost?: boolean;
}) {
  const { s } = useStore();
  const [status, setStatus] = useState<"connecting" | "live" | "error">(
    "connecting",
  );
  const [participants, setParticipants] = useState<string[]>([]);
  const [authorizedHost, setAuthorizedHost] = useState(false),
    [canPublish, setCanPublish] = useState(false);
  const [cam, setCam] = useState(false);
  const [mic, setMic] = useState(false);
  const roomRef = useRef<LKRoom | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const selfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let room: LKRoom | null = null;
    (async () => {
      try {
        const {
          token,
          url,
          isHost: serverHost,
          isPrivate,
          waiting,
        } = await getLiveKitToken({ data: { room: roomId, name: s.name } });
        if (cancelled) return;
        setAuthorizedHost(serverHost);
        setCanPublish(!waiting && (serverHost || isPrivate));
        const { Room, RoomEvent, Track } = await import("livekit-client");
        room = new Room();
        roomRef.current = room;

        const refreshNames = () => {
          if (!room) return;
          setParticipants(
            [...room.remoteParticipants.values()].map(
              (p: RemoteParticipant) => p.name || p.identity,
            ),
          );
        };
        room.on(RoomEvent.ParticipantPermissionsChanged, () => {
          setCanPublish(
            Boolean(room?.localParticipant.permissions?.canPublish),
          );
        });
        room.on(RoomEvent.ParticipantConnected, refreshNames);
        room.on(RoomEvent.ParticipantDisconnected, refreshNames);

        const attach = (
          pub: RemoteTrackPublication,
          participant: RemoteParticipant,
        ) => {
          const track = pub.track;
          if (!track || pub.kind !== "video" || !stageRef.current) return;
          const el = track.attach();
          el.className = "absolute inset-0 h-full w-full object-cover";
          stageRef.current.innerHTML = "";
          stageRef.current.appendChild(el);
          void participant;
        };
        room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
          if (track.kind === "video") attach(pub, participant);
          if (track.kind === "audio") {
            const element = track.attach();
            stageRef.current?.appendChild(element);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) =>
          track.detach().forEach((el) => el.remove()),
        );

        room.on(RoomEvent.LocalTrackPublished, (pub) => {
          const t = pub.track;
          if (!t || t.kind !== "video" || !selfRef.current) return;
          const el = t.attach();
          el.className = "h-full w-full object-cover -scale-x-100";
          selfRef.current.innerHTML = "";
          selfRef.current.appendChild(el);
        });
        room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
          pub.track?.detach().forEach((el) => el.remove());
        });

        await room.connect(url, token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setStatus("live");
        refreshNames();
        // Attach video already published before we joined.
        room.remoteParticipants.forEach((p) =>
          p.trackPublications.forEach((pub) => attach(pub, p)),
        );
        if (serverHost && !waiting) {
          const match = /^live-([0-9a-f-]{36})$/i.exec(roomId);
          if (match)
            void startClassRecording({ data: { sessionId: match[1] } }).catch(
              (error) => {
                console.warn("Class recording not started", error);
                toast.error("Recording unavailable; class can continue live.");
              },
            );
          try {
            await room.localParticipant.setCameraEnabled(true);
            setCam(true);
          } catch {
            toast.error("Allow camera access to broadcast.");
          }
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
            setMic(true);
          } catch {
            toast.error("Allow microphone access to broadcast.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          toast.error(
            err instanceof Error
              ? err.message
              : "Could not connect to the live room.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      room?.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !cam;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCam(next);
    } catch {
      toast.error(
        "Camera access was blocked. Allow camera permission and try again.",
      );
    }
  };
  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !mic;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMic(next);
    } catch {
      toast.error(
        "Microphone access was blocked. Allow mic permission and try again.",
      );
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="card overflow-hidden">
        <div className="relative aspect-video bg-secondary">
          <span className="absolute left-3 top-3 z-10 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">
            ● LIVE
          </span>
          <div ref={stageRef} className="absolute inset-0" />
          <div
            ref={selfRef}
            className={`absolute bottom-3 right-3 z-10 aspect-video w-1/4 min-w-28 overflow-hidden rounded-lg border-2 border-background bg-muted shadow-lg ${cam ? "" : "hidden"}`}
            aria-label="Your camera"
          />
          {status === "connecting" && (
            <div className="absolute inset-0 grid place-items-center">
              <p className="text-muted-foreground">Connecting to the room…</p>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <p className="text-muted-foreground">
                Couldn't connect. Check your connection and try again.
              </p>
            </div>
          )}
          {status === "live" && participants.length === 0 && authorizedHost && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <p className="text-muted-foreground">
                You're live! Members will appear on the right as they join —
                shout them out by name.
              </p>
            </div>
          )}
          {status === "live" &&
            participants.length === 0 &&
            !authorizedHost && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <Avatar
                    initials={hostName.slice(0, 2).toUpperCase()}
                    size="lg"
                  />
                  <p className="mt-3 font-display text-2xl font-bold">
                    {hostName}
                  </p>
                  <p className="text-muted-foreground">
                    {title} — waiting for the host's video…
                  </p>
                </div>
              </div>
            )}
        </div>
        {roomId.startsWith("live-") && (
          <p className="px-4 text-xs text-muted-foreground">
            Community classes may be recorded for the reviewed workout library.
            Private sessions are not recorded automatically.
          </p>
        )}
        <div className="flex flex-wrap gap-2 p-4">
          <button
            className="btn btn-ghost"
            onClick={toggleCam}
            disabled={status !== "live" || !canPublish}
          >
            {cam ? (
              <Video className="h-4 w-4" />
            ) : (
              <VideoOff className="h-4 w-4" />
            )}
            Camera {cam ? "on" : "off"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={toggleMic}
            disabled={status !== "live" || !canPublish}
          >
            {mic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            Mic {mic ? "on" : "off"}
          </button>
          <button className="btn btn-outline ml-auto" onClick={onLeave}>
            Leave room
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {roomId.startsWith("oneonone-") && <PrivatePaymentGate room={roomId} />}
        <div className="card p-4">
          <p className="eyebrow">In the room</p>
          <ul className="mt-3 space-y-2">
            <li className="flex items-center gap-2 text-sm">
              <Avatar size="sm" initials={s.name.slice(0, 2).toUpperCase()} />
              {s.name}{" "}
              <span className="text-xs text-muted-foreground">(you)</span>
            </li>
            {participants.map((n) => (
              <li key={n} className="flex items-center gap-2 text-sm">
                <Avatar size="sm" initials={n.slice(0, 2).toUpperCase()} />
                {n}
              </li>
            ))}
          </ul>
          {participants.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              You're the first one here — others will appear as they join.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
