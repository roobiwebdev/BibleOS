/**
 * SOURCE OF TRUTH KEYWORDS: FEEDBACK_CATEGORIES, FeedbackCategory, FEEDBACK_STATUSES, feedback options
 * WHAT:  Option lists shared by client forms and server validation.
 * WHERE: feedback dialog, admin feedback page, api feedback router.
 */
export const FEEDBACK_CATEGORIES = [
  { value: "feature-request", label: "Feature Request" },
  { value: "bug", label: "Bug Report" },
  { value: "improvement", label: "Improvement" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];
export const FEEDBACK_CATEGORY_VALUES = FEEDBACK_CATEGORIES.map((c) => c.value) as [
  FeedbackCategory,
  ...FeedbackCategory[],
];

export const FEEDBACK_STATUSES = ["open", "reviewed", "planned", "resolved", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
