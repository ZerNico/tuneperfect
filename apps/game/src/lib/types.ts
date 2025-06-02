export type User = LocalUser | ApiUser | GuestUser;

export interface ApiUser {
  id: string;
  username: string | null;
  image: string | null;
}

export interface GuestUser {
  id: "guest";
  username: string;
  type: "guest";
}

export interface LocalUser {
  id: string;
  username: string;
  type: "local";
}
