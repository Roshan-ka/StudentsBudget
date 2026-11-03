import type { SwapWords } from '..';

// Die Spartipps auf Deutsch, nach ihrer id (src/data/swaps.ts). Nur die Worte; "per" ist die Einheit der Spar-Zeile
// ("spar etwa 10 € pro Essen"). Jede Zahl der englischen Fassung steht auch hier (getestet in city.test.ts).

export const swaps: Record<string, SwapWords> = {
  'mensa-instead-of-restaurant': {
    title: 'Iss in der Mensa statt im Restaurant',
    body: 'Im Median kostete ein Hauptgericht in der Mensa der Uni Regensburg Studierende in der Woche vom 19. bis 23. Okt. 3,80 €, das günstigste 2,30 €. Ein Essen in einem günstigen Restaurant kostet etwa 14,50 €. An einem Tag, an dem du auswärts essen würdest, ist die Mensa der günstigere Teller.',
    per: 'Essen',
    source:
      'Numbeo, „Meal at an Inexpensive Restaurant“ in Regensburg: 14,50 € (von Nutzern gesammelt; für die ganze Stadt, 246 Einträge von 15 Beitragenden in den letzten 12 Monaten, Stand 20. Okt. 2026)',
    toSource:
      'Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: Medianpreis der Hauptgerichte für Studierende auf dem Speiseplan in der Woche vom 19. bis 23. Okt. 2026, eine Momentaufnahme (die Speiseplanseite zeigt die aktuelle Woche)',
  },
  'cinema-student-price': {
    title: 'Geh zum Studierendenpreis ins Kino',
    body: 'Zeig in den Kinos im Andreasstadel deinen Studierendennachweis: Eine Karte für eine reguläre Vorstellung kostet 8 € statt 9 €.',
    per: 'Karte',
    source:
      'Kinos im Andreasstadel, Eintrittspreise: regulär 9 €, ermäßigt 8 € für Studierende mit Nachweis an der Kasse; Sonderveranstaltungen können abweichen',
  },
  'deutschlandticket-for-travel-months': {
    title: 'Buch das Deutschlandticket für einen Reisemonat',
    body: 'Schätzung: Die Ersparnis geht von einem Tag mit dem Bayern-Ticket im Monat aus, und jeder weitere Tag kommt dazu. Ein Bayern-Ticket für einen Tag kostet 34 €. Das Upgrade auf das Deutschlandticket kostet für Studierende in Regensburg 22 € im Monat und gilt den ganzen Tag in Nah- und Regionalzügen in ganz Deutschland. Es ist ein Monatsabo: Kündigst du es bis zum 10. eines Monats, endet es mit diesem Monat, sodass du es nur für die Monate behältst, in denen du reist.',
    per: 'Monat',
    source:
      'Schätzung (geht von einem Tag mit dem Bayern-Ticket im Monat aus). Deutsche Bahn, Bayern-Ticket: 1 Person, 2. Klasse, ein Tag, 34 €',
    toSource:
      'RVV, Semesterticket: Ab 1. Okt. 2026 beträgt der Regensburger Studierendenzuschlag für das Deutschlandticket 22,00 € im Monat; ein Monatsabo, kündbar bis zum 10. des Monats',
  },
};
