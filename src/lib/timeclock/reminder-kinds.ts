/**
 * The reminders Clocky sends (Company settings > Reminders, 13C): pure, so
 * the settings screen (a client component) can read the list.
 */

export const REMINDERS = [
  { key: 'contractor_due', text: 'Your October timesheet is due tomorrow', who: 'Contractors (monthly)', when: 'The day before the month ends, 9:00 AM in their time zone' },
  { key: 'pay_period_ends', text: 'Your pay period ends Saturday', who: 'Employees (every 2 weeks)', when: 'The Thursday before the pay period ends' },
  { key: 'late', text: 'Submit October: it is 3 days late', who: 'The person, and the Super Admins', when: 'Every morning from the first day late, for the person and the Super Admins' },
  { key: 'allowance', text: 'You have used 90% of your allowance', who: 'The person at 90% and at 100%; Team Leader and Super Admins when someone goes over without approval', when: 'When it happens' },
  { key: 'birthday', text: "Today: Joy Inyele's birthday", who: 'Everyone, unless they turn it off in their settings', when: "7:00 AM in each person's time zone" },
] as const
export type ReminderKey = typeof REMINDERS[number]['key']
