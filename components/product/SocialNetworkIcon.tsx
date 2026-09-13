import type { SocialNetwork } from "@/lib/socials";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function SocialNetworkIcon({ network }: { network: SocialNetwork }) {
  if (network === "Instagram") {
    return (
      <Icon>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
      </Icon>
    );
  }
  if (network === "X") {
    return (
      <Icon>
        <path d="M4 4l16 16M20 4L4 20" />
      </Icon>
    );
  }
  if (network === "TikTok") {
    return (
      <Icon>
        <path d="M14 4v10.2a3.8 3.8 0 1 1-3-3.7V8.2c1.3 1 2.8 1.6 4.4 1.7V4z" />
      </Icon>
    );
  }
  if (network === "YouTube") {
    return (
      <Icon>
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <path d="M10 9.5v5l5-2.5z" fill="currentColor" stroke="none" />
      </Icon>
    );
  }
  return (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 15c1.5-2 6.5-2 8 0" />
      <circle cx="12" cy="10" r="2" />
    </Icon>
  );
}
