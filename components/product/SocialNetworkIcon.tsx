import { Icon } from "@/components/product/Icons";
import type { SocialNetwork } from "@/lib/socials";

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
      <Icon filled>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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
