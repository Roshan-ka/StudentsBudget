// Statement files for the import's tests (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md), shared by
// the unit tests and e2e/import.spec.ts. They follow each bank's layout as `profiles.ts` documents it, with made-up
// people, shops and numbers (the IBANs are zeros). TypeScript rather than .csv files, which no CI rule knows (a path no
// rule matches runs every spec).

const encoder = new TextEncoder();

/** UTF-8 bytes, with a byte order mark when `bom`. */
export function utf8(text: string, bom = false): Uint8Array {
  const bytes = encoder.encode(text);
  if (!bom) return bytes;
  const withBom = new Uint8Array(bytes.length + 3);
  withBom.set([0xef, 0xbb, 0xbf]);
  withBom.set(bytes, 3);
  return withBom;
}

/** Windows-1252 bytes for text in Latin-1 and the euro sign (all these files need), as Sparkasse writes them. */
export function windows1252(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    if (char === '€') return 0x80;
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) return code;
    throw new Error(`No Windows-1252 byte for ${char}`);
  });
}

/** Lines joined as banks end them: CRLF. */
const lines = (...rows: string[]) => rows.join('\r\n') + '\r\n';

/** A row of quoted fields. */
const quoted = (separator: string, ...cells: string[]) => cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(separator);

const SPARKASSE_CAMT_HEADER = [
  'Auftragskonto', 'Buchungstag', 'Valutadatum', 'Buchungstext', 'Verwendungszweck', 'Glaeubiger ID', 'Mandatsreferenz',
  'Kundenreferenz (End-to-End)', 'Sammlerreferenz', 'Lastschrift Ursprungsbetrag', 'Auslagenersatz Ruecklastschrift',
  'Beguenstigter/Zahlungspflichtiger', 'Kontonummer/IBAN', 'BIC (SWIFT-Code)', 'Betrag', 'Waehrung', 'Info',
];

/** A CSV-CAMT V2 row: the 17 columns, from the few that matter. */
function camtRow(row: { day: string; value?: string; text: string; purpose: string; payee: string; amount: string; info?: string }): string {
  return quoted(';',
    'DE00750500000000000000', row.day, row.value ?? row.day, row.text, row.purpose, '', '', '', '', '', '',
    row.payee, 'DE00000000000000000000', 'BYLADEM1001', row.amount, 'EUR', row.info ?? 'Umsatz gebucht',
  );
}

/** Sparkasse, CSV-CAMT V2, as text: a card payment, BAföG, rent, cash, a pending one, a top-up of Revolut, an umlaut. */
export const SPARKASSE_CAMT_TEXT = lines(
  quoted(';', ...SPARKASSE_CAMT_HEADER),
  camtRow({ day: '30.10.26', text: 'KARTENZAHLUNG', purpose: '2026-10-29T18:12 Debitk.1 2029-12', payee: 'REWE Markt GmbH', amount: '-23,45' }),
  camtRow({ day: '31.10.26', text: 'GUTSCHRIFT', purpose: 'BAFOEG 10/2026', payee: 'Bundesamt fuer Ausbildungsfoerderung', amount: '934,00' }),
  camtRow({ day: '01.11.26', text: 'FOLGELASTSCHRIFT', purpose: 'Miete November', payee: 'Studierendenwerk Niederbayern/Oberpfalz', amount: '-1.250,00' }),
  camtRow({ day: '02.11.26', text: 'BARGELDAUSZAHLUNG', purpose: 'GA NR00001234 BLZ75050000 0', payee: 'Sparkasse Regensburg', amount: '-50,00' }),
  camtRow({ day: '03.11.26', text: 'KARTENZAHLUNG', purpose: 'Brötchen', payee: 'Bäckerei Müller', amount: '-3,10', info: 'Umsatz vorgemerkt' }),
  camtRow({ day: '', value: '04.11.26', text: 'UEBERWEISUNG', purpose: 'Aufladen', payee: 'Revolut', amount: '-100,00' }),
);
/** The same file as Sparkasse sends it: Windows-1252. */
export const SPARKASSE_CAMT = windows1252(SPARKASSE_CAMT_TEXT);

