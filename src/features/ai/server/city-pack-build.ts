// Writes the AI's city pack from the app's own Regensburg data (the AI phase, chunk 8,
// docs/superpowers/plans/2026-11-09-ai-phase-1.md). scripts/write-city-pack.mjs runs it in plain Node, so its imports
// are relative with their extension; city-pack.test.ts fails when the written file is stale.
//
// Left out: the Deutschlandticket price, which the app never shows, and the beer price: no drinking advice.
//
// Each item's words (the Groq switch, chunk 3) come from its English text, its titles in the app's other languages
// (src/i18n/city), its category's names in all four and `TOPIC_WORDS`, so a question in any offered language finds it.
// The city words import without extensions, so the writer registers the app's imports first (mcp/app-imports.ts).

import { CATEGORIES } from '../../../data/categories.ts';
import { CHECKLIST, type ChecklistGroup, type ChecklistWho } from '../../../data/checklist.ts';
import { CITIES } from '../../../data/cities.ts';
import { DISCOUNTS } from '../../../data/discounts.ts';
import { SEMESTER_FEES, SEMESTER_PERIODS } from '../../../data/semesters.ts';
import { SWAPS } from '../../../data/swaps.ts';
import { TIPS } from '../../../data/tips.ts';
import { CITY_WORDS, type CityWords } from '../../../i18n/city/index.ts';
import { categories as deCategories } from '../../../i18n/messages/de/categories.ts';
import { categories as esCategories } from '../../../i18n/messages/es/categories.ts';
import { categories as frCategories } from '../../../i18n/messages/fr/categories.ts';
import { foldWords, packId, type PackCategory, type PackItem } from '../../../../supabase/functions/_shared/ai/pack.ts';

/** Prices the pack never carries, by their label in cities.ts. */
export const LEFT_OUT_PRICES: readonly string[] = ['Deutschlandticket per month', 'Beer in a bar (0.5 l)'];

const UNIVERSITY = { ur: 'Universität Regensburg (UR)', oth: 'OTH Regensburg' } as const;

