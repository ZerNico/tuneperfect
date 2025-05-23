import pino from "pino";
import pretty from "pino-pretty";

const stream = pretty({
  colorize: true,
  translateTime: "SYS:standard",
  ignore: "pid,hostname",
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
  },
  stream,
);

export const createLogger = (component: string) => {
  return logger.child({ component });
};
