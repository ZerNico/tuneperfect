type Success<T> = [null, T];
type Failure<E> = [E, null];
type Result<T, E = Error> = Success<T> | Failure<E>;

export async function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error as E, null];
  }
}
