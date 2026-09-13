import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { ProductShell } from "@/components/product/ProductShell";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What SkinBid stores: account fields, captures, GLB, bids, and PayPal email. We do not sell data.",
};

export default async function PrivacyPage() {
  const { user, profile } = await getSessionUser();

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <article className="page-stack legal">
        <div>
          <h1 className="display page-title">Privacy</h1>
          <p className="page-lead">Last updated 12 September 2026.</p>
        </div>

        <p>
          We keep what we need to run the auction. We do not sell your data.
        </p>

        <section>
          <h2>Account</h2>
          <p>
            Name, email, role, and the other fields you give us when you sign
            up or edit your profile.
          </p>
        </section>

        <section>
          <h2>Captures and GLB</h2>
          <p>
            Photos you upload so we can build the 3D body, and the GLB file we
            show on the event page.
          </p>
        </section>

        <section>
          <h2>Bids</h2>
          <p>Who bid, how much, and whether the bid was held, won, or refunded.</p>
        </section>

        <section>
          <h2>Pay</h2>
          <p>
            If you are an athlete, we store your PayPal email so we can pay you.
          </p>
        </section>
      </article>
    </ProductShell>
  );
}
