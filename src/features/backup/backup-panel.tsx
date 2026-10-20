'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteEverything, exportAll, type BackupData } from '@/db/bulk';
import { backupFileName, serializeBackup } from './backup';
import { RestoreFromBackup } from './restore-from-backup';

const CONFIRM_WORD = 'DELETE';

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
      return setError('Could not export your data.');
    }

    if (!navigator.canShare?.({ files: [file] })) return startDownload(file);

    setSharing(true);
    try {
      navigator
        .share({ files: [file], title: 'StudentsBudget backup' })
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
      setError('Could not export your data.');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-medium">Export a backup</h4>
      <p className="text-sm text-muted-foreground">
        Saves everything as one file. On an iPhone, choose Save to Files in the share sheet.
      </p>
      <Button
        variant="outline"
        className="h-10 self-start px-4"
        onClick={onExport}
        disabled={snapshot === undefined || sharing}
      >
        Export backup
      </Button>
      {notice?.kind === 'shared' && (
        <p role="status" className="text-sm">
          Backup shared.
        </p>
      )}
      {notice?.kind === 'downloaded' && (
        <p role="status" className="text-sm">
          Download started: {notice.name}
        </p>
      )}
      {notice?.kind === 'share-failed' && (
        <div role="alert" className="flex flex-col gap-2 text-sm">
          <p>The share sheet didn&apos;t open. You can download the file instead.</p>
          <Button variant="outline" className="h-10 self-start px-4" onClick={onDownloadInstead}>
            Download instead
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
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setOpen(false);
    setTyped('');
    setError(null);
  }

  async function onDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (typed.trim() !== CONFIRM_WORD) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEverything();
    } catch (deleteError) {
      console.error('StudentsBudget: could not delete the data', deleteError);
      setError('Could not delete your data. Try again.');
      setDeleting(false);
      return;
    }
    // A full page load: the screens behind this one were reading the database that no longer exists.
    window.location.replace('/setup');
  }

  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-medium">Delete everything</h4>
      <p className="text-sm text-muted-foreground">
        Removes your plan, accounts, entries, badges and saved weeks, discount confirmations, profile and exchange
        rates from this phone.
      </p>
      {open ? (
        <form
          onSubmit={(event) => void onDelete(event)}
          noValidate
          className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3"
        >
          <p className="text-sm">
            This can&apos;t be undone. A backup file is the only copy you can get back, so export one first if you
            might want your data again.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>Type {CONFIRM_WORD} to confirm</Label>
            <Input
              id={inputId}
              className="h-10"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              disabled={deleting}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              className="h-10 px-4"
              disabled={typed.trim() !== CONFIRM_WORD || deleting}
            >
              Delete everything
            </Button>
            <Button type="button" variant="outline" className="h-10 px-4" onClick={close} disabled={deleting}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="destructive" className="h-10 self-start px-4" onClick={() => setOpen(true)}>
          Delete everything
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
  return (
    <section aria-labelledby="backup-heading" className="flex flex-col gap-4">
      <h3 id="backup-heading" className="text-lg font-semibold">
        Backup
      </h3>
      <p className="text-muted-foreground">
        Everything you enter stays on this phone, and nowhere else. A backup file is your only second copy, so export
        one now and then and keep it somewhere safe.
      </p>
      <ExportBackup />
      <div className="flex flex-col gap-2">
        <h4 className="font-medium">Restore from a backup</h4>
        <RestoreFromBackup />
      </div>
      <DeleteEverything />
    </section>
  );
}
