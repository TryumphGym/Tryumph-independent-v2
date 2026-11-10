import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import {
  communityPhotoAvailability,
  prepareCommunityPhoto,
  finishCommunityPhoto,
  getCommunityPhoto,
  getPublicCommunityPhoto,
} from "@/lib/community-media.functions";
import { inspectCommunityImage } from "@/lib/community-images";
type Photo = { id: string; postId: string; alt: string; status: string };
export function CommunityPostPhotos({
  postId,
  canEdit,
  onChange,
}: {
  postId: string;
  canEdit: boolean;
  onChange: () => void;
}) {
  const me = useUserId(),
    [photos, setPhotos] = useState<Photo[]>([]),
    [enabled, setEnabled] = useState(false),
    [alt, setAlt] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    void communityPhotoAvailability()
      .then(setEnabled)
      .catch(() => setEnabled(false));
  }, []);
  useEffect(() => {
    let active = true;
    setPhotos([]);
    void supabase.rpc("read_post_photos", { p_posts: [postId] }).then((r) => {
      if (active && !r.error) setPhotos(r.data as unknown as Photo[]);
    });
    return () => {
      active = false;
    };
  }, [postId, me, version]);
  const refresh = () => {
    setVersion((n) => n + 1);
    onChange();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const b = new Uint8Array(await file.arrayBuffer()),
        meta = inspectCommunityImage(b);
      const ext =
        meta.type === "image/jpeg"
          ? "jpg"
          : meta.type === "image/png"
            ? "png"
            : "webp";
      const ticket = await prepareCommunityPhoto({
        data: { postId, alt, ext },
      });
      const r = await supabase.storage
        .from("community-photo-uploads")
        .upload(ticket.path, file, { contentType: meta.type, upsert: false });
      if (r.error) throw new Error("Image upload did not finish");
      const result = await finishCommunityPhoto({ data: { id: ticket.id } });
      toast.success(
        result.status === "approved"
          ? "Photo approved."
          : "Photo remains private for review.",
      );
      setAlt("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Photo upload failed");
      refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Post photos" className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {photos.map((p) => (
          <figure key={p.id}>
            {p.status === "approved" ? (
              <AuthorizedPhoto id={p.id} />
            ) : (
              <p className="rounded border p-3 text-sm">
                Photo{" "}
                {p.status === "specialist"
                  ? "held for specialist review"
                  : p.status}{" "}
                · Your post stays private while attachments await approval.
              </p>
            )}
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="text-xs underline"
                  disabled={busy}
                  onClick={async () => {
                    const r = await supabase.rpc("remove_post_photo", {
                      p_photo: p.id,
                    });
                    if (r.error) toast.error(r.error.message);
                    else refresh();
                  }}
                >
                  Remove photo
                </button>
                {p.status === "pending" && (
                  <button
                    className="text-xs underline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await finishCommunityPhoto({ data: { id: p.id } });
                        refresh();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Review unavailable",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Retry review
                  </button>
                )}
              </div>
            )}
          </figure>
        ))}
      </div>
      {canEdit && enabled && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Add or replace photos
          </summary>
          <p className="my-2 text-xs">
            Up to four photos per post, each up to 8 MB. Remove an old photo to
            replace it. Photos are processed and reviewed before the post is
            published. Never upload private documents or personal information.
          </p>
          <label>
            Image description
            <input
              className="field"
              maxLength={300}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image for people using screen readers"
            />
          </label>
          <label>
            Add photo
            <input
              className="field"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || !alt.trim()}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
        </details>
      )}
    </section>
  );
}
export function AuthorizedPhoto({
  id,
  review = false,
}: {
  id: string;
  review?: boolean;
}) {
  const me = useUserId(),
    [image, setImage] = useState<Awaited<
      ReturnType<typeof getCommunityPhoto>
    > | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setImage(null);
    setError(false);
    void (
      me
        ? getCommunityPhoto({ data: { id, review } })
        : getPublicCommunityPhoto({ data: { id } })
    )
      .then((r) => {
        if (active) setImage(r);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [id, me, review]);
  return image ? (
    <a href={image.url} target="_blank" rel="noopener noreferrer">
      <img
        src={image.thumbnail}
        alt={image.alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="max-h-80 w-full rounded-lg object-contain"
      />
    </a>
  ) : error ? (
    <p className="text-xs">
      Photo unavailable. Refresh this feed to check access.
    </p>
  ) : (
    <p role="status" className="text-xs">
      Loading photo…
    </p>
  );
}
