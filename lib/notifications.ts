import { isMissingRelation } from "@/lib/db-error";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { createServerSupabase } from "@/lib/supabase/server";

export type NoticeKind =
  | "bid_held"
  | "bid_held_brand"
  | "outbid"
  | "won"
  | "auction_won_athlete"
  | "auction_won_brand"
  | "proof_due"
  | "proof_approved"
  | "proof_rejected"
  | "refund_done";

export type NoticeRow = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

export type NoticeRecord = {
  id: string;
  user_id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  href: string;
  entity_id: string;
};

const NOTICE_KINDS = new Set<NoticeKind>([
  "bid_held",
  "bid_held_brand",
  "outbid",
  "won",
  "auction_won_athlete",
  "auction_won_brand",
  "proof_due",
  "proof_approved",
  "proof_rejected",
  "refund_done",
]);

const ZONE_LIFECYCLE_KINDS = new Set<NoticeKind>([
  "bid_held",
  "bid_held_brand",
  "outbid",
  "refund_done",
]);

type SessionDb = NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>;

export function isNoticeHref(href: string) {
  return (
    /^\/e\/[a-z0-9-]{3,48}(?:\/logo)?$/.test(href) ||
    /^\/proof\/[0-9a-f-]{36}$/i.test(href)
  );
}

export function isZoneLifecycleKind(kind: string): kind is NoticeKind {
  return ZONE_LIFECYCLE_KINDS.has(kind as NoticeKind);
}

export function noticeEventSlug(href: string) {
  const match = href.match(/^\/e\/([a-z0-9-]{3,48})(?:\/logo)?$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

export function noticeZoneKey(title: string) {
  const sep = " · ";
  const index = title.indexOf(sep);
  if (index < 0) {
    return "";
  }
  return title.slice(index + sep.length).trim().toLowerCase();
}

function zoneLifecycleKey(item: { kind: string; title: string; href: string }) {
  if (!isZoneLifecycleKind(item.kind)) {
    return "";
  }
  const slug = noticeEventSlug(item.href);
  const zone = noticeZoneKey(item.title);
  if (!slug || !zone) {
    return "";
  }
  return `${slug}:${zone}`;
}

// One row per zone: held, outbid, and refunded are the same story.
export function collapseZoneLifecycleNotices(items: NoticeRow[]): NoticeRow[] {
  const seen = new Set<string>();
  const next: NoticeRow[] = [];
  for (const item of items) {
    const key = zoneLifecycleKey(item);
    if (key) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
    }
    next.push(item);
  }
  return next;
}

export function isNoticeKind(value: string): value is NoticeKind {
  return NOTICE_KINDS.has(value as NoticeKind);
}

export function noticeCta(href: string) {
  if (href.startsWith("/proof/")) {
    return "Upload proof";
  }
  if (href.endsWith("/logo")) {
    return "Upload PNG";
  }
  return "View event";
}

export async function insertNotification(input: {
  userId: string;
  kind: NoticeKind;
  title: string;
  body: string;
  href: string;
  entityId: string;
}): Promise<{ duplicate: boolean; row: NoticeRecord | null }> {
  try {
    if (!isNoticeHref(input.href)) {
      console.log("Notification skipped — bad href", input.kind, input.href);
      return { duplicate: false, row: null };
    }
    const admin = createAdminSupabase();
    if (!admin) {
      console.log("Notification skipped — no service role key");
      return { duplicate: false, row: null };
    }
    if (isZoneLifecycleKind(input.kind)) {
      await supersedeZoneLifecycleNotices(admin, input);
    }
    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
        entity_id: input.entityId,
      })
      .select("id, user_id, kind, title, body, href, entity_id")
      .single();
    if (!error && data && isNoticeKind(data.kind)) {
      console.log("Notification inserted", input.kind, input.entityId);
      return {
        duplicate: false,
        row: {
          id: data.id,
          user_id: data.user_id,
          kind: data.kind,
          title: data.title,
          body: data.body,
          href: data.href,
          entity_id: data.entity_id,
        },
      };
    }
    if (error?.code === "23505") {
      const { data: existing } = await admin
        .from("notifications")
        .select("id, user_id, kind, title, body, href, entity_id")
        .eq("user_id", input.userId)
        .eq("kind", input.kind)
        .eq("entity_id", input.entityId)
        .maybeSingle();
      if (existing && isNoticeKind(existing.kind)) {
        const { data: updated } = await admin
          .from("notifications")
          .update({
            title: input.title,
            body: input.body,
            href: input.href,
            read_at: null,
            created_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id, user_id, kind, title, body, href, entity_id")
          .maybeSingle();
        const row = updated ?? existing;
        if (isNoticeKind(row.kind)) {
          return {
            duplicate: true,
            row: {
              id: row.id,
              user_id: row.user_id,
              kind: row.kind,
              title: row.title,
              body: row.body,
              href: row.href,
              entity_id: row.entity_id,
            },
          };
        }
      }
      return { duplicate: true, row: null };
    }
    if (isMissingRelation(error, "notifications")) {
      console.log("Notification skipped — run supabase/schema.sql");
      return { duplicate: false, row: null };
    }
    if (error) {
      console.log("Notification insert failed", error.message);
    }
    return { duplicate: false, row: null };
  } catch (error) {
    console.log("Notification threw", error);
    return { duplicate: false, row: null };
  }
}

async function supersedeZoneLifecycleNotices(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  input: {
    userId: string;
    kind: NoticeKind;
    title: string;
    href: string;
  },
) {
  const key = zoneLifecycleKey(input);
  if (!key) {
    return;
  }
  const { data, error } = await admin
    .from("notifications")
    .select("id, kind, title, href")
    .eq("user_id", input.userId)
    .in("kind", [...ZONE_LIFECYCLE_KINDS]);
  if (error) {
    console.log("Notice supersede list failed", error.message);
    return;
  }
  const ids = (data ?? [])
    .filter((row) => zoneLifecycleKey(row) === key)
    .map((row) => row.id);
  if (ids.length === 0) {
    return;
  }
  const { error: deleteError } = await admin
    .from("notifications")
    .delete()
    .in("id", ids);
  if (deleteError) {
    console.log("Notice supersede delete failed", deleteError.message);
  }
}

function toNoticeRow(row: {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string;
  read_at: string | null;
  created_at: string;
}): NoticeRow | null {
  if (!isNoticeKind(row.kind) || !isNoticeHref(row.href)) {
    return null;
  }
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: typeof row.body === "string" ? row.body : "",
    href: row.href,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

export async function listNotices(supabase: SessionDb, userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    if (isMissingRelation(error, "notifications")) {
      return [] as NoticeRow[];
    }
    console.log("Notices list failed", error.message);
    return null;
  }
  const items = (data ?? [])
    .map(toNoticeRow)
    .filter((row): row is NoticeRow => row !== null);
  return collapseZoneLifecycleNotices(items);
}

export async function countUnreadNotices(supabase: SessionDb, userId: string) {
  const items = await listNotices(supabase, userId);
  if (!items) {
    return 0;
  }
  return items.filter((item) => !item.read_at).length;
}
