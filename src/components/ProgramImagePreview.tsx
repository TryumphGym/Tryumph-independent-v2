import { useState } from "react";
import { toast } from "sonner";
import { previewProgramImage } from "@/lib/programs.functions";
export function ProgramImagePreview({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  return (
    <div>
      <button
        className="btn btn-ghost"
        type="button"
        onClick={() =>
          void previewProgramImage({ data: { id } })
            .then(setUrl)
            .catch(() => toast.error("Image preview unavailable"))
        }
      >
        Private image preview
      </button>
      {url && (
        <img
          src={url}
          alt="Private trainer demonstration"
          referrerPolicy="no-referrer"
          className="max-h-80 rounded object-contain"
        />
      )}
    </div>
  );
}
