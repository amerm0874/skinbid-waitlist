import Link from "next/link";

export function ProductFooter() {
  return (
    <footer className="product-footer">
      <nav className="site-wrap" aria-label="Legal">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </footer>
  );
}
