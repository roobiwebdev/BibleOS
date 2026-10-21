import { redirect } from "next/navigation";

import { getAuthConfig } from "@/lib/actions/settings";

import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const authConfig = await getAuthConfig();
  // Admin switched password reset off: the link is hidden on login, and the page is closed too.
  if (!authConfig.forgotPasswordEnabled) redirect("/login");
  return <ForgotPasswordForm />;
}
