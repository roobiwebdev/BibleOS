"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Settings2,
  Shield,
  Users,
  AlertTriangle,
  Link2,
  Pencil,
  Share2,
  Upload,
  Loader2,
  X,
  Palette,
  Check,
} from "lucide-react";
import { APP_THEMES, type AppThemeId } from "@starter/config/themes";
import { getAdminSettings, updateAppSettings } from "@/lib/actions/settings";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Textarea } from "@starter/ui/components/textarea";
import { Switch } from "@starter/ui/components/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { GeneralSettingsSkeleton } from "@/components/skeletons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@starter/ui/components/dialog";

type UserRole = "user" | "admin";

type Settings = {
  appName: string;
  appDescription: string;
  appUrl: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  appTheme: AppThemeId;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  defaultUserRole: UserRole;
  maxUsersEnabled: boolean;
  maxUsers: number;
  supportEmail: string;
  privacyContent: string;
  termsContent: string;
  signupsEnabled: boolean;
  sessionTimeout: number;
};

function toThemeId(value: string): AppThemeId {
  return APP_THEMES.find((t) => t.id === value)?.id ?? "default";
}

function toUserRole(value: string): UserRole {
  return value === "admin" ? "admin" : "user";
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
  danger,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className={`text-[11px] font-medium ${danger ? "text-destructive" : ""}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function AdminGeneralPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ogImageUploading, setOgImageUploading] = useState(false);
  const ogImageInputRef = useRef<HTMLInputElement>(null);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const [s, setS] = useState<Settings>({
    appName: "",
    appDescription: "",
    appUrl: "",
    metaTitle: "",
    metaDescription: "",
    ogImage: "",
    appTheme: "default",
    maintenanceMode: false,
    maintenanceMessage: "",
    defaultUserRole: "user",
    maxUsersEnabled: false,
    maxUsers: 0,
    supportEmail: "",
    privacyContent: "",
    termsContent: "",
    signupsEnabled: true,
    sessionTimeout: 30,
  });

  useEffect(() => {
    getAdminSettings()
      .then((data) => {
        setS({
          appName: data.appName,
          appDescription: data.appDescription,
          appUrl: data.appUrl,
          metaTitle: data.metaTitle ?? "",
          metaDescription: data.metaDescription ?? "",
          ogImage: data.ogImage ?? "",
          appTheme: toThemeId(data.appTheme),
          maintenanceMode: data.maintenanceMode,
          maintenanceMessage: data.maintenanceMessage,
          defaultUserRole: toUserRole(data.defaultUserRole),
          maxUsersEnabled: data.maxUsersEnabled,
          maxUsers: data.maxUsers,
          supportEmail: data.supportEmail,
          privacyContent: data.privacyContent,
          termsContent: data.termsContent,
          signupsEnabled: data.signupsEnabled,
          sessionTimeout: data.sessionTimeout,
        });
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateAppSettings(s);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle<K extends keyof Settings>(key: K, value: Settings[K]) {
    const prev = s[key];
    update(key, value);
    try {
      const patch: Partial<Settings> = {};
      patch[key] = value;
      await updateAppSettings(patch);
      toast.success("Setting updated");
    } catch {
      update(key, prev);
      toast.error("Failed to update");
    }
  }

  async function handleThemeChange(theme: AppThemeId) {
    const prev = s.appTheme;
    update("appTheme", theme);
    try {
      await updateAppSettings({ appTheme: theme });
      // Apply immediately; the root layout sets the same attribute on the next load.
      document.documentElement.setAttribute("data-app-theme", theme);
      toast.success("Theme updated");
    } catch {
      update("appTheme", prev);
      toast.error("Failed to update");
    }
  }

  async function handleOgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setOgImageUploading(true);
    try {
      const result = await uploadFile("uploads", file);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      update("ogImage", result.url);
      toast.success("Preview image uploaded");
    } catch {
      toast.error("Failed to upload");
    } finally {
      setOgImageUploading(false);
    }
  }

  async function handleSaveLegal(type: "privacy" | "terms") {
    setSaving(true);
    try {
      await updateAppSettings(
        type === "privacy" ? { privacyContent: s.privacyContent } : { termsContent: s.termsContent },
      );
      toast.success("Published");
      setLegalModal(null);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <GeneralSettingsSkeleton />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">General</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Core application settings and configuration</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="text-xs h-7">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* App Identity */}
      <SectionCard icon={Settings2} title="App Identity" description="Name, description, and branding">
        <FieldRow label="App Name" hint="Used in emails, browser tab, and UI">
          <Input
            value={s.appName}
            onChange={(e) => update("appName", e.target.value)}
            placeholder="My App"
            className="h-8 text-xs"
          />
        </FieldRow>
        <FieldRow label="Description" hint="Short tagline for your app">
          <Input
            value={s.appDescription}
            onChange={(e) => update("appDescription", e.target.value)}
            placeholder="A brief description of your product"
            className="h-8 text-xs"
          />
        </FieldRow>
      </SectionCard>

      {/* Theme */}
      <SectionCard icon={Palette} title="Theme" description="Brand colour used for buttons, links and highlights">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {APP_THEMES.map((theme) => {
            const active = s.appTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => !active && handleThemeChange(theme.id)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 border px-2.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "border-primary bg-muted/50" : "border-border/40 hover:bg-muted/30",
                )}
              >
                {/* Each swatch scopes its own preset so it shows that preset's primary colour. */}
                <span data-app-theme={theme.id} className="shrink-0">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full",
                      theme.id === "default" ? "bg-foreground text-background" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {active && <Check className="h-2.5 w-2.5" />}
                  </span>
                </span>
                {theme.label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Social Preview */}
      <SectionCard
        icon={Share2}
        title="Social Preview"
        description="Title, description, and image shown when your site is shared on social media, messaging apps, or link previews"
      >
        <FieldRow label="Share Title" hint="Shown as the main title in link previews. Leave empty to use App Name.">
          <Input
            value={s.metaTitle}
            onChange={(e) => update("metaTitle", e.target.value)}
            placeholder={s.appName || "My App"}
            className="h-8 text-xs"
          />
        </FieldRow>
        <FieldRow
          label="Share Description"
          hint="Shown as the description in link previews. Leave empty to use App Description."
        >
          <Textarea
            value={s.metaDescription}
            onChange={(e) => update("metaDescription", e.target.value)}
            placeholder={s.appDescription || "A brief description of your product"}
            className="min-h-[60px] text-xs resize-none"
          />
        </FieldRow>
        <FieldRow
          label="Preview Image"
          hint="Image shown in link previews (e.g. Facebook, Twitter, Slack). Recommended: 1200×630px. Max 2MB."
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => ogImageInputRef.current?.click()}
              disabled={ogImageUploading}
              className="flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {ogImageUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {ogImageUploading ? "Uploading..." : "Upload image"}
            </button>
            <input
              ref={ogImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleOgImageUpload}
            />
            {s.ogImage && (
              <>
                <div className="relative w-16 h-16 rounded overflow-hidden border border-border/40 shrink-0">
                  <Image
                    src={s.ogImage}
                    alt="Social preview"
                    width={64}
                    height={64}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => update("ogImage", "")}
                >
                  <X className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              </>
            )}
          </div>
        </FieldRow>
      </SectionCard>

      {/* Access Control */}
      <SectionCard icon={Shield} title="Access Control" description="Registration, roles, and session settings">
        <ToggleRow
          label="User Signups"
          hint="Allow new users to register. Disable to close registration."
          checked={s.signupsEnabled}
          onCheckedChange={(v) => handleToggle("signupsEnabled", v)}
        />
        <div className="border-t border-border/20 pt-3">
          <FieldRow label="Default User Role" hint="Role assigned to new users on signup">
            <Select value={s.defaultUserRole} onValueChange={(v) => update("defaultUserRole", toUserRole(v))}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user" className="text-xs">
                  User
                </SelectItem>
                <SelectItem value="admin" className="text-xs">
                  Admin
                </SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
        <div className="border-t border-border/20 pt-3">
          <FieldRow label="Session Timeout" hint="Days before an inactive session expires">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={s.sessionTimeout}
                onChange={(e) => update("sessionTimeout", parseInt(e.target.value) || 1)}
                min={1}
                max={365}
                className="h-8 text-xs w-24"
              />
              <span className="text-[10px] text-muted-foreground">days</span>
            </div>
          </FieldRow>
        </div>
      </SectionCard>

      {/* User Limits */}
      <SectionCard icon={Users} title="User Limits" description="Control maximum user capacity">
        <ToggleRow
          label="Enable User Cap"
          hint="Limit the total number of registered users"
          checked={s.maxUsersEnabled}
          onCheckedChange={(v) => handleToggle("maxUsersEnabled", v)}
        />
        {s.maxUsersEnabled && (
          <div className="border-t border-border/20 pt-3">
            <FieldRow label="Max Users" hint="Registration closes when this limit is reached">
              <Input
                type="number"
                value={s.maxUsers}
                onChange={(e) => update("maxUsers", parseInt(e.target.value) || 0)}
                min={0}
                className="h-8 text-xs w-32"
              />
            </FieldRow>
          </div>
        )}
      </SectionCard>

      {/* Maintenance Mode */}
      <SectionCard icon={AlertTriangle} title="Maintenance Mode" description="Temporarily restrict access to the app">
        <ToggleRow
          label="Maintenance Mode"
          hint="Non-admin users will see a maintenance page"
          checked={s.maintenanceMode}
          onCheckedChange={(v) => handleToggle("maintenanceMode", v)}
          danger
        />
        {s.maintenanceMode && (
          <div className="border-t border-border/20 pt-3">
            <FieldRow label="Message" hint="Shown to users during maintenance">
              <Textarea
                value={s.maintenanceMessage}
                onChange={(e) => update("maintenanceMessage", e.target.value)}
                placeholder="We're performing scheduled maintenance..."
                className="min-h-[60px] text-xs resize-none"
              />
            </FieldRow>
          </div>
        )}
      </SectionCard>

      {/* Contact & Legal */}
      <SectionCard icon={Link2} title="Contact & Legal" description="Support email and legal documents">
        <FieldRow label="Support Email" hint="Displayed in footer and error pages">
          <Input
            value={s.supportEmail}
            onChange={(e) => update("supportEmail", e.target.value)}
            placeholder="support@yourapp.com"
            type="email"
            className="h-8 text-xs"
          />
        </FieldRow>
        <div className="border-t border-border/20 pt-3 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium">Privacy Policy</p>
              <p className="text-[10px] text-muted-foreground">Shown at /legal/privacy</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={() => setLegalModal("privacy")}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium">Terms of Service</p>
              <p className="text-[10px] text-muted-foreground">Shown at /legal/terms</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={() => setLegalModal("terms")}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Legal editor modals */}
      <Dialog open={legalModal === "privacy"} onOpenChange={(open) => !open && setLegalModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm">Privacy Policy</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4">
            <Textarea
              value={s.privacyContent}
              onChange={(e) => update("privacyContent", e.target.value)}
              placeholder={`# Privacy Policy\n\nWrite your privacy policy in **markdown**...\n\n- Bullet points\n- [Links](https://example.com)`}
              className="min-h-[280px] text-xs font-mono resize-y"
            />
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t border-border/30 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setLegalModal(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => handleSaveLegal("privacy")} disabled={saving}>
              {saving ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={legalModal === "terms"} onOpenChange={(open) => !open && setLegalModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm">Terms of Service</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4">
            <Textarea
              value={s.termsContent}
              onChange={(e) => update("termsContent", e.target.value)}
              placeholder={`# Terms of Service\n\nWrite your terms in **markdown**...\n\n- Bullet points\n- [Links](https://example.com)`}
              className="min-h-[280px] text-xs font-mono resize-y"
            />
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t border-border/30 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setLegalModal(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => handleSaveLegal("terms")} disabled={saving}>
              {saving ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saving} size="sm" className="text-xs h-7">
          {saving ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
}
