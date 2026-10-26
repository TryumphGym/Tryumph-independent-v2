import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StoreItem } from "@/lib/launch-features";

/** Public, trainer-owned external links. Tryumph is not the merchant of record. */
export function TrainerStorefront({ trainerId }: { trainerId: string }) {
  const [items, setItems] = useState<StoreItem[]>([]);
  useEffect(() => {
    let active = true;
    void supabase
      .from("trainer_store_items")
      .select("*")
      .eq("trainer_id", trainerId)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (active && !error) setItems((data ?? []) as StoreItem[]);
      });
    return () => {
      active = false;
    };
  }, [trainerId]);
  if (!items.length) return null;
  return (
    <section className="card my-6 p-5">
      <h2 className="text-xl font-bold">Trainer’s Trybe Store</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Purchases happen with the trainer or linked merchant, not Tryumph Gym.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.external_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="rounded-lg border p-3 hover:border-primary"
          >
            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.title}
                loading="lazy"
                className="mb-2 aspect-video w-full rounded object-cover"
              />
            )}
            <strong>{item.title}</strong>
            <p className="text-sm text-muted-foreground">{item.description}</p>
            <p className="mt-2 text-sm text-primary">
              {item.price_cents > 0
                ? `$${(item.price_cents / 100).toFixed(2)} · `
                : ""}
              Visit seller
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
