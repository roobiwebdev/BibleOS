CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"bio" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member',
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'default',
	"app_name" text DEFAULT 'Project Starter' NOT NULL,
	"app_description" text DEFAULT '' NOT NULL,
	"app_url" text DEFAULT '' NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"og_image" text,
	"app_theme" text DEFAULT 'default' NOT NULL,
	"support_email" text DEFAULT '' NOT NULL,
	"privacy_content" text DEFAULT '' NOT NULL,
	"terms_content" text DEFAULT '' NOT NULL,
	"onboarding_enabled" boolean DEFAULT true NOT NULL,
	"email_verification_enabled" boolean DEFAULT false NOT NULL,
	"forgot_password_enabled" boolean DEFAULT true NOT NULL,
	"social_login_enabled" boolean DEFAULT false NOT NULL,
	"organizations_enabled" boolean DEFAULT false NOT NULL,
	"invites_enabled" boolean DEFAULT false NOT NULL,
	"signups_enabled" boolean DEFAULT true NOT NULL,
	"default_user_role" text DEFAULT 'user' NOT NULL,
	"max_users_enabled" boolean DEFAULT false NOT NULL,
	"max_users" integer DEFAULT 0 NOT NULL,
	"session_timeout" integer DEFAULT 30 NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_message" text DEFAULT 'We''re performing scheduled maintenance. We''ll be back shortly.' NOT NULL,
	"waitlist_mode" boolean DEFAULT false NOT NULL,
	"waitlist_title" text DEFAULT 'Join the waitlist' NOT NULL,
	"waitlist_headline" text DEFAULT 'Be the first to know when we launch' NOT NULL,
	"waitlist_description" text DEFAULT '' NOT NULL,
	"waitlist_button_text" text DEFAULT 'Join waitlist' NOT NULL,
	"waitlist_success_message" text DEFAULT 'You''re on the list! We''ll notify you when we launch.' NOT NULL,
	"waitlist_show_name" boolean DEFAULT false NOT NULL,
	"waitlist_show_company" boolean DEFAULT false NOT NULL,
	"countdown_mode" boolean DEFAULT false NOT NULL,
	"countdown_target" timestamp,
	"countdown_title" text DEFAULT 'Coming soon' NOT NULL,
	"countdown_headline" text DEFAULT 'We''re launching soon' NOT NULL,
	"countdown_description" text DEFAULT '' NOT NULL,
	"countdown_end_message" text DEFAULT 'We''re live! Check back soon.' NOT NULL,
	"storage_public_url" text,
	"storage_bucket" text,
	"storage_account_id" text,
	"storage_access_key_id" text,
	"storage_secret_access_key" text,
	"resend_api_key" text,
	"resend_from_email" text,
	"google_client_id" text,
	"google_client_secret" text,
	"github_client_id" text,
	"github_client_secret" text,
	"polar_access_token" text,
	"polar_organization_id" text,
	"polar_webhook_secret" text,
	"polar_sandbox_mode" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY,
	"user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"description" text,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"tag" text DEFAULT 'general' NOT NULL,
	"attachment_url" text,
	"attachment_name" text,
	"sender_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_recipient" (
	"id" text PRIMARY KEY,
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"excerpt" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"og_image" text,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"author_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL UNIQUE,
	"polar_subscription_id" text NOT NULL UNIQUE,
	"polar_customer_id" text NOT NULL,
	"product_id" text,
	"status" text NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entry" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"name" text,
	"company" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "user_created_at_idx" ON "user" ("created_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE INDEX "invitation_org_id_idx" ON "invitation" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_uq" ON "member" ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" ("status");--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" ("created_at");--> statement-breakpoint
CREATE INDEX "notification_sender_idx" ON "notification" ("sender_id");--> statement-breakpoint
CREATE INDEX "notification_created_idx" ON "notification" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipient_uq" ON "notification_recipient" ("notification_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_recipient_user_read_idx" ON "notification_recipient" ("user_id","read");--> statement-breakpoint
CREATE INDEX "notification_recipient_user_created_idx" ON "notification_recipient" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "post_published_idx" ON "post" ("published","published_at");--> statement-breakpoint
CREATE INDEX "post_author_idx" ON "post" ("author_id");--> statement-breakpoint
CREATE INDEX "post_created_idx" ON "post" ("created_at");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" ("status");--> statement-breakpoint
CREATE INDEX "waitlist_created_idx" ON "waitlist_entry" ("created_at");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_recipient" ADD CONSTRAINT "notification_recipient_notification_id_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_recipient" ADD CONSTRAINT "notification_recipient_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_author_id_user_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;