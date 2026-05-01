"use client";

import dynamic from "next/dynamic";
import type { Trail } from "@/types";

// Leaflet touches `window` on import — can't be server-rendered. Loading
// the map this way keeps the rest of the page server-rendered while
// deferring the map's JS + CSS to the browser only.
const TrailsMap = dynamic(() => import("@/components/TrailsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] border border-rule rounded-sm flex items-center justify-center text-muted text-sm">
      Loading map…
    </div>
  ),
});

export default function MapWrapper({ trails }: { trails: Trail[] }) {
  return <TrailsMap trails={trails} />;
}
