export const formatMinutes = (minutes: number) => {
  const wholeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(wholeMinutes / 60);
  const leftoverMinutes = wholeMinutes % 60;

  if (hours === 0) {
    return `${leftoverMinutes}m`;
  }

  if (leftoverMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${leftoverMinutes}m`;
};

export const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const leftoverSeconds = (safeSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${leftoverSeconds}`;
};

export const formatDateTime = (value?: string) => {
  if (!value) {
    return "No deadline";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export const toDateTimeInputValue = (value: Date) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const clampPercent = (value: number) => `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
