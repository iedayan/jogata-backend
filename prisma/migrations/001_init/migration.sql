-- CreateEnum
CREATE TYPE "StyleRarity" AS ENUM ('COMMON', 'RARE', 'LEGENDARY', 'MYTHIC');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PACK_PURCHASE', 'PACK_PREORDER', 'MARKETPLACE_BUY', 'MARKETPLACE_SELL', 'TOURNAMENT_ENTRY', 'TOURNAMENT_PRIZE', 'STYLE_FUSION', 'REFUND', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PreOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "walletAddress" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "country" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "weeklyRank" INTEGER,
    "overallRank" INTEGER,
    "packsPurchased" INTEGER NOT NULL DEFAULT 0,
    "isFounder" BOOLEAN NOT NULL DEFAULT false,
    "founderTier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rarity" "StyleRarity" NOT NULL,
    "category" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "keyMetrics" JSONB NOT NULL,
    "imageUrl" TEXT,
    "animationUrl" TEXT,
    "externalUrl" TEXT,
    "basePoints" INTEGER NOT NULL DEFAULT 0,
    "bonusMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "maxSupply" INTEGER,
    "currentSupply" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_styles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "styleCardId" TEXT NOT NULL,
    "tokenId" TEXT,
    "mintedAt" TIMESTAMP(3),
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "weeklyPoints" INTEGER NOT NULL DEFAULT 0,
    "activationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "externalId" TEXT,
    "appearances" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_performances" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "opponent" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "stats" JSONB NOT NULL,
    "styleScores" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_activations" (
    "id" TEXT NOT NULL,
    "styleCardId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameweek" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "points" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entryFee" INTEGER NOT NULL,
    "maxEntries" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalPrize" INTEGER NOT NULL DEFAULT 0,
    "prizeStructure" JSONB NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "entryFee" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "prize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "styleCardId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "stripePaymentId" TEXT,
    "blockchainTxHash" TEXT,
    "packType" TEXT,
    "packCount" INTEGER NOT NULL DEFAULT 1,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "packCount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "pricePerPack" INTEGER NOT NULL,
    "status" "PreOrderStatus" NOT NULL DEFAULT 'PENDING',
    "isEarlyBird" BOOLEAN NOT NULL DEFAULT true,
    "packContents" JSONB NOT NULL,
    "deliveredPacks" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");
CREATE UNIQUE INDEX "style_cards_name_key" ON "style_cards"("name");
CREATE UNIQUE INDEX "user_styles_tokenId_key" ON "user_styles"("tokenId");
CREATE UNIQUE INDEX "user_styles_userId_styleCardId_key" ON "user_styles"("userId", "styleCardId");
CREATE UNIQUE INDEX "players_externalId_key" ON "players"("externalId");
CREATE UNIQUE INDEX "style_activations_styleCardId_gameweek_season_rank_key" ON "style_activations"("styleCardId", "gameweek", "season", "rank");
CREATE UNIQUE INDEX "tournament_entries_userId_tournamentId_key" ON "tournament_entries"("userId", "tournamentId");

-- Performance Indexes
CREATE INDEX "idx_users_email" ON "users"("email");
CREATE INDEX "idx_users_wallet" ON "users"("walletAddress");
CREATE INDEX "idx_user_styles_user_id" ON "user_styles"("userId");
CREATE INDEX "idx_style_activations_gameweek" ON "style_activations"("gameweek", "season");
CREATE INDEX "idx_player_performances_date" ON "player_performances"("matchDate");
CREATE INDEX "idx_transactions_user_type" ON "transactions"("userId", "type");
CREATE INDEX "idx_marketplace_status" ON "marketplace_listings"("status");

-- Foreign Keys
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_styles" ADD CONSTRAINT "user_styles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_styles" ADD CONSTRAINT "user_styles_styleCardId_fkey" FOREIGN KEY ("styleCardId") REFERENCES "style_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_performances" ADD CONSTRAINT "player_performances_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "style_activations" ADD CONSTRAINT "style_activations_styleCardId_fkey" FOREIGN KEY ("styleCardId") REFERENCES "style_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "style_activations" ADD CONSTRAINT "style_activations_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_styleCardId_fkey" FOREIGN KEY ("styleCardId") REFERENCES "style_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pre_orders" ADD CONSTRAINT "pre_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;