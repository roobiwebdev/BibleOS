import { Button } from "@starter/ui/components/button";
import { Switch } from "@starter/ui/components/switch";
import { cn } from "@starter/ui/lib/utils";
import { isTauri } from "@tauri-apps/api/core";
import { Check, ChevronDown, Download, FileText, Globe, Minus, Plus, RefreshCw, Upload } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { BuiltBy } from "../../components/built-by";
import { OnlineAttribution } from "../../components/online-text";
import { Page, PageHeader } from "../../components/page";
import { Segmented } from "../../components/segmented";
import { TranslationSelect } from "../../components/translation-select";
import { isOnline, READER_TRANSLATIONS } from "../../lib/bible/catalog";
import { useFormatDate } from "../../lib/format";
import { ACCENTS, usePreferences, useT, type LineWidth } from "../../lib/state/preferences";
import { appVersion, checkForUpdates, installUpdate, useUpdates, type UpdateState } from "../../lib/updates";
import { useYourData } from "./use-your-data";

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="eyebrow mb-2 px-1">
        {title}
      </h2>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">{children}</div>
    </section>
  );
}

/** A settings row. The control receives the row's label id so it is named for assistive tech. */
function Row({ label, hint, children }: { label: string; hint?: string; children: (labelId: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p id={id} className="text-sm font-medium">
          {label}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children(id)}</div>
    </div>
  );
}

const round = (v: number) => Math.round(v * 100) / 100;

function Stepper({
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  labelledBy,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  labelledBy: string;
}) {
  const t = useT();
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
      <button
        type="button"
        aria-label={t.settings.decrease}
        className="rounded-md p-1.5 hover:bg-card disabled:opacity-40"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, round(value - step)))}
      >
        <Minus className="size-3.5" />
      </button>
      <output aria-live="polite" className="w-14 text-center text-[13px] font-medium tabular">
        {format(value)}
      </output>
      <button
        type="button"
        aria-label={t.settings.increase}
        className="rounded-md p-1.5 hover:bg-card disabled:opacity-40"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, round(value + step)))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** What the Updates row says for each state of the shared update store. */
function updateHint(state: UpdateState, t: ReturnType<typeof useT>): string {
  switch (state.status) {
    case "unsupported":
      return t.updates.previewOnly;
    case "idle":
      return t.updates.checkOnOpenHint;
    case "checking":
      return t.updates.checking;
    case "current":
      return t.updates.current;
    case "available":
      return t.updates.available(state.version);
    case "downloading":
      return t.updates.downloading(state.total ? Math.round((state.received / state.total) * 100) : undefined);
    case "restarting":
      return t.updates.restarting;
    case "error":
      return t.updates.failed;
  }
}

function UpdatesGroup() {
  const t = useT();
  const { prefs, update } = usePreferences();
  const state = useUpdates();
  const [version, setVersion] = useState<string>();
  useEffect(() => {
    void appVersion().then(setVersion);
  }, []);
  const native = state.status !== "unsupported";
  const busy = state.status === "checking" || state.status === "downloading" || state.status === "restarting";

  return (
    <Group title={t.updates.title}>
      <Row label={version ? t.updates.version(version) : t.updates.title} hint={updateHint(state, t)}>
        {(id) =>
          state.status === "available" ? (
            <Button size="sm" aria-labelledby={id} onClick={() => void installUpdate()}>
              <Download /> {t.updates.install}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              aria-labelledby={id}
              disabled={!native || busy}
              onClick={() => void checkForUpdates()}
            >
              <RefreshCw className={cn(state.status === "checking" && "animate-spin")} /> {t.updates.checkNow}
            </Button>
          )
        }
      </Row>
      {state.status === "available" && state.notes && (
        <div className="px-5 py-3">
          <p className="text-xs font-medium text-muted-foreground">{t.updates.whatsNew}</p>
          <p className="mt-1 text-sm whitespace-pre-line">{state.notes}</p>
        </div>
      )}
      <Row label={t.updates.checkOnOpen}>
        {(id) => (
          <Switch
            aria-labelledby={id}
            disabled={!native}
            checked={prefs.checkUpdates}
            onCheckedChange={(on) => update({ checkUpdates: on })}
          />
        )}
      </Row>
    </Group>
  );
}

