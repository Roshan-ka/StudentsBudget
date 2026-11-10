import type { TipWords } from '..';

// Los consejos en español, por su id (src/data/tips.ts). Solo las palabras: cifras, enlaces, fechas de comprobación y
// categorías se quedan en los datos, y cada cifra de la versión inglesa está también aquí (comprobado en
// city.test.ts). Los nombres de lugares, entidades y ofertas se quedan como se llaman.

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';

export const tips: Record<string, TipWords> = {
  'cafeteria-surprise-bags': {
    title: 'Llévate una bolsa sorpresa de la cafetería',
    body: 'Las cafeterías Milchbar, Sammelgebäude (UR) y Architektur (OTH) venden sobras baratas a través de Too Good To Go en los últimos 30 minutos.',
    source: `${STWNO}, página sobre desperdicio de comida: bolsas sorpresa a través de Too Good To Go en los últimos 30 minutos en las cafeterías Milchbar, Sammelgebäude y Architektur, no todos los días`,
  },
  'eat-at-the-mensa': {
    title: 'Come en la Mensa',
    body: 'En la Mensa de la Uni Regensburg los platos principales empiezan en 2,30 € para estudiantes. Los invitados pagan 6,10 € por el mismo plato.',
    source: `${STWNO}, menú de la Mensa Uni Regensburg: el plato principal más barato costaba 2,30 € para estudiantes, 3,30 € para el personal y 6,10 € para invitados todos los días laborables del 19 al 30 de octubre de 2026 (el menú cambia cada día)`,
  },
  'tap-your-student-id': {
    title: 'Pon tu carné de estudiante en la caja',
    body: '¿Pagas con tarjeta o con el móvil? Pon también tu carné de estudiante en el terminal de la caja, o te cobran el precio más alto.',
    source: `${STWNO}, página de la Mensa Uni Regensburg: las cajas no aceptan efectivo; hay que poner también la tarjeta de la Mensa o el carné de estudiante en el terminal para obtener el precio de estudiante`,
  },
  'theatre-at-half-price': {
    title: 'Ve al teatro a mitad de precio',
    body: 'Los estudiantes menores de 30 pagan la mitad en el Staatstheater; las funciones U30 cuestan 10 € en cualquier asiento. Compra en la taquilla para ahorrarte la comisión de 1,50 €.',
    source: 'Staatstheater Regensburg, preguntas frecuentes: 50 % de descuento sobre el precio normal hasta cumplir 30 años; funciones U30 a 10 € en cualquier asiento; 1,50 € de comisión por entrada en línea o por teléfono, ninguna en la taquilla',
  },
  'historisches-museum-free': {
    title: 'Visita gratis el Historisches Museum',
    body: 'Los estudiantes menores de 30 entran gratis en el Historisches Museum de la ciudad (los adultos pagan 5 €). Lleva tu carné de estudiante.',
    source: 'Museen der Stadt Regensburg, Historisches Museum: adultos 5 €; gratis para estudiantes menores de 30 con carné, y para todos el primer domingo de cada mes',
  },
  'hdbg-museum-free': {
    title: 'Visita gratis el museo de historia bávara',
    body: 'Los estudiantes menores de 30 entran gratis en la Haus der Bayerischen Geschichte (los adultos pagan 7 €), también en la Bayernausstellung 2026/27.',
    source: 'Haus der Bayerischen Geschichte, precios de entrada válidos del 8 de julio de 2026 al 7 de agosto de 2027: adultos 7 €, estudiantes menores de 30 gratis',
  },
  'cinema-student-price': {
    title: 'Reserva entradas de cine gratis',
    body: 'En los Kinos im Andreasstadel los estudiantes pagan 8 € en lugar de 9 €. Reserva gratis en vez de comprar en línea, que añade un 10 %.',
    source: 'Kinos im Andreasstadel, precios: 9 € normal, 8 € reducido para estudiantes con justificante; la venta anticipada en línea añade un 10 %; las reservas son gratis',
  },
  'register-in-person': {
    title: 'Regístrate en persona y llévate vales gratis',
    body: 'Registra tu residencia principal en persona en un Bürgerbüro: el paquete de bienvenida incluye vales para una visita guiada por la ciudad y una entrada de teatro.',
    source: 'Stadt Regensburg, paquete de bienvenida: se entrega al registrarte en persona; con residencia principal incluye vales para una visita guiada por la ciudad y una entrada de teatro',
  },
  'campus-bike-repair': {
    title: 'Arregla tu bici en Campus Bike Repair',
    body: 'Un taller de bicis móvil con herramientas y parches viene al campus de la UR cada semana. Las piezas especiales las traes tú.',
    source: 'Universität Regensburg, UR Health «Move»: el taller móvil Campus Bike Repair viene al campus cada semana con herramientas y material de parches; no se ofrecen piezas especiales',
  },
  'fashion-for-free': {
    title: 'Consigue ropa en Fashion for Free',
    body: 'El Studierendenwerk organiza cada semestre un intercambio de ropa gratis, y no hace falta llevar ropa. Su página de noticias tiene la próxima fecha en Regensburg.',
    source: `${STWNO}, noticia «Fashion for free im STWNO» (6 de agosto de 2026): gratis para todos, sin donación, cada semestre; en Regensburg el 9 de diciembre de 2026 en la sala de invitados de la Mensa de la UR`,
  },
  'free-psychological-counselling': {
    title: 'Usa la orientación psicológica gratuita',
    body: 'El Studierendenwerk ofrece orientación individual gratuita en alemán o en inglés, en persona, por teléfono o por vídeo.',
    source: `${STWNO}, orientación psicológica: orientación individual gratuita a corto y medio plazo en persona, por teléfono o por vídeo, en alemán e inglés`,
  },
  'borrow-course-books': {
    title: 'Toma prestados los manuales, no los compres',
    body: 'Toma prestados los manuales básicos de la Lehrbuchsammlung de la biblioteca central de la UR durante cuatro semanas, prorrogables hasta 12 semanas.',
    source: 'Biblioteca de la Universität Regensburg, préstamo de material impreso: la colección de manuales se presta cuatro semanas, prorrogables a 12 semanas',
  },
  'scan-for-free': {
    title: 'Escanea libros de la biblioteca gratis',
    body: 'Escanea gratis libros de la sala de lectura en los escáneres de libros de la biblioteca de la UR y guárdalos en tu propio USB.',
    source: 'Biblioteca de la Universität Regensburg, préstamo de material impreso, salas de lectura: escanear en los escáneres de libros es gratis, y se guarda en tu propio USB',
  },
  'day-trips-on-the-semester-ticket': {
    title: 'Haz excursiones de un día con el abono semestral',
    body: 'Desde el invierno 2026/27 el abono semestral vuelve a cubrir los trenes de Regensburg hasta Neustadt an der Donau, sin coste extra.',
    source: `${STWNO}, abono semestral de Regensburg: desde el semestre de invierno 2026/27 el tramo de tren de Sinzing/Riegling a Neustadt a. d. Donau vuelve a estar en la zona del abono`,
  },
  studienstarthilfe: {
    title: 'Pide la ayuda de inicio de estudios de 1000 €',
    body: '¿Primer año, menos de 25 y con prestaciones como Bürgergeld o Wohngeld? Pide una ayuda única de 1000 € antes de que acabe el mes siguiente a tu inicio.',
    source: `${STWNO}, BAföG Studienstarthilfe: una ayuda única de 1000 €, que no se devuelve, para quienes empiezan a estudiar a tiempo completo por primera vez, son menores de 25 y reciben prestaciones sociales; se pide por BAföG Digital antes de que acabe el mes siguiente al inicio`,
  },
  'apply-for-a-dorm-room': {
    title: 'Solicita una habitación del Studierendenwerk',
    body: 'Las habitaciones de residencia más baratas cuestan unos 215 € al mes; una habitación en piso compartido cuesta de media 459–561 €. Puedes solicitarla en línea en cualquier momento.',
    source: 'Universität Regensburg, vivir en Regensburg: las habitaciones más baratas del Studierendenwerk cuestan unos 215 €; una habitación media en piso compartido, 459–561 € (Moses Mendelssohn Institut, sept. 2026); sin plazo de solicitud',
  },
  'check-wohngeld': {
    title: 'Comprueba si te corresponde el Wohngeld',
    body: '¿Sin derecho al BAföG en principio, por ejemplo por superar el límite de edad? El Wohngeld puede ayudarte con el alquiler si Regensburg es tu residencia principal.',
    source: `${STWNO}, Wohngeld: solo es posible sin derecho al BAföG en principio, y la ciudad de estudios debe ser la residencia principal`,
  },
  'free-tenancy-advice': {
    title: 'Consigue asesoría gratuita sobre tu alquiler',
    body: '¿Problemas con tu casero? La orientación social del Studierendenwerk te deriva al Mieterverein local para un asesoramiento gratuito.',
    source: `${STWNO}, asesoría sobre derecho de alquiler: asesoramiento gratuito del Mieterverein local de Regensburg, por derivación de la orientación social`,
  },
  'stay-on-family-insurance': {
    title: 'Sigue en el seguro médico familiar',
    body: 'La cobertura gratuita en el seguro médico público de uno de tus padres dura hasta que cumples 25 si ganas menos de 565 € al mes (603 € en un minijob, 2026).',
    source: `${STWNO}, seguro médico y de dependencia: seguro familiar gratuito hasta cumplir 25 años; en 2026 hasta 565 € al mes de un empleo normal o 603 € de un minijob`,
  },
  'software-from-campus-it': {
    title: 'Consigue Office a través de la universidad',
    body: 'Antes de pagar Office 365 o SPSS, mira la oferta de software de Campus IT de la UR: las licencias de campus son gratis o tienen descuento para estudiantes.',
    source: 'Universität Regensburg Campus IT, software: licencias de campus gratis o a precios especiales; los estudiantes tienen descuentos en software como SPSS y Office 365',
  },
  'ride-on-your-semester-ticket': {
    title: 'Viaja en el RVV con tu abono semestral',
    body: 'Tu cuota semestral ya incluye 126 € (semestre de invierno 2026/27) para viajes ilimitados en autobús y tren del RVV. Tu carné de estudiante y un documento con foto son el billete.',
    source: 'RVV, abono semestral: 126 € obligatorios por semestre para viajes ilimitados en toda la zona del RVV; el billete es el carné de estudiante más el DNI o el pasaporte',
  },
  'upgrade-to-deutschlandticket': {
    title: 'Pasa al Deutschlandticket por 22 €',
    body: 'La ampliación cuesta 22 € al mes además de tu abono semestral. Contrátala para los meses en que viajes; cancélala antes del día 10 para el mes siguiente.',
    source: 'RVV, abono semestral: desde el 1 de octubre de 2026 el suplemento para estudiantes de Regensburg es de 22,00 € al mes; una suscripción mensual que se cancela antes del día 10 del mes',
  },
  'try-university-sport': {
    title: 'Prueba el deporte universitario antes que un gimnasio',
    body: 'URsport, en el Sportzentrum de la UR, tiene gimnasio, piscina, sauna y cursos a precio de estudiante para estudiantes de la UR y la OTH. Compara antes de apuntarte.',
    source: 'Sportzentrum de la Universität Regensburg, plataforma URsport: los estudiantes de la UR y la OTH entran y compran a precio de estudiante; gimnasio, piscina y sauna a través de la app',
  },
  'split-the-rundfunkbeitrag': {
    title: 'Comparte un solo Rundfunkbeitrag por piso',
    body: 'La tasa es de 18,36 € al mes por piso, no por persona. En un piso compartido se registra una persona y la repartís; las demás se dan de baja.',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, información para estudiantes: 18,36 € al mes por piso; solo un adulto por piso se registra y paga',
  },
  'rundfunkbeitrag-bafoeg-exemption': {
    title: 'Pide la exención del Rundfunkbeitrag',
    body: 'Si recibes BAföG y no vives con tus padres, pide la exención de la tasa de 18,36 € al mes. No es automática.',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, información para estudiantes: quienes reciben BAföG y no viven con sus padres pueden quedar exentos si lo solicitan',
  },
};
