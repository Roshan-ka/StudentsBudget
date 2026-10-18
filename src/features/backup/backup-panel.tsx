'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteEverything, exportAll } from '@/db/bulk';
import { backupFileName, serializeBackup } from './backup';
import { RestoreFromBackup } from './restore-from-backup';

const CONFIRM_WORD = 'DELETE';

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

/** Hands the file to the share sheet where there is one (iPhone), else downloads it. False when the person closed the sheet. */
async function saveFile(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'StudentsBudget backup' });
      return true;
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      // Sharing was refused for another reason: a download is still better than nothing.
    }
  }
  download(file);
  return true;
}

function ExportBackup() {
  const [busy, setBusy] = useState(false);
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setBusy(true);
    setSavedAs(null);
    setError(null);
    try {
      const now = new Date();
      const file = new File([serializeBackup(await exportAll(), now)], backupFileName(now), {
        type: 'application/json',
      });
      if (await saveFile(file)) setSavedAs(file.name);
    } catch (exportError) {
      console.error('StudentsBudget: could not export the backup', exportError);
      setError('Could not export your data.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-medium">Export a backup</h4>
      <p className="text-sm text-muted-foreground">
        Saves everything as one file. On an iPhone, choose Save to Files in the share sheet.
      </p>
      <Button variant="outline" className="h-10 self-start px-4" onClick={() => void onExport()} disabled={busy}>
        Export backup
      </Button>
      {savedAs && (
        <p role="status" className="text-sm">
          Exported {savedAs}.
        </p>
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
        Removes your plan, accounts, entries and exchange rates from this phone.
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
