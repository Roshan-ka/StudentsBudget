import type { SwapWords } from '..';

// Las ideas de ahorro en español, por su id (src/data/swaps.ts). Solo las palabras; "per" es la unidad de la línea
// de ahorro ("ahorra unos 10 € por comida"). Cada cifra de la versión inglesa está también aquí (city.test.ts).

export const swaps: Record<string, SwapWords> = {
  'mensa-instead-of-restaurant': {
    title: 'Come en la Mensa en lugar de en un restaurante',
    body: 'En la semana del 19 al 23 de octubre, la mediana de los platos principales de la Mensa de la Uni Regensburg fue de 3,80 € para estudiantes, y el más barato costó 2,30 €. Una comida en un restaurante económico cuesta unos 14,50 €. Un día en que comerías fuera, la Mensa es el plato más barato.',
    per: 'comida',
    source:
      'Numbeo, «Meal at an Inexpensive Restaurant» en Regensburg: 14,50 € (datos aportados por usuarios; para toda la ciudad, 246 entradas de 15 colaboradores en los últimos 12 meses, actualizado el 20 de octubre de 2026)',
    toSource:
      'Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: mediana del precio para estudiantes de los platos principales del menú en la semana del 19 al 23 de octubre de 2026, una instantánea (la página del menú muestra la semana actual)',
  },
  'cinema-student-price': {
    title: 'Ve al cine a precio de estudiante',
    body: 'Enseña tu justificante de estudiante en los Kinos im Andreasstadel: una entrada para una sesión normal cuesta 8 € en lugar de 9 €.',
    per: 'entrada',
    source:
      'Kinos im Andreasstadel, precios: normal 9 €, reducido 8 € para estudiantes que muestran justificante en el cine; los eventos especiales pueden variar',
  },
  'deutschlandticket-for-travel-months': {
    title: 'Contrata el Deutschlandticket para un mes en que viajes',
    body: 'Estimación: el ahorro supone un día con Bayern-Ticket al mes, y cada día más se suma. Un Bayern-Ticket de un día cuesta 34 €. La ampliación para estudiantes al Deutschlandticket cuesta 22 € al mes en Regensburg y vale todo el día en trenes locales y regionales de toda Alemania. Es una suscripción mensual: cancélala antes del día 10 de un mes y termina con ese mes, así que puedes tenerla solo los meses en que viajas.',
    per: 'mes',
    source:
      'Estimación (supone un día con Bayern-Ticket al mes). Deutsche Bahn, Bayern-Ticket: 1 persona, 2.ª clase, un día, 34 €',
    toSource:
      'RVV, abono semestral: desde el 1 de octubre de 2026 el suplemento para estudiantes de Regensburg para el Deutschlandticket es de 22,00 € al mes; una suscripción mensual que se cancela antes del día 10 del mes',
  },
};
