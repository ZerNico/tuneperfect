type Success<T> = [T, null];
type Failure<E> = [null, E];
type Result<T, E = Error> = Success<T> | Failure<E>;
type MaybePromise<T> = T | Promise<T>;

export async function tryCatch<T, E = Error>(promise: MaybePromise<T>): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error as E];
  }
}
