ALTER TABLE "game_record" ADD COLUMN "mode" text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
-- every game kept so far was one of the three there were: the one its kind was played as
UPDATE "game_record" SET "mode" = CASE "kind" WHEN 'multiplayer' THEN 'race' WHEN 'daily' THEN 'daily' ELSE 'classic' END;
