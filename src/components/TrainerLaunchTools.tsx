import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  safeExternalUrl,
  validStoreItem,
  type StoreItem,
  type Program,
} from "@/lib/launch-features";

export function TrainerStoreManager() {
  const [me, setMe] = useState<string | null>(null);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [price, setPrice] = useState(""),
    [link, setLink] = useState(""),
    [image, setImage] = useState("");
  const [kind, setKind] = useState<StoreItem["item_type"]>("product");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const reload = async (id: string) => {
    const { data, error } = await supabase
      .from("trainer_store_items")
      .select("*")
      .eq("trainer_id", id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as StoreItem[]);
  };
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setMe(id);
      if (id) void reload(id);
    });
  }, []);
  const save = async () => {
    if (!me) return void toast.error("Sign in as a trainer first.");
    const amount = Number(price || 0);
    const problem = validStoreItem(title, link, amount);
    if (problem) return void toast.error(problem);
    if (image && !safeExternalUrl(image))
      return void toast.error("Image URL must use HTTPS.");
    setBusy(true);
    let imageUrl = image.trim() || null;
    if (photo) {
      if (
        photo.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(photo.type)
      ) {
        setBusy(false);
        return void toast.error("Choose a JPG, PNG or WebP image up to 5 MB.");
      }
      const extension =
        photo.type === "image/png"
          ? "png"
          : photo.type === "image/webp"
            ? "webp"
            : "jpg";
      const path = `${me}/${crypto.randomUUID()}.${extension}`;
      const uploaded = await supabase.storage
        .from("trainer-store-images")
        .upload(path, photo, { contentType: photo.type });
      if (uploaded.error) {
        setBusy(false);
        return void toast.error(uploaded.error.message);
      }
      imageUrl = supabase.storage
        .from("trainer-store-images")
        .getPublicUrl(path).data.publicUrl;
    }
    const record = {
      title: title.trim(),
      description: description.trim(),
      price_cents: Math.round(amount * 100),
      external_url: link.trim(),
      image_url: imageUrl,
      item_type: kind,
    };
    const { error } = editing
      ? await supabase
          .from("trainer_store_items")
          .update(record)
          .eq("id", editing)
          .eq("trainer_id", me)
      : await supabase
          .from("trainer_store_items")
          .insert({ ...record, trainer_id: me, published: true });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setEditing(null);
    setPhoto(null);
    setTitle("");
    setDescription("");
    setPrice("");
    setLink("");
    setImage("");
    void reload(me);
  };
  const remove = async (id: string) => {
    if (!me) return;
    const { error } = await supabase
      .from("trainer_store_items")
      .delete()
      .eq("id", id)
      .eq("trainer_id", me);
    if (error) toast.error(error.message);
    else void reload(me);
  };
  return (
    <section className="card space-y-3 p-6">
      <h2 className="text-xl font-bold">Your Trybe Store</h2>
      <p className="text-sm text-muted-foreground">
        Your affiliate and independent store earnings are 100% yours. Tryumph
        does not process these sales.
      </p>
      <select
        className="field"
        value={kind}
        onChange={(e) => setKind(e.target.value as StoreItem["item_type"])}
      >
        <option value="product">Product</option>
        <option value="affiliate">Affiliate link</option>
        <option value="external_store">Independent store / Shopify</option>
      </select>
      <input
        className="field"
        placeholder="Name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="field"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        className="field"
        type="number"
        min="0"
        step="0.01"
        placeholder="Price in dollars (optional)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <input
        className="field"
        type="url"
        placeholder="https://your-store-or-affiliate-link"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      <input
        className="field"
        type="url"
        placeholder="https://image-url (optional)"
        value={image}
        onChange={(e) => setImage(e.target.value)}
      />
      <label className="block text-xs">
        Upload product photo (optional){" "}
        <input
          className="field mt-1"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </label>
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : editing ? "Save changes" : "Publish listing"}
      </button>
      {editing && (
        <button
          className="btn btn-ghost"
          onClick={() => {
            setEditing(null);
            setTitle("");
            setDescription("");
            setPrice("");
            setLink("");
            setImage("");
            setPhoto(null);
          }}
        >
          Cancel edit
        </button>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            {item.image_url && (
              <img
                src={item.image_url}
                alt=""
                className="h-14 w-14 object-cover"
              />
            )}
            <span className="flex-1">
              <strong>{item.title}</strong>
              <span className="block text-xs">
                ${(item.price_cents / 100).toFixed(2)} · {item.item_type}
              </span>
            </span>
            <a
              href={item.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              View
            </a>
            <button
              onClick={() => {
                setEditing(item.id);
                setTitle(item.title);
                setDescription(item.description);
                setPrice(String(item.price_cents / 100));
                setLink(item.external_url);
                setImage(item.image_url ?? "");
                setKind(item.item_type);
              }}
              className="text-primary"
            >
              Edit
            </button>
            <button
              onClick={() =>
                void (async () => {
                  const { error } = await supabase
                    .from("trainer_store_items")
                    .update({ published: !item.published })
                    .eq("id", item.id)
                    .eq("trainer_id", me!);
                  if (error) toast.error(error.message);
                  else void reload(me!);
                })()
              }
            >
              {item.published ? "Unpublish" : "Publish"}
            </button>
            <button
              onClick={() => void remove(item.id)}
              className="text-destructive"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TrainerProgramManager() {
  const [me, setMe] = useState<string | null>(null),
    [programs, setPrograms] = useState<Program[]>([]),
    [videos, setVideos] = useState<{ id: string; title: string }[]>([]);
  const [title, setTitle] = useState(""),
    [selected, setSelected] = useState(""),
    [chosen, setChosen] = useState<string[]>([]);
  const [ordered, setOrdered] = useState<
    { video_id: string; position: number }[]
  >([]);
  const load = async (id: string) => {
    const [p, v] = await Promise.all([
      supabase.from("trainer_programs").select("*").eq("trainer_id", id),
      supabase
        .from("trainer_videos")
        .select("id,title")
        .eq("user_id", id)
        .eq("review_status", "approved"),
    ]);
    setPrograms((p.data ?? []) as Program[]);
    setVideos(v.data ?? []);
  };
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setMe(id);
      if (id) void load(id);
    });
  }, []);
  const loadOrder = async (id: string) => {
    const { data, error } = await supabase
      .from("trainer_program_workouts")
      .select("video_id,position")
      .eq("program_id", id)
      .order("position");
    if (error) toast.error(error.message);
    else setOrdered(data ?? []);
  };
  const create = async () => {
    if (!me || !title.trim()) return;
    const { error } = await supabase
      .from("trainer_programs")
      .insert({
        trainer_id: me,
        title: title.trim(),
        description: "",
        published: false,
      });
    if (error) toast.error(error.message);
    else {
      setTitle("");
      void load(me);
    }
  };
  const add = async () => {
    if (!selected) return;
    const ids = [...new Set([...ordered.map((x) => x.video_id), ...chosen])];
    const result = await supabase.rpc("save_program_workouts", {
      p_program_id: selected,
      p_video_ids: ids,
    });
    if (result.error) toast.error(result.error.message);
    else {
      setChosen([]);
      void loadOrder(selected);
    }
  };
  const removeWorkout = async (id: string) => {
    const result = await supabase.rpc("save_program_workouts", {
      p_program_id: selected,
      p_video_ids: ordered
        .filter((x) => x.video_id !== id)
        .map((x) => x.video_id),
    });
    if (result.error) toast.error(result.error.message);
    else void loadOrder(selected);
  };
  const move = async (index: number, delta: number) => {
    if (!selected) return;
    const next = [...ordered];
    const other = index + delta;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other]!, next[index]!];
    const { error } = await supabase.rpc("reorder_program_workouts", {
      p_program_id: selected,
      p_video_ids: next.map((x) => x.video_id),
    });
    if (error) toast.error(error.message);
    else void loadOrder(selected);
  };
  const publish = async (p: Program) => {
    const { error } = await supabase
      .from("trainer_programs")
      .update({ published: !p.published })
      .eq("id", p.id)
      .eq("trainer_id", me!);
    if (error) toast.error(error.message);
    else if (me) void load(me);
  };
  return (
    <section className="card space-y-3 p-6">
      <h2 className="text-xl font-bold">Ordered workout programs</h2>
      <p className="text-sm text-muted-foreground">
        Build a program from your approved videos. Workouts are added in the
        order you select them.
      </p>
      <div className="flex gap-2">
        <input
          className="field flex-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Program name"
        />
        <button className="btn btn-primary" onClick={() => void create()}>
          Create
        </button>
      </div>
      <select
        className="field"
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          setChosen([]);
          setOrdered([]);
          if (e.target.value) void loadOrder(e.target.value);
        }}
      >
        <option value="">Choose program</option>
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      {selected && (
        <>
          <div className="space-y-2">
            {videos.map((v) => (
              <label key={v.id} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={chosen.includes(v.id)}
                  onChange={(e) =>
                    setChosen((old) =>
                      e.target.checked
                        ? [...old, v.id]
                        : old.filter((x) => x !== v.id),
                    )
                  }
                />
                {v.title}
              </label>
            ))}
          </div>
          <button className="btn btn-outline" onClick={() => void add()}>
            Add selected in order
          </button>
          <ol className="space-y-2">
            {ordered.map((row, index) => (
              <li
                key={row.video_id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <button
                  className="btn btn-ghost"
                  onClick={() => void removeWorkout(row.video_id)}
                >
                  Remove
                </button>
                <span className="flex-1">
                  {index + 1}.{" "}
                  {videos.find((v) => v.id === row.video_id)?.title ??
                    "Workout"}
                </span>
                <button
                  disabled={index === 0}
                  className="btn btn-ghost"
                  onClick={() => void move(index, -1)}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  disabled={index === ordered.length - 1}
                  className="btn btn-ghost"
                  onClick={() => void move(index, 1)}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
      <ul>
        {programs.map((p) => (
          <li key={p.id} className="flex justify-between gap-3 py-2">
            <span>
              {p.title}
              <textarea
                className="field"
                aria-label={`Description for ${p.title}`}
                defaultValue={p.description}
                onBlur={(e) => {
                  void supabase
                    .from("trainer_programs")
                    .update({ description: e.target.value })
                    .eq("id", p.id)
                    .then((r) => {
                      if (r.error) toast.error(r.error.message);
                    });
                }}
              />{" "}
              · {p.published ? "Published" : "Draft"}
            </span>
            <button
              className="text-primary underline"
              onClick={() => void publish(p)}
            >
              {p.published ? "Unpublish" : "Publish"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
