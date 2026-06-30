CREATE TABLE "player_names" (
    "playerId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_names_pkey" PRIMARY KEY ("playerId")
);
