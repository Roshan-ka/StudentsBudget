/** A full date as `formatDate` writes it: "15-11-2026". The group keeps it in `split`'s result. */
const DATE = /(\d{2}-\d{2}-\d{4})/;

/** Text whose full dates never break across lines (a hyphen is a break point). The text itself is unchanged. */
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
