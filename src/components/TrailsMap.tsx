"use client";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Trail } from "@/types";
import { directionsUrl, trailSlug } from "@/lib/trails";

const SLO_CENTER: [number, number] = [35.2828, -120.6596];

// Match the dot colors used in the list view's difficulty pill so the visual
// language is consistent between views. Using hex equivalents of the Tailwind
// classes:
//   emerald-700 #047857, amber-700 #b45309, orange-800 #9a3412, accent #8a1c1c
const COLOR_BY_DIFFICULTY: Record<Trail["difficulty"], string> = {
  Easy: "#047857",
  Moderate: "#b45309",
  Hard: "#9a3412",
  Strenuous: "#8a1c1c",
};

export default function TrailsMap({ trails }: { trails: Trail[] }) {
  return (
    <div className="border border-rule rounded-sm overflow-hidden">
      <MapContainer
        center={SLO_CENTER}
        zoom={10}
        scrollWheelZoom={true}
        style={{ height: "70vh", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        />
        {trails.map((t) => {
          const color = COLOR_BY_DIFFICULTY[t.difficulty];
          return (
            <CircleMarker
              key={trailSlug(t)}
              center={[t.lat, t.lng]}
              radius={8}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: 220, fontFamily: "Georgia, serif" }}>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      lineHeight: 1.25,
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#6b6357",
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: color,
                      }}
                      aria-hidden
                    />
                    {t.difficulty}
                    <span aria-hidden>·</span>
                    <span>{t.distance_miles} mi</span>
                  </div>
                  <a
                    href={directionsUrl(t)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontWeight: 700,
                      color: "#8a1c1c",
                      textDecoration: "underline",
                      textDecorationThickness: 2,
                      textUnderlineOffset: 4,
                    }}
                  >
                    Get directions →
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
