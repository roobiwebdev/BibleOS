"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Mail, Type, ToggleLeft, Users, Timer } from "lucide-react";
import { getWaitlistEntries } from "@/lib/actions/admin";
import { getAdminSettings, updateAppSettings } from "@/lib/actions/settings";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Textarea } from "@starter/ui/components/textarea";
import { Switch } from "@starter/ui/components/switch";
import { GeneralSettingsSkeleton } from "@/components/skeletons";

type WaitlistSettings = {
  waitlistMode: boolean;
  waitlistTitle: string;
  waitlistHeadline: string;
  waitlistDescription: string;
  waitlistButtonText: string;
  waitlistSuccessMessage: string;
  waitlistShowName: boolean;
  waitlistShowCompany: boolean;
};

type CountdownSettings = {
  countdownMode: boolean;
  countdownTarget: string; // YYYY-MM-DDTHH:mm for datetime-local
  countdownTitle: string;
  countdownHeadline: string;
  countdownDescription: string;
  countdownEndMessage: string;
};

/** Formats a date for a datetime-local input in the browser's own time zone. */
function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/40 bg-card/50">
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
        <div>
          <p className="text-xs font-semibold">{title}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 items-start">
      <div className="pt-1.5">
        <Label className="text-[11px] font-medium">{label}</Label>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-[11px] font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function AdminSiteSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof getWaitlistEntries>>>([]);
  const [s, setS] = useState<WaitlistSettings>({
    waitlistMode: false,
    waitlistTitle: "Join the waitlist",
    waitlistHeadline: "Be the first to know when we launch",
    waitlistDescription: "",
    waitlistButtonText: "Join waitlist",
    waitlistSuccessMessage: "You're on the list! We'll notify you when we launch.",
    waitlistShowName: false,
    waitlistShowCompany: false,
  });
  const [c, setC] = useState<CountdownSettings>({
    countdownMode: false,
    countdownTarget: "",
    countdownTitle: "Coming soon",
    countdownHeadline: "We're launching soon",
    countdownDescription: "",
    countdownEndMessage: "We're live! Check back soon.",
  });

  useEffect(() => {
    Promise.all([getAdminSettings(), getWaitlistEntries()])
      .then(([d, list]) => {
        setS({
          waitlistMode: d.waitlistMode,
          waitlistTitle: d.waitlistTitle,
          waitlistHeadline: d.waitlistHeadline,
          waitlistDescription: d.waitlistDescription,
          waitlistButtonText: d.waitlistButtonText,
          waitlistSuccessMessage: d.waitlistSuccessMessage,
          waitlistShowName: d.waitlistShowName,
          waitlistShowCompany: d.waitlistShowCompany,
        });
        setC({
          countdownMode: d.countdownMode,
          countdownTarget: d.countdownTarget ? toLocalInputValue(new Date(d.countdownTarget)) : "",
          countdownTitle: d.countdownTitle,
          countdownHeadline: d.countdownHeadline,
          countdownDescription: d.countdownDescription,
          countdownEndMessage: d.countdownEndMessage,
        });
        setEntries(list);
      })
      .catch(() => toast.error("Failed to load site settings"))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof WaitlistSettings>(key: K, value: WaitlistSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function updateCountdown<K extends keyof CountdownSettings>(key: K, value: CountdownSettings[K]) {
    setC((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateAppSettings({
        ...s,
        countdownMode: c.countdownMode,
        countdownTarget: c.countdownTarget ? new Date(c.countdownTarget) : null,
        countdownTitle: c.countdownTitle,
        countdownHeadline: c.countdownHeadline,
        countdownDescription: c.countdownDescription,
        countdownEndMessage: c.countdownEndMessage,
      });
      toast.success("Site settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle<K extends keyof WaitlistSettings>(key: K, value: WaitlistSettings[K]) {
    const prev = s[key];
    update(key, value);
    try {
      const patch: Partial<WaitlistSettings> = {};
      patch[key] = value;
      await updateAppSettings(patch);
      toast.success("Setting updated");
    } catch {
      update(key, prev);
      toast.error("Failed to update");
    }
  }

  async function handleCountdownToggle(value: boolean) {
    const prev = c.countdownMode;
    updateCountdown("countdownMode", value);
    try {
      await updateAppSettings({ countdownMode: value });
      toast.success("Setting updated");
    } catch {
      updateCountdown("countdownMode", prev);
      toast.error("Failed to update");
    }
  }

  if (loading) return <GeneralSettingsSkeleton />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Site Settings</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Waitlist, countdown, and landing page UI configuration
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="text-xs h-7">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <SectionCard
        icon={Timer}
        title="Countdown Mode"
        description="Show a countdown to launch or when the site will be available"
      >
        <ToggleRow
          label="Enable Countdown Mode"
          hint="Replace the main landing page with a countdown timer. Use for launch dates, coming back soon, or user-locked access."
          checked={c.countdownMode}
          onCheckedChange={(v) => handleCountdownToggle(v)}
        />
        {c.countdownMode && (
          <div className="border-t border-border/20 pt-3 space-y-4">
            <FieldRow label="Target Date & Time" hint="When the countdown ends (launch, availability, etc.)">
              <Input
                type="datetime-local"
                value={c.countdownTarget}
                onChange={(e) => updateCountdown("countdownTarget", e.target.value)}
                className="h-8 text-xs"
              />
            </FieldRow>
            <FieldRow label="Title" hint="Main heading">
              <Input
                value={c.countdownTitle}
                onChange={(e) => updateCountdown("countdownTitle", e.target.value)}
                placeholder="Coming soon"
                className="h-8 text-xs"
              />
            </FieldRow>
            <FieldRow label="Headline" hint="Subheading">
              <Input
                value={c.countdownHeadline}
                onChange={(e) => updateCountdown("countdownHeadline", e.target.value)}
                placeholder="We're launching soon"
                className="h-8 text-xs"
              />
            </FieldRow>
            <FieldRow label="Description" hint="Optional longer description">
              <Textarea
                value={c.countdownDescription}
                onChange={(e) => updateCountdown("countdownDescription", e.target.value)}
                placeholder="Tell visitors what to expect..."
                className="min-h-[60px] text-xs resize-none"
              />
            </FieldRow>
            <FieldRow label="End Message" hint="Shown when countdown reaches zero">
              <Input
                value={c.countdownEndMessage}
                onChange={(e) => updateCountdown("countdownEndMessage", e.target.value)}
                placeholder="We're live!"
                className="h-8 text-xs"
              />
            </FieldRow>
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={ToggleLeft}
        title="Waitlist Mode"
        description="When enabled, the site becomes a waitlist landing page that collects emails"
      >
        <ToggleRow
          label="Enable Waitlist Mode"
          hint="Replace the main landing page with a waitlist form. Visitors can only submit their email (and optional fields)."
          checked={s.waitlistMode}
          onCheckedChange={(v) => handleToggle("waitlistMode", v)}
        />
      </SectionCard>

      {s.waitlistMode && (
        <>
          <SectionCard
            icon={Type}
            title="Waitlist UI"
            description="Configure the text and labels shown on the waitlist form"
          >
            <FieldRow label="Title" hint="Main heading (e.g. Join the waitlist)">
              <Input
                value={s.waitlistTitle}
                onChange={(e) => update("waitlistTitle", e.target.value)}
                placeholder="Join the waitlist"
                className="h-8 text-xs"
              />
            </FieldRow>
            <FieldRow label="Headline" hint="Subheading below the title">
              <Input
                value={s.waitlistHeadline}
                onChange={(e) => update("waitlistHeadline", e.target.value)}
                placeholder="Be the first to know when we launch"
                className="h-8 text-xs"
              />
            </FieldRow>
            <FieldRow label="Description" hint="Optional longer description">
              <Textarea
                value={s.waitlistDescription}
                onChange={(e) => update("waitlistDescription", e.target.value)}
                placeholder="Tell visitors what they're signing up for..."
                className="min-h-[60px] text-xs resize-none"
              />
            </FieldRow>
            <FieldRow label="Button Text" hint="Submit button label">
              <Input
                value={s.waitlistButtonText}
                onChange={(e) => update("waitlistButtonText", e.target.value)}
                placeholder="Join waitlist"
                className="h-8 text-xs"
              />
            </FieldRow>
            <FieldRow label="Success Message" hint="Shown after a user joins">
              <Input
                value={s.waitlistSuccessMessage}
                onChange={(e) => update("waitlistSuccessMessage", e.target.value)}
                placeholder="You're on the list!"
                className="h-8 text-xs"
              />
            </FieldRow>
          </SectionCard>

          <SectionCard icon={Mail} title="Form Fields" description="Choose which fields to show on the waitlist form">
            <ToggleRow
              label="Show Name Field"
              hint="Collect visitor names in addition to email"
              checked={s.waitlistShowName}
              onCheckedChange={(v) => handleToggle("waitlistShowName", v)}
            />
            <div className="border-t border-border/20 pt-3">
              <ToggleRow
                label="Show Company Field"
                hint="Collect company/organization name"
                checked={s.waitlistShowCompany}
                onCheckedChange={(v) => handleToggle("waitlistShowCompany", v)}
              />
            </div>
          </SectionCard>

          <SectionCard icon={Users} title="Waitlist Entries" description={`${entries.length} signups`}>
            <div className="max-h-64 overflow-y-auto border border-border/30 rounded">
              {entries.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">No entries yet</p>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/50 border-b border-border/30">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      {s.waitlistShowName && <th className="text-left px-3 py-2 font-medium">Name</th>}
                      {s.waitlistShowCompany && <th className="text-left px-3 py-2 font-medium">Company</th>}
                      <th className="text-left px-3 py-2 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b border-border/20 last:border-0">
                        <td className="px-3 py-2">{e.email}</td>
                        {s.waitlistShowName && <td className="px-3 py-2">{e.name ?? "—"}</td>}
                        {s.waitlistShowCompany && <td className="px-3 py-2">{e.company ?? "—"}</td>}
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(e.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </SectionCard>
        </>
      )}

      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saving} size="sm" className="text-xs h-7">
          {saving ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
}
