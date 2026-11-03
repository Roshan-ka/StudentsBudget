import { en, type Messages } from '../en';
import { language } from './language';
import { shell } from './shell';

/**
 * German, being drafted (plan 1, chunks 10–14): each area as it is written, English for the rest. Not offered yet;
 * chunk 15 offers it once every area is German, and drops the English underneath, so typecheck then holds every key.
 */
export const de: Messages = { ...en, shell, language };
