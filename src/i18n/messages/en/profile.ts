// The profile and its semesters in English: Settings → Profile, profile.ts's checks and labels, and the semester fee
// offer's source note.
export const profile = {
  heading: 'Profile',
  intro:
    'Your profile is stored on this phone and goes into any backup you export, and into your account when you save ' +
    'to it.',
  name: 'Your name',
  nameHint: 'Optional. Home greets you by this name.',
  university: 'University',
  notSet: 'Not set',
  /** The university choice that is neither UR nor OTH (the data and the MCP server call it "Other"). */
  otherUniversity: 'Other',
  semesterStart: 'Semester start',
  semesterEnd: 'Semester end',
  weeks: (weeks: number) => `Your semester: ${weeks} ${weeks === 1 ? 'week' : 'weeks'}.`,
  /** "Winter semester at OTH Regensburg: 1 Oct – 14 Mar. Change the dates if yours differ." */
  period: (term: string, university: string, period: string) =>
    `${term} at ${university}: ${period}. Change the dates if yours differ.`,
  winter: 'Winter semester',
  summer: 'Summer semester',
  save: 'Save profile',
  clearDates: 'Clear semester dates',
  saved: 'Profile saved.',
  saveFailed: 'Could not save your profile. Try again.',
  /** Why the semester dates can't be saved yet (profileProblems). */
  problems: {
    both: 'Add both semester dates, or leave both empty.',
    full: 'Enter each semester date as a full date.',
    year: 'Enter the year of each semester date with four digits, like 2026.',
    endAfterStart: 'Pick an end date after the start date.',
    tooLong: 'A semester lasts a year at most. Pick an earlier end date.',
  },
  /** The one-off the semester fee offer adds (profile.ts keeps SEMESTER_FEE_NAME, the English one, for the MCP). */
  semesterFee: 'Semester fee',
  fee: {
    noFee: "No page states this semester's fee yet, so the amount is yours to fill in.",
    dueReRegistration: (month: string) => `Due in ${month}, when re-registration is expected to open.`,
    dueBeforeSemester: (month: string) => `Due in ${month}, the month before the semester starts.`,
    /** What the re-registration month's source line is about. */
    reRegistration: 're-registration',
  },
};
