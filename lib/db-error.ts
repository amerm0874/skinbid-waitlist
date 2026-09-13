export function dbErrorMessage(error: unknown) {
  if (!error) {
    return "Could not save. Try again.";
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "object") {
    const row = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error?: unknown;
    };
    const parts = [row.message, row.details, row.hint, row.code].filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
    if (parts.length > 0) {
      return parts.join(" — ");
    }
    if (typeof row.error === "string" && row.error.trim()) {
      return row.error;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Could not save. Try again.";
  }
}

export function dbErrorFields(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      details: null as string | null,
      hint: null as string | null,
      code: null as string | null,
    };
  }
  const row = error as {
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };
  return {
    details: typeof row.details === "string" ? row.details : null,
    hint: typeof row.hint === "string" ? row.hint : null,
    code: typeof row.code === "string" ? row.code : null,
  };
}

function errorText(error: { message?: string; code?: string } | null | undefined) {
  return `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
}

export function isMissingRelation(
  error: { message?: string; code?: string } | null | undefined,
  name: string,
) {
  const text = errorText(error);
  const table = name.toLowerCase();
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    (text.includes(table) &&
      (text.includes("schema cache") ||
        text.includes("does not exist") ||
        text.includes("could not find the table")))
  );
}

export function isMissingColumn(
  error: { message?: string; code?: string } | null | undefined,
  column: string,
) {
  const text = errorText(error);
  return (
    text.includes(column.toLowerCase()) &&
    (error?.code === "42703" ||
      text.includes("schema cache") ||
      text.includes("does not exist") ||
      text.includes("column"))
  );
}
