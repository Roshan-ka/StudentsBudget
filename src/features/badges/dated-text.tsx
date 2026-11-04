import { fullDatePattern } from '@/i18n/regions';

/** A full date as `formatDate` writes it in the region: "15.11.2026". The group keeps it in `split`'s result. */
const DATE = new RegExp(`(${fullDatePattern()})`);

/** Text whose full dates never break across lines (a separator can be a break point). The text itself is unchanged. */
export function DatedText({ text }: { text: string }) {
  return (
    <>
      {text.split(DATE).map((part, i) =>
        // `split` with a group puts each date at an odd index, between the text around it.
        i % 2 === 1 ? (
          <span key={i} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
