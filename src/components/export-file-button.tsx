'use client';

import { useState } from 'react';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';

// Giving the person a file the app made: the backup, and the entries for a spreadsheet (CSV export). Where the browser
// can share files (an iPhone), the share sheet opens; otherwise the file downloads. iOS opens the share sheet only
// from inside the tap itself, so nothing here waits before it shares or downloads: `build` must be synchronous, from
// data the caller read before the tap.

/** Starts a download of the file. */
export function downloadFile(file: File) {
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

/** The button's words, and what it says after. */
export type ExportFileText = {
  button: string;
  /** The share sheet's title for the file. */
  shareTitle: string;
  shared: string;
  downloaded: (fileName: string) => string;
  shareFailed: string;
  downloadInstead: string;
  failed: string;
};

type Notice =
  | { kind: 'shared' }
  | { kind: 'downloaded'; name: string }
  // The share sheet did not open: a fresh tap on "Download instead" is a real user gesture.
  | { kind: 'share-failed' };

/** The export button, with its status line and the "Download instead" way when the share sheet fails. */
export function ExportFileButton({ build, ready, text }: { build: () => File; ready: boolean; text: ExportFileText }) {
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startDownload(file: File) {
    downloadFile(file);
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

  function made(): File | null {
    try {
      return build();
    } catch (exportError) {
      console.error('StudentsBudget: could not export the file', exportError);
      setError(text.failed);
      return null;
    }
  }

  function onExport() {
    if (!ready) return;
    setNotice(null);
    setError(null);
    const file = made();
    if (file === null) return;

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
    if (!ready) return;
    setError(null);
    const file = made();
    if (file !== null) startDownload(file);
  }

  return (
    <>
      <Button variant="outline" className="self-start px-4" onClick={onExport} disabled={!ready || sharing}>
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
    </>
  );
}
