/*
  Warnings:

  - You are about to drop the `player_confidence_inputs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "player_confidence_inputs" DROP CONSTRAINT "player_confidence_inputs_gamePk_fkey";

-- DropTable
DROP TABLE "player_confidence_inputs";
