-- CreateEnum
CREATE TYPE "PreOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'PACK_PREORDER';

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "founderTier" TEXT,
ADD COLUMN     "isFounder" BOOLEAN NOT NULL DEFAULT false;

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

-- AddForeignKey
ALTER TABLE "pre_orders" ADD CONSTRAINT "pre_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