/** Sparkasse, CSV-MT940: the SEPA fields packed into the purpose. */
export const SPARKASSE_MT940 = windows1252(
  lines(
    quoted(';', 'Auftragskonto', 'Buchungstag', 'Valutadatum', 'Buchungstext', 'Verwendungszweck', 'Beguenstigter/Zahlungspflichtiger', 'Kontonummer', 'BLZ', 'Betrag', 'Waehrung', 'Info'),
    quoted(';', '0000000000', '01.11.26', '01.11.26', 'FOLGELASTSCHRIFT', 'EREF+NOTPROVIDED MREF+M-1 CRED+DE98ZZZ00000000000 SVWZ+Rundfunkbeitrag 11.2026 ABWA+ARD ZDF', 'Rundfunk ARD, ZDF, Deutschlandradio', 'DE00000000000000000000', 'GENODEF1S01', '-18,36', 'EUR', 'Umsatz gebucht'),
  ),
);

const DKB_HEADER = ['Buchungsdatum', 'Wertstellung', 'Status', 'Zahlungspflichtige*r', 'Zahlungsempfänger*in', 'Verwendungszweck', 'Umsatztyp', 'IBAN', 'Betrag (€)', 'Gläubiger-ID', 'Mandatsreferenz', 'Kundenreferenz'];

function dkbText(separator: string): string {
  return lines(
    quoted(separator, 'Girokonto', 'DE00 1203 0000 0000 0000 00'),
    quoted(separator, ''),
    quoted(separator, 'Kontostand vom 05.11.2026:', '1.234,56 €'),
    quoted(separator, ''),
    quoted(separator, ...DKB_HEADER),
    quoted(separator, '04.11.26', '04.11.26', 'Gebucht', 'Max Mustermann', 'Lidl sagt Danke', '2026-11-03 Debitk.99 VISA Debit', 'Ausgang', 'DE00000000000000000000', '-12,49 €', '', '', ''),
    quoted(separator, '03.11.26', '03.11.26', 'Gebucht', 'Eltern Mustermann', 'Max Mustermann', 'Taschengeld November', 'Eingang', 'DE00000000000000000000', '200,00 €', '', '', ''),
    quoted(separator, '05.11.26', '05.11.26', 'Vorgemerkt', 'Max Mustermann', 'Spotify', 'Spotify P1234', 'Ausgang', '', '-10,99 €', '', '', ''),
    quoted(separator, '05.11.26', '05.11.26', 'Gebucht', '', '', 'Tagessaldo', '', '', '1.411,08 €', '', '', ''),
  );
}
/** DKB since late 2023: four account lines above the header, `;`, UTF-8 with a BOM. */
export const DKB = utf8(dkbText(';'), true);
/** The same with `,`, as DKB has written it since about 09-2024. */
export const DKB_COMMA = utf8(dkbText(','), true);

/** DKB before 2023: ISO-8859-1, a trailing `;` on every line, account lines above, a closing line. */
export const DKB_OLD = windows1252(
  lines(
    '"Kontonummer:";"DE00 1203 0000 0000 0000 00 / Girokonto";',
    '"Von:";"01.10.2022";',
    '"Bis:";"31.10.2022";',
    '"Kontostand vom 31.10.2022:";"1.000,00 EUR";',
    '',
    quoted(';', 'Buchungstag', 'Wertstellung', 'Buchungstext', 'Auftraggeber / Begünstigter', 'Verwendungszweck', 'Kontonummer', 'BLZ', 'Betrag (EUR)', 'Gläubiger-ID', 'Mandatsreferenz', 'Kundenreferenz') + ';',
    quoted(';', '28.10.2022', '28.10.2022', 'Lastschrift', 'Rundfunk ARD, ZDF, DRadio', 'Rundfunkbeitrag', 'DE00000000000000000000', 'GENODEF1S01', '-55,08', '', '', '') + ';',
    quoted(';', '31.10.2022', '31.10.2022', 'Abschluss', '', 'Abrechnung 31.10.2022', '', '', '-1,50', '', '', '') + ';',
  ),
);

