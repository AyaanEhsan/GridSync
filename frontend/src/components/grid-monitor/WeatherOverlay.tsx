"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion } from "motion/react";
import { useGridStore } from "@/stores/gridStore";

function describeWind(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round((deg % 360) / 45) % 8;
  return dirs[idx];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getTempGradient(tempF: number): string {
  if (tempF <= 45)
    return "linear-gradient(135deg, rgba(59,130,246,0.32), rgba(14,165,233,0.2))";
  if (tempF <= 80)
    return "linear-gradient(135deg, rgba(251,191,36,0.26), rgba(245,158,11,0.18))";
  return "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(251,146,60,0.2))";
}

function getBeaufort(speedMs: number): string {
  const kph = speedMs * 3.6;
  if (kph < 1) return "Bft 0 Calm";
  if (kph < 6) return "Bft 1 Light Air";
  if (kph < 12) return "Bft 2 Light Breeze";
  if (kph < 20) return "Bft 3 Gentle Breeze";
  if (kph < 29) return "Bft 4 Moderate Breeze";
  if (kph < 39) return "Bft 5 Fresh Breeze";
  if (kph < 50) return "Bft 6 Strong Breeze";
  if (kph < 62) return "Bft 7 Near Gale";
  if (kph < 75) return "Bft 8 Gale";
  if (kph < 89) return "Bft 9 Strong Gale";
  if (kph < 103) return "Bft 10 Storm";
  if (kph < 118) return "Bft 11 Violent Storm";
  return "Bft 12 Hurricane";
}

function getSolarLabel(solar: number): "Night" | "Cloudy" | "Sunny" {
  if (solar < 30) return "Night";
  if (solar < 350) return "Cloudy";
  return "Sunny";
}

function getRainSeverity(mm: number): "None" | "Light" | "Moderate" | "Heavy" {
  if (mm <= 0) return "None";
  if (mm < 2.5) return "Light";
  if (mm < 7.6) return "Moderate";
  return "Heavy";
}

function getRelativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "updated recently";
  const deltaMinutes = Math.max(
    0,
    Math.round((Date.now() - timestamp) / 60000),
  );
  if (deltaMinutes < 1) return "updated just now";
  if (deltaMinutes === 1) return "updated 1 min ago";
  return `updated ${deltaMinutes} min ago`;
}

function getChicagoHour(iso: string): number | null {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")
    ?.value;
  if (!hourPart) return null;
  const hour = Number(hourPart);
  return Number.isFinite(hour) ? hour : null;
}

function formatChicagoTimestamp(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Invalid timestamp";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(date);

  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value ?? "";
  const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  return `${month} ${day} ${hour}:${minute} ${dayPeriod} ${zone}`.trim();
}

