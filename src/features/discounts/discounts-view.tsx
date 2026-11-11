'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import type { Discount } from '@/data/discounts';
import { db } from '@/db/db';
import type { DiscountVote } from '@/db/types';
import { useAuth } from '@/features/account/use-auth';
import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { semesterOn } from '@/features/profile/profile';
import { RangeSource } from '@/features/setup/steps/range-source';
import { categoryNameIn } from '@/i18n/category-name';
import { discountIn } from '@/i18n/city';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { formatDate, todayIso } from '@/lib/dates';
import { useFocusAfter } from '@/lib/focus';
import { getSupabase } from '@/lib/supabase/client';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import { readCommunity, type CommunityConfirmations } from './community';
import { DiscountForm } from './discount-form';
import { bundledDiscounts, discountCategoryIds, sortByFreshness, voteMove, type DiscountSource } from './discounts';
import { StudentDiscountActions, StudentDiscountSource } from './student-discount-actions';
import { readStudentDiscounts, type StudentDiscount } from './student-discounts';

const VOTES: readonly DiscountVote['vote'][] = ['works', 'outdated'];

/** What a screen reader hears after a vote, and which way the discount went when the list re-sorted. */
function announcement(d: Discount, vote: DiscountVote['vote'], move: 'up' | 'down' | null, t: Messages): string {
  const text = t.tips.heard;
  const saved = vote === 'works' ? text.works(d.place) : text.outdated(d.place);
  return move === null ? saved : text.moves(saved, move);
}

/**
 * The Regensburg student discounts, freshest first. "Still works" and "Doesn't work anymore" are saved on this
 * phone, dated today; tapping again replaces the answer. The list comes from `source` (bundled now, a server
 * later; keep the same one for the view's lifetime), the votes from the database, and the chosen category is kept
 * only while the page stays mounted. Signed in, other students' totals for this semester join in (P2.6,
 * `discount_confirmations`): they confirm a discount too, and show as counts; and so do the discounts students added
 * from the app (community, chunk 5), read once per visit, marked as added by a student, with Delete or Report. Signed
 * in, "Add a discount" opens the form for one (chunk 6).
 */