/** A checklist item's group and who it is for, as the pack's text says them. */
const CHECKLIST_GROUP: Record<ChecklistGroup, string> = { 'first-weeks': 'first weeks', money: 'money to claim' };
const CHECKLIST_WHO: Record<ChecklistWho, string> = {
  everyone: '',
  'from-abroad': ', for students from abroad',
  bafoeg: ', for students on BAföG',
  'under-25': ', for students under 25',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** €12 for whole euros, €3.80 otherwise. */
function eur(minor: number): string {
  return minor % 100 === 0 ? `€${minor / 100}` : `€${(minor / 100).toFixed(2)}`;
}

/** "1 October" from "10-01". */
function dayOf(monthDay: string): string {
  const [month, day] = monthDay.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

function categoryName(id: string): string {
  return CATEGORIES.find((category) => category.id === id)?.name ?? id;
}

/** A sentence ends with a full stop, once. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

const isEstimate = (source: string) => /^Estimate\b/.test(source);

/**
 * Words a student may use for a category (by its id) or a kind of item (`kind:<kind>`), in English, German, French and
 * Spanish, beyond what the items say themselves. Folded like the rest of an item's words. No word about alcohol.
 */
export const TOPIC_WORDS: Readonly<Record<string, string>> = {
  rent: 'rent rental flat apartment room dorm housing landlord tenancy deposit miete wohnung zimmer wohnheim wg vermieter kaution wohnen loyer logement appartement chambre colocation résidence propriétaire caution alquiler piso habitación residencia vivienda casero fianza',
  food: 'food groceries grocery supermarket cook cooking meal eat lebensmittel einkauf einkaufen supermarkt kochen essen nourriture courses épicerie supermarché cuisiner manger repas comida compra supermercado cocinar comer',
  'eating-out': 'restaurant eat eating lunch dinner meal mensa canteen cafeteria takeaway essen mittagessen abendessen kantine manger déjeuner dîner repas cantine resto comer almuerzo cena comedor restaurante',
  'going-out': 'going out leisure fun party club clubbing weekend cinema film movie theatre theater museum concert swimming pool bowling bouldering climbing skating culture freizeit ausgehen feiern kino konzert schwimmbad schwimmen klettern kultur sortir loisirs soirée fête cinéma théâtre musée piscine escalade salir ocio fiesta cine teatro museo concierto piscina escalada cultura',
  transport: 'transport bus train bike bicycle cycling commute repair fahrrad bahn zug fahrt reparatur vélo vélos réparation bici bicicleta autobús tren reparación',
  shopping: 'shopping clothes clothing fashion shoes kleidung klamotten mode schuhe vêtements chaussures ropa moda zapatos',
  health: 'health doctor pharmacy medicine therapy counselling psychologist mental stress gesundheit arzt apotheke medikamente therapie beratung psychologe psyche santé médecin pharmacie médicaments thérapie psychologue salud médico farmacia medicamentos terapia psicólogo',
  'personal-care': 'haircut hairdresser barber hair cosmetics friseur haare haarschnitt coiffeur coupe cheveux peluquería corte pelo',
  study: 'study studies books textbooks library university course lecture print printing scan materials studium bücher buch bibliothek bücherei uni vorlesung drucken scannen études livres bibliothèque université cours imprimer estudios libros biblioteca universidad curso imprimir',
  travel: 'travel trip trips holiday vacation excursion reisen reise ausflug urlaub voyage voyager excursion vacances viaje viajar excursión vacaciones',
  insurance: 'insurance insured health krankenversicherung krankenkasse versicherung versichert assurance maladie mutuelle seguro médico',
  subscriptions: 'subscription subscriptions software office microsoft apps streaming abo abonnement abonnements logiciel suscripción suscripciones programa',
  'transport-pass': 'semester ticket deutschlandticket rvv bus train public transport pass semesterticket nahverkehr öpnv billet transports abono transporte',
  gym: 'gym fitness sport sports workout training exercise fitnessstudio hochschulsport salle musculation deporte deportes gimnasio',
  utilities: 'utilities rundfunkbeitrag broadcasting licence license fee pay payment tv radio flat nebenkosten gebühr gez zahlen bezahlen redevance audiovisuelle payer tasa pagar televisión',
  other: 'grant money claim course courses adult education geld zuschuss kurs kurse volkshochschule aide argent cours ayuda dinero curso cursos',
  'kind:range': 'cost costs typical normal average usual budget plan monthly month kosten kostet durchschnitt monatlich monat coût coûte moyenne mensuel mois coste cuesta media mensual mes presupuesto',
  'kind:price': 'price prices cost costs preis preise kostet prix coûte precio precios cuesta',
  'kind:tip': 'tip tips advice save saving savings cheap cheaper free tipp tipps rat sparen günstig billig kostenlos gratis conseil conseils astuce économiser économies cher gratuit consejo consejos truco ahorrar ahorro barato',
  'kind:discount': 'discount discounts deal deals offer reduced cheap cheaper student price rabatt rabatte ermäßigung ermäßigt angebot vergünstigung studentenrabatt günstig billig réduction remise offre tarif étudiant cher descuento descuentos oferta rebaja barato estudiante',
  'kind:swap': 'swap instead alternative cheaper save switch statt stattdessen anstatt günstiger sparen plutôt cher économiser lugar alternativa barato ahorrar cambiar',
  'kind:semester': 'semester term start starts begin begins end ends lectures dates semesterbeginn semesterende vorlesungszeit vorlesungen beginn anfang ende semestre début fin cours rentrée inicio comienza empieza clases fechas',
  'kind:fee': 'fee fees semester contribution enrolment enrollment registration pay semesterbeitrag beitrag rückmeldung gebühr gebühren einschreibung zahlen frais cotisation inscription réinscription payer tasa tasas matrícula cuota pagar',
  'kind:checklist': 'checklist todo first weeks new arrive arrival moving register registration documents paperwork bureaucracy ankunft neu anmelden anmeldung umzug erste wochen formulare behörde liste arrivée nouveau inscrire démarches administratif lista llegada nuevo registrarse trámites papeles',
};

/** The category names in the app's other languages (src/i18n/messages), by id. */
const OTHER_NAMES: readonly Readonly<Record<string, string>>[] = [deCategories, frCategories, esCategories];

/** The city words of every other language the app offers city content in. */
const OTHER_WORDS: readonly CityWords[] = Object.values(CITY_WORDS).filter((words) => words !== undefined);

/** Texts from each other language's city words, as `pick` finds them for one item. */
function translated(pick: (words: CityWords) => readonly (string | undefined)[]): string[] {
  return OTHER_WORDS.flatMap(pick).filter((text): text is string => text !== undefined);
}

/**
 * The item with its words: from its text, `texts` (its titles in other languages), its category's names in the app's
 * four languages and the topic words of its category and its kind; each once, sorted.
 */
function worded(item: Omit<PackItem, 'words'>, texts: readonly string[] = []): PackItem {
  const id = item.categoryId;
  const names = id === null ? [] : [categoryName(id), ...OTHER_NAMES.map((other) => other[id] ?? '')];
  const topics = [id === null ? '' : (TOPIC_WORDS[id] ?? ''), TOPIC_WORDS[`kind:${item.kind}`] ?? ''];
  const words = foldWords([item.text, ...texts, ...names, ...topics].join('\n'));
  return { ...item, words: words.sort().join(' ') };
}

export function buildCityPack(): PackItem[] {
  const city = CITIES.regensburg;
  const items: PackItem[] = [];

  for (const range of city.ranges) {
    items.push(worded({
      id: packId.range(range.categoryId),
      kind: 'range',
      categoryId: range.categoryId,
      text: `${categoryName(range.categoryId)} in Regensburg: ${eur(range.minMinor)}–${eur(range.maxMinor)} a month.`,
      source: range.source,
      checked: range.checked,
      estimate: isEstimate(range.source),
    }));
  }

  for (const price of city.prices.filter((p) => !LEFT_OUT_PRICES.includes(p.label))) {
    items.push(worded({
      id: packId.price(price.label),
      kind: 'price',
      categoryId: null,
      text: `${price.label} in Regensburg: ${eur(price.minor)}.`,
      source: price.source,
      checked: price.checked,
      estimate: isEstimate(price.source),
    }));
  }

  for (const tip of TIPS) {
    const item = {
      id: packId.tip(tip.id),
      kind: 'tip',
      categoryId: tip.categoryId,
      text: `${categoryName(tip.categoryId)} tip: ${sentence(tip.title)} ${sentence(tip.body)}`,
      source: tip.source,
      checked: tip.checked,
      estimate: false,
    } as const;
    items.push(worded(item, translated((words) => [words.tips[tip.id]?.title])));
  }

  for (const discount of DISCOUNTS) {
    const item = {
      id: packId.discount(discount.id),
      kind: 'discount',
      categoryId: discount.categoryId,
      text: `${categoryName(discount.categoryId)} discount: ${discount.place}, ${discount.address}: ${sentence(discount.offer)} ${sentence(discount.conditions)}`,
      source: discount.source,
      checked: discount.checked,
      estimate: false,
    } as const;
    const words = (all: CityWords) => [all.discounts[discount.id]?.place, all.discounts[discount.id]?.offer];
    items.push(worded(item, translated(words)));
  }

  for (const swap of SWAPS) {
    const toSource = swap.toSource ? `; ${swap.toSource}` : '';
    const item = {
      id: packId.swap(swap.id),
      kind: 'swap',
      categoryId: swap.categoryId,
      text: `${categoryName(swap.categoryId)} swap: ${sentence(swap.title)} ${sentence(swap.body)} From ${eur(swap.fromMinor)} to ${eur(swap.toMinor)} per ${swap.per}.`,
      source: `${swap.source}${toSource}`,
      checked: swap.checked,
      estimate: swap.estimate === true,
    } as const;
    items.push(worded(item, translated((words) => [words.swaps[swap.id]?.title])));
  }

  for (const period of SEMESTER_PERIODS) {
    items.push(worded({
      id: packId.semester(period.university, period.term),
      kind: 'semester',
      categoryId: null,
      text: `${UNIVERSITY[period.university]}, ${period.term} semester: ${dayOf(period.starts)} to ${dayOf(period.ends)}.`,
      source: period.source,
      checked: period.checked,
      estimate: false,
    }));
  }

  for (const fee of SEMESTER_FEES) {
    const parts = fee.parts ?? [];
    const sourced = [...parts, ...(fee.reRegistration ? [fee.reRegistration] : [])];
    if (sourced.length === 0) continue;
    const total = parts.reduce((sum, part) => sum + part.minor, 0);
    const feeText =
      parts.length > 0
        ? ` The semester fee is ${eur(total)}: ${parts.map((part) => `${part.label} ${eur(part.minor)}`).join(', ')}.`
        : '';
    const opens = fee.reRegistration ? ` Re-registration (the fee is paid with it) opens in ${fee.reRegistration.month}.` : '';
    items.push(worded({
      id: packId.fee(fee.university, fee.starts),
      kind: 'fee',
      categoryId: null,
      text: `${UNIVERSITY[fee.university]}, semester starting ${fee.starts}:${feeText}${opens}`,
      source: [...new Set(sourced.map((part) => part.source))].join('; '),
      checked: sourced.map((part) => part.checked).sort().at(-1) ?? '',
      estimate: false,
    }));
  }

  for (const item of CHECKLIST) {
    const packed = {
      id: packId.checklist(item.id),
      kind: 'checklist',
      categoryId: null,
      text: `Checklist for new students (${CHECKLIST_GROUP[item.group]}${CHECKLIST_WHO[item.who]}): ${sentence(item.title)} ${sentence(item.body)}`,
      source: item.source,
      checked: item.checked,
      estimate: false,
    } as const;
    items.push(worded(packed, translated((words) => [words.checklist[item.id]?.title])));
  }

  return items;
}

/**
 * The module the written file imports its type from, next to it. Built, not written out, so CI's import scanner
 * (scripts/ci-affected.mjs) doesn't take the written file's import for one of this file's.
 */
const PACK_MODULE = ['.', 'pack.ts'].join('/');

/** The app's categories, in English, for the setup chat's rules and its checks (chunk 11). */
export function buildCategories(): PackCategory[] {
  return CATEGORIES.map(({ id, name, kind }) => ({ id, name, kind }));
}

/** The text of supabase/functions/_shared/ai/city-pack.ts for these items and categories. */
export function cityPackFile(items: readonly PackItem[], categories: readonly PackCategory[]): string {
  return [
    '// The Regensburg data the AI may quote, and the app categories, written from src/data and src/i18n by',
    '// scripts/write-city-pack.mjs: do not edit by hand. Run `node scripts/write-city-pack.mjs` after changing src/data,',
    '// src/i18n/city or the category names; src/features/ai/server/city-pack.test.ts fails while this file is stale.',
    '',
    `import type { PackCategory, PackItem } from '${PACK_MODULE}';`,
    '',
    `export const CITY_PACK: readonly PackItem[] = ${JSON.stringify(items, null, 2)};`,
    '',
    `export const APP_CATEGORIES: readonly PackCategory[] = ${JSON.stringify(categories, null, 2)};`,
    '',
  ].join('\n');
}
