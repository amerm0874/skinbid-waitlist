"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { centsToUsd } from "@/lib/money";

type Proof = {
  id: string;
  event_id: string;
  status: string;
  event_name: string;
};

type Bid = {
  id: string;
  amount_cents: number;
  status: string;
  payable: boolean;
  dodo_payment_id: string | null;
  event_name: string;
  zone_name: string;
};

export default function AdminBoard({
  proofs,
  bids,
}: {
  proofs: Proof[];
  bids: Bid[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function post(body: Record<string, string>) {
    setMessage("");
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error || "Failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-12">
      {message ? <p className="text-[13px] text-danger">{message}</p> : null}

      <section>
        <h2 className="display text-[28px]">Proofs</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {proofs.length === 0 ? (
            <li className="py-4 text-[14px] text-muted">No proofs yet.</li>
          ) : (
            proofs.map((proof) => (
              <li key={proof.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">{proof.event_name}</p>
                  <p className="font-mono text-[12px] text-muted">{proof.status}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-solid h-10"
                    onClick={() => post({ action: "approve", proof_id: proof.id })}
                  >
                    Approve 80/20
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger h-10"
                    onClick={() => post({ action: "reject", proof_id: proof.id })}
                  >
                    Reject + refund
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="display text-[28px]">Bids</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {bids.length === 0 ? (
            <li className="py-4 text-[14px] text-muted">No bids yet.</li>
          ) : (
            bids.map((bid) => (
              <li key={bid.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">
                    {bid.event_name} · {bid.zone_name} · {centsToUsd(bid.amount_cents)}
                  </p>
                  <p className="font-mono text-[12px] text-muted">
                    {bid.status}
                    {bid.payable ? " · payable" : ""}
                    {bid.dodo_payment_id ? ` · ${bid.dodo_payment_id}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost h-10"
                    onClick={() => post({ action: "payable", bid_id: bid.id })}
                  >
                    Mark payable
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger h-10"
                    onClick={() => post({ action: "refund", bid_id: bid.id })}
                  >
                    Refund
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
