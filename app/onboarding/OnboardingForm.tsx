"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND_CATEGORIES, type Role } from "@/lib/config";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function OnboardingForm({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("athlete");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [social, setSocial] = useState("");
  const [website, setWebsite] = useState("");
  const [brandCategory, setBrandCategory] = useState("software");
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [stills, setStills] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setErrorMessage("Auth is not configured yet.");
      return;
    }
    if (!name.trim()) {
      setErrorMessage("Enter a name.");
      return;
    }
    if (role === "athlete" && !social.trim()) {
      setErrorMessage("Enter Instagram or X.");
      return;
    }
    if (role === "brand" && !website.trim()) {
      setErrorMessage("Enter the brand website.");
      return;
    }

    setBusy(true);
    try {
      let logoUrl: string | null = null;
      if (role === "brand" && logoFile) {
        const path = `${userId}/${logoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(path, logoFile, { upsert: true });
        if (uploadError) {
          throw uploadError;
        }
        logoUrl = supabase.storage.from("logos").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        role,
        name: name.trim(),
        country: country.trim() || null,
        social: role === "athlete" ? social.trim() : null,
        website: role === "brand" ? website.trim() : null,
        brand_category: role === "brand" ? brandCategory : null,
        logo_url: logoUrl,
      });
      if (error) {
        throw error;
      }

      if (role === "athlete" && glbFile) {
        const path = `${userId}/avatar.glb`;
        const { error: glbError } = await supabase.storage
          .from("avatars")
          .upload(path, glbFile, { upsert: true });
        if (glbError) {
          throw glbError;
        }
        const glbUrl = supabase.storage.from("avatars").getPublicUrl(path).data
          .publicUrl;
        await supabase.from("avatars").upsert({
          athlete_id: userId,
          glb_url: glbUrl,
          ready: true,
        });
        console.log("Avatar marked ready from GLB");
      } else if (role === "athlete" && stills && stills.length > 0) {
        const paths: string[] = [];
        for (const file of Array.from(stills)) {
          const path = `${userId}/${file.name}`;
          await supabase.storage.from("captures").upload(path, file, {
            upsert: true,
          });
          paths.push(path);
        }
        await supabase.from("captures").insert({
          athlete_id: userId,
          paths,
          status: "pending",
        });
        console.log("Capture stored. Reconstruction is a stub.");
      }

      console.log("Profile saved", role, email);
      router.push(role === "athlete" ? "/new" : "/events");
      router.refresh();
    } catch (error) {
      console.log("Onboarding failed", error);
      setErrorMessage("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <fieldset>
        <legend className="field-label">Role</legend>
        <div className="seg w-full">
          <button
            type="button"
            className={`flex-1 ${role === "athlete" ? "is-on" : ""}`}
            onClick={() => setRole("athlete")}
          >
            Athlete
          </button>
          <button
            type="button"
            className={`flex-1 ${role === "brand" ? "is-on" : ""}`}
            onClick={() => setRole("brand")}
          >
            Brand
          </button>
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="field-label">{role === "brand" ? "Brand name" : "Display name"}</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="mt-4 block">
        <span className="field-label">Country</span>
        <input className="field" value={country} onChange={(e) => setCountry(e.target.value)} />
      </label>

      {role === "athlete" ? (
        <>
          <label className="mt-4 block">
            <span className="field-label">Social</span>
            <input className="field" value={social} onChange={(e) => setSocial(e.target.value)} placeholder="@handle" />
          </label>
          <label className="mt-4 block">
            <span className="field-label">Ready .glb (marks avatar ready)</span>
            <input
              className="field pt-2 text-[13px]"
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(e) => setGlbFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="mt-4 block">
            <span className="field-label">Or orbit stills / 60–90s video + 10s name clip</span>
            <input
              className="field pt-2 text-[13px]"
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => setStills(e.target.files)}
            />
          </label>
          <p className="mt-2 text-[12px] text-muted">
            Reconstruction from stills is a stub. A .glb goes live now.
          </p>
        </>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="field-label">Website</span>
            <input className="field" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          </label>
          <label className="mt-4 block">
            <span className="field-label">Category</span>
            <select
              className="field"
              value={brandCategory}
              onChange={(e) => setBrandCategory(e.target.value)}
            >
              {BRAND_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block">
            <span className="field-label">Logo (PNG / SVG)</span>
            <input
              className="field pt-2 text-[13px]"
              type="file"
              accept="image/png,image/svg+xml"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </>
      )}

      {errorMessage ? <p className="mt-4 text-[13px] text-danger">{errorMessage}</p> : null}
      <button type="submit" disabled={busy} className="btn btn-solid mt-6 w-full">
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
