import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { ExportEntries } from '@/features/export/export-entries';

/**
 * Settings → Import and export (docs/superpowers/plans/2026-11-09-csv-import-export.md): the entries as a spreadsheet
 * file; the bank statement import joins it.
 */
export default function ImportExportPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      <PageHeading id="importExport" />
      <ExportEntries />
    </div>
  );
}
