import { commands } from "@starter/local-api/api";
import { Button } from "@starter/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@starter/ui/components/dialog";
import { Switch } from "@starter/ui/components/switch";
import { cn } from "@starter/ui/lib/utils";
import { isTauri } from "@tauri-apps/api/core";
import { Check } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Segmented } from "../../components/segmented";
import { TranslationSelect } from "../../components/translation-select";
import { callCommand } from "../../lib/data/local-api";
import { usePreferences, useT } from "../../lib/state/preferences";

const STEPS = ["language", "theme", "translations", "goal"] as const;
const THEMES = ["paper", "sepia", "night"] as const;
const GOALS = [5, 10, 15, 20, 30] as const;

/** The browser preview is seeded with sample data, so it shows the welcome only when asked (#/today?welcome). */
const previewAsked = () => !isTauri() && /[?&]welcome(=|&|$)/.test(window.location.hash);

function Field({ label, children }: { label: string; children: (labelId: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <span id={id} className="text-sm font-medium">
        {label}
      </span>
      {children(id)}
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: Welcome, onboarding, first run, onboarded, welcome sheet
 * WHAT:  A calm four-step sheet on first launch: language and calendar, theme (applied live),
 *        translations for side-by-side reading, and a daily goal. Skip and Done both set
 *        `onboarded`, so it never returns.
 * WHY:   The few choices that shape every screen are made once, up front, and each is saved
 *        the moment it is picked (settings.set), so skipping halfway keeps what was chosen.
 * WHERE: AppShell.
 */
export function Welcome() {
  const t = useT();
  const { prefs, update } = usePreferences();
  const [open, setOpen] = useState(previewAsked);
  const [step, setStep] = useState(0);
  const titleId = useId();

  // Read the saved setting directly: the provider shows defaults until it loads.
  useEffect(() => {
    if (!isTauri()) return;
    void callCommand(commands.settings.get, {})
      .then((saved) => {
        if (!saved.onboarded) setOpen(true);
      })
      .catch(() => undefined);
  }, []);

  const finish = () => {
    update({ onboarded: true });
    setOpen(false);
  };

  const key = STEPS[step] ?? "language";
  const copy = t.welcome.steps[key];
  const last = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && finish()}>
      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-lg">
        <div className="px-7 pb-2 pt-7">
          <p className="eyebrow">{step === 0 ? t.welcome.title : t.welcome.step(step + 1, STEPS.length)}</p>
          <DialogTitle id={titleId} className="mt-2 text-xl font-semibold tracking-tight">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {step === 0 ? `${t.welcome.intro} ${copy.body}` : copy.body}
          </DialogDescription>
        </div>

        <div className="min-h-44 px-7 py-4">
          {key === "language" && (
            <div className="divide-y">
              <Field label={t.welcome.language}>
                {(id) => (
                  <Segmented
                    labelledBy={id}
                    value={prefs.locale}
                    onChange={(locale) => update({ locale })}
                    options={[
                      { value: "en", label: <span lang="en">English</span> },
                      { value: "am", label: <span lang="am">አማርኛ</span> },
                    ]}
                  />
                )}
              </Field>
              <Field label={t.welcome.calendar}>
                {(id) => (
                  <Segmented
                    labelledBy={id}
                    value={prefs.calendar}
                    onChange={(calendar) => update({ calendar })}
                    options={[
                      { value: "gregorian", label: t.settings.gregorian },
                      { value: "ethiopian", label: t.settings.ethiopian },
                    ]}
                  />
                )}
              </Field>
            </div>
          )}

          {key === "theme" && (
            <div role="radiogroup" aria-label={copy.title} className="grid grid-cols-3 gap-3">
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={prefs.theme === theme}
                  onClick={() => update({ theme })}
                  className="flex flex-col items-center gap-2 text-xs font-medium"
                >
                  <span
                    data-theme={theme}
                    className={cn(
                      "relative flex h-24 w-full flex-col justify-center gap-1 overflow-hidden rounded-xl border-2 bg-background px-3 text-left text-foreground transition-colors",
                      prefs.theme === theme ? "border-primary" : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="font-reading text-2xl">Aa</span>
                    <span lang={prefs.locale} className="truncate font-reading text-[11px] text-muted-foreground">
                      {t.welcome.sample}
                    </span>
                    {prefs.theme === theme && (
                      <Check
                        aria-hidden
                        className="absolute right-1.5 top-1.5 size-3.5 rounded-full bg-primary p-0.5 text-primary-foreground"
                      />
                    )}
                  </span>
                  {t.settings.themes[theme]}
                </button>
              ))}
            </div>
          )}

          {key === "translations" && (
            <div className="divide-y">
              <Field label={t.welcome.translation}>
                {(id) => (
                  <TranslationSelect
                    labelledBy={id}
                    value={prefs.mainTranslation}
                    onChange={(mainTranslation) => update({ mainTranslation })}
                  />
                )}
              </Field>
              <Field label={t.welcome.sideBySide}>
                {(id) => (
                  <Switch
                    aria-labelledby={id}
                    checked={prefs.parallel}
                    onCheckedChange={(parallel) => update({ parallel })}
                  />
                )}
              </Field>
              {prefs.parallel && (
                <Field label={t.welcome.beside}>
                  {(id) => (
                    <TranslationSelect
                      labelledBy={id}
                      value={prefs.parallelTranslation}
                      onChange={(parallelTranslation) => update({ parallelTranslation })}
                    />
                  )}
                </Field>
              )}
            </div>
          )}

          {key === "goal" && (
            <div className="flex justify-center pt-4">
              <Segmented
                labelledBy={titleId}
                value={prefs.goalMinutes}
                onChange={(goalMinutes) => update({ goalMinutes })}
                options={GOALS.map((n) => ({ value: n, label: t.welcome.minutes(n) }))}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-7 py-4">
          <Button variant="ghost" size="sm" onClick={finish}>
            {t.welcome.skip}
          </Button>
          <div aria-hidden className="mx-auto flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={cn("size-1.5 rounded-full", i === step ? "bg-primary" : "bg-muted-foreground/30")}
              />
            ))}
          </div>
          {step > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              {t.welcome.back}
            </Button>
          )}
          <Button size="sm" onClick={last ? finish : () => setStep(step + 1)}>
            {last ? t.welcome.done : t.welcome.next}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
