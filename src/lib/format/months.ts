// Month names as the portal writes them (audit, 15 October 2026), in place of
// the nineteen hand-written lists that each screen and export used to carry.
// English always, whatever the reader's locale: "Oct 9, 2026", "October 2026".
// Indexed from 0, as Date.getMonth() is, so a "YYYY-MM" month m is [m - 1].

/** "Jan" to "Dec". */
export const MONTH_SHORT: readonly string[] = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** "January" to "December". */
export const MONTH_LONG: readonly string[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