export function DiscountsView({ source = bundledDiscounts }: { source?: DiscountSource }) {
  const { t, lang } = useT();
  const text = t.tips;
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const votes = useLiveQuery(() => db.discountVotes.toArray(), []);
  // Whose semester "this semester" is: the profile's university, else the University of Regensburg's.
  const university = useLiveQuery(async () => ((await db.profile.get('current'))?.university === 'oth' ? 'oth' : 'ur'), []);
  const auth = useAuth();
  const userId = auth.status === 'signed-in' ? auth.userId : null;
  const [community, setCommunity] = useState<CommunityConfirmations | null>(null);
  /** The students' discounts, with whose they are: another account's never show. */
  const [students, setStudents] = useState<{ userId: string; items: StudentDiscount[] } | null>(null);
  /** Counts up to load the students' discounts again (after adding, deleting or reporting one). */
  const [attempt, setAttempt] = useState(0);
  /** Whether the form for a new discount is open. */
  const [adding, setAdding] = useState(false);
  const focus = useFocusAfter();
  const [discounts, setDiscounts] = useState<Discount[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  /** The answer just given, shown under its discount. */
  const [notice, setNotice] = useState<{ discountId: string; text: string } | null>(null);
  const [heard, setHeard] = useState('');
  // Signed in, the first vote on this phone waits for the note on the shared totals (`PrivacyNote`).
  const [pendingVote, setPendingVote] = useState<{ discountId: string; vote: DiscountVote['vote'] } | null>(null);
  const items = useRef(new Map<string, HTMLLIElement>());
  /** A discount just voted on: it moves in the list, and focus goes with it. */
  const follow = useRef<string | null>(null);

  useEffect(() => {
    let current = true;
    source.list().then(
      (list) => {
        if (!current) return;
        setDiscounts(list);
        setFailed(false);
      },
      (error: unknown) => {
        console.error('StudentsBudget: could not load the discounts', error);
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [source]);

  // Other students' totals, read once per visit while signed in. Without them (signed out, offline, refused) the list
  // goes by this phone's votes alone.
  useEffect(() => {
    if (auth.status !== 'signed-in' || today === null || university === undefined) return;
    const supabase = getSupabase();
    if (supabase === null) return;
    let current = true;
    void readCommunity(supabase, semesterOn(university, today).start).then((totals) => {
      if (current) setCommunity(totals);
    });
    return () => {
      current = false;
    };
  }, [auth.status, today, university]);

  // The discounts students added, read once per visit while signed in; without them the list is the app's own.
  useEffect(() => {
    if (userId === null) return;
    let current = true;
    void readStudentDiscounts(getSupabase(), userId).then((items) => {
      if (current && items !== null) setStudents({ userId, items });
    });
    return () => {
      current = false;
    };
  }, [userId, attempt]);

  // A page the app leaves stays mounted but hidden: what was just said about a vote is old news when it comes back.
  useEffect(
    () => () => {
      follow.current = null;
      setNotice(null);
      setHeard('');
    },
    [],
  );

  // Runs once the new vote has re-sorted the list: the voted discount keeps the focus, wherever it moved.
  useEffect(() => {
    const id = follow.current;
    if (id === null) return;
    follow.current = null;
    items.current.get(id)?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
  }, [votes]);

  if (failed && discounts === null) {
    return <p className="text-sm text-muted-foreground">{text.loadFailed}</p>;
  }
  if (today === null || discounts === null || votes === undefined) return null;

  // Signed out, the totals of an earlier sign-in no longer count.
  const totals = auth.status === 'signed-in' ? community : null;
  const added = students !== null && students.userId === userId ? students.items : [];
  const byStudent = new Map(added.map((item) => [item.discount.id, item]));
  const all = [...discounts, ...added.map((item) => item.discount)];
  const rows = sortByFreshness(all, votes, today, totals);
  const shown = categoryId === null ? rows : rows.filter((row) => row.discount.categoryId === categoryId);

  /** A vote, or first the note when signed in on a phone that hasn't accepted it. */
  function tap(d: Discount, vote: DiscountVote['vote']) {
    if (auth.status === 'signed-in' && !noteSeen('votes')) {
      setNotice(null);
      return setPendingVote({ discountId: d.id, vote });
    }
    choose(d, vote);
  }

  /** Closes the note and puts the focus back on the button that opened it. */
  function cancelVote(d: Discount, vote: DiscountVote['vote']) {
    setPendingVote(null);
    items.current.get(d.id)?.querySelector<HTMLButtonElement>(`button[data-vote="${vote}"]`)?.focus();
  }

  function choose(d: Discount, vote: DiscountVote['vote']) {
    setPendingVote(null);
    follow.current = d.id;
    // Today at the moment of the tap, not of the last render.
    const row: DiscountVote = { discountId: d.id, vote, on: todayIso() };
    // Judged on the list as it is on screen, before the vote re-sorts it.
    // `votes` is loaded by now (the list renders only then); the fallback is for the type checker.
    const move = voteMove(
      shown.map((r) => r.discount),
      votes ?? [],
      row,
      row.on,
      totals,
    );
    db.discountVotes.put(row).then(
      () => {
        setNotice({ discountId: d.id, text: text.saved });
        setHeard(announcement(d, vote, move, t));
      },
      (error: unknown) => {
        follow.current = null;
        console.error('StudentsBudget: could not save the discount vote', error);
        setNotice({ discountId: d.id, text: text.saveFailed });
        setHeard(text.heard.failed(d.place));
      },
    );
  }

  /** A student's discount was deleted or reported: it leaves the list now, and the list loads again. */
  function changed(id: string, said: string) {
    focus.mark('list');
    setStudents((now) => now && { ...now, items: now.items.filter((item) => item.discount.id !== id) });
    setHeard(said);
    setAttempt((n) => n + 1);
  }

  /** The form closed: focus goes back to the button that opened it. */
  function closeForm() {
    focus.mark('add');
    setAdding(false);
  }

  /** A discount was added: the list loads again, with it. */
  function onAdded() {
    closeForm();
    setHeard(text.studentDiscounts.form.added);
    setAttempt((n) => n + 1);
  }

  const chip = (id: string | null, label: string) => (
    <Button
      key={id ?? 'all'}
      type="button"
      variant="chip"
      aria-pressed={categoryId === id}
      onClick={() => setCategoryId(id)}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{text.discountsIntro}</p>
      {auth.status === 'signed-out' && <p className="text-sm text-muted-foreground">{text.othersSignIn}</p>}
      {userId !== null &&
        (adding ? (
          <DiscountForm userId={userId} onAdded={onAdded} onCancel={closeForm} />
        ) : (
          <Button
            ref={focus.refFor('add')}
            type="button"
            className="self-start px-4"
            onClick={() => {
              setHeard('');
              setAdding(true);
            }}
          >
            {text.studentDiscounts.form.open}
          </Button>
        ))}
      <div role="group" aria-label={text.discountsFor} className="flex flex-wrap gap-2">
        {chip(null, text.all)}
        {discountCategoryIds(all).map((id) => chip(id, categoryNameIn(t, id)))}
      </div>
      {/* Always there and filled later, so screen readers announce each change. */}
      <p role="status" className="sr-only">
        {heard}
      </p>
      <ul ref={focus.refFor('list')} tabIndex={-1} aria-label={text.discounts} className="flex flex-col gap-3">
        {shown.map(({ discount, vote, community: others, freshness: f }) => {
          const student = byStudent.get(discount.id);
          // The app's own words are translated; a student's stay as written, in the language they were written in.
          const own = student === undefined ? discountIn(discount, lang) : null;
          const d = own ?? discount;
          const placeId = `discount-${d.id}-place`;
          const Icon = CATEGORY_ICONS[d.categoryId] ?? OTHER_ICON;
          return (
            <li
              key={d.id}
              ref={(el) => {
                if (el) items.current.set(d.id, el);
                return () => {
                  items.current.delete(d.id);
                };
              }}
              className={cn(cardVariants(), 'gap-2')}
            >
              <div className="flex flex-wrap gap-2">
                {/* The category's tint and icon, as on a tip; its name is the text (4.5:1 on every tint). */}
                <span
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] border-outline px-2.5 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: categoryTint(d.categoryId) }}
                >
                  <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                  {categoryNameIn(t, d.categoryId)}
                </span>
                {/* Nobody checked it before it showed, so it never reads like the app's own sourced list. */}
                {student !== undefined && (
                  <span className="inline-flex w-fit items-center rounded-full border-[1.5px] border-outline px-2.5 py-0.5 text-xs font-semibold">
                    {text.studentDiscounts.tag}
                  </span>
                )}
              </div>
              {/* The discount's own words are city content: in the phone's language where translated (`discountIn`). */}
              <div lang={own === null ? student?.info.lang : own.textLang} className="flex flex-col gap-1">
                <h3 id={placeId} className="text-xl leading-snug font-extrabold break-words">
                  {d.place}
                </h3>
                <p className="text-sm font-semibold break-words">{d.offer}</p>
                {d.conditions !== '' && <p className="text-sm break-words text-muted-foreground">{d.conditions}</p>}
                {d.address !== '' && <p className="text-sm break-words text-muted-foreground">{d.address}</p>}
              </div>
              <div className="flex flex-col gap-0.5 text-sm">
                {f.outdated && vote ? (
                  <p className="font-medium">{text.markedOutdated(formatDate(vote.on))}</p>
                ) : (
                  <>
                    {f.mayBeOutdated && <p className="font-medium">{text.mayBeOutdated}</p>}
                    <p className="text-muted-foreground">{text.lastConfirmed(formatDate(f.lastConfirmed))}</p>
                  </>
                )}
                {others !== undefined && others.works > 0 && (
                  <p className="text-muted-foreground">{text.confirmations(others.works)}</p>
                )}
                {others !== undefined && others.outdated > 0 && (
                  <p className="text-muted-foreground">{text.notWorking(others.outdated)}</p>
                )}
              </div>
              {own !== null && <RangeSource range={own} about={d.place} />}
              {student !== undefined && <StudentDiscountSource item={student} t={t} />}
              <div role="group" aria-label={text.voteGroup(d.place)} className="mt-1 flex flex-wrap gap-2">
                {VOTES.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant="chip"
                    aria-pressed={vote?.vote === option}
                    aria-describedby={placeId}
                    data-vote={option}
                    onClick={() => tap(d, option)}
                  >
                    {text.votes[option]}
                  </Button>
                ))}
              </div>
              {pendingVote?.discountId === d.id && (
                <PrivacyNote
                  id="votes"
                  label={t.common.privacy.label}
                  text={t.common.privacy.votes}
                  continueLabel={t.common.privacy.continue}
                  cancelLabel={t.common.privacy.cancel}
                  onContinue={() => choose(d, pendingVote.vote)}
                  onCancel={() => cancelVote(d, pendingVote.vote)}
                />
              )}
              {notice?.discountId === d.id && <p className="text-xs text-muted-foreground">{notice.text}</p>}
              {student !== undefined && (
                <StudentDiscountActions
                  item={student}
                  t={t}
                  lang={lang}
                  onChanged={(said) => changed(student.discount.id, said)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
