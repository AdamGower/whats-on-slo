"use client";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Trail } from "@/types";
import { directionsUrl, trailSlug } from "@/lib/trails";

function TrailCard({ t, color }: { t: Trail; color: string }) {
  return (
    <div
      style={{
        minWidth: 280,
        maxWidth: 320,
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.25 }}>
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
          flexWrap: "wrap",
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
        <span>{t.difficulty}</span>
        <span aria-hidden>·</span>
        <span>{t.distance_miles} mi</span>
        <span aria-hidden>·</span>
        <span>{t.elevation_gain_ft.toLocaleString()} ft gain</span>
      </div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "#6b6357",
          marginTop: 2,
          fontStyle: "italic",
        }}
      >
        {t.area}
      </div>
      <div
        style={{
          marginTop: 10,
          paddingLeft: 10,
          borderLeft: "2px solid rgba(138,28,28,0.6)",
        }}
      >
        <div
          style={{
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#6b6357",
            marginBottom: 2,
          }}
        >
          Hikers say
        </div>
        <div style={{ fontStyle: "italic", lineHeight: 1.45, fontSize: "0.85rem" }}>
          {t.hikers_say}
        </div>
      </div>
      <a
        href={directionsUrl(t)}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-block",
          marginTop: 12,
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
  );
}

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
              {/* Hover preview (desktop). Interactive=true so the Get
                  directions link inside the tooltip stays clickable when
                  the mouse moves from pin to tooltip. The custom class is
                  styled in globals.css to match the popup card. */}
              <Tooltip
                direction="auto"
                offset={[0, -6]}
                opacity={1}
                interactive
                className="trail-tooltip"
              >
                <TrailCard t={t} color={color} />
              </Tooltip>
              {/* Click/tap target (works on mobile where there's no hover). */}
              <Popup>
                <TrailCard t={t} color={color} />
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
