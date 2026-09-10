import DodoPayments from "dodopayments";

export function dodoEnv() {
  const value =
    process.env.DODO_PAYMENTS_ENV ?? process.env.DODO_PAYMENTS_ENVIRONMENT;
  return value === "live_mode" ? "live_mode" : "test_mode";
}

export function createDodo() {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) {
    return null;
  }
  return new DodoPayments({
    bearerToken: key,
    environment: dodoEnv(),
  });
}

export async function refundDodoPayment(paymentId: string, reason: string) {
  const dodo = createDodo();
  if (!dodo) {
    console.log("Dodo refund skipped — no API key", paymentId);
    return { skipped: true as const };
  }
  await dodo.refunds.create({
    payment_id: paymentId,
    reason,
  });
  return { skipped: false as const };
}
