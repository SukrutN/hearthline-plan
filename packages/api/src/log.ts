export type LogFields = Record<string, string | number | boolean | null>;

export type Logger = (level: "info" | "warn" | "error", message: string, fields?: LogFields) => void;

export const jsonLogger: Logger = (level, message, fields) => {
  const line = { time: new Date().toISOString(), level, message, ...fields };
  console.log(JSON.stringify(line));
};
