"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, PlugZap } from "lucide-react";
import type { RouterOutputs } from "@starter/api";

import { getApiKeys, saveApiKeys, testStorageConnection } from "@/lib/actions/settings";

import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Separator } from "@starter/ui/components/separator";
import { Switch } from "@starter/ui/components/switch";
import { ApiKeysSkeleton } from "@/components/skeletons";

type ApiKeysResponse = RouterOutputs["settings"]["apiKeys"];
type Configured = ApiKeysResponse["configured"];
type ApiKeysForm = Omit<ApiKeysResponse, "configured">;
type StringField = { [K in keyof ApiKeysForm]: ApiKeysForm[K] extends string ? K : never }[keyof ApiKeysForm];

const STORAGE_FIELDS = [
  "storageAccountId",
  "storageBucket",
  "storagePublicUrl",
  "storageAccessKeyId",
  "storageSecretAccessKey",
] as const satisfies readonly StringField[];

function toForm({ configured: _configured, ...form }: ApiKeysResponse): ApiKeysForm {
  return form;
}

export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeysForm | null>(null);
  const [form, setForm] = useState<ApiKeysForm | null>(null);
  const [configured, setConfigured] = useState<Configured | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const apply = useCallback((fresh: ApiKeysResponse) => {
    const next = toForm(fresh);
    setKeys(next);
    setForm(next);
    setConfigured(fresh.configured);
  }, []);

  useEffect(() => {
    getApiKeys()
      .then(apply)
      .catch(() => toast.error("Failed to load API keys"));
  }, [apply]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      // Masked values are sent back unchanged; the server ignores them. Empty clears a key.
      await saveApiKeys(form);
      apply(await getApiKeys());
      setShowSecrets({});
      toast.success("API keys saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestStorage() {
    setTesting(true);
    try {
      const result = await testStorageConnection();
      if (result.ok) toast.success("Storage connection works");
      else toast.error(result.error ?? "Connection failed");
    } catch {
      toast.error("Connection test failed");
    } finally {
      setTesting(false);
    }
  }

  function update(field: StringField, value: string) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function toggleShow(field: string) {
    setShowSecrets((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  if (!form || !keys || !configured) return <ApiKeysSkeleton />;

  const changed = JSON.stringify(form) !== JSON.stringify(keys);
  const storageChanged = STORAGE_FIELDS.some((f) => form[f] !== keys[f]);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">API Keys</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure third-party service credentials. Stored securely, never exposed to users.
        </p>
      </div>

      <div className="space-y-8">
        {/* File storage */}
        <section className="space-y-3">
          <SectionTitle title="File storage (Cloudflare R2 / S3-compatible)" configured={configured.storage} />
          <p className="text-[10px] text-muted-foreground -mt-2">
            File uploads, avatars, attachments.{" "}
            <a
              href="https://dash.cloudflare.com/?to=/:account/r2/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Cloudflare dashboard
            </a>{" "}
            → R2 → Manage API tokens. The bucket needs a public URL (r2.dev or a custom domain).
          </p>
          <PlainInput
            id="storageAccountId"
            label="Account ID or S3 endpoint URL"
            value={form.storageAccountId}
            onChange={(v) => update("storageAccountId", v)}
            placeholder="Cloudflare account ID, or https://s3.example.com"
          />
          <PlainInput
            id="storageBucket"
            label="Bucket"
            value={form.storageBucket}
            onChange={(v) => update("storageBucket", v)}
            placeholder="my-app-uploads"
          />
          <PlainInput
            id="storagePublicUrl"
            label="Public bucket URL"
            value={form.storagePublicUrl}
            onChange={(v) => update("storagePublicUrl", v)}
            placeholder="https://pub-xxxx.r2.dev or https://files.yourdomain.com"
          />
          <SecretInput
            id="storageAccessKeyId"
            label="Access Key ID"
            value={form.storageAccessKeyId}
            onChange={(v) => update("storageAccessKeyId", v)}
            show={showSecrets.storageAccessKeyId ?? false}
            onToggleShow={() => toggleShow("storageAccessKeyId")}
            placeholder="R2 token access key ID"
          />
          <SecretInput
            id="storageSecretAccessKey"
            label="Secret Access Key"
            value={form.storageSecretAccessKey}
            onChange={(v) => update("storageSecretAccessKey", v)}
            show={showSecrets.storageSecretAccessKey ?? false}
            onToggleShow={() => toggleShow("storageSecretAccessKey")}
            placeholder="R2 token secret access key"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] text-muted-foreground">
              {storageChanged
                ? "Save your changes first; the test uses the saved keys."
                : "Checks that the saved keys can reach the bucket."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestStorage}
              disabled={testing || storageChanged}
            >
              <PlugZap className="h-3 w-3" />
              {testing ? "Testing..." : "Test connection"}
            </Button>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* Resend */}
        <section className="space-y-3">
          <SectionTitle title="Resend" configured={configured.email} />
          <p className="text-[10px] text-muted-foreground -mt-2">Password reset, email verification, invitations.</p>
          <SecretInput
            id="resendApiKey"
            label="API Key"
            value={form.resendApiKey}
            onChange={(v) => update("resendApiKey", v)}
            show={showSecrets.resendApiKey ?? false}
            onToggleShow={() => toggleShow("resendApiKey")}
            placeholder="re_xxxxxxxxxx"
          />
          <PlainInput
            id="resendFromEmail"
            label="From Email"
            value={form.resendFromEmail}
            onChange={(v) => update("resendFromEmail", v)}
            placeholder="noreply@yourdomain.com"
          />
        </section>

        <Separator className="opacity-20" />

        {/* Google */}
        <section className="space-y-3">
          <SectionTitle title="Google OAuth" configured={configured.google} />
          <p className="text-[10px] text-muted-foreground -mt-2">
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Cloud Console
            </a>
            . Redirect URI: <code className="text-[9px] bg-muted px-1">{origin}/api/auth/callback/google</code>
          </p>
          <PlainInput
            id="googleClientId"
            label="Client ID"
            value={form.googleClientId}
            onChange={(v) => update("googleClientId", v)}
            placeholder="xxxx.apps.googleusercontent.com"
          />
          <SecretInput
            id="googleClientSecret"
            label="Client Secret"
            value={form.googleClientSecret}
            onChange={(v) => update("googleClientSecret", v)}
            show={showSecrets.googleClientSecret ?? false}
            onToggleShow={() => toggleShow("googleClientSecret")}
            placeholder="GOCSPX-xxxxxxxxxx"
          />
        </section>

        <Separator className="opacity-20" />

        {/* GitHub */}
        <section className="space-y-3">
          <SectionTitle title="GitHub OAuth" configured={configured.github} />
          <p className="text-[10px] text-muted-foreground -mt-2">
            <a
              href="https://github.com/settings/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Developer settings
            </a>{" "}
            → OAuth Apps. Callback URL:{" "}
            <code className="text-[9px] bg-muted px-1">{origin}/api/auth/callback/github</code>
          </p>
          <PlainInput
            id="githubClientId"
            label="Client ID"
            value={form.githubClientId}
            onChange={(v) => update("githubClientId", v)}
            placeholder="Ov23lixxxxxxxxxx"
          />
          <SecretInput
            id="githubClientSecret"
            label="Client Secret"
            value={form.githubClientSecret}
            onChange={(v) => update("githubClientSecret", v)}
            show={showSecrets.githubClientSecret ?? false}
            onToggleShow={() => toggleShow("githubClientSecret")}
            placeholder="40-character client secret"
          />
        </section>

        <Separator className="opacity-20" />

        {/* Polar */}
        <section className="space-y-3">
          <SectionTitle title="Polar" configured={configured.payments} />
          <p className="text-[10px] text-muted-foreground -mt-2">
            Payments, subscriptions, SaaS pricing.{" "}
            <a
              href={form.polarSandboxMode ? "https://sandbox.polar.sh" : "https://polar.sh/dashboard"}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {form.polarSandboxMode ? "Sandbox Dashboard" : "Polar Dashboard"}
            </a>{" "}
            → Settings → Access Tokens. Create an Organization Access Token with{" "}
            <code className="text-[9px] bg-muted px-0.5">products:read</code> and{" "}
            <code className="text-[9px] bg-muted px-0.5">products:write</code>. Use sandbox tokens only with Sandbox
            mode enabled.
          </p>
          <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
            <Label htmlFor="polarSandboxMode" className="text-xs font-medium">
              Sandbox mode
            </Label>
            <Switch
              id="polarSandboxMode"
              checked={form.polarSandboxMode}
              onCheckedChange={(v) => setForm((prev) => (prev ? { ...prev, polarSandboxMode: v } : prev))}
            />
          </div>
          <SecretInput
            id="polarAccessToken"
            label="Access Token"
            value={form.polarAccessToken}
            onChange={(v) => update("polarAccessToken", v)}
            show={showSecrets.polarAccessToken ?? false}
            onToggleShow={() => toggleShow("polarAccessToken")}
            placeholder="polar_at_xxxxxxxxxx"
          />
          <PlainInput
            id="polarOrganizationId"
            label="Organization ID"
            value={form.polarOrganizationId}
            onChange={(v) => update("polarOrganizationId", v)}
            placeholder="UUID from Polar dashboard"
          />
          <SecretInput
            id="polarWebhookSecret"
            label="Webhook Secret"
            value={form.polarWebhookSecret}
            onChange={(v) => update("polarWebhookSecret", v)}
            show={showSecrets.polarWebhookSecret ?? false}
            onToggleShow={() => toggleShow("polarWebhookSecret")}
            placeholder="From Polar Dashboard → Webhooks"
          />
          <p className="text-[9px] text-muted-foreground">
            Webhook URL:{" "}
            <code className="bg-muted px-0.5">
              {origin ? `${origin}/api/webhooks/polar` : "https://your-domain.com/api/webhooks/polar"}
            </code>{" "}
            — For local dev, use your ngrok URL (e.g. https://xxx.ngrok-free.app/api/webhooks/polar). Configure in{" "}
            {form.polarSandboxMode ? "sandbox.polar.sh" : "polar.sh"} → Organization → Webhooks.
          </p>
        </section>

        <Separator className="opacity-20" />

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            <code className="bg-muted px-0.5">.env</code> values are used as fallback.
          </p>
          <Button onClick={handleSave} disabled={saving || !changed} size="sm">
            {saving ? "Saving..." : "Save Keys"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, configured }: { title: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-semibold">{title}</p>
      <Badge variant={configured ? "default" : "outline"} className="text-[9px]">
        {configured ? "Configured" : "Not configured"}
      </Badge>
    </div>
  );
}

function PlainInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </div>
  );
}

function SecretInput({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            // Select the masked value so typing replaces it; leaving it untouched keeps the key.
            if (value.includes("••••")) e.currentTarget.select();
          }}
          placeholder={placeholder}
          className="h-8 text-xs pr-8 font-mono"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
