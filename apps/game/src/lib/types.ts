export type User = LocalUser | ApiUser;

export interface LocalUser {
  id: string;
  username: string;
  image: string | null;
  type: "local";
}

export interface ApiUser {
  id: string;
  username: string | null;
  image: string | null;
}
