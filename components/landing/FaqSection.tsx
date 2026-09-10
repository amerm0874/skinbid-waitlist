// Direct answers. No marketing. Native open/close so it works without extra JS.
const ITEMS = [
  {
    q: "Is the tattoo permanent?",
    a: "No. One day. Then it comes off.",
  },
  {
    q: "When does the athlete get paid?",
    a: "After the athlete delivers the photos. We check them, then payout.",
  },
  {
    q: "What if they no-show?",
    a: "The brand is refunded. The athlete gets $0 on that slot.",
  },
  {
    q: "Are you part of HYROX, UFC, or those events?",
    a: "No. Not affiliated with any organizer.",
  },
  {
    q: "What is the minimum bid?",
    a: "$100 to start. Next bid is +$100. Auction only. No buy-now.",
  },
  {
    q: "Who is this for?",
    a: "Athletes with a real event. Brands that want that photo.",
  },
  {
    q: "Can a brand reuse the athlete’s face later?",
    a: "No, unless the athlete opted in and a price was agreed.",
  },
];

export default function FaqSection() {
  return (
    <section className="border-t border-line">
      <div className="site-wrap py-[var(--block-y)]">
        <h2 className="display text-[36px] md:text-[52px]">Questions</h2>
        <div className="mt-10 border-t border-line">
          {ITEMS.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
