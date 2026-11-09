import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { ExportEntries } from '@/features/export/export-entries';
import { ImportStatement } from '@/features/import/import-statement';

/**
 * Settings → Import and export (docs/superpowers/plans/2026-11-09-csv-import-export.md): a bank statement in, the
 * entries out as a spreadsheet file.
 */
export default function ImportExportPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      <PageHeading id="importExport" />
      <ImportStatement />
      <ExportEntries />
    </div>
  );
}
