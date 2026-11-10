import type { IsoDate } from '@/lib/dates';

/** The checklist's two groups, in the order the list shows them: what to get done first, then money to claim. */
export const CHECKLIST_GROUPS = ['first-weeks', 'money'] as const;
export type ChecklistGroup = (typeof CHECKLIST_GROUPS)[number];

/** Who an item is for: a tag on the item, never a filter that hides it. */
export const CHECKLIST_WHO = ['everyone', 'from-abroad', 'bafoeg', 'under-25'] as const;
export type ChecklistWho = (typeof CHECKLIST_WHO)[number];

export type ChecklistItem = {
  id: string;
  title: string;
  body: string;
  group: ChecklistGroup;
  who: ChecklistWho;
  /** The tip that says more, where one does (src/data/tips.ts). */
  tipId?: string;
  source: string;
  url: string;
  checked: IsoDate;
};

/** The pages read for the items this checklist added (checklist plan, chunk 1). */
const CHECKED: IsoDate = '2026-11-10';
/** The tips' own check: an item that leans on a tip cites its page as the tip read it. */
const TIP_CHECKED: IsoDate = '2026-10-20';

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';
const RUNDFUNK_URL = 'https://www.rundfunkbeitrag.de/buergerinnen-und-buerger/informationen/informationen-fuer-studierende';

/**
 * What a student new to Regensburg gets done in the first weeks, and the money they can claim (checklist plan,
 * docs/superpowers/plans/2026-11-10-checklist.md). Every item is stated on its source page, opened on its checked
 * date; an item no page states is left out. Within a group, the most pressing comes first.
 *
 * Left out on purpose: the Bürgerbüro's and the foreigners' office's own pages (regensburg.de answers automated reads
 * with 503, so the law and the university's pages are cited instead), OTH's enrolment page (not read), and a deadline
 * the university's registration page gives that differs from the law's (7 to 14 days against two weeks).
 */
