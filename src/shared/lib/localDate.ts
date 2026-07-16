const LOCAL_DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function parseLocalDateKey(dateKey: string): Date | null {
  const match = LOCAL_DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addLocalDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

export function addLocalMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function moveLocalDateByCalendarKey(date: Date, key: string): Date | null {
  const mondayFirstDay = (date.getDay() + 6) % 7;
  const dayOffset = key === "ArrowRight"
    ? 1
    : key === "ArrowLeft"
      ? -1
      : key === "ArrowDown"
        ? 7
        : key === "ArrowUp"
          ? -7
          : key === "Home"
            ? -mondayFirstDay
            : key === "End"
              ? 6 - mondayFirstDay
              : null;
  return dayOffset === null ? null : startOfLocalDay(addLocalDays(date, dayOffset));
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function buildMondayFirstCalendarGrid(month: Date): Date[] {
  const monthStart = startOfLocalMonth(month);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = addLocalDays(monthStart, -mondayOffset);

  return Array.from({ length: 42 }, (_, index) => addLocalDays(gridStart, index));
}
