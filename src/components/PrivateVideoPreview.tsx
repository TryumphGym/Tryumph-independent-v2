import { useState } from "react";
import { getPrivateVideoUrl } from "@/lib/videos.functions";
import { toast } from "sonner";
export function PrivateVideoPreview({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn btn-outline"
        onClick={() =>
          void getPrivateVideoUrl({ data: { id } })
            .then(setUrl)
            .catch((error) =>
              toast.error(
                error instanceof Error ? error.message : "Preview unavailable",
              ),
            )
        }
      >
        Private preview
      </button>
      {url && (
        <div className="mt-2">
          {url.startsWith("https://iframe.mediadelivery.net/") ? (
            <iframe
              src={url}
              title="Private workout review"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture"
              className="aspect-video w-full"
            />
          ) : (
            <video src={url} controls className="aspect-video w-full" />
          )}
          <button className="btn btn-ghost" onClick={() => setUrl(null)}>
            Close preview
          </button>
        </div>
      )}
    </div>
  );
}
