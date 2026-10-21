"use client";

import { worldMapPaths } from "./world-map-paths";

const QUOTE = "The night is darkest just before the deploy.";

const FLOATING_DOTS = [
  { cx: 84.15, cy: 90.93, r: 1.58, delay: 5.64, duration: 15.42 },
  { cx: 14.99, cy: 31.1, r: 2.1, delay: 1.53, duration: 22.78 },
  { cx: 42.58, cy: 71.94, r: 1.32, delay: 7.35, duration: 12.11 },
  { cx: 65.73, cy: 8.49, r: 2.85, delay: 0.42, duration: 24.6 },
  { cx: 28.37, cy: 55.61, r: 1.05, delay: 4.18, duration: 18.33 },
  { cx: 91.42, cy: 44.23, r: 1.74, delay: 6.89, duration: 13.95 },
  { cx: 7.31, cy: 78.56, r: 2.43, delay: 2.66, duration: 21.07 },
  { cx: 53.89, cy: 16.71, r: 1.21, delay: 3.92, duration: 16.54 },
  { cx: 76.12, cy: 63.38, r: 2.67, delay: 0.88, duration: 19.82 },
  { cx: 38.45, cy: 95.14, r: 1.47, delay: 5.21, duration: 14.19 },
  { cx: 61.28, cy: 3.87, r: 2.93, delay: 7.74, duration: 23.46 },
  { cx: 19.56, cy: 49.62, r: 1.88, delay: 1.15, duration: 11.73 },
  { cx: 87.84, cy: 36.95, r: 1.05, delay: 4.55, duration: 21.58 },
  { cx: 48.69, cy: 82.41, r: 1.43, delay: 6.32, duration: 18.77 },
  { cx: 5.93, cy: 21.78, r: 2.56, delay: 3.47, duration: 15.04 },
  { cx: 72.47, cy: 58.13, r: 1.69, delay: 0.59, duration: 22.31 },
  { cx: 33.81, cy: 9.46, r: 2.24, delay: 5.98, duration: 13.58 },
  { cx: 95.15, cy: 73.29, r: 1.36, delay: 2.03, duration: 20.85 },
  { cx: 56.49, cy: 41.62, r: 2.78, delay: 7.11, duration: 16.12 },
  { cx: 11.83, cy: 86.95, r: 1.52, delay: 4.76, duration: 24.49 },
  { cx: 68.17, cy: 28.78, r: 2.01, delay: 1.84, duration: 12.76 },
  { cx: 24.51, cy: 64.11, r: 1.15, delay: 6.59, duration: 19.03 },
  { cx: 80.85, cy: 51.44, r: 2.34, delay: 3.22, duration: 15.3 },
  { cx: 30.07, cy: 37.71, r: 1.53, delay: 7.52, duration: 24.49 },
];

const GRID_NODES = [
  { cx: 32.47, cy: 58.92, delay: 1.23 },
  { cx: 71.83, cy: 24.16, delay: 4.56 },
  { cx: 18.29, cy: 81.47, delay: 2.89 },
  { cx: 55.64, cy: 43.71, delay: 0.67 },
  { cx: 84.91, cy: 67.33, delay: 3.45 },
  { cx: 43.16, cy: 12.58, delay: 5.12 },
  { cx: 67.52, cy: 89.24, delay: 1.78 },
  { cx: 26.38, cy: 35.69, delay: 4.01 },
  { cx: 91.74, cy: 52.13, delay: 2.34 },
  { cx: 14.59, cy: 71.86, delay: 5.67 },
  { cx: 58.95, cy: 18.41, delay: 0.45 },
  { cx: 37.21, cy: 63.57, delay: 3.89 },
  { cx: 79.46, cy: 46.82, delay: 1.56 },
  { cx: 22.72, cy: 28.15, delay: 4.78 },
  { cx: 63.98, cy: 75.49, delay: 2.12 },
  { cx: 48.23, cy: 91.83, delay: 5.34 },
  { cx: 86.49, cy: 33.16, delay: 0.89 },
  { cx: 75.73, cy: 58.52, delay: 3.23 },
];

const CONNECTION_LINES = [
  { x1: 32.47, y1: 58.92, x2: 37.21, y2: 63.57, delay: 1.23 },
  { x1: 55.64, y1: 43.71, x2: 58.95, y2: 18.41, delay: 0.45 },
  { x1: 84.91, y1: 67.33, x2: 75.73, y2: 58.52, delay: 3.23 },
  { x1: 84.91, y1: 67.33, x2: 79.46, y2: 46.82, delay: 1.56 },
  { x1: 26.38, y1: 35.69, x2: 22.72, y2: 28.15, delay: 4.01 },
  { x1: 26.38, y1: 35.69, x2: 32.47, y2: 58.92, delay: 1.23 },
  { x1: 14.59, y1: 71.86, x2: 18.29, y2: 81.47, delay: 2.89 },
  { x1: 37.21, y1: 63.57, x2: 32.47, y2: 58.92, delay: 1.23 },
  { x1: 79.46, y1: 46.82, x2: 75.73, y2: 58.52, delay: 1.56 },
  { x1: 79.46, y1: 46.82, x2: 91.74, y2: 52.13, delay: 1.56 },
  { x1: 63.98, y1: 75.49, x2: 67.52, y2: 89.24, delay: 1.78 },
  { x1: 48.23, y1: 91.83, x2: 43.16, y2: 12.58, delay: 5.12 },
  { x1: 86.49, y1: 33.16, x2: 91.74, y2: 52.13, delay: 0.89 },
  { x1: 71.83, y1: 24.16, x2: 86.49, y2: 33.16, delay: 0.89 },
  { x1: 55.64, y1: 43.71, x2: 48.23, y2: 91.83, delay: 0.67 },
];

