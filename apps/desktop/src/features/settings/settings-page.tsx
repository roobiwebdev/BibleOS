import { TRANSLATIONS } from "@starter/bible-data/manifest";
import { Switch } from "@starter/ui/components/switch";
import { cn } from "@starter/ui/lib/utils";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ACCENTS, usePreferences, useT } from "../../lib/state/preferences";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-6 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-[13px] font-medium transition-all",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
      <button
        type="button"
        className="rounded-md p-1.5 hover:bg-card disabled:opacity-40"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-12 text-center text-[13px] font-medium tabular">{format ? format(value) : value}</span>
      <button
        type="button"
        className="rounded-md p-1.5 hover:bg-card disabled:opacity-40"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function TranslationSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 appearance-none rounded-lg border bg-background pl-3 pr-8 text-[13px]"
      >
        {TRANSLATIONS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.abbreviation} · {t.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function SettingsPage() {
  const t = useT();
  const { prefs, update, resolvedTheme } = usePreferences();
  const [backups, setBackups] = useState(true);
  const [openLicence, setOpenLicence] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto">
      <div data-tauri-drag-region className="h-11" />
      <div className="mx-auto max-w-2xl px-10 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">{t.settings.title}</h1>
        <p className="mb-8 mt-1 text-sm text-muted-foreground">{t.settings.previewNote}</p>

        <Group title={t.settings.appearance}>
          <div className="grid grid-cols-4 gap-3 p-5">
            {(["system", "paper", "sepia", "night"] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => update({ theme })}
                className="flex flex-col items-center gap-2 text-xs font-medium"
              >
                <span
                  data-theme={theme === "system" ? undefined : theme}
                  className={cn(
                    "relative flex h-16 w-full items-center justify-center overflow-hidden rounded-xl border-2 bg-background font-reading text-lg text-foreground transition-colors",
                    prefs.theme === theme ? "border-primary" : "border-border hover:border-primary/40",
                  )}
                >
                  {theme === "system" ? (
                    <span className="flex h-full w-full">
                      <span
                        data-theme="paper"
                        className="flex flex-1 items-center justify-end bg-background pr-1 text-foreground"
                      >
                        A
                      </span>
                      <span data-theme="night" className="flex flex-1 items-center bg-background pl-1 text-foreground">
                        a
                      </span>
                    </span>
                  ) : (
                    "Aa"
                  )}
                  {prefs.theme === theme && (
                    <Check className="absolute right-1.5 top-1.5 size-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />
                  )}
                </span>
                {t.settings.themes[theme]}
              </button>
            ))}
          </div>
          <Row label={t.settings.accent}>
            <div className="flex gap-2">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  title={t.accents[accent]}
                  aria-label={t.accents[accent]}
                  aria-pressed={prefs.accent === accent}
                  onClick={() => update({ accent })}
                  data-theme={resolvedTheme}
                  data-accent={accent}
                  className={cn(
                    "size-6 rounded-full bg-primary ring-offset-2 ring-offset-card transition-transform hover:scale-110",
                    prefs.accent === accent && "ring-2 ring-foreground/50",
                  )}
                />
              ))}
            </div>
          </Row>
          <Row label={t.settings.textSize}>
            <Stepper
              value={prefs.textSize}
              min={15}
              max={28}
              format={(v) => `${v}px`}
              onChange={(textSize) => update({ textSize })}
            />
          </Row>
          <Row label={t.settings.lineSpacing}>
            <Stepper
              value={prefs.lineSpacing}
              min={1.3}
              max={2.1}
              step={0.1}
              format={(v) => v.toFixed(1)}
              onChange={(lineSpacing) => update({ lineSpacing })}
            />
          </Row>
          <div className="bg-background/60 px-5 py-4">
            <p className="scripture">For God so loved the world that He gave His one and only Son…</p>
            <p lang="am" className="scripture mt-2">
              በእርሱ የሚያምን ሁሉ የዘላለም ሕይወት እንዲኖረው እንጂ እንዳይጠፋ…
            </p>
          </div>
        </Group>

        <Group title={t.settings.language}>
          <Row label={t.settings.appLanguage}>
            <Segmented
              value={prefs.locale}
              onChange={(locale) => update({ locale })}
              options={[
                { value: "en", label: "English" },
                { value: "am", label: <span lang="am">አማርኛ</span> },
              ]}
            />
          </Row>
          <Row label={t.settings.calendar}>
            <Segmented
              value={prefs.calendar}
              onChange={(calendar) => update({ calendar })}
              options={[
                { value: "gregorian", label: t.settings.gregorian },
                { value: "ethiopian", label: t.settings.ethiopian },
              ]}
            />
          </Row>
        </Group>

        <Group title={t.settings.reading}>
          <Row label={t.settings.leftTranslation}>
            <TranslationSelect
              value={prefs.mainTranslation}
              onChange={(mainTranslation) => update({ mainTranslation })}
            />
          </Row>
          <Row label={t.settings.rightTranslation}>
            <TranslationSelect
              value={prefs.parallelTranslation}
              onChange={(parallelTranslation) => update({ parallelTranslation })}
            />
          </Row>
        </Group>

        <Group title={t.settings.habits}>
          <Row label={t.settings.dailyGoal}>
            <Stepper
              value={prefs.goalMinutes}
              min={5}
              max={120}
              step={5}
              format={(v) => `${v}′`}
              onChange={(goalMinutes) => update({ goalMinutes })}
            />
          </Row>
          <Row label={t.settings.graceDays} hint={t.today.graceNote}>
            <Segmented
              value={prefs.rules.gracePerWeek}
              onChange={(gracePerWeek) => update({ rules: { ...prefs.rules, gracePerWeek } })}
              options={[0, 1, 2, 3].map((n) => ({ value: n, label: n }))}
            />
          </Row>
          <Row label={t.settings.restDays}>
            <div className="flex gap-1">
              {t.weekdaysShort.map((day, i) => {
                const on = prefs.rules.restWeekdays.includes(i);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      update({
                        rules: {
                          ...prefs.rules,
                          restWeekdays: on
                            ? prefs.rules.restWeekdays.filter((d) => d !== i)
                            : [...prefs.rules.restWeekdays, i],
                        },
                      })
                    }
                    className={cn(
                      "h-7 min-w-9 rounded-md px-1.5 text-[11px] font-medium transition-colors",
                      on
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </Row>
        </Group>

        <Group title={t.settings.data}>
          <Row label={t.settings.backups}>
            <Switch checked={backups} onCheckedChange={setBackups} />
          </Row>
          <Row label={t.settings.export}>
            <span className="text-xs text-muted-foreground">Markdown · JSON</span>
          </Row>
        </Group>

        <Group title={t.settings.licences}>
          {TRANSLATIONS.map((tr) => (
            <div key={tr.id}>
              <button
                type="button"
                onClick={() => setOpenLicence(openLicence === tr.id ? null : tr.id)}
                className="flex w-full items-center gap-4 px-5 py-3 text-left"
              >
                <span className="w-10 text-xs font-semibold text-muted-foreground">{tr.abbreviation}</span>
                <span lang={tr.language} className="flex-1 truncate text-sm">
                  {tr.name}
                </span>
                <span className="text-xs text-muted-foreground">{tr.licence.name}</span>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    openLicence === tr.id && "rotate-180",
                  )}
                />
              </button>
              {openLicence === tr.id && (
                <p className="whitespace-pre-line border-t bg-background/60 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
                  {tr.notice}
                </p>
              )}
            </div>
          ))}
        </Group>
      </div>
    </div>
  );
}
