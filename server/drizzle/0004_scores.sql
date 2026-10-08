CREATE TABLE "daily_attempt" (
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"duration_ms" integer,
	"mine_hits" integer,
	CONSTRAINT "daily_attempt_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "multiplayer_result" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "multiplayer_result_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"rows" integer NOT NULL,
	"cols" integer NOT NULL,
	"mines" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"mine_hits" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_attempt" ADD CONSTRAINT "daily_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multiplayer_result" ADD CONSTRAINT "multiplayer_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "multiplayer_result_board_idx" ON "multiplayer_result" USING btree ("rows","cols","mines","duration_ms");