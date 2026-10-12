CREATE TABLE "training_card" (
	"user_id" text NOT NULL,
	"deck" text NOT NULL,
	"item" text NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "training_card_user_id_deck_item_pk" PRIMARY KEY("user_id","deck","item")
);
--> statement-breakpoint
ALTER TABLE "training_card" ADD CONSTRAINT "training_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;