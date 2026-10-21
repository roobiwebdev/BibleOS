import { Skeleton } from "@starter/ui/components/skeleton";

export function OverviewSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in-0 duration-300">
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border/40 p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3.5 w-3.5" />
            </div>
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-2 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-border/40 p-3 flex items-center gap-3">
            <Skeleton className="h-3.5 w-3.5" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-2 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border border-border/40">
            <div className="px-4 py-3 border-b border-border/30">
              <Skeleton className="h-3 w-24" />
            </div>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="px-4 py-2.5 flex items-center gap-3 border-b border-border/20 last:border-0">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-32" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in-0 duration-300">
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-52" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-border/40 p-4 space-y-3">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-2 w-28" />
          </div>
        ))}
      </div>
      <div className="border border-border/40 p-4 space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-border/40 p-4 space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="border border-border/40 p-4 space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

export function UserTableSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="border border-border/30">
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border/20">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-10 ml-auto" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/10 last:border-0">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-36" />
            </div>
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-7" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GeneralSettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-7 w-24" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-border/40">
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2 w-40" />
            </div>
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2 w-36" />
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeatureTogglesSkeleton() {
  return (
    <div className="max-w-xl animate-in fade-in-0 duration-300">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="border border-border divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 p-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2 w-56" />
            </div>
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeedbackSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border border-border/40 p-3 space-y-2">
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-6 w-8" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="border border-border/40 divide-y divide-border/30">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3 flex items-start gap-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2.5 w-3/4" />
            </div>
            <Skeleton className="h-2 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApiKeysSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in-0 duration-300">
      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-52" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          {i < 3 && <Skeleton className="h-px w-full" />}
        </div>
      ))}
    </div>
  );
}

export function ProfileSettingsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="border border-border">
        <div className="p-5 border-b border-border space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-44" />
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountSettingsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="border border-border">
        <div className="p-5 border-b border-border space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
        <div className="p-5 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <div className="flex justify-end">
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      <div className="border border-border">
        <div className="p-5 border-b border-border space-y-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-52" />
        </div>
        <div className="p-5">
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    </div>
  );
}

export function InvitationsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-52" />
      </div>
      <div className="border border-border divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-40" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrganizationsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-44" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
            <Skeleton className="h-2 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in-0 duration-300">
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-52" />
      </div>
      <div className="border border-border">
        <div className="border-b border-border px-5 py-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-2.5 w-52 mt-1.5" />
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-8" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlogSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="border border-border/40">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-border/30 last:border-0">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-2 w-24" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function AuditLogSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="border border-border/30">
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border/20">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-24 ml-auto" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/10 last:border-0">
            <Skeleton className="h-3 w-20" />
            <div className="space-y-1.5 w-32">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-28" />
            </div>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
