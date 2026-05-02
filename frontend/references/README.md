# Grid Dashboard — API Reference & Setup

## Data sources

| Data                        | Source                 | Auth                 |
| --------------------------- | ---------------------- | -------------------- |
| Load, fuel mix, LMP pricing | GridStatus.io REST API | `GRIDSTATUS_API_KEY` |
| Weather                     | Open-Meteo             | None                 |

---

## Env vars (.env.local)ok

```bash
GRIDSTATUS_API_KEY=   # sign up free at https://www.gridstatus.io → Settings
```

> **Free tier**: 1 million rows/month. Always pass `limit` on every request — real-time LMP data is row-heavy and will exhaust the quota fast without it.

---

## Architecture

Never call GridStatus from the browser — the API key must stay server-side. The pattern is:

```
Client (React)  →  /app/api/grid/route.ts  →  GridStatus + Open-Meteo
```

The route fans out all fetches in parallel with `Promise.all`, waits for all of them, then returns a single `DashboardSnapshot` response.

---

## Base URL & auth helper

```ts
// lib/gridstatus.ts

const BASE = "https://api.gridstatus.io/v1/datasets";

export async function gs<T>(
  dataset: string,
  params: Record<string, string>,
): Promise<T[]> {
  const url = new URL(`${BASE}/${dataset}/query`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": process.env.GRIDSTATUS_API_KEY! },
    next: { revalidate: 300 }, // Next.js cache — 5 min
  });

  if (!res.ok) throw new Error(`GridStatus [${dataset}] ${res.status}`);
  const json = await res.json();
  return json.data as T[];
}
```

---

## API route — all fetches in parallel

All six upstream calls fire simultaneously. Total latency is the slowest single call, not their sum.

```ts
// app/api/grid/route.ts
import { gs } from "@/lib/gridstatus";

export async function GET() {
  const [load, fuelMix, ercotLMPRt, ercotLMPDa, pjmLMPRt, pjmLMPDa, weather] =
    await Promise.all([
      fetchLoad(),
      fetchFuelMix(),
      fetchERCOTLMPRealtime(),
      fetchERCOTLMPDayAhead(),
      fetchPJMLMPRealtime(),
      fetchPJMLMPDayAhead(),
      fetchWeather(),
    ]);

  return Response.json({
    realtime: { ...load, ...fuelMix },
    pricing: {
      ercot: { realtime: ercotLMPRt, day_ahead: ercotLMPDa },
      pjm: { realtime: pjmLMPRt, day_ahead: pjmLMPDa },
    },
    weather,
  });
}
```

---

## Individual fetchers

Each function is `async` and independently awaitable — they're only called together via `Promise.all` above.

### Load — `ercot_load`

```ts
async function fetchLoad() {
  const rows = await gs<{
    interval_start_utc: string;
    interval_end_utc: string;
    load: number;
  }>("ercot_load", { time: "latest", limit: "1" });

  return rows[0];
  // { interval_start_utc, interval_end_utc, load }
}
```

### Fuel mix — `ercot_fuel_mix`

```ts
async function fetchFuelMix() {
  const rows = await gs<{
    interval_start_utc: string;
    natural_gas: number;
    coal: number;
    nuclear: number;
    wind: number;
    solar: number;
    hydro: number;
    other: number;
  }>("ercot_fuel_mix", { time: "latest", limit: "1" });

  return rows[0];
  // { interval_start_utc, natural_gas, coal, nuclear, wind, solar, hydro, other }
  // all values in MW
}
```

### ERCOT LMP — real-time

```ts
async function fetchERCOTLMPRealtime() {
  const rows = await gs<{
    interval_start_utc: string;
    location: string;
    location_type: string;
    lmp: number;
    energy: number;
    congestion: number;
    loss: number; // always 0 — ERCOT doesn't publish loss
  }>("ercot_lmp_by_settlement_point", {
    time: "latest",
    filter_column: "location",
    filter_value: "HB_NORTH", // options: HB_NORTH, HB_HOUSTON, HB_WEST, HB_SOUTH
    limit: "1",
  });

  return rows[0];
}
```

### ERCOT LMP — day-ahead

```ts
async function fetchERCOTLMPDayAhead() {
  const rows = await gs<{
    interval_start_utc: string;
    location: string;
    lmp: number;
  }>("ercot_spp_day_ahead_hourly", {
    time: "latest",
    filter_column: "location",
    filter_value: "HB_NORTH",
    limit: "24",
  });

  return rows; // 24 hourly rows for the next operating day
}
```

### PJM LMP — real-time

