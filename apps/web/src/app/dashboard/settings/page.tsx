"use client";
/** Profile settings: avatar (uploaded to storage), display name and bio. */
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@starter/ui/components/avatar";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Textarea } from "@starter/ui/components/textarea";

import { FieldErrors } from "@/components/sign-in-form";
import { ProfileSettingsSkeleton } from "@/components/skeletons";
import { updateProfile } from "@/lib/actions/user";
import { authClient } from "@/lib/auth-client";
import { uploadFile } from "@/lib/upload";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  bio: z.string().trim().max(1000),
});

type ProfileUser = { name: string; email: string; image?: string | null; bio?: string | null };

export default function ProfileSettings() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <ProfileSettingsSkeleton />;
  if (!session) return null;

  return <ProfileForm user={session.user} />;
}

function ProfileForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.image ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: { name: user.name, bio: user.bio ?? "" },
    validators: { onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateProfile({ name: value.name.trim(), bio: value.bio.trim() });
        toast.success("Profile updated");
        router.refresh();
      } catch {
        toast.error("Failed to save profile");
      }
    },
  });

  const initials =
    user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
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
      await updateProfile({ image: result.url });
      toast.success("Avatar updated");
      router.refresh();
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-md space-y-8">
      {/* Avatar */}
      <section>
        <SectionHeader title="Avatar" description="Click to upload a new profile picture." />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group cursor-pointer"
            disabled={uploading}
          >
            <Avatar className="h-14 w-14">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-xs font-bold bg-muted text-foreground/60">{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploading ? (
                <Loader2 className="h-3 w-3 text-background animate-spin" />
              ) : (
                <span className="text-background text-[9px] font-medium">Edit</span>
              )}
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          <div className="text-[10px] text-muted-foreground/50 space-y-0.5">
            <p>Square image, at least 200×200px.</p>
            <p>Max 5MB. JPG, PNG, or WebP.</p>
          </div>
        </div>
      </section>

      {/* Profile info */}
      <section>
        <SectionHeader title="Profile" description="Your name and bio visible to others." />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-3"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="text-[11px]">
                  Name
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Your name"
                  className="h-8 text-xs"
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[11px]">
              Email
            </Label>
            <Input id="email" value={user.email} disabled className="h-8 text-xs opacity-50" />
            <p className="text-[9px] text-muted-foreground/40">Email cannot be changed here.</p>
          </div>

          <form.Field name="bio">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="text-[11px]">
                  Bio
                </Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="text-xs resize-none"
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <div className="flex justify-end pt-2">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs h-8 bg-foreground text-background hover:bg-foreground/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </section>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3 pb-2 border-b border-border/30">
      <h3 className="text-xs font-semibold">{title}</h3>
      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{description}</p>
    </div>
  );
}
