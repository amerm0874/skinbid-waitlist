import type { ReactNode } from "react";
import {
  Bell,
  Box,
  Copy,
  Search,
  Video,
  type LucideIcon,
} from "lucide-react";

export function Icon({
  children,
  size = 18,
  filled = false,
}: {
  children: ReactNode;
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? undefined : "1.8"}
      strokeLinecap={filled ? undefined : "round"}
      strokeLinejoin={filled ? undefined : "round"}
    >
      {children}
    </svg>
  );
}

function Mark({
  icon: Glyph,
  size = 16,
}: {
  icon: LucideIcon;
  size?: number;
}) {
  return (
    <Glyph
      className="icon"
      size={size}
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

export function BellIcon({ size = 18 }: { size?: number }) {
  return <Mark icon={Bell} size={size} />;
}

export function SearchIcon({ size = 16 }: { size?: number }) {
  return <Mark icon={Search} size={size} />;
}

export function CubeIcon({ size = 18 }: { size?: number }) {
  return <Mark icon={Box} size={size} />;
}

export function VideoIcon({ size = 18 }: { size?: number }) {
  return <Mark icon={Video} size={size} />;
}

export function CopyIcon({ size = 16 }: { size?: number }) {
  return <Mark icon={Copy} size={size} />;
}
