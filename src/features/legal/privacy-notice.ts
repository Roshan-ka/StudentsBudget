import type { Operator } from '@/data/legal';
import type { IsoDate } from '@/lib/dates';
import type { LegalSection } from './content';

/** When the privacy notice last changed. */
export const PRIVACY_UPDATED: IsoDate = '2026-11-12';

/**
 * The privacy notice (legal pages): who is responsible, from `OPERATOR` (chunk 1), then what the app keeps and sends,
 * on what basis, for how long, and the rights (chunks 2 and 3). Each section says what in the code it describes, so a
 * change there finds its text here. Drafted from what the app does, to be checked before go-live. What Vercel and
 * Frankfurter do with the data is from their own pages, as read on 12-11-2026: Vercel's privacy notice (updated
 * 01-06-2026) and Speed Insights' privacy page, and the FAQ on frankfurter.dev.
 */
export function privacySections(o: Operator): LegalSection[] {
  const contact = [o.name, o.street, `${o.postcode} ${o.city}`, o.country];
  return [
    {
      id: 'controller',
      when: 'always',
      de: {
        heading: 'Verantwortlich',
        blocks: [
          { kind: 'p', text: 'Verantwortlich für die Verarbeitung personenbezogener Daten in StudentsBudget (Art. 4 Nr. 7 DSGVO) ist:' },
          { kind: 'lines', lines: [...contact, `E-Mail: ${o.email}`] },
        ],
      },
      en: {
        heading: 'Controller',
        blocks: [
          { kind: 'p', text: 'The controller for the processing of personal data in StudentsBudget (Art. 4 (7) GDPR) is:' },
          { kind: 'lines', lines: [...contact, `Email: ${o.email}`] },
        ],
      },
    },
    {
      id: 'overview',
      when: 'always',
      de: {
        heading: 'Kurz gesagt',
        blocks: [
          {
            kind: 'p',
            text: 'Deine Finanzen bleiben auf deinem Handy: Die App speichert sie in deinem Browser, nicht bei mir. Sie setzt keine Cookies, zeigt keine Werbung und verfolgt dich nicht über andere Websites.',
          },
          {
            kind: 'p',
            text: 'Was die App wohin sendet, steht in den folgenden Abschnitten: jeweils nur, was eine Funktion braucht, und die meisten Funktionen senden erst, wenn du sie nutzt. Davor sagt dir ein Hinweis in der App, was sie sendet.',
          },
        ],
      },
      en: {
        heading: 'In short',
        blocks: [
          {
            kind: 'p',
            text: 'Your finances stay on your phone: the app keeps them in your browser, not with me. It sets no cookies, shows no ads and doesn’t follow you across other websites.',
          },
          {
            kind: 'p',
            text: 'What the app sends, and to whom, is in the sections below: only what each feature needs, and most features send nothing until you use them. Before that, a note in the app tells you what they send.',
          },
        ],
      },
    },
    // The phone's own storage: Dexie's tables (src/db/db.ts), the choices and note flags in localStorage
    // (src/lib/phone-pref.ts, PRIVACY_NOTES), the two marks in sessionStorage (recovery.ts, signed-out.ts) and the
    // service worker's caches (public/sw.js). What the account adds on the phone is in its own section (chunk 3).
    {
      id: 'on-your-phone',
      when: 'always',
      de: {
        heading: 'Was auf deinem Handy bleibt',
        blocks: [
          { kind: 'p', text: 'Was du in die App eingibst, speichert sie in deinem Browser auf deinem Handy (IndexedDB):' },
          {
            kind: 'list',
            items: [
              'deine Konten mit ihren Anfangsständen, deine Ausgaben, Einnahmen und Umbuchungen mit ihren Notizen;',
              'deinen Plan (Einnahmen, Fixkosten, einmalige Kosten, Umschläge und wiederkehrende Einträge) und wie er in früheren Monaten aussah;',
              'dein Profil (Name, Hochschule, Semesterdaten), Wechselkurse, Wochenergebnisse für die Abzeichen, die abgehakten Punkte der Checkliste und deine Bewertungen von Rabatten.',
            ],
          },
          {
            kind: 'p',
            text: 'Dazu kommen kleine Einstellungen im Speicher des Browsers (localStorage und sessionStorage): deine Sprache, das Aussehen, welche Ansicht du zuletzt gewählt hast und welche Hinweise du schon gesehen hast. Damit die App auch ohne Netz läuft, legt sie außerdem eine Kopie ihrer eigenen Dateien im Browser ab (Service Worker). Cookies setzt sie keine.',
          },
          {
            kind: 'p',
            text: 'Diese Daten erreichen mich nicht. Sie zu speichern ist nötig, damit die App tut, was du von ihr willst (§ 25 Abs. 2 Nr. 2 TDDDG). Löschen kannst du alles unter Einstellungen → Backup und Daten → Alles löschen; auch wenn du die Websitedaten im Browser löschst oder die App entfernst, sind sie weg.',
          },
        ],
      },
      en: {
        heading: 'What stays on your phone',
        blocks: [
          { kind: 'p', text: 'What you enter in the app is kept in your browser on your phone (IndexedDB):' },
          {
            kind: 'list',
            items: [
              'your accounts with their starting balances, and your expenses, income and transfers with their notes;',
              'your plan (income, fixed costs, one-off costs, envelopes and recurring entries) and how it looked in earlier months;',
              'your profile (name, university, semester dates), exchange rates, the weekly results behind the badges, the checklist items you ticked and your votes on discounts.',
            ],
          },
          {
            kind: 'p',
            text: 'Next to that, small settings sit in the browser’s storage (localStorage and sessionStorage): your language, the theme, the views you last picked and which notes you have seen. So that the app works without a connection, it also keeps a copy of its own files in the browser (a service worker). It sets no cookies.',
          },
          {
            kind: 'p',
            text: 'None of this reaches me. Keeping it is necessary for the app to do what you use it for (Section 25 (2) no. 2 TDDDG, the German act on data protection in digital services). You can delete all of it in Settings → Backup and data → Delete everything; clearing the site’s data in your browser or removing the app deletes it too.',
          },
        ],
      },
    },
    // Hosting on Vercel: every request reaches its servers (Vercel's privacy notice, 01-06-2026, and its DPA).
    {
      id: 'hosting',
      when: 'always',
      de: {
        heading: 'Hosting und Server-Protokolle',
        blocks: [
          {
            kind: 'p',
            text: 'Die App liegt bei Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, USA, die sie in meinem Auftrag ausliefert (Auftragsverarbeitung, Art. 28 DSGVO). Wenn dein Browser die App lädt, sieht Vercel, was jeder Aufruf einer Website mit sich bringt: deine IP-Adresse und den daraus abgeleiteten Ort (Stadt und Land), Datum und Uhrzeit, die aufgerufene Seite sowie Browser und Betriebssystem.',
          },
          {
            kind: 'p',
            text: 'Das ist nötig, um dir die App auszuliefern und sie vor Angriffen zu schützen; Rechtsgrundlage ist mein berechtigtes Interesse daran (Art. 6 Abs. 1 lit. f DSGVO). Vercel bewahrt diese Daten nach eigenen Angaben nur so lange auf wie nötig und löscht oder anonymisiert sie dann. Vercel verarbeitet Daten auch in den USA und nennt dafür das EU-U.S. Data Privacy Framework und Standardvertragsklauseln.',
          },
        ],
      },
      en: {
        heading: 'Hosting and server logs',
        blocks: [
          {
            kind: 'p',
            text: 'The app is hosted by Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, USA, which delivers it on my behalf (as a processor, Art. 28 GDPR). When your browser loads the app, Vercel sees what comes with any visit to a website: your IP address and the place derived from it (city and country), the date and time, the page asked for, and your browser and operating system.',
          },
          {
            kind: 'p',
            text: 'This is needed to deliver the app to you and protect it from attacks; the legal basis is my legitimate interest in that (Art. 6 (1) (f) GDPR). Vercel says it keeps this data only as long as needed and then deletes or anonymises it. Vercel also processes data in the USA, and names the EU-U.S. Data Privacy Framework and standard contractual clauses for this.',
          },
        ],
      },
    },
    // Vercel Speed Insights (<SpeedInsights /> in src/app/layout.tsx; @vercel/speed-insights): what each data point
    // carries is from Speed Insights' privacy page.
    {
      id: 'speed-insights',
      when: 'always',
      de: {
        heading: 'Ladezeiten (Vercel Speed Insights)',
        blocks: [
          {
            kind: 'p',
            text: 'Damit ich sehe, ob die App auf Handys schnell genug lädt und reagiert, misst sie bei jedem Seitenaufruf ihre Ladezeiten (Web Vitals) und sendet sie über die Adresse der App selbst an Vercel. Mit jeder Messung gehen die Seite, die Art der Verbindung (etwa 4G), Browser, Gerätetyp und Betriebssystem, das Land, der Zeitpunkt und welches Element der Seite die Messung betrifft.',
          },
          {
            kind: 'p',
            text: 'Nach Vercels Angaben werden die Messungen anonym erfasst, nicht mit deiner IP-Adresse verbunden und nicht zu einem Besuch über mehrere Seiten zusammengesetzt. Dafür gibt es keine Cookies, und auf deinem Handy wird nichts gespeichert. Rechtsgrundlage ist mein berechtigtes Interesse an einer App, die schnell genug ist (Art. 6 Abs. 1 lit. f DSGVO).',
          },
        ],
      },
      en: {
        heading: 'Load times (Vercel Speed Insights)',
        blocks: [
          {
            kind: 'p',
            text: 'So that I can see whether the app loads and responds fast enough on phones, it measures its load times (Web Vitals) on each page visit and sends them to Vercel, through the app’s own address. Each measurement carries the page, the kind of connection (such as 4G), the browser, device type and operating system, the country, the time and which element of the page it concerns.',
          },
          {
            kind: 'p',
            text: 'Vercel says the measurements are recorded anonymously, not tied to your IP address and not put together into a visit across pages. There are no cookies for it, and nothing is stored on your phone. The legal basis is my legitimate interest in an app that is fast enough (Art. 6 (1) (f) GDPR).',
          },
        ],
      },
    },
    // Exchange rates (src/lib/fx.ts): the `rates` note says the same before the first request.
    {
      id: 'exchange-rates',
      when: 'always',
      de: {
        heading: 'Wechselkurse (Frankfurter)',
        blocks: [
          {
            kind: 'p',
            text: 'Solange eines deiner Konten eine andere Währung als Euro hat, fragt die App höchstens einmal am Tag bei Frankfurter (api.frankfurter.dev), einem offenen Dienst für die Kurse der Europäischen Zentralbank, nach dem Kurs. Gesendet werden nur die Währungscodes (etwa INR); wie jede Website sieht der Dienst dabei deine IP-Adresse. Frankfurter läuft hinter Cloudflare und gibt an, weder personenbezogene Daten noch IP-Adressen oder Anfragen zu speichern.',
          },
          {
            kind: 'p',
            text: 'Vor der ersten Anfrage sagt dir die App das. Rechtsgrundlage ist mein berechtigtes Interesse, deine Beträge in Euro umzurechnen (Art. 6 Abs. 1 lit. f DSGVO).',
          },
        ],
      },
      en: {
        heading: 'Exchange rates (Frankfurter)',
        blocks: [
          {
            kind: 'p',
            text: 'While one of your accounts uses a currency other than the euro, the app asks Frankfurter (api.frankfurter.dev), an open service for the European Central Bank’s rates, for the rate, at most once a day. It sends only the currency codes (such as INR); like any website, the service sees your IP address. Frankfurter runs behind Cloudflare and states that it keeps no personal data, IP addresses or requests.',
          },
          {
            kind: 'p',
            text: 'The app tells you this before the first request. The legal basis is my legitimate interest in converting your amounts to euros (Art. 6 (1) (f) GDPR).',
          },
        ],
      },
    },
    // The discount map (src/features/discounts/map/): tiles, glyphs and sprites from public/maps/, and Show me's
    // position (`whereIs`), kept in DiscountsView's memory only.
    {
      id: 'map',
      when: 'map',
      de: {
        heading: 'Karte und dein Standort',
        blocks: [
          {
            kind: 'p',
            text: 'Die Karte der Rabatte gehört zur App: Kartenausschnitte, Schriften und Symbole kommen von der Adresse der App selbst, kein Kartendienst wird gefragt. Die Kartendaten stammen von OpenStreetMap (© OpenStreetMap-Mitwirkende), aufbereitet von Protomaps.',
          },
          {
            kind: 'p',
            text: '„Mich zeigen“ fragt nur nach deinem Standort, wenn du darauf tippst, und dein Browser bittet dich vorher um Erlaubnis. Den Standort ermittelt dein Handy, je nach Gerät und Browser mit dem Ortungsdienst seines Herstellers (etwa Google oder Apple). Die App nutzt ihn nur auf deinem Handy, um die Karte zu zentrieren und Entfernungen zu zeigen: Sie speichert ihn nicht und sendet ihn nirgendwohin.',
          },
        ],
      },
      en: {
        heading: 'The map and your location',
        blocks: [
          {
            kind: 'p',
            text: 'The discount map is part of the app: its map tiles, fonts and symbols come from the app’s own address, and no map service is asked. The map data is from OpenStreetMap (© OpenStreetMap contributors), prepared by Protomaps.',
          },
          {
            kind: 'p',
            text: '“Show me” asks for your location only when you tap it, and your browser asks for your permission first. Your phone works out where you are, depending on the device and browser with its maker’s location service (such as Google or Apple). The app uses the position only on your phone, to centre the map and show distances: it doesn’t keep it or send it anywhere.',
          },
        ],
      },
    },
    // The mic button (src/features/entries/speech.ts): the `micNote` says the same before the first use.
    {
      id: 'speech',
      when: 'always',
      de: {
        heading: 'Spracheingabe',
        blocks: [
          {
            kind: 'p',
            text: 'Der Knopf „Eintrag sprechen“ bei Schnell erfassen nutzt die Spracherkennung deines Browsers. Um das Gesprochene zu erkennen, kann der Browser die Aufnahme an den Sprachdienst seines Herstellers senden (Chrome etwa an Google), nach dessen eigenen Bedingungen. StudentsBudget bekommt nur den erkannten Text, keine Aufnahme. Vor der ersten Nutzung sagt dir die App das.',
          },
        ],
      },
      en: {
        heading: 'Speaking an entry',
        blocks: [
          {
            kind: 'p',
            text: 'The “Speak an entry” button by Quick add uses your browser’s speech recognition. To recognise what you say, the browser may send the recording to its maker’s speech service (Chrome sends it to Google), under that service’s own terms. StudentsBudget gets only the recognised text, never a recording. The app tells you this before the first use.',
          },
        ],
      },
    },
    // A post's Translate (src/features/hacks/, `translateUrl`): a link, not a request of the app's; the `translate`
    // note says the same before the first use. Posts exist only in a build with an account.
    {
      id: 'translate',
      when: 'supabase',
      de: {
        heading: 'Übersetzen',
        blocks: [
          {
            kind: 'p',
            text: 'Ein Beitrag in einer anderen Sprache hat den Link „Übersetzen“. Er öffnet Google Übersetzer in einem neuen Tab, mit dem Text des Beitrags in der Adresse. Google bekommt so den Text und deine IP-Adresse und verarbeitet sie nach seinen eigenen Datenschutzbestimmungen. Die App selbst sendet dabei nichts; vor der ersten Nutzung sagt sie dir das.',
          },
        ],
      },
      en: {
        heading: 'Translate',
        blocks: [
          {
            kind: 'p',
            text: 'A post in another language has a “Translate” link. It opens Google Translate in a new tab, with the post’s text in its address. Google thus gets the text and your IP address, and processes them under its own privacy policy. The app itself sends nothing for this; it tells you so before the first use.',
          },
        ],
      },
    },
    // Until chunk 3: what follows, so the page never pretends to be complete.
    {
      id: 'in-progress',
      when: 'always',
      de: {
        heading: 'Diese Erklärung wird gerade vervollständigt',
        blocks: [
          {
            kind: 'p',
            text: 'Hier folgen in Kürze: dein Konto und der Abgleich, die Anmeldung, geteilte Beiträge, Kommentare und Rabatte, die wöchentliche Erinnerung, die KI-Funktionen, Empfänger außerhalb der EU, wie lange was gespeichert wird, und deine Rechte. Bis dahin sagt dir jeder Hinweis in der App vor der ersten Nutzung, was er sendet. Fragen beantworte ich gern unter der E-Mail-Adresse oben.',
          },
        ],
      },
      en: {
        heading: 'This notice is being completed',
        blocks: [
          {
            kind: 'p',
            text: 'Coming here shortly: your account and syncing, signing in, shared posts, comments and discounts, the weekly reminder, the AI features, recipients outside the EU, how long what is kept, and your rights. Until then, every note in the app tells you before its first use what it sends. I’m glad to answer questions at the email address above.',
          },
        ],
      },
    },
  ];
}
