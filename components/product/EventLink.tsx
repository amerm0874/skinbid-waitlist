import Link from "next/link";

// Event pages load a GLB. Lists and nav must not prefetch them.
export function EventLink({
  href,
  className,
  children,
  title,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  if (href.startsWith("/e/")) {
    return (
      <a href={href} className={className} title={title}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={false} className={className} title={title}>
      {children}
    </Link>
  );
}
