-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'MANAGER', 'AGENT');

-- CreateEnum
CREATE TYPE "tenant_plan" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "conversation_status" AS ENUM ('OPEN', 'ASSIGNED', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "message_direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACTS', 'INTERACTIVE', 'TEMPLATE', 'REACTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "handoff_reason" AS ENUM ('BOT_ESCALATION', 'USER_REQUEST', 'MANAGER_REASSIGN', 'AUTO_ROUTING', 'TIMEOUT', 'AGENT_OFFLINE');

-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('USER', 'SYSTEM', 'BOT', 'EXTERNAL');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "tenant_plan" NOT NULL DEFAULT 'FREE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'es',
    "branding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_concurrent_conversations" INTEGER NOT NULL DEFAULT 20,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "accepted_by_user_id" TEXT,
    "invited_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_integrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "business_account_id" TEXT NOT NULL,
    "display_phone_number" TEXT NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "webhook_verify_token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "whatsapp_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "wa_id" TEXT NOT NULL,
    "display_name" TEXT,
    "push_name" TEXT,
    "profile_picture_url" TEXT,
    "email" TEXT,
    "phone_number" TEXT,
    "attributes" JSONB,
    "tags" TEXT[],
    "lead_score" INTEGER,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "whatsapp_integration_id" TEXT NOT NULL,
    "status" "conversation_status" NOT NULL DEFAULT 'OPEN',
    "assigned_user_id" TEXT,
    "is_bot_active" BOOLEAN NOT NULL DEFAULT true,
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "last_message_preview" TEXT,
    "ai_summary" TEXT,
    "ai_intent" TEXT,
    "ai_lead_score" INTEGER,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "wa_message_id" TEXT,
    "direction" "message_direction" NOT NULL,
    "type" "message_type" NOT NULL,
    "sender_user_id" TEXT,
    "is_from_bot" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT,
    "media_url" TEXT,
    "media_mime_type" TEXT,
    "media_size_bytes" INTEGER,
    "media_caption" TEXT,
    "template_name" TEXT,
    "template_language" TEXT,
    "metadata" JSONB,
    "status" "message_status" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "system_prompt" TEXT NOT NULL,
    "welcome_message" TEXT,
    "handoff_message" TEXT,
    "off_hours_message" TEXT,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 1024,
    "context_window_messages" INTEGER NOT NULL DEFAULT 20,
    "auto_reply_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_reply_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "products" JSONB,
    "faqs" JSONB,
    "business_hours" JSONB,
    "monthly_token_budget" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "bot_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "from_user_id" TEXT,
    "to_user_id" TEXT,
    "is_bot_involved" BOOLEAN NOT NULL DEFAULT false,
    "reason" "handoff_reason" NOT NULL,
    "notes" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_type" "audit_actor_type" NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "trace_id" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_is_active_idx" ON "tenants"("is_active");

-- CreateIndex
CREATE INDEX "users_tenant_id_role_idx" ON "users"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "users_tenant_id_is_active_idx" ON "users"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_accepted_by_user_id_key" ON "invitations"("accepted_by_user_id");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_status_idx" ON "invitations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_email_idx" ON "invitations"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "invitations_expires_at_idx" ON "invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_tenant_id_expires_at_idx" ON "sessions"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_revoked_at_idx" ON "sessions"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_integrations_phone_number_id_key" ON "whatsapp_integrations"("phone_number_id");

-- CreateIndex
CREATE INDEX "whatsapp_integrations_tenant_id_is_active_idx" ON "whatsapp_integrations"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_integrations_tenant_id_phone_number_id_key" ON "whatsapp_integrations"("tenant_id", "phone_number_id");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_last_seen_at_idx" ON "contacts"("tenant_id", "last_seen_at" DESC);

-- CreateIndex
CREATE INDEX "contacts_tenant_id_lead_score_idx" ON "contacts"("tenant_id", "lead_score" DESC);

-- CreateIndex
CREATE INDEX "contacts_tenant_id_is_blocked_idx" ON "contacts"("tenant_id", "is_blocked");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenant_id_wa_id_key" ON "contacts"("tenant_id", "wa_id");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_status_idx" ON "conversations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_last_message_at_idx" ON "conversations"("tenant_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "conversations_tenant_id_assigned_user_id_status_idx" ON "conversations"("tenant_id", "assigned_user_id", "status");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_contact_id_idx" ON "conversations"("tenant_id", "contact_id");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_is_bot_active_idx" ON "conversations"("tenant_id", "is_bot_active");

-- CreateIndex
CREATE INDEX "messages_tenant_id_conversation_id_created_at_idx" ON "messages"("tenant_id", "conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_tenant_id_created_at_idx" ON "messages"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_tenant_id_direction_status_idx" ON "messages"("tenant_id", "direction", "status");

-- CreateIndex
CREATE UNIQUE INDEX "messages_tenant_id_wa_message_id_key" ON "messages"("tenant_id", "wa_message_id");

-- CreateIndex
CREATE INDEX "bot_configs_tenant_id_is_active_idx" ON "bot_configs"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "bot_configs_tenant_id_is_default_idx" ON "bot_configs"("tenant_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "bot_configs_tenant_id_name_key" ON "bot_configs"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "assignment_logs_tenant_id_conversation_id_idx" ON "assignment_logs"("tenant_id", "conversation_id");

-- CreateIndex
CREATE INDEX "assignment_logs_tenant_id_at_idx" ON "assignment_logs"("tenant_id", "at" DESC);

-- CreateIndex
CREATE INDEX "assignment_logs_tenant_id_to_user_id_idx" ON "assignment_logs"("tenant_id", "to_user_id");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_at_idx" ON "audit_events"("tenant_id", "at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_actor_user_id_idx" ON "audit_events"("tenant_id", "actor_user_id");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_action_idx" ON "audit_events"("tenant_id", "action");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_resource_type_resource_id_idx" ON "audit_events"("tenant_id", "resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_integrations" ADD CONSTRAINT "whatsapp_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_whatsapp_integration_id_fkey" FOREIGN KEY ("whatsapp_integration_id") REFERENCES "whatsapp_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_configs" ADD CONSTRAINT "bot_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_logs" ADD CONSTRAINT "assignment_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_logs" ADD CONSTRAINT "assignment_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_logs" ADD CONSTRAINT "assignment_logs_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_logs" ADD CONSTRAINT "assignment_logs_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
