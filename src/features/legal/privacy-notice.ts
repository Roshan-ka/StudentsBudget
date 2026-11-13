import type { Operator } from '@/data/legal';
import type { IsoDate } from '@/lib/dates';
import type { LegalSection } from './content';

/** When the privacy notice last changed. */
export const PRIVACY_UPDATED: IsoDate = '2026-11-13';

/**
 * The privacy notice (legal pages): who is responsible, from `OPERATOR` (chunk 1), then what the app keeps and sends,
 * on what basis, for how long, and the rights (chunks 2 and 3). Each section says what in the code it describes, so a
 * change there finds its text here. Drafted from what the app does, to be checked before go-live. What others do with
 * the data is from their own pages, as read on 12-11-2026: Vercel's privacy notice (updated 01-06-2026) and Speed
 * Insights' privacy page; the FAQ on frankfurter.dev; Supabase's terms, DPA (01-08-2026), region and logging docs and
 * pricing (Free plan: logs kept a day); Anthropic's commercial terms (17-06-2025), DPA (24-02-2025) and privacy
 * center; the Data Privacy Framework list; and lda.bayern.de. A section that names one of them changes with it.
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
            text: 'Das ist nötig, um dir die App auszuliefern und sie vor Angriffen zu schützen; Rechtsgrundlage ist mein berechtigtes Interesse daran (Art. 6 Abs. 1 lit. f DSGVO). Vercel bewahrt diese Daten nach eigenen Angaben nur so lange auf wie nötig und löscht oder anonymisiert sie dann. Vercel verarbeitet Daten auch in den USA und ist nach dem EU-U.S. Data Privacy Framework zertifiziert (siehe „Übermittlung in Länder außerhalb der EU“).',
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
            text: 'This is needed to deliver the app to you and protect it from attacks; the legal basis is my legitimate interest in that (Art. 6 (1) (f) GDPR). Vercel says it keeps this data only as long as needed and then deletes or anonymises it. Vercel also processes data in the USA, and is certified under the EU-U.S. Data Privacy Framework (see “Transfers outside the EU”).',
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
    // Translate on hacks, comments and students' discounts (`translateUrl`): a link, not a request of the app's; the
    // `translate` note says the same before the first use. They exist only in a build with an account.
    {
      id: 'translate',
      when: 'supabase',
      de: {
        heading: 'Übersetzen',
        blocks: [
          {
            kind: 'p',
            text: 'Hacks, Kommentare und Rabatte in einer anderen Sprache haben den Link „Übersetzen“. Er öffnet Google Übersetzer in einem neuen Tab, mit dem Text in der Adresse. Google bekommt so den Text und deine IP-Adresse und verarbeitet sie nach seinen eigenen Datenschutzbestimmungen. Die App selbst sendet dabei nichts; vor der ersten Nutzung sagt sie dir das.',
          },
        ],
      },
      en: {
        heading: 'Translate',
        blocks: [
          {
            kind: 'p',
            text: 'Hacks, comments and discounts in another language have a “Translate” link. It opens Google Translate in a new tab, with the text in its address. Google thus gets the text and your IP address, and processes them under its own privacy policy. The app itself sends nothing for this; it tells you so before the first use.',
          },
        ],
      },
    },
    // The account (P2.1, P2.2, P2.5): Supabase Auth and the ten synced tables (src/sync/tables.ts), tombstones,
    // automatic sync (src/sync/auto-schedule.ts), sign-out's wipe and `delete_my_account()`'s cascade. Supabase's
    // entity and DPA (SCCs, no DPF), its Frankfurt region and its Free-plan log retention are from its own pages
    // (12-11-2026).
    {
      id: 'account',
      when: 'supabase',
      de: {
        heading: 'Dein Konto und der Abgleich',
        blocks: [
          {
            kind: 'p',
            text: 'Ein Konto ist freiwillig: Ohne läuft die App nur auf deinem Handy. Legst du eines an, betreibt es Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapur 049513, in meinem Auftrag (Auftragsverarbeitung, Art. 28 DSGVO); die Datenbank liegt in Frankfurt am Main. Das Konto hält:',
          },
          {
            kind: 'list',
            items: [
              'deine E-Mail-Adresse und dein Passwort, dieses nur als Hash, aus dem es sich nicht zurückgewinnen lässt;',
              'die Sprache deines Handys, damit die E-Mails des Kontos in ihr kommen, und deinen Namen für Beiträge (Nutzername, Bezeichnung und Jahrgang);',
              'sobald du ein Handy verknüpfst, eine Kopie der Daten, die es abgleicht: Konten, Einträge, Plan und frühere Pläne, Profil, eigene Wechselkurse, Wochenergebnisse, die Checkliste und deine Bewertungen von Rabatten.',
            ],
          },
          {
            kind: 'p',
            text: 'Auf dem Handy merkt sich die App dafür deine Anmeldung, welches Konto verknüpft ist und was noch abzugleichen ist. Ein verknüpftes Handy gleicht von selbst ab, solange die App offen ist: beim Öffnen, kurz nach einer Änderung und jede Minute. Löschst du etwas, bleibt im Konto ein Vermerk ohne Inhalt, damit deine anderen Handys davon erfahren. Supabase protokolliert die Anfragen an das Konto mit IP-Adresse und löscht diese Protokolle nach einem Tag.',
          },
          {
            kind: 'p',
            text: 'Rechtsgrundlage ist, dass du das Konto nutzen willst (Art. 6 Abs. 1 lit. b DSGVO), für die Protokolle mein berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Das Konto und alles darin bleibt, bis du es löschst: unter Einstellungen → Dein Konto → Mein Konto löschen. Dann löscht Supabase es mit allem, was es hält, auch mit deinen Beiträgen, Kommentaren, Rabatten, Stimmen und Meldungen; die Daten auf deinem Handy bleiben. Abmelden löscht umgekehrt die Daten auf diesem Handy, nicht das Konto.',
          },
        ],
      },
      en: {
        heading: 'Your account and syncing',
        blocks: [
          {
            kind: 'p',
            text: 'An account is optional: without one, the app runs on your phone alone. If you create one, Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513, runs it on my behalf (as a processor, Art. 28 GDPR); the database is in Frankfurt am Main. The account holds:',
          },
          {
            kind: 'list',
            items: [
              'your email address and your password, the latter only as a hash it can’t be recovered from;',
              'your phone’s language, so that the account’s emails come in it, and your name on posts (username, label and batch);',
              'once you link a phone, a copy of the data it syncs: accounts, entries, the plan and earlier plans, profile, your own exchange rates, weekly results, the checklist and your votes on discounts.',
            ],
          },
          {
            kind: 'p',
            text: 'For this, the app keeps your sign-in on the phone, which account it is linked to and what is still to sync. A linked phone syncs by itself while the app is open: on opening, shortly after a change and every minute. When you delete something, the account keeps a note without its content, so that your other phones learn of it. Supabase logs the requests to the account with the IP address, and deletes these logs after one day.',
          },
          {
            kind: 'p',
            text: 'The legal basis is that you want to use the account (Art. 6 (1) (b) GDPR), and for the logs my legitimate interest in running it securely (Art. 6 (1) (f) GDPR). The account and everything in it stays until you delete it: in Settings → Your account → Delete my account. Supabase then deletes it with everything it holds, including your posts, comments, discounts, votes and reports; the data on your phone stays. Signing out, the other way round, deletes the data on this phone, not the account.',
          },
        ],
      },
    },
    // Sign-in (P2.3a, P2.3b, P2.4): passkeys and TOTP factors live in Supabase Auth; the emailed codes are
    // supabase/templates/confirmation.html and recovery.html (6 digits, 60 minutes, in the account's `lang`).
    {
      id: 'sign-in',
      when: 'supabase',
      de: {
        heading: 'Anmeldung und Sicherheit',
        blocks: [
          {
            kind: 'p',
            text: 'Du meldest dich mit E-Mail-Adresse und Passwort an oder mit einem Passkey. Den Passkey hält der Passwortmanager deines Handys, der ihn auf deine anderen Geräte übertragen kann (etwa iCloud-Schlüsselbund oder Google Passwortmanager); dein Konto hält nur seinen öffentlichen Schlüssel, mit dem sich niemand anmelden kann. Schaltest du die Anmeldung in zwei Schritten ein, hält das Konto den geheimen Schlüssel deiner Authenticator-App, um ihre Codes zu prüfen.',
          },
          {
            kind: 'p',
            text: 'Um ein neues Konto zu bestätigen oder ein neues Passwort zu setzen, schickt dir Supabase eine E-Mail mit einem sechsstelligen Code, der 60 Minuten gilt, in der Sprache deines Handys. Anmeldungen und Änderungen daran (etwa ein neues Passwort oder ein neuer Passkey) hält Supabase in seinen Protokollen fest, die es nach 24 Stunden löscht.',
          },
          {
            kind: 'p',
            text: 'Rechtsgrundlage ist die Anmeldung zu deinem Konto (Art. 6 Abs. 1 lit. b DSGVO) und mein berechtigtes Interesse, es vor fremden Zugriffen zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Passkeys und den zweiten Schritt kannst du unter Einstellungen → Dein Konto jederzeit entfernen; mit dem Konto gehen sie ganz.',
          },
        ],
      },
      en: {
        heading: 'Signing in and security',
        blocks: [
          {
            kind: 'p',
            text: 'You sign in with your email address and password, or with a passkey. Your phone’s password manager keeps the passkey and may carry it to your other devices (iCloud Keychain or Google Password Manager, for example); your account keeps only its public key, which can’t sign anyone in. If you turn on two-step sign-in, the account keeps your authenticator app’s secret key, to check its codes.',
          },
          {
            kind: 'p',
            text: 'To confirm a new account or set a new password, Supabase sends you an email with a six-digit code that works for 60 minutes, in your phone’s language. Sign-ins and changes to them (such as a new password or passkey) are recorded in Supabase’s logs, which it deletes after 24 hours.',
          },
          {
            kind: 'p',
            text: 'The legal basis is signing in to your account (Art. 6 (1) (b) GDPR) and my legitimate interest in protecting it from others (Art. 6 (1) (f) GDPR). You can remove passkeys and the second step at any time in Settings → Your account; they go entirely with the account.',
          },
        ],
      },
    },
    // Shared content (the hacks feed, the community plan): hacks, comments and students' discounts, their feeds
    // (never a user id), votes, reports (`hide_after_reports()` = 5), the moderation queues (username, counts, no
    // reporter), the daily limits, the daily purge (`purge_old_content`: deleted ones within two days, hidden ones 30
    // days after hiding unless kept), and the feeds cached on the phone.
    {
      id: 'shared',
      when: 'supabase',
      de: {
        heading: 'Hacks, Kommentare und Rabatte',
        blocks: [
          {
            kind: 'p',
            text: 'Mit einem Konto kannst du Hacks, Kommentare und Rabatte teilen. Was du teilst, sehen alle Studierenden mit Konto, zusammen mit deinem Nutzernamen, deiner Bezeichnung und deinem Jahrgang: den Text mit Kategorie, Link und Sprache, bei einem Rabatt auch Ort, Angebot, Bedingungen, Adresse und, wenn du sie gesetzt hast, die Stelle auf der Karte. Deine E-Mail-Adresse oder eine Kennung deines Kontos sieht niemand.',
          },
          {
            kind: 'p',
            text: 'Deine Stimmen zu Hacks und deine Bestätigungen von Rabatten zählen in Summen, die alle sehen; wer wie gestimmt hat, sieht niemand. Meldest du etwas, ist es für dich sofort ausgeblendet, und für alle, sobald fünf Studierende es gemeldet haben. Gemeldetes prüfe ich als Moderator: Ich sehe den Inhalt, den Nutzernamen und die Zahl der Meldungen, nicht wer gemeldet hat, und blende es aus oder lasse es stehen.',
          },
          {
            kind: 'p',
            text: 'Am Tag kannst du bis zu fünf Hacks, 20 Kommentare und drei Rabatte teilen. Löschst du einen, sieht ihn niemand mehr; ganz gelöscht wird er, sobald er nicht mehr für die Tagesgrenze zählt, spätestens nach zwei Tagen. Was für alle ausgeblendet ist und ich nicht stehen lasse, wird 30 Tage danach gelöscht. Die zuletzt geladenen Listen merkt sich die App auf deinem Handy und vergisst sie beim Abmelden.',
          },
          {
            kind: 'p',
            text: 'Rechtsgrundlage für das Teilen ist, dass du es willst (Art. 6 Abs. 1 lit. b DSGVO); für Meldungen, Moderation und Tagesgrenzen mein berechtigtes Interesse an einem Austausch ohne Missbrauch (Art. 6 Abs. 1 lit. f DSGVO).',
          },
        ],
      },
      en: {
        heading: 'Hacks, comments and discounts',
        blocks: [
          {
            kind: 'p',
            text: 'With an account you can share hacks, comments and discounts. What you share is seen by every student with an account, with your username, label and batch: the text with its category, link and language, and for a discount also the place, offer, conditions, address and, if you set one, its spot on the map. Nobody sees your email address or any identifier of your account.',
          },
          {
            kind: 'p',
            text: 'Your votes on hacks and your confirmations of discounts count in totals everyone sees; nobody sees who voted how. When you report something, it is hidden for you at once, and for everyone once five students have reported it. I check what is reported, as the moderator: I see the content, the username and the number of reports, not who reported it, and hide it or keep it.',
          },
          {
            kind: 'p',
            text: 'You can share up to five hacks, 20 comments and three discounts a day. When you delete one, nobody sees it any more; it is deleted for good once it no longer counts for the daily limit, within two days at the latest. Whatever is hidden from everyone and I don’t keep is deleted 30 days later. The app keeps the lists it last loaded on your phone, and forgets them when you sign out.',
          },
          {
            kind: 'p',
            text: 'The legal basis for sharing is that you want to (Art. 6 (1) (b) GDPR); for reports, moderation and the daily limits, my legitimate interest in an exchange without abuse (Art. 6 (1) (f) GDPR).',
          },
        ],
      },
    },
    // The weekly reminder: `push_subscriptions` (its columns), the `weekly-reminder` Edge Function (RFC 8291
    // encryption, logs with the push host only), and when the row goes.
    {
      id: 'reminder',
      when: 'reminder',
      de: {
        heading: 'Wöchentliche Erinnerung',
        blocks: [
          {
            kind: 'p',
            text: 'Schaltest du die Erinnerung ein, fragt dein Browser nach der Erlaubnis für Mitteilungen, und dein Konto hält für dieses Handy: die Push-Adresse, die dein Browser dafür vergibt, mit ihren Schlüsseln, Wochentag und Uhrzeit, deine Zeitzone und Sprache, und in welcher Woche die letzte Erinnerung ging. Ändern sich Zeitzone oder Sprache auf dem Handy, trägt die App sie nach.',
          },
          {
            kind: 'p',
            text: 'Zur gewählten Zeit schickt ein Dienst bei Supabase die Erinnerung über den Push-Dienst deines Browser-Herstellers (Apple, Google, Mozilla oder Microsoft). Sie ist Ende-zu-Ende verschlüsselt: Der Push-Dienst sieht, dass eine Mitteilung ankommt, aber nicht, was sie sagt. Die Protokolle des Dienstes nennen nur den Push-Dienst, nie deine Adresse.',
          },
          {
            kind: 'p',
            text: 'Rechtsgrundlage ist, dass du die Erinnerung einschaltest (Art. 6 Abs. 1 lit. b DSGVO). Die Angaben werden gelöscht, wenn du sie ausschaltest, dich abmeldest oder dein Konto löschst, und wenn der Push-Dienst meldet, dass es die Adresse nicht mehr gibt.',
          },
        ],
      },
      en: {
        heading: 'Weekly reminder',
        blocks: [
          {
            kind: 'p',
            text: 'When you turn the reminder on, your browser asks for permission to show notifications, and your account keeps for this phone: the push address your browser gives it, with its keys, the weekday and time, your time zone and language, and the week the last reminder went. When the time zone or language changes on the phone, the app updates them.',
          },
          {
            kind: 'p',
            text: 'At the time you picked, a function at Supabase sends the reminder through your browser maker’s push service (Apple, Google, Mozilla or Microsoft). It is end-to-end encrypted: the push service sees that a message arrives, but not what it says. The function’s logs name only the push service, never your address.',
          },
          {
            kind: 'p',
            text: 'The legal basis is that you turn the reminder on (Art. 6 (1) (b) GDPR). The details are deleted when you turn it off, sign out or delete your account, and when the push service reports that the address no longer exists.',
          },
        ],
      },
    },
    // The AI features (the AI phase): what each sends (contract.ts, askSnapshot, draftForChat), `scrub`, the
    // allowance in `private.ai_uses` (rows over 2 days go in the daily purge), logs without text (handle.ts), and
    // Anthropic's terms (Anthropic Ireland, Limited for the EEA; no training; deleted within 30 days at the latest;
    // flagged content up to 2 years), read on 12-11-2026.
    {
      id: 'ai',
      when: 'ai',
      de: {
        heading: 'KI-Funktionen (Anthropic)',
        blocks: [
          {
            kind: 'p',
            text: 'Angemeldet kannst du drei Funktionen mit KI nutzen. Vor der ersten Nutzung sagt dir die App, was sie sendet; abschalten kannst du sie für dieses Handy unter Einstellungen → Dein Konto. Gesendet wird:',
          },
          {
            kind: 'list',
            items: [
              'bei Schnell erfassen: die Zeile, das heutige Datum, die Sprache und die Namen deiner Ausgabenkategorien und deiner Konten mit Art und Währung, ohne deren Kennungen;',
              'bei Fragen: deine Fragen mit den Antworten davor und eine Übersicht deines Budgets: der Plan, die Zahlen dieses und des Monats davor je Umschlag, die Woche, einmalige Kosten und bis zu 30 letzte Ausgaben und Einnahmen mit gekürzten Notizen; keine Kontostände, Konten, E-Mail-Adresse oder Nutzernamen;',
              'bei Per Chat einrichten: deine Nachrichten mit den Antworten davor und der Entwurf deines Plans, also Beträge sowie Namen, Arten, Währungen und Anfangsstände der Konten darin.',
            ],
          },
          {
            kind: 'p',
            text: 'Eine Funktion bei Supabase prüft deine Anmeldung, zählt, wie oft du jede Funktion nutzt (nach zwei Tagen gelöscht, alle mit dem Konto), und entfernt aus allen Texten Konto- und Kartennummern, SEPA-Angaben, E-Mail-Adressen, Telefonnummern und lange Zahlenfolgen. Die Antwort erstellt dann Anthropic Ireland, Limited in meinem Auftrag (Art. 28 DSGVO), auch in den USA durch Anthropic, PBC. Anthropic nutzt die Anfragen nicht zum Training seiner Modelle und löscht Anfragen und Antworten spätestens nach 30 Tagen; was gegen seine Nutzungsrichtlinien verstößt, kann es bis zu zwei Jahre aufbewahren. Die Protokolle der Funktion enthalten keine Texte.',
          },
          {
            kind: 'p',
            text: 'Rechtsgrundlage ist, dass du die Funktion nutzt (Art. 6 Abs. 1 lit. b DSGVO), für die Tagesgrenzen mein berechtigtes Interesse an begrenzten Kosten (Art. 6 Abs. 1 lit. f DSGVO).',
          },
        ],
      },
      en: {
        heading: 'AI features (Anthropic)',
        blocks: [
          {
            kind: 'p',
            text: 'Signed in, you can use three features with AI. Before the first use, the app tells you what they send; you can turn them off for this phone in Settings → Your account. What is sent:',
          },
          {
            kind: 'list',
            items: [
              'with Quick add: the line, today’s date, the language, and the names of your expense categories and of your accounts with their kind and currency, without their identifiers;',
              'with Ask: your questions with the answers before them, and an overview of your budget: the plan, this month’s and last month’s figures per envelope, the week, one-off costs and up to 30 recent expenses and incomes with shortened notes; no balances, accounts, email address or username;',
              'with Set up by chatting: your messages with the replies before them, and the draft of your plan, that is amounts and the names, kinds, currencies and starting balances of the accounts in it.',
            ],
          },
          {
            kind: 'p',
            text: 'A function at Supabase checks your sign-in, counts how often you use each feature (deleted after two days, all of them with the account), and takes account and card numbers, SEPA details, email addresses, phone numbers and long runs of digits out of every text. Anthropic Ireland, Limited then writes the answer on my behalf (Art. 28 GDPR), also in the USA through Anthropic, PBC. Anthropic doesn’t use the requests to train its models, and deletes requests and answers within 30 days at the latest; what breaks its usage policies it may keep for up to two years. The function’s logs hold no text.',
          },
          {
            kind: 'p',
            text: 'The legal basis is that you use the feature (Art. 6 (1) (b) GDPR), and for the daily limits my legitimate interest in limited costs (Art. 6 (1) (f) GDPR).',
          },
        ],
      },
    },
    // Transfers: the DPF list read on 12-11-2026 (Vercel Inc. and Cloudflare, Inc. active; Supabase and Anthropic
    // not listed, so their DPAs' SCCs).
    {
      id: 'transfers',
      when: 'always',
      de: {
        heading: 'Übermittlung in Länder außerhalb der EU',
        blocks: [
          {
            kind: 'p',
            text: 'Einige der genannten Dienste sitzen außerhalb der EU oder verarbeiten Daten auch dort. Vercel Inc. und Cloudflare, Inc. (USA) sind nach dem EU-U.S. Data Privacy Framework zertifiziert (Liste geprüft am 12.11.2026); die Übermittlung an sie stützt sich auf den Angemessenheitsbeschluss der EU-Kommission dazu (Art. 45 DSGVO).',
          },
          {
            kind: 'p',
            text: 'Wo die App ein Konto oder KI-Funktionen hat, gilt für Supabase (Singapur, mit der Datenbank in Frankfurt) und Anthropic (Irland, mit Verarbeitung in den USA), die nicht so zertifiziert sind: Die Übermittlung stützt sich auf die Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO) in ihren Verträgen zur Auftragsverarbeitung. Eine Kopie bekommst du auf Anfrage von mir.',
          },
        ],
      },
      en: {
        heading: 'Transfers outside the EU',
        blocks: [
          {
            kind: 'p',
            text: 'Some of the services named above are based outside the EU or also process data there. Vercel Inc. and Cloudflare, Inc. (USA) are certified under the EU-U.S. Data Privacy Framework (list checked on 12.11.2026); transfers to them rest on the European Commission’s adequacy decision for it (Art. 45 GDPR).',
          },
          {
            kind: 'p',
            text: 'Where the app has an account or AI features, Supabase (Singapore, with the database in Frankfurt) and Anthropic (Ireland, with processing in the USA) are not certified in this way: transfers to them rest on the European Commission’s standard contractual clauses (Art. 46 (2) (c) GDPR) in their data processing agreements. You can ask me for a copy.',
          },
        ],
      },
    },
    // The rights (Art. 15–22, 77 GDPR) and the authority: BayLDA, for a non-public body in Bavaria (Art. 18 (1)
    // BayDSG, § 2 (4) BDSG), from lda.bayern.de (12-11-2026).
    {
      id: 'rights',
      when: 'always',
      de: {
        heading: 'Deine Rechte',
        blocks: [
          {
            kind: 'p',
            text: 'Du hast das Recht auf Auskunft über deine Daten (Art. 15 DSGVO), auf Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Einer Verarbeitung, die auf meinem berechtigten Interesse beruht, kannst du aus Gründen, die sich aus deiner besonderen Situation ergeben, widersprechen (Art. 21). Automatisierte Entscheidungen im Sinne von Art. 22 DSGVO trifft die App nicht.',
          },
          {
            kind: 'p',
            text: 'Vieles davon kannst du in der App selbst: Unter Einstellungen → Backup und Daten exportierst du mit „Backup exportieren“ alles, was auf deinem Handy liegt, als Datei, und mit „Alles löschen“ löschst du es. Für alles andere schreib mir an die E-Mail-Adresse oben.',
          },
          { kind: 'p', text: 'Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), etwa bei der für mich zuständigen:' },
          {
            kind: 'lines',
            lines: ['Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)', 'Promenade 18', '91522 Ansbach', 'www.lda.bayern.de'],
          },
        ],
      },
      en: {
        heading: 'Your rights',
        blocks: [
          {
            kind: 'p',
            text: 'You have the right of access to your data (Art. 15 GDPR), to rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and data portability (Art. 20). You can object to processing based on my legitimate interest on grounds relating to your particular situation (Art. 21). The app makes no automated decisions within the meaning of Art. 22 GDPR.',
          },
          {
            kind: 'p',
            text: 'Much of this you can do in the app itself: in Settings → Backup and data, “Export backup” saves everything on your phone as a file, and “Delete everything” deletes it. For anything else, write to me at the email address above.',
          },
          { kind: 'p', text: 'You can also complain to a data protection supervisory authority (Art. 77 GDPR), for example the one responsible for me:' },
          {
            kind: 'lines',
            lines: ['Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)', 'Promenade 18', '91522 Ansbach, Germany', 'www.lda.bayern.de'],
          },
        ],
      },
    },
  ];
}
