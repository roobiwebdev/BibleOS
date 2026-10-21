"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

import { getAdminSettings, updateAppSettings } from "@/lib/actions/settings";

import { Switch } from "@starter/ui/components/switch";
import { FeatureTogglesSkeleton } from "@/components/skeletons";

type AppSettings = {
  onboardingEnabled: boolean;
  emailVerificationEnabled: boolean;
  forgotPasswordEnabled: boolean;
  socialLoginEnabled: boolean;
  organizationsEnabled: boolean;
  invitesEnabled: boolean;
};

const features: {
  key: keyof AppSettings;
  label: string;
  description: string;
}[] = [
  {
    key: "onboardingEnabled",
    label: "Onboarding Flow",
    description: "New users see a setup wizard after their first sign-in.",
  },
  {
    key: "emailVerificationEnabled",
    label: "Email Verification",
    description: "Require users to verify their email before accessing the app.",
  },
  {
    key: "forgotPasswordEnabled",
    label: "Forgot Password",
    description:
      'Show the "Forgot?" link on login so users can reset their password via email. Requires Resend to be configured.',
  },
  {
    key: "socialLoginEnabled",
    label: "Social Login (OAuth)",
    description: "Allow users to sign in with Google or GitHub. Requires the OAuth keys in API Keys.",
  },
  {
    key: "organizationsEnabled",
    label: "Organizations / Teams",
    description: "Users can create organizations, manage members, and assign roles.",
  },
  {
    key: "invitesEnabled",
    label: "Email Invitations",
    description: "Organization owners can send email invitations to new members.",
  },
];

export default function AdminFeaturesPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminSettings()
      .then(setSettings)
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(key: keyof AppSettings, value: boolean) {
    try {
      const patch: Partial<AppSettings> = {};
      patch[key] = value;
      setSettings(await updateAppSettings(patch));
      const label = features.find((f) => f.key === key)?.label ?? key;
      toast.success(`${label} ${value ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update");
    }
  }

  if (loading) return <FeatureTogglesSkeleton />;

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Features</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Toggle features on or off. Changes take effect immediately.
        </p>
      </div>

      <div className="space-y-0 border border-border divide-y divide-border">
        {features.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium">{f.label}</p>
              <p className="text-[10px] text-muted-foreground">{f.description}</p>
            </div>
            <Switch checked={settings?.[f.key] ?? false} onCheckedChange={(v) => handleToggle(f.key, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}
