export class AuthError extends Error {
  status: number;
  statusText: string;

  constructor(error: {
    message?: string | undefined;
    status: number;
    statusText: string;
  }) {
    super(error.message ?? error.statusText);
    this.name = "AuthError";
    this.status = error.status;
    this.statusText = error.statusText;
  }
}
