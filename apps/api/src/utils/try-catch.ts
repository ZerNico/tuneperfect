type Success<T> = [null, T];
type Failure<E> = [E, null];
type Result<T, E = Error> = Success<T> | Failure<E>;

export async function tryCatch<T, E = Error>(fn: (() => T | Promise<T>) | Promise<T>): Promise<Result<T, E>> {
  try {
    const data = await (fn instanceof Promise ? fn : (fn as () => T | Promise<T>)());
    return [null, data];
  } catch (error) {
    return [error as E, null];
  }
}
