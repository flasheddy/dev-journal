export type DatedEntry = { data: { date: Date; updated?: Date } };

export function isUpdated(post: DatedEntry): boolean {
  return Boolean(post.data.updated && post.data.updated.valueOf() !== post.data.date.valueOf());
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: Date, month: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat('en-US', {
    month,
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
