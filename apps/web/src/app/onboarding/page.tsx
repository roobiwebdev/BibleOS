"use client";
/**
 * Multi-step onboarding wizard: welcome -> name/bio -> avatar -> done.
 * The avatar goes to storage via the upload route; the profile and the "completed" flag are saved
 * at the end (or just the flag when skipped).
 */
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronRight, Upload, User, Sparkles, Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { updateProfile, completeOnboarding } from "@/lib/actions/user";
import { uploadFile } from "@/lib/upload";

import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Textarea } from "@starter/ui/components/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@starter/ui/components/avatar";
import { cn } from "@/lib/utils";
import Loader from "@/components/loader";

const steps = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "profile", title: "Profile", icon: User },
  { id: "avatar", title: "Photo", icon: Upload },
  { id: "done", title: "Done", icon: Check },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isPending) return <Loader />;
  if (!session) return null;

  if (!initialized) {
    setName(session.user.name ?? "");
    setBio(session.user.bio ?? "");
    setAvatarUrl(session.user.image ?? "");
    setInitialized(true);
  }

  const initials = (name || session.user.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadFile("avatars", file);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setAvatarUrl(result.url);
    } catch {
      toast.error("Failed to upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        bio,
        image: avatarUrl || undefined,
      });
      await completeOnboarding();
      toast.success("You're all set!");
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCompleting(false);
    }
  }

  async function handleSkip() {
    setCompleting(true);
    try {
      await completeOnboarding();
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="w-full space-y-8">
      {/* Progress */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={cn(
                "h-6 w-6 flex items-center justify-center rounded-full border transition-all duration-200",
                i < step
                  ? "bg-foreground border-foreground text-background"
                  : i === step
                    ? "border-foreground/40 bg-foreground/5 text-foreground"
                    : "border-border/40 bg-muted/30 text-muted-foreground/50",
              )}
            >
              {i < step ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <s.icon className="h-3 w-3" />}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn("w-6 h-px mx-0.5 transition-colors", i < step ? "bg-foreground/40" : "bg-border/40")}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="space-y-6">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 mb-2">
                Step 1 of 4
              </p>
              <h1 className="text-lg font-semibold tracking-tight">Welcome, {session.user.name ?? "there"}</h1>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Let&apos;s set up your profile in a few quick steps. You can always change this later.
              </p>
              {session.user.role === "admin" && (
                <div className="mt-3 rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-foreground">You&apos;re the admin</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                    You have full access to the admin dashboard — users, settings, analytics, and more.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => setStep(1)} className="h-9 text-xs font-medium">
                Get started
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                disabled={completing}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 mb-2">
                Step 2 of 4
              </p>
              <h1 className="text-lg font-semibold tracking-tight">Your profile</h1>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Tell us a bit about yourself. This helps others recognize you.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ob-name" className="text-[11px] font-medium">
                  Display name
                </Label>
                <Input
                  id="ob-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-bio" className="text-[11px] font-medium">
                  Bio <span className="text-muted-foreground/60 font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="ob-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short bio..."
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(0)}
                className="h-9 text-xs text-muted-foreground"
              >
                Back
              </Button>
              <Button size="sm" onClick={() => setStep(2)} className="h-9 text-xs font-medium">
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 mb-2">
                Step 3 of 4
              </p>
              <h1 className="text-lg font-semibold tracking-tight">Profile photo</h1>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Upload a photo so others can recognize you. You can skip this for now.
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 py-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative group rounded-full transition-all duration-200",
                  "ring-2 ring-border/40 hover:ring-foreground/20 focus:outline-none focus:ring-2 focus:ring-foreground/30",
                  uploading && "pointer-events-none opacity-70",
                )}
                disabled={uploading}
              >
                <Avatar className="h-24 w-24 border-2 border-border/30">
                  <AvatarImage src={avatarUrl} className="object-cover" />
                  <AvatarFallback className="text-xl font-semibold bg-foreground/10 text-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 text-background animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6 text-background" />
                  )}
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <p className="text-[10px] text-muted-foreground/70">
                {uploading ? "Uploading..." : "Click to upload · Max 5MB"}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="h-9 text-xs text-muted-foreground"
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(3)}
                  className="h-9 text-xs text-muted-foreground"
                >
                  Skip for now
                </Button>
                <Button size="sm" onClick={() => setStep(3)} className="h-9 text-xs font-medium">
                  Next
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="h-14 w-14 rounded-full bg-foreground/10 border border-foreground/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-7 w-7 text-foreground" strokeWidth={2} />
              </div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 mb-2">
                Step 4 of 4
              </p>
              <h1 className="text-lg font-semibold tracking-tight">You&apos;re all set</h1>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[260px] mx-auto">
                Your profile is ready. You can update it anytime in settings.
              </p>
            </div>

            <Button size="sm" onClick={handleComplete} disabled={completing} className="w-full h-9 text-xs font-medium">
              {completing ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Setting up...
                </>
              ) : (
                "Go to dashboard"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
