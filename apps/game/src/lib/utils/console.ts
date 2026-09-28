/** Also passes everything logged with `console[fnName]` to `logger`, e.g. the app's log file. */
export function forwardConsole(
  fnName: "log" | "debug" | "info" | "warn" | "error",
  logger: (message: string) => unknown,
) {
  const original = console[fnName];
  console[fnName] = (...args: Parameters<typeof original>) => {
    original(...args);
    void Promise.resolve(logger(args.map((arg) => String(arg)).join(" "))).catch(() => {});
  };
}
