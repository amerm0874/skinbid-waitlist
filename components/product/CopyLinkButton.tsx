"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  path: string;
  title: string;
  className?: string;
};

// Phones and tablets only. Desktop Chrome can share too — we still copy there.
function canNativeShare() {
  if (typeof navigator.share !== "function") {
    return false;
  }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function pageUrl(path: string) {
  return `${window.location.origin}${path}`;
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Some browsers expose clipboard but block it. Fall through.
  }

  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.left = "-9999px";
  document.body.appendChild(box);
  box.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(box);
  if (!ok) {
    throw new Error("copy failed");
  }
}

export function CopyLinkButton({ path, title, className }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
  }, []);

  async function onClick() {
    const url = pageUrl(path);

    if (canNativeShare()) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // User closed the sheet. Do not copy behind their back.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await copyText(url);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.log("Copy link failed", error);
    }
  }

  return (
    <button
      type="button"
      className={className ?? "btn btn-ghost"}
      onClick={onClick}
      aria-label="Copy link"
      aria-live="polite"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
