import { db } from '@/db/db';
import type { Plan, PlanLine } from '@/db/types';
import { laterOf } from './schedule';

/**
 * Each schedule `next` shares (by id) with `stored` keeps the later of the two watermarks. A change made on a copy
 * of the plan read earlier carries the watermark of that moment; the poster may have moved it on since, and moving
 * it back would post those periods again. A change may still move it forward, as a resume does.
 */
function keepWatermarks(stored: Plan, next: Plan): Plan {
  const watermarks = new Map(
    [...stored.incomes, ...stored.fixed].flatMap((l) =>
      l.schedule ? [[l.schedule.id, l.schedule.postedThrough] as const] : [],
    ),
  );
  const keep = (line: PlanLine): PlanLine => {
    const s = line.schedule;
    const was = s && watermarks.get(s.id);
    if (!s || was === undefined || was <= s.postedThrough) return line;
    return { ...line, schedule: { ...s, postedThrough: laterOf(was, s.postedThrough) } };
  };
  return { ...next, incomes: next.incomes.map(keep), fixed: next.fixed.map(keep) };
}

/**
 * Changes the plan: reads it and writes `mutate`'s result in one read-write transaction, so the change applies to the
 * plan as stored, and no schedule's watermark moves back. Rejects when there is no plan.
 */
export async function updatePlan(mutate: (plan: Plan) => Plan): Promise<void> {
  await db.transaction('rw', db.plan, async () => {
    const stored = await db.plan.get('current');
    if (!stored) throw new Error('There is no plan to change.');
    // Copied before `mutate` sees it, so even a change that edits its argument cannot move a watermark back.
    const before = structuredClone(stored);
    await db.plan.put(keepWatermarks(before, mutate(stored)));
  });
}
