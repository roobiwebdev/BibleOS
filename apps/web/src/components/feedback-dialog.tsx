"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: FeedbackDialog, send feedback, feature request, bug report, feedback form
 * WHAT:  Dialog where a signed-in user picks a category and sends a short message to the team.
 * WHY:   Controlled mode (open/onOpenChange) lets dropdown menus open it; uncontrolled mode renders
 *        its own trigger button. Categories come from @starter/config/content (shared with the API).
 * WHERE: dashboard shell (user menu + floating button), public user menu.
 */
import { useForm } from "@tanstack/react-form";
import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { FEEDBACK_CATEGORIES, FEEDBACK_CATEGORY_VALUES, type FeedbackCategory } from "@starter/config/content";
import { Button } from "@starter/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@starter/ui/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Textarea } from "@starter/ui/components/textarea";

import { submitFeedback } from "@/lib/actions/feedback";

const MAX_LENGTH = 2000;

const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORY_VALUES),
  message: z.string().trim().min(1, "Please enter a message").max(MAX_LENGTH),
});

function toCategory(value: string): FeedbackCategory | null {
  return FEEDBACK_CATEGORIES.find((c) => c.value === value)?.value ?? null;
}

type FeedbackDialogProps = {
  /** When provided, dialog is controlled and no trigger is rendered (e.g. for dropdown use) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function FeedbackDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: FeedbackDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen;

  const defaultValues: { category: FeedbackCategory; message: string } = { category: "feature-request", message: "" };
  const form = useForm({
    defaultValues,
    validators: { onSubmit: feedbackSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await submitFeedback({ category: value.category, message: value.message.trim() });
        toast.success("Feedback sent — thank you!");
        formApi.reset();
        setOpen(false);
      } catch {
        toast.error("Failed to send feedback");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
          >
            <MessageSquarePlus className="h-3 w-3" />
            Send Feedback
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md rounded-none!">
        <DialogHeader>
          <DialogTitle className="text-sm">Send Feedback</DialogTitle>
          <DialogDescription className="text-[11px]">
            Help us improve — share a bug, idea, or suggestion.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <div className="space-y-3">
            <form.Field name="category">
              {(field) => (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">
                    Category
                  </label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => {
                      const next = toCategory(v);
                      if (next) field.handleChange(next);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value} className="text-xs">
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field name="message">
              {(field) => (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">
                    Message
                  </label>
                  <Textarea
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Describe your feedback..."
                    className="min-h-[100px] text-xs resize-none"
                    maxLength={MAX_LENGTH}
                  />
                  <p className="text-[10px] text-muted-foreground/40 text-right mt-1">
                    {field.state.value.length}/{MAX_LENGTH}
                  </p>
                </div>
              )}
            </form.Field>
          </div>

          <DialogFooter className="rounded-none! mt-4">
            <form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting, message: s.values.message })}>
              {({ isSubmitting, message }) => (
                <Button type="submit" disabled={isSubmitting || !message.trim()} size="sm" className="text-xs h-8">
                  {isSubmitting ? "Sending..." : "Send Feedback"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
