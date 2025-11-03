import { DateTime } from "luxon";

/**
 * Calculates the next valid pick deadline given:
 *  - 8-hour time limit per pick
 *  - Only active between 8AM–10PM EST
 *
 * Returns a Luxon DateTime object for the deadline.
 */
export function calculateDeadline(now = DateTime.now().setZone("America/New_York")) {
  const startOfDay = now.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
  const endOfDay = now.set({ hour: 22, minute: 0, second: 0, millisecond: 0 });

  // If it's before 8AM, start counting from 8AM
  if (now < startOfDay) now = startOfDay;

  // If it's after 10PM, start counting from tomorrow 8AM
  if (now > endOfDay) now = startOfDay.plus({ days: 1 });

  let deadline = now.plus({ hours: 8 });

  // If deadline exceeds 10PM, roll over the remaining hours to next day 8AM
  if (deadline > endOfDay) {
    const overflowHours = deadline.diff(endOfDay, "hours").hours;
    deadline = startOfDay.plus({ days: 1, hours: overflowHours });
  }

  return deadline;
}

/**
 * Formats the deadline in a nice human-readable form for Slack messages.
 * Example output: "5:30 PM EST"
 */
export function formatDeadline(deadline) {
  return deadline.toFormat("h:mm a 'EST'");
}
