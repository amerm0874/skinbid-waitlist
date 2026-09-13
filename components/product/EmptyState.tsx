import Link from "next/link";

export function EmptyState({
  line,
  toEvents = true,
}: {
  line: string;
  toEvents?: boolean;
}) {
  return (
    <div className="bib empty-bib">
      <p>
        {line}
        {toEvents ? (
          <>
            {" "}
            <Link href="/events">Events</Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
