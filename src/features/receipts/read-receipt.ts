import type { Category, Entry } from '@/db/types';
import { categorize } from '@/features/import/categorize';
import { parseStatementDate } from '@/features/import/dates';
import { chainRule, fold, merchantKey } from '@/features/import/merchants';
import { importNote } from '@/features/import/note';
import { daysBetween, type IsoDate } from '@/lib/dates';
import { parseAmount, type Minor } from '@/lib/money';

// The receipt reader (receipt scan, chunk 2): the text a phone's OCR read from a shop receipt becomes one expense
// reading, which the student checks before it saves. Pure and on the phone: no photo, text or reading leaves it, and
// no AI. What it can't find stays null, and the card asks the student for it instead of guessing.

export type ReceiptReading = {
  /** The receipt's total, or null. */
  amountMinor: Minor | null;
  /** The day on the receipt, if it is today or at most MAX_RECEIPT_AGE_DAYS days before, else null. */
  date: IsoDate | null;
  /** The shop as the receipt names it, cleaned like an import's note, or null. */
  shop: string | null;
  /** The entry's note: the shop, or '' without one. */
  note: string;
  /** The shop's category (the student's earlier choice, the chain list, else Other), or null without a shop. */
  categoryId: string | null;
};

export type ReceiptContext = { today: IsoDate; history: readonly Entry[]; categories: readonly Category[] };

/** The oldest receipt date read: older ones, like any future one, are more likely misread than meant. */
export const MAX_RECEIPT_AGE_DAYS = 60;

/** How many lines from the top can name the shop, at most: the head ends earlier at the first amount. */
const HEAD_LINES = 8;

// OCR's usual misreadings in a number: O for 0, l, I or | for 1. Only fixed inside something shaped like an amount or a
// date with at least one real digit ("1O,49", "O9.11.2O26"), never in words, nor in a size in litres ("0,5l").
const NUMBERISH = /(?<![\p{L}\p{N}])[\dOoIl|]{1,4}(?:[.,-][\dOoIl|]{1,4}){1,2}(?![\p{L}\p{N}])/gu;
const DIGIT_FOR: Readonly<Record<string, string>> = { O: '0', o: '0', I: '1', l: '1', '|': '1' };

// An amount with two decimals and a comma or a point ("23,45", "23.45", "1.099,00"), not part of a date, a weight
// ("0,534 kg") or a longer number.
const AMOUNT = /(?<![\d.,])(?:\d{1,3}(?:[.,]\d{3})+|\d{1,5})[.,]\d{2}(?![.,]?\d)/g;
// A line that holds nothing but an amount, with its currency and a tax class letter: a total's amount OCR put on the
// line under its label.
const BARE_AMOUNT = /^(?:eur|€)?\s*[\d.,]+\s*(?:eur|€)?\s*[a-z]?$/;

// What a line is about, read on the folded text (lower case, umlauts written out). The total comes from the first
// TOTAL line, else the first AMOUNT_WORD line, else what was paid; never a tax, given, change or savings line.
const TOTAL =
  /\b(?:summe|su(?:m|rn)(?:m|rn)e|gesamt|gesamtsumme|gesamtbetrag|gesamtpreis|endsumme|endbetrag|rechnungsbetrag|zahlbetrag|zu zahlen|total|amount due|balance due|to pay)\b/;
const AMOUNT_WORD = /\b(?:betrag|amount)\b/;
const SUBTOTAL = /\b(?:zwischensumme|sub ?-?total)\b/;
const TAX = /\b(?:mwst\w*|mw\.?\s?st|ust|steuer\w*|netto\w*|brutto\w*|vat|tax\w*|inkl)\b|%/;
const GIVEN = /\b(?:gegeben|geg|tendered|given)\b/;
const CHANGE = /\b(?:rueckgeld|wechselgeld|zurueck|change|retour)\b/;
const SAVINGS =
  /\b(?:rabatt\w*|gespart|ersparnis|preisvorteil|savings?|saved|discount|coupon|gutschein\w*|pfand|leergut|punkte|payback|bonus\w*)\b/;
const CARD =
  /\b(?:ec|karte|kartenzahlung|girocard|maestro|vpay|visa|mastercard|debit|kreditkarte|card|kontaktlos|contactless|amex|apple pay|google pay|paypal)\b/;
const CASH = /\b(?:bar|barzahlung|bargeld|cash)\b/;

