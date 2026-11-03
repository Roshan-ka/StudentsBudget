import { en, type Messages } from '../en';
import { categories } from './categories';
import { common } from './common';
import { language } from './language';
import { shell } from './shell';

/**
 * Spanish, being drafted (language switch, plan 2: docs/superpowers/plans/2026-11-03-language-switch-2.md, chunks
 * 3–9): each area as it is written, English for the rest. Not offered yet; chunk 9 offers it once every area is
 * Spanish and a native speaker has read it, and drops the English underneath. A test checks that every written area
 * differs from English, apart from a short allow-list (messages.test.ts). Counts go through `byCount` (`plural()`).
 *
 * Glossary, so the areas say the same thing the same way:
 * - tú, throughout; calm: "12 € de más", never a warning
 * - envelope: sobre; everyday budget: presupuesto del día a día; plan: plan; set aside: apartar (ahorro)
 * - one-off cost: gasto puntual; fixed costs: gastos fijos; income: ingresos; expense: gasto
 * - entry: registro; transfer: transferencia; account: cuenta; opening balance: saldo inicial; cash: efectivo
 * - quick add: Añadir rápido; Add it automatically: Añadir automáticamente; recurring: recurrente
 * - guess and estimate (a number no page states): estimación; source: fuente; checked: comprobado el
 * - check-in: revisión semanal; badge: insignia; semester fee: cuota semestral; exchange rate: tipo de cambio
 * - Settings: Ajustes (in a sentence: en Ajustes); Edit plan: Editar plan; phone: móvil
 * - the sign-in account: cuenta, "tu cuenta" (as in English, the same word as a money account); email: correo
 * - sign in / out: iniciar / cerrar sesión; two-step sign-in: verificación en dos pasos; passkey: llave de acceso;
 *   authenticator app: app de autenticación
 * - sync: sincronizar (the heading: Sincronización; the button: Sincronizar ahora); link: vincular
 * - Regensburg stays Regensburg, as on every sign there.
 */
export const es: Messages = { ...en, shell, language, common, categories };