```ts
async function fetchPJMLMPRealtime() {
  const rows = await gs<{
    interval_start_utc: string;
    location: string;
    location_type: string;
    lmp: number;
    energy: number;
    congestion: number;
    loss: number;
  }>("pjm_lmp_real_time_5_min", {
    time: "latest",
    filter_column: "location",
    filter_value: "PJM RTO",
    limit: "1",
  });

  return rows[0];
}
```

### PJM LMP — day-ahead

```ts
async function fetchPJMLMPDayAhead() {
  const rows = await gs<{
    interval_start_utc: string;
    location: string;
    lmp: number;
    energy: number;
    congestion: number;
    loss: number;
  }>("pjm_lmp_day_ahead_hourly", {
    time: "latest",
    filter_column: "location",
    filter_value: "PJM RTO",
    limit: "24",
  });

  return rows; // 24 hourly rows for the next operating day
}
```

### Weather — Open-Meteo

```ts
async function fetchWeather() {
  // Adjust lat/lon for your target location (below: Austin, TX)
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=30.27&longitude=-97.74" +
    "&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,direct_normal_irradiance,precipitation" +
    "&wind_speed_unit=ms" + // returns m/s — matches DashboardSnapshot.wind_speed_ms
    "&forecast_days=1";

  const res = await fetch(url, { next: { revalidate: 1800 } }); // cache 30 min
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

  const json = await res.json();

  // Return only the current hour's slice
  const now = new Date();
  const currentHour = now.getUTCHours();

  return {
    timestamp_utc: json.hourly.time[currentHour],
    temperature_c: json.hourly.temperature_2m[currentHour],
    wind_speed_ms: json.hourly.wind_speed_10m[currentHour],
    wind_direction_deg: json.hourly.wind_direction_10m[currentHour],
    solar_irradiance_wm2: json.hourly.direct_normal_irradiance[currentHour],
    precipitation_mm: json.hourly.precipitation[currentHour],
  };
}
```

> **Wind speed**: `wind_speed_unit=ms` is required. Without it, Open-Meteo defaults to km/h, which won't match the `wind_speed_ms` field in `DashboardSnapshot`.

---

## Error handling

Wrap the `Promise.all` in a try/catch in the route handler so one failing upstream call doesn't crash the whole response:

```ts
export async function GET() {
  try {
    const [load, fuelMix, ercotLMPRt, ercotLMPDa, pjmLMPRt, pjmLMPDa, weather] =
      await Promise.all([
        fetchLoad(),
        fetchFuelMix(),
        fetchERCOTLMPRealtime(),
        fetchERCOTLMPDayAhead(),
        fetchPJMLMPRealtime(),
        fetchPJMLMPDayAhead(),
        fetchWeather(),
      ]);

    return Response.json({
      realtime: { ...load, ...fuelMix },
      pricing: {
        ercot: { realtime: ercotLMPRt, day_ahead: ercotLMPDa },
        pjm: { realtime: pjmLMPRt, day_ahead: pjmLMPDa },
      },
      weather,
    });
  } catch (err) {
    console.error("[grid/route]", err);
    return Response.json({ error: "upstream fetch failed" }, { status: 502 });
  }
}
```

If you want partial failures to be tolerated rather than fatal, swap `Promise.all` for `Promise.allSettled` and handle each result individually:

```ts
const results = await Promise.allSettled([
  fetchLoad(),
  fetchFuelMix(),
  // ...
]);

const [load, fuelMix, ...] = results.map((r) =>
  r.status === "fulfilled" ? r.value : null,
);
```

---

## Client-side polling (React hook)

```ts
// hooks/useGridDashboard.ts
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useGridDashboard() {
  const { data, error, isLoading } = useSWR("/api/grid", fetcher, {
    refreshInterval: 300_000, // re-poll every 5 min
  });

  return {
    snapshot: data ?? null,
    isLoading,
    isError: !!error,
  };
}
```

---

## File structure

```
app/
└── api/
    └── grid/
        └── route.ts        ← parallel fetches, returns DashboardSnapshot
lib/
└── gridstatus.ts           ← gs() helper
hooks/
└── useGridDashboard.ts     ← SWR polling hook
```

---

## Known limitations

| Topic                | Detail                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| ERCOT frequency      | Not in any public ERCOT feed. Hardcode `60.0` in normal mode; use mock for incident simulation. |
| ERCOT LMP loss       | Always `0` — ERCOT doesn't publish loss components.                                             |
| Open-Meteo wind      | Must include `&wind_speed_unit=ms`. Default is km/h.                                            |
| GridStatus free tier | 1M rows/month. Always pass `limit`. LMP data for all nodes is very large — filter by location.  |
