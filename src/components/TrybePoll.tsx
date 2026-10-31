import { useEffect, useRef, useState } from "react";
import {
  localPollDeadline,
  pollInput,
  pollPercent,
  type TrybePoll as Poll,
  type PollInput,
} from "@/lib/polls";
import {
  saveTrybePoll,
  voteTrybePoll,
  closeTrybePoll,
} from "@/lib/polls.functions";
import { Avatar } from "./Avatar";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Poll action failed. Please retry.";
export function PollEditor({
  trybe,
  initial,
  onSaved,
  onCancel,
}: {
  trybe: string;
  initial?: Poll;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const [question, setQuestion] = useState(initial?.question ?? ""),
    [description, setDescription] = useState(initial?.description ?? ""),
    [options, setOptions] = useState(
      initial?.options.map((o) => o.label) ?? ["", ""],
    ),
    [multiple, setMultiple] = useState((initial?.maxSelections ?? 1) > 1),
    [maximum, setMaximum] = useState(initial?.maxSelections ?? 2),
    [expires, setExpires] = useState(() => {
      if (!initial?.expiresAt) return "";
      const d = new Date(initial.expiresAt);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    }),
    [notify, setNotify] = useState(false),
    [visibility, setVisibility] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="card space-y-3 p-4"
      aria-label={initial ? "Edit poll" : "Create a Trybe poll"}
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        void (async () => {
          try {
            const data: PollInput = pollInput.parse({
              trybe,
              question,
              description,
              options,
              maxSelections: multiple ? maximum : 1,
              expiresAt: localPollDeadline(expires),
              notify,
              public: visibility,
              ...(initial
                ? { id: initial.id, revision: initial.revision }
                : {}),
            });
            const id = await saveTrybePoll({ data });
            onSaved(id);
          } catch (err) {
            setError(message(err));
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-bold">
          {initial ? "Edit poll before voting begins" : "Ask your Trybe"}
        </legend>
        <label className="block">
          Poll question
          <input
            className="field"
            value={question}
            required
            maxLength={500}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <label className="block">
          Context (optional)
          <textarea
            className="field"
            value={description}
            maxLength={1400}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {options.map((option, i) => (
          <div className="flex items-end gap-2" key={i}>
            <label className="flex-1">
              Answer {i + 1}
              <input
                className="field"
                required
                maxLength={200}
                value={option}
                onChange={(e) =>
                  setOptions((old) =>
                    old.map((v, j) => (j === i ? e.target.value : v)),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={options.length <= 2}
              aria-label={`Remove answer ${i + 1}`}
              onClick={() => {
                setOptions((old) => old.filter((_, j) => j !== i));
                setMaximum((n) => Math.min(n, options.length - 1));
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline"
          disabled={options.length >= 6}
          onClick={() => setOptions((old) => [...old, ""])}
        >
          Add answer
        </button>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={multiple}
            onChange={(e) => setMultiple(e.target.checked)}
          />
          Allow multiple choices
        </label>
        {multiple && (
          <label className="block">
            Maximum selections
            <input
              className="field"
              type="number"
              min={2}
              max={options.length}
              required
              value={maximum}
              onChange={(e) => setMaximum(Number(e.target.value))}
            />
          </label>
        )}
        <label className="block">
          Close voting at (your local time; optional)
          <input
            className="field"
            type="datetime-local"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </label>
        {!initial && (
          <>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Notify eligible members who opted into poll notifications
            </label>
            {trybe.startsWith("coach-") && (
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={visibility}
                  onChange={(e) => setVisibility(e.target.checked)}
                />
                Show the question in public discovery (voting stays member-only)
              </label>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Votes are feedback, not bookings, purchases or subscriptions. Once
          voting begins the question, answers and selection rules are locked.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary" type="submit">
            {busy ? "Saving…" : initial ? "Save poll changes" : "Publish poll"}
          </button>
          {onCancel && (
            <button className="btn btn-ghost" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
export function TrybePollCard({
  poll,
  onUpdate,
  onRefresh,
  admin = false,
}: {
  poll: Poll;
  onUpdate: (p: Poll) => void;
  onRefresh: () => void;
  admin?: boolean;
}) {
  const reasonRequired = admin || poll.requiresCloseReason;
  const [chosen, setChosen] = useState(poll.mine),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [reason, setReason] = useState("");
  const callback = useRef(onRefresh);
  callback.current = onRefresh;
  useEffect(() => {
    setChosen(poll.mine);
  }, [poll.id, poll.mine]);
  useEffect(() => {
    if (!poll.expiresAt || poll.closed) return;
    const deadline = new Date(poll.expiresAt).getTime();
    let timer: number;
    const schedule = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        callback.current();
        return;
      }
      timer = window.setTimeout(schedule, Math.min(remaining + 50, 2147483647));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [poll.expiresAt, poll.closed]);
  const run = async (action: () => Promise<Poll>) => {
    setBusy(true);
    setError("");
    try {
      onUpdate(await action());
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  if (editing)
    return (
      <PollEditor
        trybe={poll.trybe}
        initial={poll}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onRefresh();
        }}
      />
    );
  return (
    <section
      aria-label="Trybe community poll"
      id={`poll-${poll.id}`}
      className="mt-3 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Avatar
          initials={poll.creatorName.slice(0, 2).toUpperCase()}
          src={poll.creatorAvatar ?? undefined}
          size="sm"
        />
        <span className="text-sm">{poll.creatorName}</span>
        <time className="ml-auto text-xs" dateTime={poll.createdAt}>
          {new Date(poll.createdAt).toLocaleString()}
        </time>
      </div>
      <h3 className="text-lg font-bold">{poll.question}</h3>
      {poll.description && (
        <p className="whitespace-pre-wrap text-sm">{poll.description}</p>
      )}
      <p className="text-sm">
        {poll.closed
          ? "Voting closed"
          : poll.expiresAt
            ? `Voting closes ${new Date(poll.expiresAt).toLocaleString()}`
            : "Voting open"}{" "}
        · {poll.voters} {poll.voters === 1 ? "voter" : "voters"}
      </p>
      {poll.maxSelections > 1 && (
        <p className="text-xs">
          Choose up to {poll.maxSelections}. Percentages count participating
          voters and may total more than 100%.
        </p>
      )}
      <fieldset disabled={busy || !poll.mayVote} className="space-y-3">
        <legend className="sr-only">{poll.question}</legend>
        {poll.options.map((option) => (
          <label key={option.id} className="block rounded border p-3">
            <span className="flex items-center gap-2">
              <input
                type={poll.maxSelections === 1 ? "radio" : "checkbox"}
                name={`poll-${poll.id}`}
                checked={chosen.includes(option.id)}
                onChange={(e) => {
                  setChosen((old) =>
                    poll.maxSelections === 1
                      ? [option.id]
                      : e.target.checked
                        ? [...old, option.id]
                        : old.filter((id) => id !== option.id),
                  );
                }}
              />
              <span className="break-words">{option.label}</span>
              {poll.resultsVisible && (
                <span className="ml-auto text-sm">
                  {pollPercent(option.votes ?? 0, poll.voters)}% ·{" "}
                  {option.votes ?? 0}
                </span>
              )}
            </span>
            {poll.resultsVisible && (
              <progress
                className="mt-2 h-2 w-full"
                max={100}
                value={pollPercent(option.votes ?? 0, poll.voters)}
                aria-label={`${option.label} percentage of voters`}
              />
            )}
          </label>
        ))}
      </fieldset>
      {poll.resultsVisible && poll.voters === 0 && <p>No votes yet.</p>}
      {!poll.resultsVisible && (
        <p className="text-xs">
          Trybe members can view results after voting or when the poll closes.
          Individual ballots stay private.
        </p>
      )}
      {poll.mayVote ? (
        <button
          className="btn btn-primary"
          disabled={
            busy || !chosen.length || chosen.length > poll.maxSelections
          }
          onClick={() =>
            void run(() =>
              voteTrybePoll({
                data: { id: poll.id, options: chosen, revision: poll.revision },
              }),
            )
          }
        >
          {busy ? "Saving…" : poll.mine.length ? "Change vote" : "Submit vote"}
        </button>
      ) : (
        !poll.closed && (
          <p className="text-sm">Sign in and join this Trybe to vote.</p>
        )
      )}
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" disabled={busy} onClick={onRefresh}>
          Refresh poll
        </button>
        {poll.mayEdit && (
          <button
            className="btn btn-outline"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            Edit poll
          </button>
        )}
        {poll.mayClose && (
          <>
            {reasonRequired && (
              <label>
                Moderation reason
                <input
                  className="field"
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <button
              className="btn btn-outline"
              disabled={busy || (reasonRequired && reason.trim().length < 3)}
              onClick={() => {
                if (
                  window.confirm(
                    "Close this poll? Existing votes will be preserved.",
                  )
                )
                  void run(() =>
                    closeTrybePoll({ data: { id: poll.id, reason } }),
                  );
              }}
            >
              Close poll
            </button>
          </>
        )}
      </div>
    </section>
  );
}
