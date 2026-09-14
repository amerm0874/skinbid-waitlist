"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellIcon } from "@/components/product/Icons";
import type { NoticeRow } from "@/lib/notifications";

type Props = {
  unread?: number;
};

export function NotificationBell({ unread = 0 }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [items, setItems] = useState<NoticeRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(unread);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setLoaded(true);
        return;
      }
      const data = (await response.json()) as {
        items?: NoticeRow[];
        unread?: number;
      };
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setItems(nextItems);
      setUnreadCount(
        typeof data.unread === "number"
          ? data.unread
          : nextItems.filter((item) => !item.read_at).length,
      );
      setLoaded(true);
    } catch (error) {
      console.log("Notices fetch failed", error);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setUnreadCount(unread);
  }, [unread]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  function openNotice(item: NoticeRow) {
    void fetch("/api/notifications", {
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    }).catch((error) => {
      console.log("Notice mark-read failed", error);
    });
    setItems((current) =>
      current.map((row) =>
        row.id === item.id
          ? { ...row, read_at: row.read_at ?? new Date().toISOString() }
          : row,
      ),
    );
    setUnreadCount((count) => (item.read_at ? count : Math.max(0, count - 1)));
    detailsRef.current?.removeAttribute("open");
  }

  const label =
    unreadCount > 0 ? `Bell, ${unreadCount} unread` : "Bell";

  return (
    <details
      ref={detailsRef}
      className="notice-bell"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          void load();
        }
      }}
    >
      <summary aria-label={label}>
        <BellIcon size={18} />
        {unreadCount > 0 ? (
          <span className="notice-count">{unreadCount > 99 ? "99" : unreadCount}</span>
        ) : null}
      </summary>
      <div className="notice-bell-panel">
        {!loaded && items.length === 0 ? (
          <p className="notice-empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="notice-empty">No notices.</p>
        ) : (
          items.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={item.read_at ? "notice-item" : "notice-item notice-item-unread"}
              onClick={() => void openNotice(item)}
            >
              <span className="notice-item-title">{item.title}</span>
              {item.body ? (
                <span className="notice-item-body">{item.body}</span>
              ) : null}
            </a>
          ))
        )}
      </div>
    </details>
  );
}