export function SettingsPage() {
  const t = useT();
  const { prefs, update, resolvedTheme } = usePreferences();
  const data = useYourData();
  const formatDate = useFormatDate();
  const lastBackup = data.backups[0];
  const [openLicence, setOpenLicence] = useState<string | null>(null);
  const themeLabel = useId();

  return (
    <Page>
      <PageHeader title={t.settings.title} subtitle={t.settings.previewNote} />
      <div className="max-w-2xl">
        <Group title={t.settings.appearance}>
          <div role="radiogroup" aria-labelledby={themeLabel} className="p-5">
            <p id={themeLabel} className="mb-3 text-sm font-medium">
              {t.settings.theme}
            </p>
            <div className="grid grid-cols-4 gap-3">
              {(["system", "paper", "sepia", "night"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={prefs.theme === theme}
                  onClick={() => update({ theme })}
                  className="flex flex-col items-center gap-2 rounded-xl text-xs font-medium"
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
                        <span
                          data-theme="night"
                          className="flex flex-1 items-center bg-background pl-1 text-foreground"
                        >
                          a
                        </span>
                      </span>
                    ) : (
                      "Aa"
                    )}
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
          </div>
          <Row label={t.settings.accent}>
            {(id) => (
              <div role="radiogroup" aria-labelledby={id} className="flex gap-2">
                {ACCENTS.map((accent) => (
                  <button
                    key={accent}
                    type="button"
                    role="radio"
                    aria-checked={prefs.accent === accent}
                    title={t.accents[accent]}
                    aria-label={t.accents[accent]}
                    onClick={() => update({ accent })}
                    data-theme={resolvedTheme}
                    data-accent={accent}
                    className={cn(
                      "size-7 rounded-full bg-primary ring-offset-2 ring-offset-card transition-transform hover:scale-110",
                      prefs.accent === accent && "ring-2 ring-foreground/60",
                    )}
                  />
                ))}
              </div>
            )}
          </Row>
          <Row label={t.settings.textSize}>
            {(id) => (
              <Stepper
                labelledBy={id}
                value={prefs.textSize}
                min={15}
                max={28}
                format={(v) => `${v}px`}
                onChange={(textSize) => update({ textSize })}
              />
            )}
          </Row>
          <Row label={t.settings.lineSpacing}>
            {(id) => (
              <Stepper
                labelledBy={id}
                value={prefs.lineSpacing}
                min={1.3}
                max={2.1}
                step={0.05}
                format={(v) => v.toFixed(2)}
                onChange={(lineSpacing) => update({ lineSpacing })}
              />
            )}
          </Row>
          <Row label={t.settings.lineWidth}>
            {(id) => (
              <Segmented<LineWidth>
                labelledBy={id}
                value={prefs.lineWidth}
                onChange={(lineWidth) => update({ lineWidth })}
                options={(["narrow", "normal", "wide"] as const).map((w) => ({
                  value: w,
                  label: t.settings.widths[w],
                }))}
              />
            )}
          </Row>
          <div className="bg-background/60 px-5 py-4">
            <div className="reading-column">
              <p lang="en" className="scripture">
                For God so loved the world that He gave His one and only Son…
              </p>
              <p lang="am" className="scripture mt-2">
                በእርሱ የሚያምን ሁሉ የዘላለም ሕይወት እንዲኖረው እንጂ እንዳይጠፋ…
              </p>
            </div>
          </div>
        </Group>

        <Group title={t.settings.language}>
          <Row label={t.settings.appLanguage}>
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
          </Row>
          <Row label={t.settings.calendar}>
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
          </Row>
        </Group>

        <Group title={t.settings.reading}>
          <Row label={t.settings.leftTranslation}>
            {(id) => (
              <TranslationSelect
                labelledBy={id}
                value={prefs.mainTranslation}
                onChange={(mainTranslation) => update({ mainTranslation })}
              />
            )}
          </Row>
          <Row label={t.settings.rightTranslation}>
            {(id) => (
              <TranslationSelect
                labelledBy={id}
                value={prefs.parallelTranslation}
                onChange={(parallelTranslation) => update({ parallelTranslation })}
              />
            )}
          </Row>
        </Group>

        <Group title={t.settings.habits}>
          <Row label={t.settings.dailyGoal}>
            {(id) => (
              <Stepper
                labelledBy={id}
                value={prefs.goalMinutes}
                min={5}
                max={120}
                step={5}
                format={(v) => `${v} min`}
                onChange={(goalMinutes) => update({ goalMinutes })}
              />
            )}
          </Row>
          <Row label={t.settings.graceDays} hint={t.today.graceNote}>
            {(id) => (
              <Segmented
                labelledBy={id}
                value={prefs.rules.gracePerWeek}
                onChange={(gracePerWeek) => update({ rules: { ...prefs.rules, gracePerWeek } })}
                options={[0, 1, 2, 3].map((n) => ({ value: n, label: n }))}
              />
            )}
          </Row>
          <Row label={t.settings.restDays} hint={t.settings.restHint}>
            {(id) => (
              <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1">
                {t.weekdaysShort.map((day, i) => {
                  const on = prefs.rules.restWeekdays.includes(i);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
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
                        "h-7 min-w-10 rounded-md border px-1.5 text-xs font-medium transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background text-foreground hover:border-primary/50",
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}
          </Row>
        </Group>

        <Group title={t.settings.data}>
          <Row
            label={t.settings.backups}
            hint={
              !isTauri()
                ? t.welcome.data.previewOnly
                : `${t.welcome.data.autoHint} ${lastBackup ? t.welcome.data.lastBackup(formatDate(lastBackup.modifiedAt)) : t.welcome.data.noBackup}`
            }
          >
            {(id) => <Switch aria-labelledby={id} checked={prefs.autoBackup} onCheckedChange={data.setAutoBackup} />}
          </Row>
          <Row label={t.welcome.data.exportJson} hint={t.welcome.data.exportJsonHint}>
            {(id) => (
              <Button variant="outline" size="sm" aria-labelledby={id} disabled={data.busy} onClick={data.exportBackup}>
                <Download /> {t.welcome.data.exportButton}
              </Button>
            )}
          </Row>
          <Row label={t.welcome.data.importJson} hint={t.welcome.data.importHint}>
            {(id) => (
              <Button variant="outline" size="sm" aria-labelledby={id} disabled={data.busy} onClick={data.importBackup}>
                <Upload /> {t.welcome.data.importButton}
              </Button>
            )}
          </Row>
          <Row label={t.welcome.data.exportMarkdown} hint={t.welcome.data.exportMarkdownHint}>
            {(id) => (
              <Button
                variant="outline"
                size="sm"
                aria-labelledby={id}
                disabled={data.busy}
                onClick={data.exportMarkdown}
              >
                <FileText /> {t.welcome.data.exportButton}
              </Button>
            )}
          </Row>
        </Group>

        <UpdatesGroup />

        <Group title={t.settings.licences}>
          {READER_TRANSLATIONS.map((tr) => {
            const open = openLicence === tr.id;
            return (
              <div key={tr.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`licence-${tr.id}`}
                  onClick={() => setOpenLicence(open ? null : tr.id)}
                  className="flex w-full items-center gap-4 px-5 py-3 text-left"
                >
                  <span className="w-10 text-xs font-semibold text-muted-foreground">{tr.abbreviation}</span>
                  <span lang={tr.language} className="flex-1 truncate text-sm">
                    {tr.name}
                  </span>
                  {isOnline(tr) && <Globe aria-label={t.online.online} className="size-3.5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{tr.licence.name}</span>
                  <ChevronDown
                    aria-hidden
                    className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
                  />
                </button>
                {open && (
                  <div
                    id={`licence-${tr.id}`}
                    className="border-t bg-background/60 px-5 py-4 text-xs leading-relaxed text-muted-foreground"
                  >
                    <p lang={tr.language} className="whitespace-pre-line">
                      {tr.notice}
                    </p>
                    {isOnline(tr) && (
                      <>
                        <p className="mt-3">{t.online.licenceOnline}</p>
                        <OnlineAttribution translation={tr} className="mt-2" />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Group>

        <Group title={t.settings.about}>
          <BuiltBy className="px-5 py-3.5 text-sm" />
        </Group>
      </div>
    </Page>
  );
}
