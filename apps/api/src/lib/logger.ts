import pino from "pino";


export const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
  level: process.env.LOG_LEVEL || "info",
});

export const createLogger = (component: string) => {
  return logger.child({ component });
}; 