export function forwardConsole(
  fnName: "log" | "debug" | "info" | "warn" | "error",
  logger: (message: string) => Promise<void>,
) {
  const original = console[fnName];
  console[fnName] = (...args: Parameters<typeof original>) => {
    original(...args);
    logger(args.map((arg) => arg.toString()).join(" "));
  };
}
