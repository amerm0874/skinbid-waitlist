"use client";

import "./globals.css";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-full bg-bg font-sans text-ink antialiased">
        <title>Something broke — SkinBid</title>
        <div className="site-wrap py-[var(--block-y)]">
          <h1 className="display text-[40px]">Something broke</h1>
          <p className="page-lead">Try again, or go home.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn btn-solid" onClick={() => retry()}>
              Try again
            </button>
            <a href="/" className="btn btn-ghost">
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
