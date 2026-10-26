export function reportRuntimeError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  console.error("Tryumph application error", error, context);
}
