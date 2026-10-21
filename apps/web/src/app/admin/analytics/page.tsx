"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, Activity, UserPlus, CheckCircle, Building2, Bell, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getAnalytics } from "@/lib/actions/admin";
import { AnalyticsSkeleton } from "@/components/skeletons";
import { WorldMap } from "@/components/world-map";

type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

const MONO = {
  solid: "var(--foreground)",
  medium: "color-mix(in oklch, var(--foreground) 55%, transparent)",
  light: "color-mix(in oklch, var(--foreground) 30%, transparent)",
  faint: "color-mix(in oklch, var(--foreground) 15%, transparent)",
};

/* ─── Reusable components ─────────────────────────────────── */

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/40 bg-card/50">
      <div className="px-5 py-3 border-b border-border/30">
        <h3 className="text-xs font-semibold">{title}</h3>
        {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border shadow-lg px-3 py-2">
      <p className="text-[10px] font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[10px] text-muted-foreground capitalize">{p.name}:</span>
          <span className="text-[10px] font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function RingGauge({
  value,
  label,
  sub,
  icon: Icon,
}: {
  value: number;
  label: string;
  sub: string;
  icon: React.ElementType;
}) {
  const radius = 36;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const filled = (value / 100) * circumference;
  const size = (radius + stroke) * 2;

  return (
    <div className="border border-border/40 bg-card/50 p-4 flex items-center gap-4">
      <div className="shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            fill="none"
            className="stroke-border/40"
            strokeWidth={stroke}
          />
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            fill="none"
            className="stroke-foreground transition-all duration-700"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            strokeLinecap="butt"
          />
        </svg>
        <div className="flex items-center justify-center -mt-[100%]" style={{ width: size, height: size }}>
          <span className="text-sm font-bold">{value}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Icon className="h-3 w-3 text-muted-foreground/50" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
        </div>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const h = 24;
  const w = 56;
  const step = w / Math.max(data.length - 1, 1);

  const points = data.map((v, i) => ({
    x: i * step,
    y: h - (v / max) * (h - 2) - 1,
  }));

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const last = points.at(-1);

  return (
    <svg width={w} height={h} className={className} viewBox={`0 0 ${w} ${h}`}>
      <path
        d={line}
        fill="none"
        className="stroke-foreground/50"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last && <circle cx={last.x} cy={last.y} r={2} className="fill-foreground" />}
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  sparkData,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "flat";
  sparkData?: number[];
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-foreground" : trend === "down" ? "text-muted-foreground/60" : "text-muted-foreground/30";

  return (
    <div className="border border-border/40 bg-card/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
      <div className="flex items-end justify-between">
        <div className="flex items-end gap-2">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trend && <TrendIcon className={`h-3.5 w-3.5 mb-1 ${trendColor}`} />}
        </div>
        {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} className="mb-1" />}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function HorizontalBar({ label, count, total, shade }: { label: string; count: number; total: number; shade: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">
          {count} · {Math.round(pct)}%
        </span>
      </div>
      <div className="h-2 bg-border/30 w-full">
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: shade }} />
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <AnalyticsSkeleton />;

  const { overview, dailyData, weeklySignups, weeklyActive, authProviders, countries, organizations } = data;

  const signupTrend: "up" | "down" | "flat" =
    overview.usersLast7d > overview.usersLast30d / 4
      ? "up"
      : overview.usersLast7d < overview.usersLast30d / 4
        ? "down"
        : "flat";

  const authTotal = authProviders.reduce((sum, p) => sum + p.count, 0);

  const barShades = [
    MONO.solid,
    MONO.medium,
    MONO.light,
    MONO.faint,
    "color-mix(in oklch, var(--foreground) 8%, transparent)",
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">The metrics that matter — last 30 days.</p>
      </div>

      {/* Row 1: Key numbers with sparklines */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Users"
          value={overview.totalUsers}
          sub={`+${overview.usersLast30d} in 30d`}
          icon={Users}
          trend={signupTrend}
          sparkData={weeklySignups}
        />
        <StatCard
          label="Active Today"
          value={overview.dailyActiveUsers}
          sub={`${overview.weeklyActiveUsers} this week`}
          icon={Activity}
          trend={overview.dailyActiveUsers > 0 ? "up" : overview.totalUsers > 0 ? "down" : "flat"}
          sparkData={weeklyActive}
        />
        <StatCard
          label="New This Week"
          value={`+${overview.usersLast7d}`}
          sub={`${overview.usersLast30d} in 30 days`}
          icon={UserPlus}
          trend={signupTrend}
        />
        <StatCard
          label="Organizations"
          value={organizations.totalOrgs}
          sub={`${organizations.avgMembersPerOrg} avg per org`}
          icon={Building2}
        />
      </div>

      {/* Row 2: Ring gauges for rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RingGauge
          value={overview.onboardingRate}
          label="Onboarding"
          sub={`${overview.onboardedUsers} of ${overview.totalUsers} users completed onboarding`}
          icon={CheckCircle}
        />
        <RingGauge
          value={overview.notificationReadRate}
          label="Notification Read Rate"
          sub="Percentage of delivered notifications that were read"
          icon={Bell}
        />
      </div>

      {/* Row 3: Growth & engagement area chart with cumulative line */}
      <ChartCard
        title="Growth & Engagement"
        description="Daily signups, active users, and cumulative total over 30 days"
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.3} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "currentColor" }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
                interval={Math.floor(dailyData.length / 7)}
              />
              <YAxis
                yAxisId="daily"
                tick={{ fontSize: 9, fill: "currentColor" }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="cumulative"
                orientation="right"
                tick={{ fontSize: 9, fill: "currentColor" }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="daily"
                type="monotone"
                dataKey="signups"
                stroke={MONO.solid}
                fill="url(#signupGrad)"
                strokeWidth={1.5}
                name="Signups"
              />
              <Area
                yAxisId="daily"
                type="monotone"
                dataKey="activeUsers"
                stroke={MONO.medium}
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                name="Active Users"
              />
              <Area
                yAxisId="cumulative"
                type="monotone"
                dataKey="totalUsers"
                stroke={MONO.light}
                fill="none"
                strokeWidth={1}
                strokeDasharray="2 2"
                name="Total Users"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-5 mt-3 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-px bg-foreground" />
            <span className="text-[10px] text-muted-foreground">Signups</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-px bg-foreground/55 border-t border-dashed border-foreground/55" />
            <span className="text-[10px] text-muted-foreground">Active Users</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-px bg-foreground/30 border-t border-dotted border-foreground/30" />
            <span className="text-[10px] text-muted-foreground">Total (right axis)</span>
          </div>
        </div>
      </ChartCard>

      {/* Row 4: Weekly signups bar chart + Signup methods side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ChartCard title="Weekly Signups" description="New user registrations per week">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklySignups.map((v, i) => ({
                  week: `W${i + 1}`,
                  signups: v,
                }))}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border"
                  opacity={0.3}
                  horizontal
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 9, fill: "currentColor" }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "currentColor" }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="signups" fill={MONO.solid} name="Signups" radius={[0, 0, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Signup Methods" description="How users create their accounts">
          {authProviders.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No account data yet</p>
          ) : (
            <div className="space-y-3 py-2">
              {authProviders.map((p, i) => (
                <HorizontalBar
                  key={p.provider}
                  label={p.provider}
                  count={p.count}
                  total={authTotal}
                  shade={barShades[i % barShades.length] ?? MONO.faint}
                />
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 5: World map */}
      <ChartCard
        title="Where Your Users Are"
        description="Geographic distribution based on session IP addresses (last 30 days)"
      >
        <WorldMap countries={countries} />
      </ChartCard>
    </div>
  );
}
