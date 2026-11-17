'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { DownloadIcon, Trash2Icon, UploadIcon, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { ExportFileButton, type ExportFileType } from '@/components/export-file-button';
import { noticeClass } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteEverything, exportAll, type BackupData } from '@/db/bulk';
import { categoryTint } from '@/features/charts/colors';
import { RowTile } from '@/features/home/row-card';
import { StepMore } from '@/features/setup/steps/step-more';
import { useT } from '@/i18n/use-t';
import { backupFileName, serializeBackup } from './backup';
import { RestoreFromBackup } from './restore-from-backup';
import { focusFirstControl, useFocusAfter } from '@/lib/focus';

const BACKUP_FILE: ExportFileType = { extension: '.json', type: 'application/json' };

function buildFile(data: BackupData): File {
  const now = new Date();
  return new File([serializeBackup(data, now)], backupFileName(now), { type: BACKUP_FILE.type });
}

/**
 * One of the page's three cards (Roshan's mockups, 16-11-2026): its tile in a category's tint, for the colour, a bold
 * title and one short line, then what it does. Each is a section named by its title.
 */
function BackupCard({
  icon,
  tint,
  title,
  line,
  children,
}: {
  icon: LucideIcon;
  tint: string;
  title: string;
  line: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cardVariants()}>
      <div className="flex items-center gap-3">
        <RowTile icon={icon} tint={tint} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={headingId} className="text-lg leading-tight font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">{line}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Export: the bank's blue, as setup's accounts have it. */
function ExportBackup() {
  const { t } = useT();
  const text = t.backup.export;
  // Read before the tap, not in it. iOS opens the share sheet only from inside the tap itself, and waiting
  // on the database first would let that moment pass. The live query also keeps the snapshot current.
  const snapshot = useLiveQuery(() => exportAll(), []);

  return (
    <BackupCard icon={DownloadIcon} tint={categoryTint('rent')} title={text.heading} line={text.hint}>
      <ExportFileButton
        build={() => {
          // Only called once ready, which means the snapshot is there.
          if (snapshot === undefined) throw new Error('The backup is not read yet');
          return buildFile(snapshot);
        }}
        fileType={BACKUP_FILE}
        ready={snapshot !== undefined}
        text={text}
        primary
      />
    </BackupCard>
  );
}

/** Restore: cash's green. The question and the restore show inside the card once a file is chosen. */
function RestoreBackup() {
  const { t } = useT();
  const text = t.backup.restore;
  return (
    <BackupCard icon={UploadIcon} tint={categoryTint('eating-out')} title={text.heading} line={text.intro}>
      <RestoreFromBackup />
    </BackupCard>
  );
}

/** Delete everything: going out's violet, and an outlined button, not a red one; the typed word still guards it. */
function DeleteEverything() {
  const inputId = useId();
  const { t } = useT();
  const text = t.backup.delete;
  // The word to type is the phone's language's, so it can be typed on that phone's keyboard.
  // In any case: the word is the safeguard, not its capitals.
  const confirmed = (typed: string) => typed.trim().toUpperCase() === text.word.toUpperCase();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The form opens on its word field; Cancel gives the focus back to the button that opened it.
  const focus = useFocusAfter();

  useEffect(() => {
    // The router keeps a page it has left mounted but hidden, with its state. A confirmation that is half
    // done must not still be armed when the person comes back.
    return () => {
      setOpen(false);
      setTyped('');
      setError(null);
    };
  }, []);

  function close() {
    focus.mark('open');
    setOpen(false);
    setTyped('');
    setError(null);
  }

  async function onDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed(typed)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEverything();
    } catch (deleteError) {
      console.error('StudentsBudget: could not delete the data', deleteError);
      setError(text.failed);
      setDeleting(false);
      return;
    }
    // A full page load: the screens behind this one were reading the database that no longer exists. Setup, not the
    // start page: whoever deletes everything has already chosen how to use the app.
    window.location.replace('/setup');
  }

  return (
    <BackupCard icon={Trash2Icon} tint={categoryTint('going-out')} title={text.heading} line={text.intro}>
      {open ? (
        <form
          ref={focusFirstControl}
          onSubmit={(event) => void onDelete(event)}
          noValidate
          className={noticeClass('muted', 'flex flex-col gap-3')}
        >
          {/* What the card's short line leaves out, read before the word is typed. */}
          <p className="text-sm">{text.linked}</p>
          <p className="text-sm">{text.warning}</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>{text.typeToConfirm(text.word)}</Label>
            <Input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              disabled={deleting}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="destructive"
              className="px-4"
              disabled={!confirmed(typed) || deleting}
            >
              {text.button}
            </Button>
            <Button type="button" variant="outline" className="px-4" onClick={close} disabled={deleting}>
              {text.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          ref={focus.refFor('open')}
          variant="outline"
          className="self-start px-4"
          onClick={() => setOpen(true)}
        >
          {text.button}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </BackupCard>
  );
}

/**
 * Under the page heading: one line, and the rest of why a backup matters folded under a question (Roshan's mockups,
 * 16-11-2026), so the three cards come first.
 */
export function BackupIntro() {
  const { t } = useT();
  return (
    <>
      <p className="text-muted-foreground">{t.backup.intro}</p>
      <StepMore summary={t.backup.more}>
        <p>{t.backup.moreText}</p>
      </StepMore>
    </>
  );
}

/** Settings: save everything to a file, bring it back, or wipe the phone, a card each. Always shown, plan or no plan. */
export function BackupPanel() {
  return (
    <div className="flex flex-col gap-3">
      <ExportBackup />
      <RestoreBackup />
      <DeleteEverything />
    </div>
  );
}
