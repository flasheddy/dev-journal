export type DatedPost = { id: string; data: { date: Date } };
export type OrderedProject = { id: string; data: { order: number } };

export function sortPostsByDate<T extends DatedPost>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) => {
    const byDate = b.data.date.valueOf() - a.data.date.valueOf();
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
}

export function sortProjectsByOrder<T extends OrderedProject>(projects: readonly T[]): T[] {
  return [...projects].sort((a, b) => {
    const byOrder = a.data.order - b.data.order;
    return byOrder !== 0 ? byOrder : a.id.localeCompare(b.id);
  });
}
