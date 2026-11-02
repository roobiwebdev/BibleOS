CREATE TABLE `change_log` (
	`id` text PRIMARY KEY,
	`entity` text NOT NULL,
	`entity_id` text,
	`action` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chapter_reads` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`chapter_vid` integer NOT NULL,
	`first_read_at` integer NOT NULL,
	`last_read_at` integer NOT NULL,
	`times` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`collection_id` text NOT NULL,
	`start_vid` integer NOT NULL,
	`end_vid` integer NOT NULL,
	`sort` integer NOT NULL,
	CONSTRAINT `fk_collection_items_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`sort` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`kind` text NOT NULL,
	`target` integer NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text
);
--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`start_vid` integer NOT NULL,
	`end_vid` integer NOT NULL,
	`color` text NOT NULL,
	`char_start` integer,
	`char_end` integer,
	`quote` text
);
--> statement-breakpoint
CREATE TABLE `note_anchors` (
	`id` text PRIMARY KEY,
	`note_id` text NOT NULL,
	`start_vid` integer NOT NULL,
	`end_vid` integer NOT NULL,
	`sort` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_note_anchors_note_id_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `note_links` (
	`id` text PRIMARY KEY,
	`from_note_id` text NOT NULL,
	`to_note_id` text,
	`to_start_vid` integer,
	`to_end_vid` integer,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_note_links_from_note_id_notes_id_fk` FOREIGN KEY (`from_note_id`) REFERENCES `notes`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `note_tags` (
	`note_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `note_tags_pk` PRIMARY KEY(`note_id`, `tag_id`),
	CONSTRAINT `fk_note_tags_note_id_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_note_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body_md` text NOT NULL,
	`body_norm` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`focused_seconds` integer NOT NULL,
	`translation_id` text NOT NULL,
	`vid_start` integer NOT NULL,
	`vid_furthest` integer NOT NULL,
	`local_day` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `change_log_at_idx` ON `change_log` (`at`);--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_reads_chapter_idx` ON `chapter_reads` (`chapter_vid`);--> statement-breakpoint
CREATE INDEX `chapter_reads_last_idx` ON `chapter_reads` (`last_read_at`);--> statement-breakpoint
CREATE INDEX `collection_items_collection_idx` ON `collection_items` (`collection_id`,`sort`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_items_live_unique_idx` ON `collection_items` (`collection_id`,`start_vid`,`end_vid`) WHERE "collection_items"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `highlights_range_idx` ON `highlights` (`start_vid`,`end_vid`);--> statement-breakpoint
CREATE INDEX `note_anchors_range_idx` ON `note_anchors` (`start_vid`,`end_vid`);--> statement-breakpoint
CREATE INDEX `note_anchors_note_idx` ON `note_anchors` (`note_id`);--> statement-breakpoint
CREATE INDEX `note_links_from_idx` ON `note_links` (`from_note_id`);--> statement-breakpoint
CREATE INDEX `note_links_to_note_idx` ON `note_links` (`to_note_id`);--> statement-breakpoint
CREATE INDEX `note_links_to_range_idx` ON `note_links` (`to_start_vid`,`to_end_vid`);--> statement-breakpoint
CREATE INDEX `note_tags_tag_idx` ON `note_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `notes_kind_updated_idx` ON `notes` (`kind`,`updated_at`);--> statement-breakpoint
CREATE INDEX `reading_sessions_local_day_idx` ON `reading_sessions` (`local_day`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_idx` ON `tags` (`name`);