export function polarPaymentsEnabled() {
  return Boolean(process.env.POLAR_ACCESS_TOKEN?.trim());
}
