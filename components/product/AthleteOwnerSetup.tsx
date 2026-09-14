"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CAPTURE_VIDEO_ACCEPT,
  ORBIT_CLIP_LABEL,
  PROFILE_CLIP_LABEL,
  UPLOAD_ORBIT_LABEL,
  UPLOAD_PROFILE_LABEL,
  orbitFileError,
  profileClipFileError,
  uploadOrbitVideo,
  uploadProfileClip,
} from "@/lib/capture";
import { captureEvent, captureException } from "@/lib/analytics";
import { CubeIcon, VideoIcon } from "@/components/product/Icons";

export const CREATE_RACE_LABEL = "List my race";
export const CREATE_MODEL_LABEL = "Create my 3D model";

export function AthleteOwnerSetup({
  handle,
  userId,
  modelPaid,
}: {
  handle: string;
  userId: string;
  modelPaid: boolean;
}) {
  const router = useRouter();
  const orbitToken = useRef(0);
  const profileToken = useRef(0);
  const [paid, setPaid] = useState(modelPaid);
  const [payBusy, setPayBusy] = useState(false);
  const [payMessage, setPayMessage] = useState("");
  const [payFailed, setPayFailed] = useState(false);
  const [orbitFile, setOrbitFile] = useState<File | null>(null);
  const [orbitError, setOrbitError] = useState("");
  const [orbitBusy, setOrbitBusy] = useState(false);
  const [orbitMessage, setOrbitMessage] = useState("");
  const [orbitFailed, setOrbitFailed] = useState(false);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profileError, setProfileError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileFailed, setProfileFailed] = useState(false);
  const paidTracked = useRef(modelPaid);

  useEffect(() => {
    setPaid(modelPaid);
    if (modelPaid) {
      paidTracked.current = true;
    }
  }, [modelPaid]);

  function markPaid() {
    setPaid(true);
    if (!paidTracked.current) {
      paidTracked.current = true;
      captureEvent("model_paid");
    }
  }

  useEffect(() => {
    if (paid) {
      return;
    }
    const returnedId = new URLSearchParams(window.location.search).get("capture_id");
    if (!returnedId) {
      return;
    }
    setPayMessage("Payment received. Uploads unlock when Whop confirms.");
    setPayFailed(false);
    captureEvent("checkout_returned", {
      kind: "model",
      capture_id: returnedId,
    });
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch("/api/captures/checkout");
        const payload = (await response.json()) as { model_paid?: boolean };
        if (cancelled || !response.ok || !payload.model_paid) {
          return;
        }
        markPaid();
        setPayMessage("Paid. Upload the profile clip and the orbit clip.");
        router.refresh();
      } catch (error) {
        console.log("Model pay poll failed", error);
      }
    }
    void poll();
    const tick = window.setInterval(() => {
      void poll();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [paid, router]);

  async function payForModel() {
    captureEvent("model_pay_clicked");
    setPayBusy(true);
    setPayMessage("");
    setPayFailed(false);
    try {
      const response = await fetch("/api/captures/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_to: `/a/${handle}` }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        model_paid?: boolean;
        checkout_url?: string;
      } | null;
      if (!payload) {
        setPayFailed(true);
        setPayMessage(`Checkout failed (${response.status}).`);
        return;
      }
      if (!response.ok) {
        setPayFailed(true);
        setPayMessage(payload.error || `Checkout failed (${response.status}).`);
        return;
      }
      if (payload.model_paid) {
        markPaid();
        setPayMessage("Paid. Upload the profile clip and the orbit clip.");
        router.refresh();
        return;
      }
      if (payload.checkout_url) {
        captureEvent("checkout_opened", { kind: "model" });
        window.location.href = payload.checkout_url;
        return;
      }
      setPayFailed(true);
      setPayMessage("Whop returned no checkout URL.");
    } catch (error) {
      console.log("Athlete model checkout failed", error);
      captureException(error);
      setPayFailed(true);
      setPayMessage(error instanceof Error ? error.message : "Checkout request failed.");
    } finally {
      setPayBusy(false);
    }
  }

  async function onProfilePicked(file: File | null) {
    const token = ++profileToken.current;
    setProfileFile(file);
    setProfileMessage("");
    setProfileFailed(false);
    if (!file) {
      setProfileError("");
      return;
    }
    const reason = await profileClipFileError(file);
    if (token !== profileToken.current) {
      return;
    }
    setProfileError(reason);
  }

  async function onOrbitPicked(file: File | null) {
    const token = ++orbitToken.current;
    setOrbitFile(file);
    setOrbitMessage("");
    setOrbitFailed(false);
    if (!file) {
      setOrbitError("");
      return;
    }
    const reason = await orbitFileError([file]);
    if (token !== orbitToken.current) {
      return;
    }
    setOrbitError(reason);
  }

  async function uploadProfile() {
    if (!paid) {
      setProfileFailed(true);
      setProfileMessage("Create my 3D model first.");
      return;
    }
    if (!profileFile || profileError) {
      setProfileFailed(true);
      setProfileMessage(profileError || "Add the profile clip.");
      return;
    }
    setProfileBusy(true);
    setProfileMessage("");
    setProfileFailed(false);
    try {
      await uploadProfileClip(userId, profileFile);
      captureEvent("profile_clip_uploaded");
      setProfileMessage("Profile clip uploaded. It plays on this page.");
      setProfileFile(null);
      setProfileError("");
      router.refresh();
    } catch (error) {
      console.log("Profile clip upload failed", error);
      setProfileFailed(true);
      setProfileMessage(error instanceof Error ? error.message : "Could not upload.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function uploadOrbit() {
    if (!paid) {
      setOrbitFailed(true);
      setOrbitMessage("Create my 3D model first.");
      return;
    }
    if (!orbitFile || orbitError) {
      setOrbitFailed(true);
      setOrbitMessage(orbitError || "Add the orbit clip.");
      return;
    }
    setOrbitBusy(true);
    setOrbitMessage("");
    setOrbitFailed(false);
    try {
      await uploadOrbitVideo(userId, orbitFile);
      captureEvent("orbit_clip_uploaded");
      setOrbitMessage("Orbit clip uploaded. We build the 3D body by hand.");
      setOrbitFile(null);
      setOrbitError("");
      router.refresh();
    } catch (error) {
      console.log("Orbit upload failed", error);
      setOrbitFailed(true);
      setOrbitMessage(error instanceof Error ? error.message : "Could not upload.");
    } finally {
      setOrbitBusy(false);
    }
  }

  const showPay = !paid;
  const showUploads = paid;

  return (
    <div className="athlete-setup">
      <p className="athlete-setup-kicker">List</p>
      <Link href="/new" className="btn btn-solid">
        {CREATE_RACE_LABEL}
      </Link>
      {showPay ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={payBusy}
          onClick={() => void payForModel()}
        >
          {payBusy ? "Opening checkout…" : (
            <>
              <CubeIcon />
              {CREATE_MODEL_LABEL}
            </>
          )}
        </button>
      ) : null}
      {showUploads ? (
        <>
          <label className="athlete-setup-file">
            <span>{PROFILE_CLIP_LABEL}</span>
            <span className="athlete-setup-hint">5–10s. Plays on this page.</span>
            <input
              className="field pt-2 text-[13px]"
              type="file"
              accept={CAPTURE_VIDEO_ACCEPT}
              onChange={(event) => {
                void onProfilePicked(event.target.files?.[0] ?? null);
              }}
            />
          </label>
          {profileError ? <p className="athlete-setup-error">{profileError}</p> : null}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={profileBusy || !profileFile || Boolean(profileError)}
            onClick={() => void uploadProfile()}
          >
            {profileBusy ? "Uploading…" : (
              <>
                <VideoIcon />
                {UPLOAD_PROFILE_LABEL}
              </>
            )}
          </button>
          {profileMessage ? (
            <p className={`athlete-setup-note${profileFailed ? " is-bad" : ""}`}>
              {profileMessage}
            </p>
          ) : null}
          <label className="athlete-setup-file">
            <span>{ORBIT_CLIP_LABEL}</span>
            <span className="athlete-setup-hint">
              60–90s circle. We build the GLB by hand.
            </span>
            <input
              className="field pt-2 text-[13px]"
              type="file"
              accept={CAPTURE_VIDEO_ACCEPT}
              onChange={(event) => {
                void onOrbitPicked(event.target.files?.[0] ?? null);
              }}
            />
          </label>
          {orbitError ? <p className="athlete-setup-error">{orbitError}</p> : null}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={orbitBusy || !orbitFile || Boolean(orbitError)}
            onClick={() => void uploadOrbit()}
          >
            {orbitBusy ? "Uploading…" : (
              <>
                <VideoIcon />
                {UPLOAD_ORBIT_LABEL}
              </>
            )}
          </button>
          {orbitMessage ? (
            <p className={`athlete-setup-note${orbitFailed ? " is-bad" : ""}`}>
              {orbitMessage}
            </p>
          ) : null}
        </>
      ) : null}
      {payMessage ? (
        <p className={`athlete-setup-note${payFailed ? " is-bad" : ""}`}>{payMessage}</p>
      ) : null}
    </div>
  );
}
