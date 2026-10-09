CREATE TABLE "game_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"match" text NOT NULL,
	"rated" boolean DEFAULT false NOT NULL,
	"rows" integer NOT NULL,
	"cols" integer NOT NULL,
	"mines" integer NOT NULL,
	"layout" text NOT NULL,
	"open_row" integer NOT NULL,
	"open_col" integer NOT NULL,
	"outcome" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"mine_hits" integer NOT NULL,
	"bv" integer NOT NULL,
	"moves" jsonb NOT NULL,
	"suspect" boolean DEFAULT false NOT NULL,
	"suspect_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_attempt" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_attempt" ADD COLUMN "hidden_reason" text;--> statement-breakpoint
ALTER TABLE "game_result" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "game_result" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game_result" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game_result" ADD COLUMN "hidden_reason" text;--> statement-breakpoint
ALTER TABLE "multiplayer_result" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "multiplayer_result" ADD COLUMN "hidden_reason" text;--> statement-breakpoint
ALTER TABLE "game_record" ADD CONSTRAINT "game_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_record_user_idx" ON "game_record" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "game_record_match_idx" ON "game_record" USING btree ("match");