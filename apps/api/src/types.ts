import type { InferSelectModel } from "drizzle-orm";
import type * as schema from "./lib/db/schema";

export type User = Omit<InferSelectModel<typeof schema.users>, "password">;
export type UserWithPassword = InferSelectModel<typeof schema.users>;