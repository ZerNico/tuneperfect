import type { ApiUser, GuestUser, LocalUser, User } from "~/lib/types";

export function isGuestUser(user: User): user is GuestUser {
  return "type" in user && user.type === "guest";
}

export function isLocalUser(user: User): user is LocalUser {
  return "type" in user && user.type === "local";
}

export function isApiUser(user: User): user is ApiUser {
  return "id" in user && "image" in user && !("type" in user);
} 