import Link from "next/link";

export function EmptyState({
  line,
  toEvents = true,
  href = "/events",
  linkLabel = "Events",
}: {
  line: string;
  toEvents?: boolean;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="bib empty-bib">
      <p>
        {line}
        {toEvents ? (
          <>
            {" "}
            <Link href={href}>{linkLabel}</Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
