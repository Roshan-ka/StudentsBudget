import { DEFAULT_LANGUAGE, type Language } from '@/i18n/languages';

/**
 * The weekly check-in's calendar file for a language: its title is in that language, and it rings when it starts
 * (review, 09-11-2026: one English file with no alert, so on an iPhone, whose default is no alert, nothing rang).
 * English keeps the first file's name, so a link saved before still works. Every language in the registry has one,
 * with the title `checkIn.calendarEvent` (tested).
 */
export function calendarFileOf(lang: Language): string {
  return lang === DEFAULT_LANGUAGE ? '/weekly-check-in.ics' : `/weekly-check-in.${lang}.ics`;
}
