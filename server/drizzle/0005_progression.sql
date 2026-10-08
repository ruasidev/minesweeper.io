ALTER TABLE "profile" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "elo" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "games_started" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "play_seconds" integer DEFAULT 0 NOT NULL;