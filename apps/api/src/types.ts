import type { InferSelectModel } from "drizzle-orm";
import type * as schema from "./lib/db/schema";

export type User = InferSelectModel<typeof schema.users>;
