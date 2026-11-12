'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useId } from 'react';
import { ExportFileButton, type ExportFileType } from '@/components/export-file-button';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';
import { entriesCsv, entriesFileName } from './entries-csv';

const CSV_FILE: ExportFileType = { extension: '.csv', type: 'text/csv' };

/**
 * Settings → Import and export → Export to a spreadsheet: every entry as a CSV file, shared or downloaded as the
 * backup is (`ExportFileButton`). The entries and accounts are read before the tap: iOS opens the share sheet only
 * from inside the tap itself.
 */
export function ExportEntries() {
  const id = useId();
  const { t } = useT();
  const text = t.importExport.export;
  const snapshot = useLiveQuery(async () => ({ entries: await db.entries.toArray(), accounts: await db.accounts.toArray() }), []);

  return (
    <section aria-labelledby={`${id}-heading`} className={cardVariants()}>
      <h3 id={`${id}-heading`} className="text-lg leading-tight font-bold">
        {text.heading}
      </h3>
      <p className="text-sm text-muted-foreground">{text.hint}</p>
      {snapshot !== undefined && snapshot.entries.length === 0 ? (
        <p className="text-sm">{text.empty}</p>
      ) : (
        <ExportFileButton
          build={() => {
            // Only called once ready, which means the snapshot is there.
            if (snapshot === undefined) throw new Error('The entries are not read yet');
            return new File([entriesCsv(snapshot.entries, snapshot.accounts, t)], entriesFileName(new Date()), { type: CSV_FILE.type });
          }}
          fileType={CSV_FILE}
          ready={snapshot !== undefined}
          text={text}
        />
      )}
    </section>
  );
}