export const CHECKLIST: ChecklistItem[] = [
  {
    id: 'register-your-address',
    title: 'Register your address',
    body: 'Register at the city’s registration office within two weeks of moving in.',
    group: 'first-weeks',
    who: 'everyone',
    source: 'Bundesmeldegesetz § 17 (1): whoever moves into a flat must register with the registration office within two weeks of moving in',
    url: 'https://www.gesetze-im-internet.de/bmg/__17.html',
    checked: CHECKED,
  },
  {
    id: 'health-insurance-for-enrolment',
    title: 'Have your health insurance sent to the university',
    body: 'Your statutory health insurer sends the proof electronically, with the university’s number H0000341; paper proof isn’t accepted. Insured privately or abroad? A statutory insurer checks your status and sends it.',
    group: 'first-weeks',
    who: 'everyone',
    source:
      'Universität Regensburg, proof of health insurance: needed in electronic form, sent by the statutory insurer with the university number H0000341; paper proof not enough since 1 Jan 2022; private and foreign insurers cannot send it, so a statutory insurer checks the status and sends it',
    url: 'https://www.uni-regensburg.de/studieren/wege-ins-studium/zugang-bewerbung-und-einschreibung/einschreibung/krankenversicherung',
    checked: CHECKED,
  },
  {
    id: 'residence-permit',
    title: 'Apply for your residence permit',
    body: 'From outside the EU? Apply to the city’s foreigners’ office before your entry visa runs out, or within your first 90 days if you came without one.',
    group: 'first-weeks',
    who: 'from-abroad',
    source:
      'Universität Regensburg, International Office, residence permit for non-EU students: apply to the responsible foreigners’ office before an entry visa runs out; without a visa, within the first 90 days of the stay',
    url: 'https://www.uni-regensburg.de/international/wege-nach-regensburg/studienabschluss-an-der-ur/aufenthaltstitel',
    checked: CHECKED,
  },
  {
    id: 'open-a-bank-account',
    title: 'Open a bank account',
    body: 'Anyone legally resident in the EU has the right to a basic account, even without a fixed address.',
    group: 'first-weeks',
    who: 'everyone',
    source:
      'Zahlungskontengesetz § 31 (1): every consumer legally resident in the European Union, including people without a fixed address, has the right to a basic payment account',
    url: 'https://www.gesetze-im-internet.de/zkg/__31.html',
    checked: CHECKED,
  },
  {
    id: 'register-for-the-rundfunkbeitrag',
    title: 'Sort out the Rundfunkbeitrag',
    body: 'One adult per flat registers and pays it; in a shared flat, agree who does.',
    group: 'first-weeks',
    who: 'everyone',
    tipId: 'split-the-rundfunkbeitrag',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, information for students: €18.36 a month per flat; only one adult per flat registers and pays',
    url: RUNDFUNK_URL,
    checked: TIP_CHECKED,
  },
  {
    id: 'apply-for-bafoeg',
    title: 'Apply for BAföG',
    body: 'Apply through BAföG Digital as early as you can: it is paid from the month your application arrives, never before your studies begin.',
    group: 'money',
    who: 'everyone',
    source: `${STWNO}, BAföG: apply through BAföG Digital, as early as possible; funding is granted from the month the application arrives, at the earliest from the start of studies; the Regensburg office serves Universität Regensburg and OTH Regensburg`,
    url: 'https://stwno.de/de/finanzierung/bafoeg',
    checked: CHECKED,
  },
  {
    id: 'claim-the-study-start-grant',
    title: 'Claim the study start grant',
    body: 'Starting your first degree under 25 and on social benefits? A one-off €1,000 that you never pay back.',
    group: 'money',
    who: 'under-25',
    tipId: 'studienstarthilfe',
    source: `${STWNO}, BAföG Studienstarthilfe: a one-off €1,000 grant, not repaid, for first-time full-time students under 25 who receive social benefits; apply via BAföG Digital by the end of the month after the start`,
    url: 'https://stwno.de/de/finanzierung/bafoeg-studienstarthilfe',
    checked: TIP_CHECKED,
  },
  {
    id: 'keep-kindergeld',
    title: 'Keep Kindergeld coming',
    body: 'Your parents can get Kindergeld for you during a first degree, until the day before your 25th birthday.',
    group: 'money',
    who: 'under-25',
    source:
      'Bundesagentur für Arbeit, Familienkasse, Kindergeld from 18: paid between 18 and the completed 25th year for a child in a first training or degree; the 25th year ends with the day before the 25th birthday',
    url: 'https://www.arbeitsagentur.de/familie-und-kinder/infos-rund-um-kindergeld/kindergeld-ab-18-jahren',
    checked: CHECKED,
  },
  {
    id: 'stay-on-family-insurance',
    title: 'Stay on family health insurance',
    body: 'Free until your 25th birthday while you earn little. Check before you take on a bigger job.',
    group: 'money',
    who: 'under-25',
    tipId: 'stay-on-family-insurance',
    source: `${STWNO}, health and care insurance: free family insurance until the 25th birthday; in 2026 up to €565 a month from a regular job or €603 from a minijob`,
    url: 'https://stwno.de/de/beratung/sozialberatung/kranken-pflegeversicherung',
    checked: TIP_CHECKED,
  },
  {
    id: 'check-wohngeld',
    title: 'Check Wohngeld',
    body: 'No BAföG entitlement in principle? Wohngeld may help with rent, with Regensburg as your main residence.',
    group: 'money',
    who: 'everyone',
    tipId: 'check-wohngeld',
    source: `${STWNO}, Wohngeld: possible only without a BAföG entitlement in principle, and the study town must be the main residence`,
    url: 'https://stwno.de/de/beratung/sozialberatung/studium-geld/wohngeld',
    checked: TIP_CHECKED,
  },
  {
    id: 'rundfunkbeitrag-exemption',
    title: 'Apply for the Rundfunkbeitrag exemption',
    body: 'On BAföG and not living with your parents? You can be exempted, on application.',
    group: 'money',
    who: 'bafoeg',
    tipId: 'rundfunkbeitrag-bafoeg-exemption',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, information for students: BAföG recipients who do not live with their parents can be exempted on application',
    url: RUNDFUNK_URL,
    checked: TIP_CHECKED,
  },
];