// Lines of the head that don't name the shop.
const POSTCODE = /\b\d{5}\b/;
const STREET = /(?:strasse|str\.|weg|gasse|platz|allee|ring|damm|ufer|graben|markt|street|road)\s*\d/;
const HOUSE_NUMBER = /\p{L}\.?\s+\d{1,4}\s?[a-z]?$/u;
const PHONE = /\b(?:tel|telefon|fon|phone|fax|mobil)\b|\+\d{2}|\d{3,5}\s?[/-]\s?\d{3,}|\b\d{4,5} \d{5,}\b/;
const TAX_NUMBER = /\b(?:ust|uid|st\.?-?nr|steuer\w*|vat|tax|mwst)\b|\b[a-z]{2} ?\d{9}\b/;
const TIME = /\b\d{1,2}:\d{2}\b/;
const WEB = /www\.|https?:|@|\.(?:de|com|eu)\b/;
/** Words a receipt's head prints that are no shop's name. */
const RECEIPT_WORDS = new Set([
  'kassenbon', 'kassenbeleg', 'beleg', 'kundenbeleg', 'haendlerbeleg', 'quittung', 'rechnung', 'bon', 'nr', 'kasse',
  'filiale', 'eur', 'euro', 'kopie', 'original', 'herzlich', 'willkommen', 'vielen', 'dank', 'danke', 'receipt',
  'invoice', 'copy', 'welcome', 'thank', 'you',
]);

const DAY_FIRST = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?![.,]?\d)/g;
const YEAR_FIRST = /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g;

type Amount = { minor: Minor; negative: boolean };
type Line = { text: string; folded: string; amounts: Amount[] };

/** The reading of a receipt's OCR text. Empty text reads as all nulls. */
export function readReceipt(text: string, ctx: ReceiptContext): ReceiptReading {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((raw) => fixDigits(raw).replace(/\s+/g, ' ').trim())
    .filter((raw) => raw !== '')
    .map((raw): Line => ({ text: raw, folded: fold(raw), amounts: amountsIn(raw) }));

  const amountMinor = totalOf(lines);
  const shop = shopOf(lines);
  const categoryId =
    shop === null
      ? null
      : categorize({ amountMinor: -(amountMinor ?? 1), payee: shop, purpose: '' }, ctx.history, ctx.categories).categoryId;
  return { amountMinor, date: dateOf(lines, ctx.today), shop, note: shop ?? '', categoryId };
}

function fixDigits(line: string): string {
  return line.replace(NUMBERISH, (token) =>
    /\d/.test(token) && !/\dl$/.test(token) ? token.replace(/[OoIl|]/g, (char) => DIGIT_FOR[char] ?? char) : token,
  );
}

function amountsIn(line: string): Amount[] {
  const found: Amount[] = [];
  for (const match of line.matchAll(AMOUNT)) {
    const minor = parseAmount(match[0]);
    if (minor === null) continue;
    const before = line.slice(0, match.index);
    const after = line.slice(match.index + match[0].length);
    found.push({ minor, negative: /[-−–]\s?$/.test(before) || after.startsWith('-') });
  }
  return found;
}

/** A tax block's line: one naming a tax, or a table row with three amounts (net, tax, gross), whatever its label. */
const isTax = (line: Line) => TAX.test(line.folded) || line.amounts.length >= 3;

/** Lines whose amount is never the total. */
const neverTotal = (line: Line) => isTax(line) || GIVEN.test(line.folded) || CHANGE.test(line.folded) || SAVINGS.test(line.folded);

/**
 * The amount a line stands for: its last amount that isn't negative, or, for a label alone ("SUMME"), the amount on the
 * line under it when that line holds nothing else.
 */
function amountAt(lines: readonly Line[], index: number): Minor | null {
  const own = lines[index].amounts.filter((amount) => !amount.negative);
  if (own.length > 0) return own[own.length - 1].minor;
  if (lines[index].amounts.length > 0) return null;
  const next = lines[index + 1];
  if (next === undefined || next.amounts.length !== 1 || next.amounts[0].negative) return null;
  return BARE_AMOUNT.test(next.folded) ? next.amounts[0].minor : null;
}

