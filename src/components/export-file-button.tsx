'use client';

import { useState, useSyncExternalStore } from 'react';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';

// Giving the person a file the app made: the backup, and the entries for a spreadsheet (CSV export). Where the browser
// can share the file, Export opens the share sheet, and a Download button stands beside it: a computer's share sheet
// (Chrome and Edge on Windows, Safari on a Mac) sends the file to apps and has no Save (Roshan, 12-11-2026). Elsewhere
// Export downloads, and there is no second button. iOS opens the share sheet only from inside the tap itself, so
// nothing here waits before it shares or downloads: `build` must be synchronous, from data the caller read before the
// tap.

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
  download: string;
  failed: string;
};

/** The kind of file `build` makes, so the page can ask the browser before the tap whether it would share one. */
export type ExportFileType = { extension: string; type: string };

type Notice =
  | { kind: 'shared' }
  | { kind: 'downloaded'; name: string }
  // The share sheet did not open: a fresh tap on Download is a real user gesture.
  | { kind: 'share-failed' };

const subscribeNever = () => () => {};

/** Whether this browser would open a share sheet for a file of this kind, asked with an empty one. */
function sharesFilesLike({ extension, type }: ExportFileType): boolean {
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([''], `studentsbudget${extension}`, { type })] });
  } catch {
    return false;
  }
}

/** The export button, with Download beside it where Export shares, and its status line. */
export function ExportFileButton({
  build,
  fileType,
  ready,
  text,
}: {
  build: () => File;
  fileType: ExportFileType;
  ready: boolean;
  text: ExportFileText;
}) {
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  // False while the page prerenders, then the browser's answer.
  const offersDownload = useSyncExternalStore(
    subscribeNever,
    () => sharesFilesLike(fileType),
    () => false,
  );

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

  function onDownload() {
    if (!ready) return;
    setError(null);
    const file = made();
    if (file !== null) startDownload(file);
  }

  const downloadButton = (
    <Button variant="outline" className="px-4" onClick={onDownload} disabled={!ready}>
      {text.download}
    </Button>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="px-4" onClick={onExport} disabled={!ready || sharing}>
          {text.button}
        </Button>
        {offersDownload && downloadButton}
      </div>
      {notice?.kind === 'shared' && <StatusLine className="text-sm">{text.shared}</StatusLine>}
      {notice?.kind === 'downloaded' && <StatusLine className="text-sm">{text.downloaded(notice.name)}</StatusLine>}
      {notice?.kind === 'share-failed' && (
        <div role="alert" className="flex flex-col gap-2 text-sm">
          <p>{text.shareFailed}</p>
          {/* Download already stands beside Export where the browser shares; this is for a share that the check
              before the tap didn't foresee. */}
          {!offersDownload && <div>{downloadButton}</div>}
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
