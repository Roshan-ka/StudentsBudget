'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteEverything, exportAll, type BackupData } from '@/db/bulk';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { backupFileName, serializeBackup } from './backup';
import { RestoreFromBackup } from './restore-from-backup';
import { focusFirstControl, useFocusAfter } from '@/lib/focus';

function buildFile(data: BackupData): File {
  const now = new Date();
  return new File([serializeBackup(data, now)], backupFileName(now), { type: 'application/json' });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  // Not right away: some browsers start reading the file after the click has returned.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

type Notice =
  | { kind: 'shared' }
  | { kind: 'downloaded'; name: string }
  // The share sheet did not open: a fresh tap on "Download instead" is a real user gesture.
  | { kind: 'share-failed' };

function ExportBackup() {
  const { t } = useT();
  const text = t.backup.export;
  // Read before the tap, not in it. iOS opens the share sheet only from inside the tap itself, and waiting
  // on the database first would let that moment pass. The live query also keeps the snapshot current.
  const snapshot = useLiveQuery(() => exportAll(), []);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startDownload(file: File) {
    download(file);
    setNotice({ kind: 'downloaded', name: file.name });
  }

  function onShareFailed(shareError: unknown) {
    // Closing the share sheet is a choice, not a failure.
    if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
    // NotAllowedError is the expected way a browser says no, and the message below covers it; log anything else.
    if (!(shareError instanceof DOMException && shareError.name === 'NotAllowedError')) {
      console.error('StudentsBudget: the share sheet did not open', shareError);
    }
    setNotice({ kind: 'share-failed' });
  }

  // Nothing here waits before it shares or downloads: the browser only allows both from inside the tap.
  function onExport() {
    if (!snapshot) return;
    setNotice(null);
    setError(null);
    let file: File;
    try {
      file = buildFile(snapshot);
    } catch (exportError) {
      console.error('StudentsBudget: could not export the backup', exportError);
      return setError(text.failed);
    }

    if (!navigator.canShare?.({ files: [file] })) return startDownload(file);

    setSharing(true);
    try {
      navigator
        .share({ files: [file], title: text.shareTitle })
        .then(() => setNotice({ kind: 'shared' }), onShareFailed)
        .finally(() => setSharing(false));
    } catch (shareError) {
      setSharing(false);
      onShareFailed(shareError);
    }
  }

  function onDownloadInstead() {
    if (!snapshot) return;
    setError(null);
    try {
      startDownload(buildFile(snapshot));
    } catch (exportError) {
      console.error('StudentsBudget: could not export the backup', exportError);
      setError(text.failed);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-medium">{text.heading}</h4>
      <p className="text-sm text-muted-foreground">{text.hint}</p>
      <Button
        variant="outline"
        className="self-start px-4"
        onClick={onExport}
        disabled={snapshot === undefined || sharing}
      >
        {text.button}
      </Button>
      {notice?.kind === 'shared' && <StatusLine className="text-sm">{text.shared}</StatusLine>}
      {notice?.kind === 'downloaded' && <StatusLine className="text-sm">{text.downloaded(notice.name)}</StatusLine>}
      {notice?.kind === 'share-failed' && (
        <div role="alert" className="flex flex-col gap-2 text-sm">
          <p>{text.shareFailed}</p>
          <Button variant="outline" className="self-start px-4" onClick={onDownloadInstead}>
            {text.downloadInstead}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

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
    <div className="flex flex-col gap-2">
      <h4 className="font-medium">{text.heading}</h4>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {open ? (
        <form
          ref={focusFirstControl}
          onSubmit={(event) => void onDelete(event)}
          noValidate
          className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3"
        >
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
          variant="destructive"
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
    </div>
  );
}

/** Settings: save everything to a file, bring it back, or wipe the phone. Always shown, plan or no plan. */
export function BackupPanel() {
  const { t } = useT();
  return (
    <section aria-labelledby="backup-heading" className={cn(cardVariants(), 'gap-4')}>
      <h3 id="backup-heading" className="text-xl leading-tight font-extrabold">
        {t.backup.heading}
      </h3>
      <p className="text-muted-foreground">{t.backup.intro}</p>
      <ExportBackup />
      <div className="flex flex-col gap-2">
        <h4 className="font-medium">{t.backup.restore.heading}</h4>
        <RestoreFromBackup />
      </div>
      <DeleteEverything />
    </section>
  );
}
