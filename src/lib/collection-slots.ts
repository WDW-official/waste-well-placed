// Collection windows use London wall-clock time, including British Summer Time.
export function collectionSlots(now = new Date(), days = 14, capacity = 3) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const slots: { start: Date; end: Date; capacity: number }[] = [];
  for (let day = 1; day <= days; day++) {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + day);
    if (date.getUTCDay() === 0) continue;
    const londonHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(date),
    );
    const offsetHours = londonHour - 12;
    for (const hour of [9, 11, 13, 15]) {
      const start = new Date(date);
      start.setUTCHours(hour - offsetHours, 0, 0, 0);
      slots.push({ start, end: new Date(start.getTime() + 7200000), capacity });
    }
  }
  return slots;
}
