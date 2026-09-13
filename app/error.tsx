"use client";

export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="min-h-full bg-bg">
      <div className="site-wrap py-[var(--block-y)]">
        <h1 className="display text-[40px] md:text-[56px]">Something broke</h1>
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
    </div>
  );
}
