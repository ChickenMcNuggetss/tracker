export function isDateInRange(date: Date | string, range: { start: string; end: string } | null): boolean {
    if (!range || !range.start || !range.end) {
      return false;
    }
    const target =
      typeof date === 'string'
        ? new Date(`${date}T00:00:00`)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const start = new Date(`${range.start}T00:00:00`);
    const end = new Date(`${range.end}T00:00:00`);
    return !!(target >= start && target <= end);
  }