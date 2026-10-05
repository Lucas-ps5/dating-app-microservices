export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Normalises a wildcard route parameter back into an object key.
 *
 * MinIO stores objects as `folder/name.ext`, so the delete routes use a named
 * wildcard (`images/*objectName`). Under path-to-regexp v8 / Express 5 a
 * wildcard that spans several segments arrives as an array, and interpolating
 * that array directly yields `folder,name.ext` instead of `folder/name.ext`.
 */
export function objectNameToPath(objectName: string | string[]): string {
  return Array.isArray(objectName) ? objectName.join("/") : objectName;
}

/**
 * Normalises a caught value into a loggable string. `catch` bindings are
 * `unknown` in strict TypeScript, so reading `.message` directly is unsafe and
 * would throw again inside the logger.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}
