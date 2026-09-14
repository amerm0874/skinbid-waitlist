"use client";

import type { ModelViewerElement } from "@google/model-viewer";
import { DRACO_PATH } from "@/lib/landing-media";

type ModelViewerCtor = typeof ModelViewerElement & {
  dracoDecoderLocation: string;
};

type ArRendererLike = {
  isPresenting: boolean;
  presentedScene: unknown;
  onUpdateScene: () => void;
  __skinbidPatched?: boolean;
};

let modelViewerPromise: Promise<ModelViewerCtor> | null = null;

function findArRenderer(viewer: object): ArRendererLike | null {
  let current: object | null = viewer;
  while (current) {
    for (const key of Object.getOwnPropertySymbols(current)) {
      let value: unknown;
      try {
        value = Reflect.get(viewer, key);
      } catch {
        continue;
      }
      if (
        value &&
        typeof value === "object" &&
        "arRenderer" in value &&
        (value as { arRenderer?: ArRendererLike }).arRenderer &&
        typeof (value as { arRenderer: ArRendererLike }).arRenderer
          .onUpdateScene === "function"
      ) {
        return (value as { arRenderer: ArRendererLike }).arRenderer;
      }
    }
    current = Object.getPrototypeOf(current);
  }
  return null;
}

// model-viewer 4.3.1 calls AR update on every scale change, even when AR is
// off. presentedScene is null then, so .add() throws a TypeError.
export function guardModelViewerScale(viewer: ModelViewerElement) {
  const ar = findArRenderer(viewer);
  if (!ar || ar.__skinbidPatched) {
    return;
  }
  ar.__skinbidPatched = true;
  const original = ar.onUpdateScene.bind(ar);
  ar.onUpdateScene = () => {
    if (!ar.isPresenting || ar.presentedScene == null) {
      return;
    }
    original();
  };
}

export function ensureModelViewer() {
  if (!modelViewerPromise) {
    modelViewerPromise = import(
      /* webpackPrefetch: false, webpackPreload: false */
      "@google/model-viewer"
    ).then((mod) => {
      const El = mod.ModelViewerElement as ModelViewerCtor;
      El.dracoDecoderLocation = DRACO_PATH;
      return El;
    });
  }
  return modelViewerPromise;
}
