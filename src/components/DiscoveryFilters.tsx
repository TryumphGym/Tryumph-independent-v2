import { DISCOVERY, DISCOVERY_DISCLAIMER } from "@/lib/discovery";
export function DiscoveryFilters({
  value,
  onChange,
  editor = false,
}: {
  value: readonly string[];
  onChange: (v: string[]) => void;
  editor?: boolean;
}) {
  return (
    <details className="card my-4 p-4">
      <summary className="cursor-pointer font-semibold">
        {editor ? "Content focus labels" : "Goals, life stages & accessibility"}
        {value.length ? ` · ${value.length} selected` : ""}
      </summary>
      <p className="my-2 text-xs">
        {editor
          ? "Select the focus of this content. These selections do not verify qualifications."
          : "Matches all selected focus labels. Free browsing; no diagnosis or paid membership required."}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {Object.entries(DISCOVERY).map(([group, items]) => (
          <fieldset key={group}>
            <legend className="font-semibold">
              {group === "goal"
                ? "Fitness goals"
                : group === "life_stage"
                  ? "Life stages"
                  : "Accessibility & modifications"}
            </legend>
            {items.map(([id, label]) => (
              <label className="my-2 flex items-start gap-2 text-sm" key={id}>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={value.includes(id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...value, id]
                        : value.filter((v) => v !== id),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <button
        className="btn btn-ghost"
        type="button"
        onClick={() => onChange([])}
      >
        Clear focus filters
      </button>
      <p className="text-xs text-muted-foreground">{DISCOVERY_DISCLAIMER}</p>
    </details>
  );
}
