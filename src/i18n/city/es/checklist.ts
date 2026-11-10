import type { ChecklistWords } from '..';

// La lista de comprobación en español, por su id (src/data/checklist.ts). Solo las palabras: grupo, público, consejo,
// enlaces y fechas de comprobación siguen en los datos, y cada número de la versión inglesa está también aquí
// (comprobado en city.test.ts). Un punto que se apoya en un consejo cita su fuente con las mismas palabras que el consejo.

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';

export const checklist: Record<string, ChecklistWords> = {
  'register-your-address': {
    title: 'Empadrónate en tu dirección',
    body: 'Regístrate en la oficina de empadronamiento de la ciudad en las dos semanas siguientes a la mudanza.',
    source: 'Bundesmeldegesetz, § 17, apdo. 1: quien se muda a una vivienda debe registrarse en la oficina de empadronamiento en las dos semanas siguientes a la mudanza',
  },
  'health-insurance-for-enrolment': {
    title: 'Haz que tu seguro médico se comunique a la universidad',
    body: 'Tu caja de seguro médico público envía el justificante por vía electrónica, con el número de la universidad H0000341; no se acepta en papel. ¿Tienes seguro privado o del extranjero? Una caja pública comprueba tu situación y la envía.',
    source:
      'Universität Regensburg, justificante del seguro médico: se necesita en formato electrónico, enviado por la caja pública con el número de la universidad H0000341; los certificados en papel no bastan desde el 1 ene. 2022; las aseguradoras privadas y extranjeras no pueden enviarlo, así que una caja pública comprueba la situación y lo envía',
  },
  'residence-permit': {
    title: 'Solicita tu permiso de residencia',
    body: '¿Vienes de fuera de la UE? Solicítalo en la oficina de extranjería de la ciudad antes de que caduque tu visado de entrada, o en tus primeros 90 días si llegaste sin visado.',
    source:
      'Universität Regensburg, International Office, permiso de residencia para estudiantes de fuera de la UE: se solicita en la oficina de extranjería competente antes de que caduque un posible visado; sin visado, en los primeros 90 días de la estancia',
  },
  'open-a-bank-account': {
    title: 'Abre una cuenta bancaria',
    body: 'Quien reside legalmente en la UE tiene derecho a una cuenta básica, incluso sin domicilio fijo.',
    source:
      'Zahlungskontengesetz, § 31, apdo. 1: todo consumidor con residencia legal en la Unión Europea, incluidas las personas sin domicilio fijo, tiene derecho a una cuenta de pago básica',
  },
  'register-for-the-rundfunkbeitrag': {
    title: 'Ocúpate de la tasa de radiodifusión (Rundfunkbeitrag)',
    body: 'Solo un adulto por piso se registra y paga; en un piso compartido, acordad quién lo hace.',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, información para estudiantes: 18,36 € al mes por piso; solo un adulto por piso se registra y paga',
  },
  'apply-for-bafoeg': {
    title: 'Solicita el BAföG',
    body: 'Pídelo por BAföG Digital lo antes que puedas: se paga desde el mes en que llega tu solicitud, nunca antes de empezar tus estudios.',
    source: `${STWNO}, BAföG: solicitud por BAföG Digital, lo antes posible; la ayuda se concede desde el mes en que llega la solicitud, como pronto desde el inicio de los estudios; la oficina de Regensburg atiende a la Universität Regensburg y a la OTH Regensburg`,
  },
  'claim-the-study-start-grant': {
    title: 'Pide la ayuda para empezar a estudiar',
    body: '¿Empiezas tu primera carrera, tienes menos de 25 años y recibes prestaciones sociales? Una ayuda única de 1000 € que nunca devuelves.',
    source: `${STWNO}, BAföG Studienstarthilfe: una ayuda única de 1000 €, que no se devuelve, para quienes empiezan a estudiar a tiempo completo por primera vez, son menores de 25 y reciben prestaciones sociales; se pide por BAföG Digital antes de que acabe el mes siguiente al inicio`,
  },
  'keep-kindergeld': {
    title: 'Mantén la prestación por hijo (Kindergeld)',
    body: 'Tus padres pueden cobrar el Kindergeld por ti durante tu primera carrera, hasta el día antes de que cumplas 25 años.',
    source:
      'Bundesagentur für Arbeit, Familienkasse, Kindergeld desde los 18 años: se paga entre los 18 y los 25 años cumplidos por un hijo en su primera formación o carrera; los 25 años se cumplen al acabar el día anterior al 25.º cumpleaños',
  },
  'stay-on-family-insurance': {
    title: 'Sigue en el seguro familiar',
    body: 'Gratis hasta que cumplas 25 años mientras ganes poco. Compruébalo antes de aceptar un trabajo mayor.',
    source: `${STWNO}, seguro médico y de dependencia: seguro familiar gratuito hasta cumplir 25 años; en 2026 hasta 565 € al mes de un empleo normal o 603 € de un minijob`,
  },
  'check-wohngeld': {
    title: 'Comprueba la ayuda al alquiler (Wohngeld)',
    body: '¿Sin derecho al BAföG en principio? El Wohngeld puede ayudarte con el alquiler si Regensburg es tu residencia principal.',
    source: `${STWNO}, Wohngeld: solo es posible sin derecho al BAföG en principio, y la ciudad de estudios debe ser la residencia principal`,
  },
  'rundfunkbeitrag-exemption': {
    title: 'Solicita la exención de la tasa',
    body: '¿Recibes BAföG y no vives con tus padres? Puedes quedar exento si lo solicitas.',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, información para estudiantes: quienes reciben BAföG y no viven con sus padres pueden quedar exentos si lo solicitan',
  },
};
