import type { CityRange } from '@/data/cities';
import { formatDate } from '@/lib/dates';

/** "studierendenwerke.de": enough to see where the link goes, short enough to fit a phone. */
function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

/** Where a city range comes from, collapsed under the range line: source text, check date and link. */
export function RangeSource({ range }: { range: Pick<CityRange, 'source' | 'url' | 'checked'> }) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer">Source</summary>
      <div className="mt-1 flex flex-col gap-1">
        <p className="break-words">{range.source}</p>
        <p>checked {formatDate(range.checked)}</p>
        <a href={range.url} target="_blank" rel="noopener noreferrer" className="w-fit break-all underline">
          {hostOf(range.url)}
        </a>
      </div>
    </details>
  );
}
