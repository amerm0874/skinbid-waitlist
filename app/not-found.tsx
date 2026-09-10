import Link from "next/link";

export default function NotFound() {
  return (
    <div className="site-wrap py-20">
      <h1 className="display text-[40px]">Not found</h1>
      <p className="mt-3 text-muted">That page is not on SkinBid.</p>
      <Link href="/" className="btn btn-solid mt-8 inline-flex">
        Home
      </Link>
    </div>
  );
}
