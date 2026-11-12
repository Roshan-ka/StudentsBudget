import type { Messages } from '../en';

// El marco de la app en español: la navegación de abajo y los títulos de las páginas (plan 2, chunk 3).
export const shell: Messages['shell'] = {
  // Como mucho 9 caracteres: cinco caben uno al lado del otro a 375 px. "Movimientos" no cabe, así que "Registros".
  nav: {
    home: 'Inicio',
    entries: 'Registros',
    charts: 'Gráficos',
    tips: 'Consejos',
    settings: 'Ajustes',
  },
  navLabel: 'Menú principal',
  backToSettings: 'Volver a Ajustes',
  backToSetup: 'Volver a la configuración',
  headings: {
    home: 'Inicio',
    plan: 'Plan',
    profile: 'Perfil',
    appearance: 'Apariencia',
    accounts: 'Cuentas y transferencias',
    backup: 'Copia de seguridad y datos',
    importExport: 'Importar y exportar',
    moderation: 'Moderación',
    reminder: 'Recordatorio semanal',
    badges: 'Insignias',
    charts: 'Gráficos',
    checkIn: 'Revisión semanal',
    entries: 'Registros',
    newEntry: 'Nuevo registro',
    reveal: 'Mes a mes',
    account: 'Tu cuenta',
    start: 'Te damos la bienvenida',
    ask: 'Preguntas',
    settings: 'Ajustes',
    tips: 'Consejos y descuentos en Regensburg',
  },
};
