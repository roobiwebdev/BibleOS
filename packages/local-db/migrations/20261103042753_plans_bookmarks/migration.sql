CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`start_vid` integer NOT NULL,
	`end_vid` integer NOT NULL,
	`label` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_progress` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`plan_id` text NOT NULL,
	`day` integer NOT NULL,
	`completed_at` integer NOT NULL,
	CONSTRAINT `fk_plan_progress_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`plan_key` text NOT NULL,
	`title` text NOT NULL,
	`definition` text,
	`started_on` text NOT NULL,
	`finished_at` integer,
	`left_at` integer
);
--> statement-breakpoint
CREATE INDEX `bookmarks_range_idx` ON `bookmarks` (`start_vid`,`end_vid`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_progress_plan_day_idx` ON `plan_progress` (`plan_id`,`day`);--> statement-breakpoint
CREATE INDEX `plans_key_idx` ON `plans` (`plan_key`);