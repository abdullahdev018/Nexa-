-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CreditTransactionKind" AS ENUM ('GRANT', 'SPEND', 'REFUND', 'ADJUSTMENT', 'EXPIRY');

-- CreateEnum
CREATE TYPE "CampaignGoal" AS ENUM ('SALES', 'LEADS', 'BRAND_AWARENESS', 'PRODUCT_LAUNCH', 'ENGAGEMENT', 'WEBSITE_TRAFFIC');

-- CreateEnum
CREATE TYPE "CampaignStyle" AS ENUM ('PROFESSIONAL', 'UGC', 'EDUCATIONAL', 'STORYTELLING', 'PROMOTIONAL', 'LUXURY', 'FUN', 'MINIMAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'WHATSAPP', 'GOOGLE');

-- CreateEnum
CREATE TYPE "CampaignAssetKind" AS ENUM ('STRATEGY', 'AUDIENCE_SUMMARY', 'POSITIONING', 'MARKETING_ANGLE', 'HOOK', 'ALT_HOOK', 'CONTENT_IDEA', 'VIDEO_CONCEPT', 'AD_COPY', 'SOCIAL_CAPTION', 'CTA', 'CONTENT_CALENDAR');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('POST', 'REEL', 'STORY', 'SHORT', 'CAROUSEL', 'CAPTION', 'AD');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "VideoType" AS ENUM ('PRODUCT_SHOWCASE', 'UGC', 'PROBLEM_SOLUTION', 'TESTIMONIAL', 'PROMOTIONAL', 'EDUCATIONAL', 'FOUNDER_STORY', 'PRODUCT_LAUNCH');

-- CreateEnum
CREATE TYPE "VideoRenderStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "AdLaunchState" AS ENUM ('NOT_LAUNCHED', 'PROVIDER_NOT_CONFIGURED', 'AWAITING_CONFIRMATION', 'LAUNCHED');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('DEMO', 'IMPORTED', 'CONNECTED');

-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('PENDING', 'RESEARCHING', 'COMPLETE', 'FAILED', 'PROVIDER_NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "AIFeature" AS ENUM ('CHAT', 'CAMPAIGN', 'CONTENT', 'VIDEO_PLAN', 'AD', 'COMPETITOR', 'CALENDAR', 'INSIGHTS');
-- AlterEnum: Plan gains STARTER and AGENCY, and loses TEAM.
--
-- Done as a rename rather than ADD VALUE because Postgres will not let a value
-- added in one transaction be used in the same one. "User"."plan" keeps
-- pointing at the old type until the backfill below has copied it onto each
-- user's new workspace; only then is the column and the old type dropped.
ALTER TABLE "public"."User" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TYPE "Plan" RENAME TO "Plan_old";
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PRO', 'AGENCY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastWorkspaceId" TEXT;

-- AlterTable: nullable for now. Backfilled below, then made NOT NULL, so no
-- existing conversation is lost on the way into the workspace model.
ALTER TABLE "Conversation" ADD COLUMN "workspaceId" TEXT;

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "provider" TEXT,
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditBalance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "monthlyAllowance" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" "CreditTransactionKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT,
    "description" TEXT,
    "colors" JSONB NOT NULL DEFAULT '[]',
    "fonts" JSONB NOT NULL DEFAULT '[]',
    "toneOfVoice" TEXT,
    "audience" TEXT,
    "guidelines" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "imageUrl" TEXT,
    "category" TEXT,
    "price" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "goal" "CampaignGoal" NOT NULL,
    "style" "CampaignStyle" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceAgeRange" TEXT,
    "audienceLocation" TEXT,
    "audienceInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audienceCustomerType" TEXT,
    "audiencePainPoints" TEXT,
    "platforms" "Platform"[] DEFAULT ARRAY[]::"Platform"[],
    "strategy" JSONB,
    "generatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAsset" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "CampaignAssetKind" NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "brandId" TEXT,
    "platform" "Platform" NOT NULL,
    "format" "ContentFormat" NOT NULL,
    "topic" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "variantGroup" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "productId" TEXT,
    "type" "VideoType" NOT NULL,
    "goal" TEXT,
    "audience" TEXT,
    "tone" TEXT,
    "platform" "Platform",
    "durationSeconds" INTEGER,
    "title" TEXT,
    "plan" JSONB,
    "renderStatus" "VideoRenderStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "renderProvider" TEXT,
    "renderJobId" TEXT,
    "renderUrl" TEXT,
    "renderError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "platform" "AdPlatform" NOT NULL,
    "primaryText" TEXT NOT NULL,
    "headlines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "descriptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cta" TEXT,
    "audienceAngle" TEXT,
    "creativeConcept" TEXT,
    "variantGroup" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "launchState" "AdLaunchState" NOT NULL DEFAULT 'NOT_LAUNCHED',
    "externalId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "contentId" TEXT,
    "platform" "Platform" NOT NULL,
    "format" "ContentFormat" NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "source" "DataSource" NOT NULL,
    "platform" "Platform",
    "date" TIMESTAMP(3) NOT NULL,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT,
    "url" TEXT NOT NULL,
    "status" "ResearchStatus" NOT NULL DEFAULT 'PENDING',
    "analysis" JSONB,
    "analyzedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "feature" "AIFeature" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "creditsCharged" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);


-- ---------------------------------------------------------------------------
-- Backfill: every existing account becomes a workspace owner.
--
-- Workspace ids are derived from the user id rather than generated, so the
-- inserts below can reference them without a round trip, and so re-running
-- this migration against a partially migrated database is detectable.
-- ---------------------------------------------------------------------------

INSERT INTO "Workspace" ("id", "name", "slug", "ownerId", "plan", "createdAt", "updatedAt")
SELECT
  'ws_' || u."id",
  COALESCE(NULLIF(u."name", ''), split_part(u."email", '@', 1)) || '''s Workspace',
  'w-' || lower(u."id"),
  u."id",
  (CASE u."plan"::text WHEN 'TEAM' THEN 'AGENCY' ELSE u."plan"::text END)::"Plan",
  u."createdAt",
  CURRENT_TIMESTAMP
FROM "User" u;

INSERT INTO "Membership" ("id", "workspaceId", "userId", "role", "createdAt")
SELECT 'mb_' || u."id", 'ws_' || u."id", u."id", 'OWNER'::"WorkspaceRole", u."createdAt"
FROM "User" u;

-- A subscription row with provider = NULL means nobody has ever paid. The
-- plan column records what the account was granted; it is not a claim that a
-- payment happened.
INSERT INTO "Subscription" ("id", "workspaceId", "plan", "status", "interval", "createdAt", "updatedAt")
SELECT
  'sb_' || u."id",
  'ws_' || u."id",
  (CASE u."plan"::text WHEN 'TEAM' THEN 'AGENCY' ELSE u."plan"::text END)::"Plan",
  'ACTIVE'::"SubscriptionStatus",
  'MONTHLY'::"BillingInterval",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u;

-- Opening credit grant. The amounts match lib/billing/plans.ts; they are
-- written here as literals because a migration must keep meaning the same
-- thing after the config changes.
INSERT INTO "CreditBalance" ("id", "workspaceId", "balance", "monthlyAllowance", "periodStart", "periodEnd", "updatedAt")
SELECT
  'cb_' || u."id",
  'ws_' || u."id",
  (CASE u."plan"::text WHEN 'PRO' THEN 2000 WHEN 'TEAM' THEN 7000 ELSE 100 END),
  (CASE u."plan"::text WHEN 'PRO' THEN 2000 WHEN 'TEAM' THEN 7000 ELSE 100 END),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  CURRENT_TIMESTAMP
FROM "User" u;

INSERT INTO "CreditTransaction" ("id", "workspaceId", "amount", "kind", "reason", "balanceAfter", "createdAt")
SELECT
  'ct_' || u."id",
  'ws_' || u."id",
  (CASE u."plan"::text WHEN 'PRO' THEN 2000 WHEN 'TEAM' THEN 7000 ELSE 100 END),
  'GRANT'::"CreditTransactionKind",
  'Opening balance',
  (CASE u."plan"::text WHEN 'PRO' THEN 2000 WHEN 'TEAM' THEN 7000 ELSE 100 END),
  CURRENT_TIMESTAMP
FROM "User" u;

UPDATE "User" u SET "lastWorkspaceId" = 'ws_' || u."id";

-- Existing chat threads move into their author's workspace.
UPDATE "Conversation" c SET "workspaceId" = 'ws_' || c."userId";

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditBalance_workspaceId_key" ON "CreditBalance"("workspaceId");

-- CreateIndex
CREATE INDEX "CreditTransaction_workspaceId_createdAt_idx" ON "CreditTransaction"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "Brand_workspaceId_idx" ON "Brand"("workspaceId");

-- CreateIndex
CREATE INDEX "Product_workspaceId_idx" ON "Product"("workspaceId");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_updatedAt_idx" ON "Campaign"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Campaign_productId_idx" ON "Campaign"("productId");

-- CreateIndex
CREATE INDEX "Campaign_brandId_idx" ON "Campaign"("brandId");

-- CreateIndex
CREATE INDEX "CampaignAsset_campaignId_kind_position_idx" ON "CampaignAsset"("campaignId", "kind", "position");

-- CreateIndex
CREATE INDEX "CampaignAsset_workspaceId_idx" ON "CampaignAsset"("workspaceId");

-- CreateIndex
CREATE INDEX "Content_workspaceId_createdAt_idx" ON "Content"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Content_campaignId_idx" ON "Content"("campaignId");

-- CreateIndex
CREATE INDEX "Content_variantGroup_idx" ON "Content"("variantGroup");

-- CreateIndex
CREATE INDEX "Video_workspaceId_createdAt_idx" ON "Video"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Video_campaignId_idx" ON "Video"("campaignId");

-- CreateIndex
CREATE INDEX "Ad_workspaceId_createdAt_idx" ON "Ad"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ad_campaignId_idx" ON "Ad"("campaignId");

-- CreateIndex
CREATE INDEX "Ad_variantGroup_idx" ON "Ad"("variantGroup");

-- CreateIndex
CREATE INDEX "CalendarItem_workspaceId_scheduledFor_idx" ON "CalendarItem"("workspaceId", "scheduledFor");

-- CreateIndex
CREATE INDEX "CalendarItem_campaignId_idx" ON "CalendarItem"("campaignId");

-- CreateIndex
CREATE INDEX "AnalyticsRecord_workspaceId_date_idx" ON "AnalyticsRecord"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "AnalyticsRecord_campaignId_idx" ON "AnalyticsRecord"("campaignId");

-- CreateIndex
CREATE INDEX "Competitor_workspaceId_createdAt_idx" ON "Competitor"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AIUsage_workspaceId_createdAt_idx" ON "AIUsage"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AIUsage_userId_idx" ON "AIUsage"("userId");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_updatedAt_idx" ON "Conversation"("workspaceId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBalance" ADD CONSTRAINT "CreditBalance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarItem" ADD CONSTRAINT "CalendarItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarItem" ADD CONSTRAINT "CalendarItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarItem" ADD CONSTRAINT "CalendarItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsRecord" ADD CONSTRAINT "AnalyticsRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsRecord" ADD CONSTRAINT "AnalyticsRecord_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Finalise: now that every row has a workspace, enforce it and retire the
-- per-user plan column the workspace has taken over.
-- ---------------------------------------------------------------------------
ALTER TABLE "Conversation" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "plan";
DROP TYPE "Plan_old";
