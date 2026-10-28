/** Offline catalog comparison. Never connects to a database or evaluates SQL from an export. */
export type MetadataRow = {
  section: string;
  object_name: string;
  details: Record<string, unknown>;
};

export function parseInspection(input: string): MetadataRow[] {
  const text = input.replace(/^\uFEFF/, "");
  let rows: MetadataRow[];
  if (text.trimStart().startsWith("[")) rows = JSON.parse(text);
  else {
    const records: string[][] = [];
    let row: string[] = [],
      cell = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (!quoted && cell !== "")
          throw new Error("Unexpected CSV quote");
        else quoted = !quoted;
      } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
        row.push(cell);
        cell = "";
        if (c !== ",") {
          if (c === "\r" && text[i + 1] === "\n") i++;
          if (row.some(Boolean)) records.push(row);
          row = [];
        }
      } else cell += c;
    }
    if (quoted)
      throw new Error("Unterminated CSV field; export may be truncated");
    if (cell || row.length) {
      row.push(cell);
      records.push(row);
    }
    if (records.shift()?.join(",") !== "section,object_name,details")
      throw new Error("Unexpected inspection CSV header");
    rows = records.map((r) => {
      if (r.length !== 3)
        throw new Error("Inspection CSV requires three columns");
      return { section: r[0]!, object_name: r[1]!, details: JSON.parse(r[2]!) };
    });
  }
  const keys = new Set<string>();
  for (const r of rows) {
    if (typeof r.details === "string") r.details = JSON.parse(r.details);
    if (
      !r.section ||
      !r.object_name ||
      !r.details ||
      typeof r.details !== "object" ||
      Array.isArray(r.details)
    )
      throw new Error("Invalid inspection row");
    const key = `${r.section}:${r.object_name}`;
    if (keys.has(key)) throw new Error(`Duplicate inspection object: ${key}`);
    keys.add(key);
  }
  const footer = rows.filter((r) => r.section === "99_report_complete");
  if (
    footer.length !== 1 ||
    footer[0]!.details["report_rows"] !== rows.length ||
    footer[0]!.details["baseline_selected"] !== false
  )
    throw new Error("Missing or mismatched completion row");
  return rows;
}

// PG18 represents NOT NULL both as an attribute and a constraint; hosted PG17
// represents it only as an attribute. Compare the column's not_null in both.
export function appObject(r: MetadataRow) {
  return (
    [
      "02_relation",
      "03_column",
      "04_constraint",
      "05_index",
      "06_policy",
      "07_trigger",
      "08_routine",
    ].includes(r.section) &&
    (r.object_name.startsWith("public.") ||
      (r.section === "06_policy" &&
        r.object_name.startsWith("storage.objects."))) &&
    !(r.section === "04_constraint" && r.details["kind"] === "n")
  );
}

function canonical(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/\r\n/g, "\n");
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function compareMetadata(
  hosted: MetadataRow[],
  expected: MetadataRow[],
) {
  const h = new Map(
    hosted.filter(appObject).map((r) => [`${r.section}:${r.object_name}`, r]),
  );
  const e = new Map(
    expected.filter(appObject).map((r) => [`${r.section}:${r.object_name}`, r]),
  );
  return [...new Set([...h.keys(), ...e.keys()])].sort().map((key) => {
    const actual = h.get(key),
      target = e.get(key),
      r = actual ?? target!;
    // Position and owner are reported separately; column order has no API effect.
    const ignored = new Set(["position", "owner"]);
    const fields =
      actual && target
        ? [
            ...new Set([
              ...Object.keys(actual.details),
              ...Object.keys(target.details),
            ]),
          ]
            .filter(
              (k) =>
                !ignored.has(k) &&
                JSON.stringify(canonical(actual.details[k])) !==
                  JSON.stringify(canonical(target.details[k])),
            )
            .sort()
        : [];
    return {
      section: r.section,
      object_name: r.object_name,
      status: !actual
        ? "missing"
        : !target
          ? "hosted_only"
          : fields.length
            ? "differs"
            : "matches",
      fields,
      owner_differs:
        actual && target
          ? actual.details["owner"] !== target.details["owner"]
          : false,
    };
  });
}

export const identifier = (s: string) => `"${s.replaceAll('"', '""')}"`;
export const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;