function CountUp({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (!Number.isFinite(value)) {
      setDisplayValue(0);
      return;
    }
    let frameId = 0;
    const start = performance.now();
    const startValue = displayValue;
    const duration = 700;
    const step = (now: number) => {
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startValue + (value - startValue) * eased;
      setDisplayValue(next);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <>{displayValue.toFixed(decimals)}</>;
}

function Tile({
  title,
  children,
  className = "",
  style,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-(--border-subtle) bg-[color-mix(in_srgb,var(--bg-elevated)_76%,transparent)] h-full min-h-0 overflow-hidden flex flex-col ${compact ? "p-2" : "p-3"} ${className}`}
      style={style}
    >
      <div
        className={`font-mono uppercase tracking-widest text-muted-foreground shrink-0 ${compact ? "text-[8px] mb-1" : "text-[9px] mb-2"}`}
      >
        {title}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

export default function WeatherOverlay() {
  const weather = useGridStore((s) => s.weather);
  const formattedTimestamp = weather
    ? formatChicagoTimestamp(weather.timestamp_utc)
    : "Loading timestamp";

  if (!weather) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-xs">
        Loading weather…
      </div>
    );
  }

  const tempF = (weather.temperature_c * 9) / 5 + 32;
  const windMph = weather.wind_speed_ms * 2.237;
  const windDir = clamp(weather.wind_direction_deg % 360, 0, 360);
  const solar = clamp(weather.solar_irradiance_wm2, 0, 1000);
  const precipitation = Math.max(0, weather.precipitation_mm);
  const solarLabel = getSolarLabel(solar);
  const rainSeverity = getRainSeverity(precipitation);
  const rainBadgeColor =
    rainSeverity === "Heavy"
      ? "var(--accent-danger)"
      : rainSeverity === "Moderate"
        ? "var(--accent-amber)"
        : rainSeverity === "Light"
          ? "var(--accent-cyan)"
          : "var(--text-secondary)";
  const hour = getChicagoHour(weather.timestamp_utc) ?? 12;
  const isDay = hour >= 6 && hour < 18;
  const gaugeRadius = 42;
  const gaugeArc = Math.PI * gaugeRadius;
  const dashOffset = gaugeArc * (1 - solar / 1000);

  return (
    <div
      className="w-full h-full min-h-0 p-3 grid grid-cols-12 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3"
      aria-label="Live weather"
    >
      <Tile
        title="Temperature"
        className="col-span-4 row-span-2"
        style={{ backgroundImage: getTempGradient(tempF) }}
      >
        <div className="h-full flex flex-col justify-between">
          <div className="font-mono text-4xl leading-none font-semibold text-(--text-primary)">
            <CountUp value={tempF} decimals={0} />
            <span className="text-2xl align-top">F</span>
          </div>
          <div className="font-mono text-xs text-(--text-secondary)">
            {weather.temperature_c.toFixed(1)}C
          </div>
        </div>
      </Tile>

      <Tile title="Wind" className="col-span-4 row-span-2">
        <div className="h-full flex items-center justify-between gap-3">
          <div className="w-24 h-24 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="1.5"
              />
              <line
                x1="50"
                y1="8"
                x2="50"
                y2="18"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
              />
              <line
                x1="92"
                y1="50"
                x2="82"
                y2="50"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
              />
              <line
                x1="50"
                y1="92"
                x2="50"
                y2="82"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
              />
              <line
                x1="8"
                y1="50"
                x2="18"
                y2="50"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
              />
              <text
                x="50"
                y="12"
                textAnchor="middle"
                fontSize="8"
                fill="var(--text-muted)"
              >
                N
              </text>
              <text
                x="88"
                y="53"
                textAnchor="middle"
                fontSize="8"
                fill="var(--text-muted)"
              >
                E
              </text>
              <text
                x="50"
                y="93"
                textAnchor="middle"
                fontSize="8"
                fill="var(--text-muted)"
              >
                S
              </text>
              <text
                x="12"
                y="53"
                textAnchor="middle"
                fontSize="8"
                fill="var(--text-muted)"
              >
                W
              </text>
              <motion.g
                animate={{ rotate: windDir }}
                style={{ originX: "50%", originY: "50%" }}
                transition={{ type: "spring", stiffness: 120, damping: 15 }}
              >
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="18"
                  stroke="var(--accent-cyan)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <polygon points="50,13 45,21 55,21" fill="var(--accent-cyan)" />
              </motion.g>
            </svg>
          </div>
          <div className="font-mono flex-1">
            <div className="text-2xl font-semibold text-(--text-primary)">
              <CountUp value={windMph} decimals={0} /> mph
            </div>
            <div className="text-xs text-(--text-secondary) mt-1">
              {describeWind(windDir)} at {windDir.toFixed(0)}deg
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              {getBeaufort(weather.wind_speed_ms)}
            </div>
          </div>
        </div>
      </Tile>

      <Tile title="Solar" className="col-span-2 row-span-1" compact>
        <div className="h-full min-h-0 overflow-hidden flex flex-col items-center justify-center gap-0.5">
          <svg viewBox="0 0 120 70" className="w-full max-w-[120px] h-8 shrink-0">
            <path
              d="M18 60 A42 42 0 0 1 102 60"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <motion.path
              d="M18 60 A42 42 0 0 1 102 60"
              fill="none"
              stroke="var(--accent-amber)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={gaugeArc}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </svg>
          <div className="font-mono text-xs text-(--text-primary) leading-tight text-center">
            <CountUp value={solar} decimals={0} /> W/m2
          </div>
          <div className="font-mono text-[9px] text-muted-foreground leading-tight truncate max-w-full">
            {solarLabel}
          </div>
        </div>
      </Tile>

      <Tile title="Rain" className="col-span-2 row-span-1" compact>
        {precipitation > 0 ? (
          <div className="h-full min-h-0 overflow-hidden flex flex-col justify-between gap-0.5">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="inline-block w-1.5 h-3 rounded-full bg-(--accent-cyan)"
                  animate={{ y: [0, 6, 0], opacity: [0.9, 0.5, 0.9] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: i * 0.12,
                  }}
                />
              ))}
            </div>
            <div className="font-mono text-xs text-(--text-primary) leading-tight">
              {precipitation.toFixed(1)} mm
            </div>
            <span
              className="inline-flex px-1.5 py-0.5 rounded-full font-mono text-[9px] border border-(--border-subtle) w-fit"
              style={{ color: rainBadgeColor }}
            >
              {rainSeverity}
            </span>
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-hidden flex flex-col justify-center">
            <div className="font-mono text-xs text-(--text-primary) leading-tight">
              No Rain
            </div>
            <div className="font-mono text-[9px] text-muted-foreground leading-tight truncate">
              Skies are calm right now.
            </div>
          </div>
        )}
      </Tile>

      <Tile title="Timestamp" className="col-span-4 row-span-1" compact>
        <div className="h-full min-h-0 overflow-hidden flex items-center justify-between gap-2">
          <div className="min-w-0 overflow-hidden">
            <div className="font-mono text-[11px] text-(--text-primary) truncate">
              {formattedTimestamp}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground mt-0.5 truncate">
              {getRelativeTime(weather.timestamp_utc)} - Open-Meteo
            </div>
          </div>
          <div className="w-6 h-6 shrink-0">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              {isDay ? (
                <>
                  <circle cx="12" cy="12" r="4" fill="var(--accent-amber)" />
                  <line
                    x1="12"
                    y1="2.5"
                    x2="12"
                    y2="5.5"
                    stroke="var(--accent-amber)"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="12"
                    y1="18.5"
                    x2="12"
                    y2="21.5"
                    stroke="var(--accent-amber)"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="2.5"
                    y1="12"
                    x2="5.5"
                    y2="12"
                    stroke="var(--accent-amber)"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="18.5"
                    y1="12"
                    x2="21.5"
                    y2="12"
                    stroke="var(--accent-amber)"
                    strokeWidth="1.5"
                  />
                </>
              ) : (
                <>
                  <path
                    d="M15.8 4.8a7 7 0 1 0 3.4 12.7A8 8 0 1 1 15.8 4.8Z"
                    fill="var(--accent-cyan)"
                  />
                  <circle cx="17.8" cy="6.2" r="0.9" fill="var(--text-muted)" />
                </>
              )}
            </svg>
          </div>
        </div>
      </Tile>
    </div>
  );
}
