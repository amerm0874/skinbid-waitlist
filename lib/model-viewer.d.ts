import type { ModelViewerElement } from "@google/model-viewer";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerJSXAttributes = Partial<
  DetailedHTMLProps<HTMLAttributes<ModelViewerElement>, ModelViewerElement>
> & {
  src?: string;
  alt?: string;
  poster?: string;
  reveal?: "auto" | "interaction" | "manual";
  "camera-controls"?: boolean;
  "touch-action"?: string;
  "auto-rotate"?: boolean;
  "auto-rotate-delay"?: string | number;
  "rotation-per-second"?: string;
  "shadow-intensity"?: string | number;
  "shadow-softness"?: string | number;
  exposure?: string | number;
  "environment-image"?: string;
  "disable-pan"?: boolean;
  "disable-zoom"?: boolean;
  "camera-orbit"?: string;
  "camera-target"?: string;
  "min-camera-orbit"?: string;
  "max-camera-orbit"?: string;
  orientation?: string;
  "interaction-prompt"?: "auto" | "none";
  "interpolation-decay"?: string | number;
  "field-of-view"?: string;
  "min-field-of-view"?: string;
  "max-field-of-view"?: string;
  loading?: "auto" | "lazy" | "eager";
  scale?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerJSXAttributes;
    }
  }
}
