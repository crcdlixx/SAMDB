const publicAccessFields = new Set([
  "accessId",
  "accessType",
  "platform",
  "url",
  "availability",
  "accessNote",
  "lastVerified",
  "access_id",
  "access_type",
  "access_note",
  "last_verified"
]);

export function filterPublicAccessEntry<T extends Record<string, unknown>>(entry: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(entry).filter(([key]) => publicAccessFields.has(key))
  ) as Partial<T>;
}

export function filterPublicList<T extends Record<string, unknown>>(items: T[]): Array<Partial<T>> {
  return items.map((item) => filterPublicAccessEntry(item));
}