/** N26 since about 2021: `,` with uneven quoting (the Type header and some fields bare). */
export const N26 = utf8(
  lines(
    '"Booking Date","Value Date","Partner Name","Partner Iban",Type,"Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"',
    '"2026-11-02","2026-11-02","dm-drogerie markt","",Presentment,"-","Main Account","-7.95","","",""',
    '"2026-11-01","","Max Mustermann","DE00000000000000000000",Credit Transfer,"Rent share, November","Main Account",300.00,"","",""',
    '2026-10-31,,"Netflix",,Presentment,,"Main Account",-13.99,13.99,EUR,1.0',
  ),
);

/** N26 as a spreadsheet saves it again in German: `;`, a decimal comma and the day first. */
export const N26_RESAVED = utf8(
  lines(
    'Booking Date;Value Date;Partner Name;Partner Iban;Type;Payment Reference;Account Name;Amount (EUR);Original Amount;Original Currency;Exchange Rate',
    '02.11.2026;02.11.2026;dm-drogerie markt;;Presentment;-;Main Account;-7,95;;;',
    '31.10.2026;;Netflix;;Presentment;;Main Account;-13,99;13,99;EUR;1',
  ),
);

/** N26 until about 2021, from the German app. */
export const N26_OLD_DE = utf8(
  lines(
    '"Datum","Empfänger","Kontonummer","Transaktionstyp","Verwendungszweck","Kategorie","Betrag (EUR)","Betrag (Fremdwährung)","Fremdwährung","Wechselkurs"',
    '"2021-03-01","Mensa Uni Regensburg","","MasterCard Zahlung","","Bars & Restaurants","-3.5","","",""',
  ),
);

/** Revolut's personal statement: a top-up, a card payment, cash with a fee, an exchange, a vault move, pending, INR, reverted. */
export const REVOLUT = utf8(
  lines(
    'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
    'TOPUP,Current,2026-11-01 09:00:00,2026-11-01 09:00:05,Top-Up by *1234,100.00,0.00,EUR,COMPLETED,100.00',
    'CARD_PAYMENT,Current,2026-11-02 12:30:00,2026-11-03 08:00:00,Lieferando,-18.40,0.00,EUR,COMPLETED,81.60',
    'ATM,Current,2026-11-03 10:00:00,2026-11-03 10:00:01,Cash at Sparkasse,-50.00,1.00,EUR,COMPLETED,30.60',
    'EXCHANGE,Current,2026-11-04 10:00:00,2026-11-04 10:00:00,Exchanged to INR,-20.00,0.00,EUR,COMPLETED,10.60',
    'TRANSFER,Deposit,2026-11-04 11:00:00,2026-11-04 11:00:00,To EUR Savings,5.00,0.00,EUR,COMPLETED,5.00',
    'CARD_PAYMENT,Current,2026-11-05 19:00:00,,Amazon,-12.00,0.00,EUR,PENDING,',
    'Card Payment,Current,2026-11-02 08:00:00,2026-11-02 08:00:00,Chai Point,-250.00,0.00,INR,COMPLETED,750.00',
    'CARD_PAYMENT,Current,2026-11-01 08:00:00,,Refunded thing,-9.00,0.00,EUR,REVERTED,',
    'Topup,Current,2026-11-05 09:00:00,2026-11-05 09:00:00,Top-Up by *1234,25.00,0.00,EUR,COMPLETED,35.60',
  ),
);

/** DKB's Visa card since 2023, which the import recognises and can't read yet. */
export const DKB_VISA = utf8(
  lines(
    quoted(';', 'Karte', 'Visa Kreditkarte', '4930 **** **** 1234'),
    quoted(';', ''),
    quoted(';', 'Belegdatum', 'Wertstellung', 'Status', 'Beschreibung', 'Umsatztyp', 'Betrag (€)', 'Fremdwährungsbetrag'),
    quoted(';', '04.11.26', '05.11.26', 'Gebucht', 'AMAZON', 'Ausgang', '-24,99 €', ''),
  ),
);

/** A CSV the import doesn't know, with money out and money in apart: matched by hand. */
export const UNKNOWN = utf8(
  lines(
    'Datum;Text;Soll;Haben;Währung',
    '01.11.2026;Edeka Center;12,30;;EUR',
    '02.11.2026;Lohn Oktober;;450,00;EUR',
    '03.11.2026;Kaputt;;;EUR',
  ),
);
