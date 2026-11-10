import { monthOf, todayIso, type IsoDate } from '@/lib/dates';
import { planMonthOf } from '@/lib/plan-history';
import { db } from './db';
import type { Plan } from './types';

/**
 * Keeps the plan as just saved as this month's row of plan history (docs/superpowers/plans/2026-11-10-plan-history.md),
 * so the month ends with the plan it had. Called after each of the person's own plan writes (setup's Save, Edit plan,
 * the fixed costs and income, the suggested budget), inside that write's transaction, which must hold
 * `db.planMonths`. Never by the recurring poster, which only moves watermarks, or by a pull or a restore, which bring
 * their own rows.
 */
export async function recordPlanMonth(plan: Plan, today: IsoDate = todayIso()): Promise<void> {
  await db.planMonths.put(planMonthOf(plan, monthOf(today)));
}
