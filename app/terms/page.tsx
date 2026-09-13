import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { ProductShell } from "@/components/product/ProductShell";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Auction rules for SkinBid: $100 steps, hold until proof, 80/20 split.",
};

export default async function TermsPage() {
  const { user, profile } = await getSessionUser();

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <article className="page-stack legal">
        <div>
          <h1 className="display page-title">Terms</h1>
          <p className="page-lead">Last updated 12 September 2026.</p>
        </div>

        <p>
          SkinBid is an auction for a one-day temp mark on an athlete. Use the
          site and these rules apply.
        </p>

        <section>
          <h2>Auction</h2>
          <p>
            Auction only. Floor is $100. Each new bid is $100 more. There is no
            buy-now.
          </p>
        </section>

        <section>
          <h2>Money</h2>
          <p>
            SkinBid holds the brand’s payment until proof is approved. The
            athlete gets 80%. SkinBid keeps 20%.
          </p>
        </section>

        <section>
          <h2>Cancel and close</h2>
          <p>
            Cancel is blocked after a held or won bid. After close, the winner
            cannot walk.
          </p>
        </section>

        <section>
          <h2>Age</h2>
          <p>You must be 18 or older.</p>
        </section>

        <section>
          <h2>The mark</h2>
          <p>
            The athlete prints and wears the mark. Two brands in the same
            category cannot sit on one body for the same event.
          </p>
        </section>

        <section>
          <h2>Likeness</h2>
          <p>
            A win buys the mark on event day and the proof photos from that day.
            Reuse of the athlete’s face or body in other ads is off unless the
            athlete opted in and you agree a separate price.
          </p>
        </section>

        <section>
          <h2>Mail</h2>
          <p>We only email you about SkinBid.</p>
        </section>
      </article>
    </ProductShell>
  );
}
