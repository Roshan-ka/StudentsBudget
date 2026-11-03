import type { DiscountWords } from '..';

// Los descuentos en español, por su id (src/data/discounts.ts). Solo las palabras: los lugares conservan su nombre
// (salvo uno con una palabra común), las direcciones se quedan como las da el lugar. Cada cifra de la versión inglesa
// está también aquí (comprobado en city.test.ts).

const STADTWERK = 'das Stadtwerk Regensburg';
const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';
/** Las piscinas y la pista de hielo de das Stadtwerk aplican así el precio de estudiante, y las tres páginas lo dicen. */
const STADTWERK_STUDENTS =
  'Estudiantes de 15 años hasta cumplir 25, con un justificante válido como el carné de estudiante (y un documento oficial con foto si lo piden), mostrado en la entrada. Un justificante presentado después no se acepta.';
const PUPILS_STUDENTS_TRAINEES = 'alumnos, estudiantes y aprendices';

export const discounts: Record<string, DiscountWords> = {
  'asia-restaurant-sunrise': {
    offer: '10 % de descuento',
    conditions: 'Estudiantes, todos los días, mostrando el carné de estudiante. No se combina con otras ofertas o descuentos.',
    source: 'Asia Restaurant Sunrise, página de inicio: 10 % de descuento para estudiantes, de lunes a domingo, mostrando el carné de estudiante; no se combina con otras ofertas o descuentos',
  },
  'mensa-childrens-plate': {
    offer: 'Un plato infantil gratis para tu hijo o hija, hasta su sexto año',
    conditions:
      'Para estudiantes con hijos que también comen en la Mensa (el comedor universitario), con una tarjeta de la Mensa de plato infantil. La consigues en la oficina de tarjetas de la Mensa (Info-Punkt) con una copia del certificado de nacimiento y tu certificado de matrícula.',
    source: `${STWNO}, Mensa Uni Regensburg: los hijos de estudiantes reciben un plato infantil gratis hasta su sexto año cuando el padre o la madre también come en la Mensa, con una tarjeta Kinderteller de la oficina de tarjetas de la Mensa`,
  },
  'kinos-im-andreasstadel': {
    offer: '8 € en lugar de 9 € por entrada',
    conditions:
      'Estudiantes, con justificante válido. Las sesiones especiales pueden tener otro precio. Comprar en línea por adelantado añade un 10 %; reservar un asiento es gratis.',
    source: 'Kinos im Andreasstadel, precios: 9 € normal, 8 € reducido para estudiantes con justificante válido; la venta anticipada en línea añade un 10 %; las reservas son gratis; los precios de las sesiones especiales pueden variar',
  },
  'staatstheater-regensburg': {
    offer: 'Mitad de precio en entradas normales, y cualquier asiento por 10 € en funciones marcadas U30 (menores de 30)',
    conditions:
      'Estudiantes hasta cumplir 30 años, para entradas de venta libre. Las funciones U30 son en fechas seleccionadas. Muestra tu justificante con la entrada en la puerta. En línea o por teléfono hay una comisión de 1,50 € por entrada; en la taquilla del teatro o en la taquilla de la noche, ninguna.',
    source: 'Staatstheater Regensburg, preguntas frecuentes: 50 % de descuento sobre el precio normal en venta libre (Freiverkauf) para estudiantes hasta cumplir 30 años; funciones U30 en fechas seleccionadas, 10 € en cualquier asiento; 1,50 € de comisión por entrada en línea o por teléfono, ninguna en la taquilla ni en la taquilla de la noche',
  },
  'regensburger-turmtheater': {
    offer: '16 € en lugar de 32 € en funciones normales',
    conditions: 'Estudiantes, alumnos y aprendices. Una función con otros precios lo indica en su descripción.',
    source: `Regensburger Turmtheater, entradas: funciones normales 32 €; ${PUPILS_STUDENTS_TRAINEES} 50 % de descuento (16 €); otros precios se indican en las descripciones de las funciones`,
  },
  'kunstforum-ostdeutsche-galerie': {
    offer: '4 € en lugar de 6 € la entrada',
    conditions: 'Estudiantes, alumnos y aprendices.',
    source: `Kunstforum Ostdeutsche Galerie, tu visita: entrada 6 €, reducida 4 €; ${PUPILS_STUDENTS_TRAINEES} están en la lista de quienes pagan el precio reducido`,
  },
  'document-kepler': {
    offer: 'Entrada gratis en lugar de 5 €',
    conditions: 'Estudiantes menores de 30, mostrando un documento. Las visitas guiadas públicas se pagan aparte.',
    source: 'Museen der Stadt Regensburg, document Kepler: adultos 5 €; gratis para estudiantes menores de 30 mostrando un documento; visitas guiadas públicas 8 €, reducidas 5 €',
  },
  'schloss-thurn-und-taxis': {
    offer:
      '14 € en lugar de 17 € por la visita guiada de las salas de gala y el claustro; 4 € en lugar de 6 € por la Cámara del Tesoro y el Marstall (museo de carruajes)',
    conditions: 'Estudiantes, mostrando el carné de estudiante. Las salas de gala solo se ven con visita guiada.',
    source: 'Fürst Thurn und Taxis, visitar Schloss St. Emmeram: visita guiada de las salas de gala y el claustro (Prunkräume & Kreuzgang) 17 €, reducida 14 €; Cámara del Tesoro y Marstall 6 €, reducida 4 €; reducida para alumnos y estudiantes mostrando su documento',
  },
  westbad: {
    offer: '4,60 € en lugar de 7,20 € por 3 horas; 6,50 € en lugar de 10 € por el día',
    conditions: STADTWERK_STUDENTS,
    source: `${STADTWERK}, precios del Westbad: 3 horas 7,20 €, día 10,00 €; reducido 4,60 € y 6,50 € para ${PUPILS_STUDENTS_TRAINEES} de 15 años hasta cumplir 25; justificante en la entrada, no después`,
  },
  'sportpark-ost-pool': {
    place: 'Piscina Sportpark Ost',
    offer: '2,90 € en lugar de 5 € por visita',
    conditions: STADTWERK_STUDENTS,
    source: `${STADTWERK}, precios de la piscina Sportpark Ost: entrada individual 5,00 €, reducida 2,90 € para ${PUPILS_STUDENTS_TRAINEES} de 15 años hasta cumplir 25; justificante en la entrada, no después`,
  },
  'donau-arena-skating': {
    offer: '5 € en lugar de 6 € en el patinaje público sobre hielo; 6 € en lugar de 7 € en el patinaje con música (Discolauf)',
    conditions: `${STADTWERK_STUDENTS} Solo en la temporada de patinaje.`,
    source: `${STADTWERK}, precios del patinaje público en la Donau-Arena: entrada individual 6 €, reducida 5 €; Discolauf 7 €, reducido 6 €; reducido para ${PUPILS_STUDENTS_TRAINEES} de 15 años hasta cumplir 25; justificante en la entrada, no después`,
  },
  'boulderwelt-studi-monday': {
    offer: 'Una entrada de día por 9,90 € los lunes («Studi Monday»)',
    conditions: 'Estudiantes y aprendices con justificante válido. Todo el día los lunes, no en festivos. El alquiler de pies de gato se paga aparte.',
    source: 'Boulderwelt Regensburg, precios: Studi Monday, una entrada de día de 9,90 € los lunes todo el día para estudiantes y aprendices con justificante válido; no en festivos; pies de gato de alquiler en el mostrador, con coste',
  },
  'super-bowl-student-tuesday': {
    offer: 'Bolos a 1 € la partida los martes',
    conditions: 'Alumnos y estudiantes.',
    source: 'Super Bowl Regensburg, ofertas: los martes, alumnos y estudiantes pagan 1 € por partida («Studenten Bowling»)',
  },
  'alnatura-student-tuesday': {
    offer: '8 % de descuento en toda tu compra los martes',
    conditions:
      'Estudiantes con un carné de estudiante o de alumno válido mostrado en la caja, en todas las tiendas Alnatura (en Regensburg también Donaustaufer Straße 128 y Joseph-Dahlem-Straße 3). No en envases retornables (Pfand), tarjetas regalo, libros ni leche infantil, y no con otros descuentos.',
    source: 'Alnatura, descuento para estudiantes: cada martes 8 % de descuento en toda la compra para estudiantes, aprendices y alumnos con un carné de estudiante o de alumno válido, en todas las tiendas Alnatura; no en envases retornables, tarjetas regalo, libros ni leche infantil, y no se combina con otros descuentos. El buscador de tiendas de Alnatura indica en Regensburg las tiendas de Dr.-Martin-Luther-Straße 2, Donaustaufer Straße 128 y Joseph-Dahlem-Straße 3',
  },
  'bellas-kunst-student-haircut': {
    offer: 'Corte de pelo de hombre para estudiantes: 30 € en lugar de 36 €',
    conditions:
      'Estudiantes. La lista de precios no indica otras condiciones. También hay un corte de mujer para estudiantes a 57 €, mientras que los demás cortes de mujer cuestan de 48 € a 70 €.',
    source: "Bella's Kunst, lista de precios: corte de hombre 36 €, corte para estudiantes 30 €; corte de mujer para estudiantes 57 €; otros cortes de mujer 48 € (Schnitt Spezial), 52 € (corto), 65 € (hasta los hombros), 70 € (largo)",
  },
  'stadtbuecherei-library-card': {
    offer: '10 € en lugar de 17 € por un carné anual de la biblioteca',
    conditions: 'Estudiantes, mostrando el carné de estudiante al hacer o renovar el carné de la biblioteca.',
    source: 'Stadt Regensburg, tasas de la Stadtbücherei: carné anual 17 € para adultos, 10 € reducido; las normas de uso a las que remite dan el carné reducido a estudiantes, aprendices y alumnos, con un justificante como el carné de estudiante al hacerlo o renovarlo',
  },
  'vhs-course-fees': {
    offer: '10 % de descuento en las tasas de los cursos del centro de educación de adultos',
    conditions:
      'Estudiantes matriculados de forma regular, previa solicitud: muestra el justificante en persona, o envía una copia con el número del curso, al menos una semana antes de que empiece. No se combina con otras reducciones, no vale para cursos que la VHS solo coorganiza, y la VHS puede excluir reducciones.',
    source: 'Volkshochschule Regensburg, condiciones generales: 10 % de descuento para estudiantes matriculados de forma regular (ordentlich Studierende) previa solicitud, con justificante al menos una semana antes de que empiece el curso; las reducciones no se combinan; no para actividades que la VHS solo coorganiza, y la VHS puede excluir reducciones',
  },
};