/**
 * SOURCE OF TRUTH KEYWORDS: AuthVisual, auth side panel, world map, decorative visual, login visual
 * WHAT:  Decorative animated world-map panel shown beside the auth and onboarding forms.
 * WHERE: app/(auth)/layout.tsx, app/onboarding/layout.tsx, pricing layout.
 */
export function AuthVisual() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-foreground/2 dark:bg-foreground/4">
      {/* Base grid pattern */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="authGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.5" className="fill-foreground/10 dark:fill-foreground/22" />
          </pattern>
          <pattern id="authGridLarge" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
            <line
              x1="120"
              y1="0"
              x2="120"
              y2="120"
              className="stroke-foreground/8 dark:stroke-foreground/22"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="120"
              x2="120"
              y2="120"
              className="stroke-foreground/8 dark:stroke-foreground/22"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#authGridLarge)" />
        <rect width="100%" height="100%" fill="url(#authGrid)" />
      </svg>

      {/* Animated world map — slowly drifting */}
      <div className="absolute inset-0 flex items-center justify-center auth-map-drift">
        <svg viewBox="0 0 1000 500" className="w-[140%] h-auto opacity-100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="authDot" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="0.9" className="fill-foreground/30 dark:fill-foreground/55" />
            </pattern>
            <pattern id="authDotActive" x="0" y="0" width="4.5" height="4.5" patternUnits="userSpaceOnUse">
              <circle cx="2.25" cy="2.25" r="1.1" className="fill-foreground/60 dark:fill-foreground/85" />
              <line
                x1="0"
                y1="2.25"
                x2="4.5"
                y2="2.25"
                className="stroke-foreground/15 dark:stroke-foreground/35"
                strokeWidth="0.3"
              />
              <line
                x1="2.25"
                y1="0"
                x2="2.25"
                y2="4.5"
                className="stroke-foreground/15 dark:stroke-foreground/35"
                strokeWidth="0.3"
              />
            </pattern>
          </defs>
          {worldMapPaths.map((path, i) => {
            const isHighlighted = i % 7 === 0 || i % 11 === 0;
            return (
              <path
                key={path.id}
                d={path.d}
                fill={isHighlighted ? "url(#authDotActive)" : "url(#authDot)"}
                className={
                  isHighlighted
                    ? "stroke-foreground/25 dark:stroke-foreground/45"
                    : "stroke-foreground/10 dark:stroke-foreground/25"
                }
                strokeWidth={0.4}
              />
            );
          })}
        </svg>
      </div>

      {/* Network constellation — nodes and connections */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {CONNECTION_LINES.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className="stroke-foreground/15 dark:stroke-foreground/35 auth-line-pulse"
            strokeWidth="0.15"
            style={{ animationDelay: `${line.delay}s` }}
          />
        ))}
        {GRID_NODES.map((node, i) => (
          <circle
            key={i}
            cx={node.cx}
            cy={node.cy}
            r="0.4"
            className="fill-foreground/30 dark:fill-foreground/55 auth-node-pulse"
            style={{ animationDelay: `${node.delay}s` }}
          />
        ))}
      </svg>

      {/* Floating particles */}
      <svg className="absolute inset-0 w-full h-full">
        {FLOATING_DOTS.map((dot, i) => (
          <circle
            key={i}
            cx={dot.cx}
            cy={dot.cy}
            r={dot.r}
            className="fill-foreground/15 dark:fill-foreground/35 auth-float"
            style={{
              animationDelay: `${dot.delay}s`,
              animationDuration: `${dot.duration}s`,
            }}
          />
        ))}
      </svg>

      {/* Radial gradient overlays for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,var(--foreground)/0.03,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,var(--foreground)/0.02,transparent_50%)]" />

      {/* Edge fades */}
      <div className="absolute inset-y-0 left-0 w-16 bg-linear-to-r from-background to-transparent" />
      <div className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-background to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background to-transparent" />

      {/* Quote at bottom */}
      <div className="absolute bottom-8 left-8 right-8">
        <p className="text-[10px] font-mono text-foreground/35 dark:text-foreground/60 italic leading-relaxed">
          &ldquo;{QUOTE}&rdquo;
        </p>
      </div>

      {/* Bat logo watermark */}
      <div className="absolute top-8 right-8">
        <svg viewBox="0 0 100 40" fill="currentColor" className="h-5 w-auto text-foreground/15 dark:text-foreground/35">
          <path d="M50 0C50 0 42 14 30 18C18 22 0 18 0 18C0 18 12 28 20 32C28 36 50 40 50 40C50 40 72 36 80 32C88 28 100 18 100 18C100 18 82 22 70 18C58 14 50 0 50 0Z" />
        </svg>
      </div>
    </div>
  );
}
