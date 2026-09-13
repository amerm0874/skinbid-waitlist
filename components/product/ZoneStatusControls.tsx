"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAuctionClosed } from "@/lib/auction";
import { logoDownloadName } from "@/lib/athlete-status";
import { centsToUsd } from "@/lib/money";
import type { ZoneStatus } from "@/lib/types";
import { isPersistedZoneId } from "@/lib/zone-bids";
import { ZONE_LABEL, ZONE_NAMES, type ZoneName } from "@/lib/zones";
import { zoneToggleError } from "@/lib/zone-status";
import { DownloadLogo } from "@/components/product/DownloadLogo";

export type OwnerZone = {
  id: string;
  name: ZoneName;
  status: ZoneStatus;
  occupied: boolean;
  currentCents: number | null;
  leadStatus: "held" | "won" | null;
  logoUrl?: string | null;
};

export async function patchZoneStatus(zoneId: string, status: ZoneStatus) {
  const response = await fetch("/api/zones", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zone_id: zoneId, status }),
  });
  const payload = (await response.json()) as {
    error?: string;
    status?: ZoneStatus;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Could not update the zone.");
  }
  return payload.status ?? status;
}

export function zoneActionLabel(input: {
  status: ZoneStatus;
  occupied: boolean;
  leadStatus: "held" | "won" | null;
  eventDate: string;
  now?: Date;
}) {
  const next: ZoneStatus = input.status === "open" ? "closed" : "open";
  const error = zoneToggleError({
    from: input.status,
    to: next,
    hasHeldOrWon: input.occupied,
    eventDate: input.eventDate,
    now: input.now,
  });
  if (error) {
    if (input.occupied && input.leadStatus === "won") {
      return { disabled: true, label: "Won", hint: error };
    }
    if (input.occupied) {
      return { disabled: true, label: "Held", hint: error };
    }
    return { disabled: true, label: input.status === "closed" ? "Closed" : "Open", hint: error };
  }
  return {
    disabled: false,
    label: next === "closed" ? "Close" : "Reopen",
    hint: null as string | null,
  };
}

type BoardProps = {
  eventDate: string;
  zones: OwnerZone[];
};

export function MeZoneBoard({ eventDate, zones }: BoardProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    id: string;
    status: ZoneStatus;
  } | null>(null);
  const [message, setMessage] = useState("");

  async function toggle(zone: OwnerZone) {
    if (!isPersistedZoneId(zone.id) || busyId) {
      return;
    }
    const next: ZoneStatus = zone.status === "open" ? "closed" : "open";
    const blocked = zoneToggleError({
      from: zone.status,
      to: next,
      hasHeldOrWon: zone.occupied,
      eventDate,
    });
    if (blocked) {
      setMessage(blocked);
      return;
    }
    setBusyId(zone.id);
    setMessage("");
    try {
      const status = await patchZoneStatus(zone.id, next);
      setPending({ id: zone.id, status });
      console.log("Zone", status, zone.name);
      router.refresh();
    } catch (error) {
      console.log("Zone update failed", error);
      setMessage(
        error instanceof Error ? error.message : "Could not update the zone.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="me-zones">
      <div>
        <h2 className="bib-title">Zones</h2>
        <p className="fine">
          Close empty zones if you will not wear a mark there. Held or won stays.
          After T–48h you cannot reopen.
        </p>
      </div>
      <ul className="me-zone-list">
        {ZONE_NAMES.map((name) => {
          const row = zones.find((item) => item.name === name);
          if (!row) {
            return null;
          }
          const zone =
            pending && pending.id === row.id
              ? { ...row, status: pending.status }
              : row;
          const action = zoneActionLabel({
            status: zone.status,
            occupied: zone.occupied,
            leadStatus: zone.leadStatus,
            eventDate,
          });
          const state = zone.occupied
            ? `${zone.leadStatus === "won" ? "Won" : "Held"}${
                zone.currentCents ? ` ${centsToUsd(zone.currentCents)}` : ""
              }`
            : zone.status === "closed"
              ? "Closed"
              : "Open";
          const logoHref =
            zone.leadStatus === "won" ||
            (isAuctionClosed(eventDate) && zone.leadStatus === "held")
              ? zone.logoUrl
              : null;
          return (
            <li key={zone.id}>
              <div className="me-zone">
                <span className="me-zone-name">{ZONE_LABEL[name]}</span>
                <span className="me-zone-state">{state}</span>
                {action.disabled ? null : (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === zone.id}
                    onClick={() => void toggle(zone)}
                  >
                    {busyId === zone.id
                      ? nextBusyLabel(zone.status)
                      : action.label}
                  </button>
                )}
              </div>
              {logoHref ? (
                <DownloadLogo
                  href={logoHref}
                  zoneLabel={ZONE_LABEL[name]}
                  fileName={logoDownloadName(name)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {message ? <p className="text-[13px] text-danger">{message}</p> : null}
    </div>
  );
}

function nextBusyLabel(status: ZoneStatus) {
  return status === "open" ? "Closing…" : "Reopening…";
}

type EventActionProps = {
  zone: OwnerZone;
  eventDate: string;
  now?: Date;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onStatus: (status: ZoneStatus) => void;
  onMessage: (message: string) => void;
};

export function EventZoneOwnerAction({
  zone,
  eventDate,
  now,
  busy,
  onBusy,
  onStatus,
  onMessage,
}: EventActionProps) {
  if (!isPersistedZoneId(zone.id)) {
    return null;
  }

  const action = zoneActionLabel({
    status: zone.status,
    occupied: zone.occupied,
    leadStatus: zone.leadStatus,
    eventDate,
    now,
  });
  const next: ZoneStatus = zone.status === "open" ? "closed" : "open";
  const auctionClosed = isAuctionClosed(eventDate, now);

  async function toggle() {
    if (busy || action.disabled) {
      if (action.hint) {
        onMessage(action.hint);
      }
      return;
    }
    onBusy(true);
    onMessage("");
    try {
      const status = await patchZoneStatus(zone.id, next);
      onStatus(status);
      onMessage(status === "closed" ? "Zone closed." : "Zone reopened.");
      console.log("Zone", status, zone.name);
    } catch (error) {
      console.log("Zone update failed", error);
      onMessage(
        error instanceof Error ? error.message : "Could not update the zone.",
      );
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="event-zone-owner">
      {action.disabled ? (
        <p className="fine">{ownerHint(zone, auctionClosed, action.hint)}</p>
      ) : (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void toggle()}
        >
          {busy ? nextBusyLabel(zone.status) : action.label}
        </button>
      )}
    </div>
  );
}

function ownerHint(
  zone: OwnerZone,
  auctionClosed: boolean,
  fallback: string | null,
) {
  if (zone.occupied && zone.leadStatus === "won") {
    return "Won. You cannot close this zone.";
  }
  if (zone.occupied) {
    return "Held. You cannot close this zone.";
  }
  if (zone.status === "closed" && auctionClosed) {
    return "Closed. Cannot reopen after T–48h.";
  }
  return fallback ?? "";
}