function totalOf(lines: readonly Line[]): Minor | null {
  for (const label of [TOTAL, AMOUNT_WORD]) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!label.test(line.folded) || SUBTOTAL.test(line.folded) || neverTotal(line)) continue;
      const amount = amountAt(lines, index);
      if (amount !== null) return amount;
    }
  }
  return paidOf(lines) ?? largestInLowerHalf(lines);
}

/** Without a total line: what a card paid, or the cash paid (or given) less the change. */
function paidOf(lines: readonly Line[]): Minor | null {
  for (let index = 0; index < lines.length; index += 1) {
    const { folded } = lines[index];
    const card = CARD.test(folded);
    const cash = CASH.test(folded);
    const given = GIVEN.test(folded);
    if (!card && !cash && !given) continue;
    if (isTax(lines[index]) || CHANGE.test(folded) || SAVINGS.test(folded)) continue;
    const paid = amountAt(lines, index);
    if (paid === null) continue;
    if (card) return paid;
    const change = changeAfter(lines, index);
    if (change !== null) {
      if (change < paid) return paid - change;
      continue;
    }
    // Cash with no change line was paid exactly; an amount only "given" is never the total.
    if (cash) return paid;
  }
  return null;
}

/** The change on the first change line after `index` (0 when it prints none, "0,00"), or null without one. */
function changeAfter(lines: readonly Line[], index: number): Minor | null {
  const line = lines.slice(index + 1).find((candidate) => CHANGE.test(candidate.folded));
  if (line === undefined) return null;
  return line.amounts[line.amounts.length - 1]?.minor ?? 0;
}

/** The last resort: the largest amount in the lower half, where totals stand, leaving out the lines never a total. */
function largestInLowerHalf(lines: readonly Line[]): Minor | null {
  let largest: Minor | null = null;
  for (const line of lines.slice(Math.floor(lines.length / 2))) {
    if (neverTotal(line)) continue;
    for (const amount of line.amounts) {
      if (!amount.negative && (largest === null || amount.minor > largest)) largest = amount.minor;
    }
  }
  return largest;
}

/** The first date on the receipt that is today or at most MAX_RECEIPT_AGE_DAYS days before; a voucher's future date is passed over. */
function dateOf(lines: readonly Line[], today: IsoDate): IsoDate | null {
  for (const line of lines) {
    for (const date of datesIn(line.text)) {
      const age = daysBetween(date, today);
      if (age >= 0 && age <= MAX_RECEIPT_AGE_DAYS) return date;
    }
  }
  return null;
}

function datesIn(line: string): IsoDate[] {
  const dates: IsoDate[] = [];
  for (const [, day, month, year] of line.matchAll(DAY_FIRST)) {
    const date = parseStatementDate(`${day}.${month}.${year}`, 'dmy');
    if (date !== null) dates.push(date);
  }
  for (const [, year, month, day] of line.matchAll(YEAR_FIRST)) {
    const date = parseStatementDate(`${year}-${month}-${day}`, 'ymd');
    if (date !== null) dates.push(date);
  }
  return dates;
}

/**
 * The shop: in the head (the lines above the first amount, at most HEAD_LINES), the first line a chain on the CSV
 * import's list fits, else the first line that names something (not an address, a phone or tax number, a date, a web
 * address or the receipt's own words). Cleaned like an import's note, so no card or account digits stay.
 */
function shopOf(lines: readonly Line[]): string | null {
  const firstAmount = lines.findIndex((line) => line.amounts.length > 0);
  const head = lines.slice(0, firstAmount === -1 ? HEAD_LINES : Math.min(firstAmount, HEAD_LINES));
  const line = head.find((candidate) => chainRule(candidate.text, 'out') !== null) ?? head.find(namesSomething);
  if (line === undefined) return null;
  const tidy = line.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.)]+$/gu, '');
  const shop = importNote({ payee: tidy, purpose: '' });
  return shop === '' ? null : shop;
}

function namesSomething(line: Line): boolean {
  const { text, folded } = line;
  if (!/\p{L}{3,}/u.test(text) || merchantKey(text, '') === '') return false;
  if (POSTCODE.test(folded) || STREET.test(folded) || HOUSE_NUMBER.test(folded)) return false;
  if (PHONE.test(folded) || TAX_NUMBER.test(folded) || WEB.test(folded) || TIME.test(folded)) return false;
  if (datesIn(text).length > 0) return false;
  const words = folded.match(/\p{L}+/gu) ?? [];
  return !words.every((word) => RECEIPT_WORDS.has(word));
}
