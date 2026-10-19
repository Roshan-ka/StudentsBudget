'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { replaceAll, type BackupData } from '@/db/bulk';
import { backupSummary, parseBackup } from './backup';

type Chosen = { fileName: string; data: BackupData; exportedAt: string };

/**
 * Pick a backup file, check it, ask once, then swap the data on this device for it. A file that does not
 * pass the check is refused with a message and nothing changes. Used in Settings and on /setup, so a new or
 * wiped phone can restore before it has a plan.
 */
export function RestoreFromBackup() {
  const inputId = useId();
  const questionRef = useRef<HTMLParagraphElement>(null);
  // Counts the files chosen. A read that finishes after a later file was chosen sees its number is old and says nothing.
  const latestPick = useRef(0);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    // The router keeps a page it has left mounted but hidden, with its state. A question left open there
    // would still be waiting when the person comes back, and a read still going would land on a hidden page.
    return () => {
      latestPick.current += 1;
      setChosen(null);
      setError(null);
      setReading(false);
    };
  }, []);

  useEffect(() => {
    if (chosen) questionRef.current?.focus();
  }, [chosen]);

  async function onChoose(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    // Empty again, so choosing the same file a second time still counts as a change.
    input.value = '';
    latestPick.current += 1;
    const pick = latestPick.current;
    // An earlier question or error belongs to an earlier file.
    setChosen(null);
    setError(null);
    setReading(true);

    let fileText: string;
    try {
      fileText = await file.text();
    } catch (readError) {
      if (pick !== latestPick.current) return;
      console.error('StudentsBudget: could not read the backup file', readError);
      setReading(false);
      return setError('Could not read that file.');
    }
    if (pick !== latestPick.current) return;
    setReading(false);
    const result = parseBackup(fileText);
    if (!result.ok) return setError(result.error);
    setChosen({ fileName: file.name, data: result.data, exportedAt: result.exportedAt });
  }

  async function onReplace() {
    if (!chosen) return;
    setRestoring(true);
    setError(null);
    try {
      await replaceAll(chosen.data);
    } catch (restoreError) {
      console.error('StudentsBudget: could not restore the backup', restoreError);
      setError('Could not restore the backup. The data on this device is unchanged.');
      setChosen(null);
      setRestoring(false);
      return;
    }
    // A full page load, not a router push: every live query and hidden page starts over from the restored data.
    window.location.replace('/');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {/* Not "Backup file": a file field is a button to Chromium, and the wizard's "Back" would match it by name. */}
        <Label htmlFor={inputId}>File to restore</Label>
        <Input
          id={inputId}
          type="file"
          accept=".json,application/json"
          className="h-10 py-1.5"
          onChange={(event) => void onChoose(event)}
          disabled={restoring}
        />
        {reading && (
          <p role="status" className="text-sm text-muted-foreground">
            Reading…
          </p>
        )}
      </div>
      {chosen && (
        <div role="group" aria-label="Confirm restore" className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <div className="flex flex-col gap-1">
            <p ref={questionRef} tabIndex={-1} className="text-sm outline-none">
              Replace all data with <strong className="break-all font-semibold">{chosen.fileName}</strong>?
            </p>
            <p className="text-sm text-muted-foreground">{backupSummary(chosen.data, chosen.exportedAt)}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" className="h-10 px-4" onClick={() => void onReplace()} disabled={restoring}>
              Replace all data
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4"
              onClick={() => setChosen(null)}
              disabled={restoring}
            >
              Cancel
            </Button>
          </div>
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
