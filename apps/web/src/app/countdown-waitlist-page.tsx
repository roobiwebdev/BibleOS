"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import type { RouterOutputs } from "@starter/api";
import { BRANDING } from "@starter/config/branding";

import { BrandMark, LandingThemeToggle } from "@/components/brand-mark";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { joinWaitlist } from "@/lib/actions/waitlist";

type CountdownSettings = NonNullable<RouterOutputs["settings"]["siteModes"]["countdown"]>;

type WaitlistSettings = NonNullable<RouterOutputs["settings"]["siteModes"]["waitlist"]>;

function useCountdown(target: string) {
  const [diff, setDiff] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    ended: boolean;
  } | null>(null);

  useEffect(() => {
    const targetDate = new Date(target).getTime();

    function tick() {
      const now = Date.now();
      const delta = targetDate - now;

      if (delta <= 0) {
        setDiff({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true });
        return;
      }

      const days = Math.floor(delta / (1000 * 60 * 60 * 24));
      const hours = Math.floor((delta % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((delta % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((delta % (1000 * 60)) / 1000);

      setDiff({ days, hours, minutes, seconds, ended: false });
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return diff;
}

export function CountdownWaitlistPage({
  countdown,
  waitlist,
}: {
  countdown: CountdownSettings;
  waitlist: WaitlistSettings;
}) {
  const diff = useCountdown(countdown.target);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const result = await joinWaitlist({
      email,
      name: waitlist.showName ? name : undefined,
      company: waitlist.showCompany ? company : undefined,
    });

    if (result.success) {
      setStatus("success");
      setEmail("");
      setName("");
      setCompany("");
    } else {
      setStatus("error");
      setError(result.error);
    }
  }

  const appName = countdown.appName || waitlist.appName || BRANDING.appName;
  const supportEmail = countdown.supportEmail || waitlist.supportEmail;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 flex h-12 items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark className="h-3.5 w-auto text-foreground" />
            <span className="text-[11px] font-semibold tracking-widest uppercase">{appName}</span>
          </div>
          <LandingThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          {/* Countdown section */}
          <div className="mb-10 text-center">
            <BrandMark className="h-6 w-auto text-foreground mx-auto mb-6" />
            <h1 className="text-xl font-semibold tracking-tight mb-2">{countdown.title}</h1>
            <p className="text-sm text-muted-foreground mb-2">{countdown.headline}</p>
            {countdown.description && (
              <p className="text-xs text-muted-foreground/80 leading-relaxed mb-6">{countdown.description}</p>
            )}

            {diff?.ended ? (
              <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-6">
                <p className="text-base font-medium text-foreground">{countdown.endMessage}</p>
              </div>
            ) : diff ? (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Days", value: diff.days },
                  { label: "Hours", value: diff.hours },
                  { label: "Minutes", value: diff.minutes },
                  { label: "Seconds", value: diff.seconds },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-border/40 bg-card/50 p-4 text-center">
                    <p className="text-2xl font-semibold tabular-nums">{String(value).padStart(2, "0")}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
            )}
          </div>

          {/* Waitlist section */}
          <div className="border-t border-border/40 pt-8">
            <p className="text-sm font-medium text-center mb-4">{waitlist.headline}</p>

            {status === "success" ? (
              <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-6 text-center">
                <p className="text-sm font-medium text-foreground">{waitlist.successMessage}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={status === "loading"}
                    className="h-10 text-sm"
                  />
                </div>

                {waitlist.showName && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs">
                      Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={status === "loading"}
                      className="h-10 text-sm"
                    />
                  </div>
                )}

                {waitlist.showCompany && (
                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-xs">
                      Company
                    </Label>
                    <Input
                      id="company"
                      type="text"
                      placeholder="Your company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      disabled={status === "loading"}
                      className="h-10 text-sm"
                    />
                  </div>
                )}

                {status === "error" && <p className="text-xs text-destructive">{error}</p>}

                <Button type="submit" disabled={status === "loading"} className="w-full h-10 text-sm">
                  {status === "loading" ? "Joining..." : waitlist.buttonText}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-4">
        <div className="max-w-2xl flex justify-between mx-auto px-4 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/40">
          <span>{appName}</span>
          <div className="flex gap-x-3 items-center">
            <Link href="/legal/privacy" className="hover:text-muted-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-muted-foreground transition-colors">
              Terms
            </Link>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="hover:text-muted-foreground transition-colors">
                Contact
              </a>
            )}
            <Link href="/login" className="hover:text-muted-foreground transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
