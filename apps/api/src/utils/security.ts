import { hasProtocol, parseURL } from "ufo";

export async function executeWithConstantTime<T>(fn: () => Promise<T>, targetTimeMs: number) {
  const startTime = performance.now();

  try {
    const result = await fn();
    const elapsedTime = performance.now() - startTime;
    const remainingTime = Math.max(0, targetTimeMs - elapsedTime);

    if (remainingTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
    }

    return result;
  } catch (error) {
    const elapsedTime = performance.now() - startTime;
    const remainingTime = Math.max(0, targetTimeMs - elapsedTime);

    if (remainingTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
    }

    throw error;
  }
}

export function isValidRedirectUrl(redirectUrl?: string, allowedDomains: string[] = []): boolean {
  if (!redirectUrl || allowedDomains.length === 0) {
    return false;
  }

  try {
    const parsedRedirect = parseURL(redirectUrl);

    for (const domain of allowedDomains) {
      try {
        const parsedDomain = parseURL(domain);
        if (parsedRedirect.host === parsedDomain.host && parsedRedirect.protocol === parsedDomain.protocol) {
          return true;
        }
      } catch {
        // Skip invalid domains
      }
    }

    return false;
  } catch {
    return false;
  }
}
