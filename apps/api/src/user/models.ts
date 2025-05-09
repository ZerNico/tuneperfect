import * as v from "valibot";

export const UsernameSchema = v.pipe(
  v.string(),
  v.minLength(3, "Username must be at least 3 characters long"),
  v.maxLength(20, "Username must be less than 20 characters long"),
  v.regex(/^[a-zA-Z0-9_]+$/, "Username must contain only letters, numbers, and underscores"),
);
