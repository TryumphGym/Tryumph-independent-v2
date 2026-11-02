/** An explicit service choice overrides legacy positive-rate profiles without rewriting them. */
export function offersPrivateCoaching(trainer: {
  rate?: unknown;
  services?: unknown;
}) {
  return (
    typeof trainer.rate === "number" &&
    Number.isFinite(trainer.rate) &&
    trainer.rate >= 2 &&
    trainer.rate <= 1000 &&
    (!Array.isArray(trainer.services) || trainer.services.includes("coaching"))
  );
}
