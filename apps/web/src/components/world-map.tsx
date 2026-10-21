"use client";

import { useMemo, useState } from "react";
import { worldMapPaths } from "./world-map-paths";

type CountryData = {
  code: string;
  name: string;
  count: number;
};

function getIntensity(count: number, maxCount: number): number {
  if (maxCount === 0 || count === 0) return 0;
  return Math.max(0.2, Math.min(1, count / maxCount));
}

export function WorldMap({ countries }: { countries: CountryData[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const countryMap = useMemo(() => {
    const map = new Map<string, CountryData>();
    for (const c of countries) {
      map.set(c.code, c);
    }
    return map;
  }, [countries]);

  const maxCount = useMemo(() => Math.max(1, ...countries.map((c) => c.count)), [countries]);

  const totalUsers = useMemo(() => countries.reduce((sum, c) => sum + c.count, 0), [countries]);

  const hoveredCountry = hovered ? countryMap.get(hovered) : null;

  return (
    <div className="space-y-4">
      <div className="relative min-h-[200px] w-full" style={{ aspectRatio: "2/1" }}>
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-full"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltipPos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            {/* Dot pattern for inactive countries */}
            <pattern id="dotPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="4" r="0.8" className="fill-muted-foreground/35 dark:fill-muted-foreground/50" />
            </pattern>

            {/* Denser dot pattern for hovered inactive countries */}
            <pattern id="dotPatternHover" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="0.8" className="fill-muted-foreground/50 dark:fill-muted-foreground/65" />
            </pattern>

            {/* Active country pattern — crosshatch grid with glow */}
            <pattern id="activePattern" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="1" className="fill-primary/80" />
              <line x1="0" y1="3" x2="6" y2="3" className="stroke-primary/15" strokeWidth="0.3" />
              <line x1="3" y1="0" x2="3" y2="6" className="stroke-primary/15" strokeWidth="0.3" />
            </pattern>

            {/* Intense active country pattern */}
            <pattern id="activePatternIntense" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" className="fill-primary" />
              <line x1="0" y1="2" x2="4" y2="2" className="stroke-primary/25" strokeWidth="0.3" />
              <line x1="2" y1="0" x2="2" y2="4" className="stroke-primary/25" strokeWidth="0.3" />
            </pattern>

            {/* Grid lines for the background */}
            <pattern id="bgGrid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <line
                x1="50"
                y1="0"
                x2="50"
                y2="50"
                className="stroke-border/30 dark:stroke-border/50"
                strokeWidth="0.5"
              />
              <line
                x1="0"
                y1="50"
                x2="50"
                y2="50"
                className="stroke-border/30 dark:stroke-border/50"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          {/* Subtle grid background */}
          <rect width="1000" height="500" fill="url(#bgGrid)" />

          {worldMapPaths.map((path) => {
            const data = countryMap.get(path.id);
            const intensity = data ? getIntensity(data.count, maxCount) : 0;
            const isHovered = hovered === path.id;

            let fill: string;
            if (intensity >= 0.6) {
              fill = "url(#activePatternIntense)";
            } else if (intensity > 0) {
              fill = "url(#activePattern)";
            } else if (isHovered) {
              fill = "url(#dotPatternHover)";
            } else {
              fill = "url(#dotPattern)";
            }

            return (
              <path
                key={path.id}
                d={path.d}
                fill={fill}
                className={`transition-all duration-150 cursor-pointer ${
                  isHovered
                    ? "stroke-foreground/50 dark:stroke-foreground/70"
                    : intensity > 0
                      ? "stroke-primary/30 dark:stroke-primary/50"
                      : "stroke-muted-foreground/35 dark:stroke-muted-foreground/50"
                }`}
                strokeWidth={isHovered ? 1.2 : 0.4}
                onMouseEnter={() => setHovered(path.id)}
              />
            );
          })}
        </svg>

        {hoveredCountry && (
          <div
            className="absolute pointer-events-none bg-popover border border-border shadow-lg px-3 py-2 z-10"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y - 50}px`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="text-[10px] font-semibold">{hoveredCountry.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {hoveredCountry.count} user
              {hoveredCountry.count !== 1 ? "s" : ""} ·{" "}
              {totalUsers > 0 ? Math.round((hoveredCountry.count / totalUsers) * 100) : 0}%
            </p>
          </div>
        )}
      </div>

      {countries.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5">
          {countries.slice(0, 8).map((c) => (
            <div key={c.code} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0 bg-primary"
                  style={{
                    opacity: getIntensity(c.count, maxCount),
                  }}
                />
                <span className="text-[10px] text-muted-foreground truncate">{c.name}</span>
              </div>
              <span className="text-[10px] font-medium ml-2 shrink-0">{c.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/50 text-center">
          User locations will appear here as sessions are recorded
        </p>
      )}
    </div>
  );
}

export function MiniWorldMap({ countries }: { countries: { code: string; name: string; count: number }[] }) {
  const countrySet = useMemo(() => new Set(countries.map((c) => c.code)), [countries]);

  return (
    <div className="min-h-[120px] w-full" style={{ aspectRatio: "2/1" }}>
      <svg viewBox="0 0 1000 500" className="w-full h-full">
        {worldMapPaths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            className={
              countrySet.has(path.id)
                ? "fill-foreground/80 stroke-foreground/40 dark:fill-foreground/95 dark:stroke-foreground/60"
                : "fill-muted-foreground/25 stroke-muted-foreground/30 dark:fill-muted-foreground/35 dark:stroke-muted-foreground/45"
            }
            strokeWidth={0.5}
          />
        ))}
      </svg>
    </div>
  );
}
