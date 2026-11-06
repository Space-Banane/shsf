/*
  Warnings:

  - A unique constraint covering the columns `[ssoIdentity]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Session` ADD COLUMN `expiresAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `ssoIdentity` CHAR(64) NULL,
    ADD COLUMN `ssoPolicy` CHAR(64) NULL,
    ADD COLUMN `ssoValidUntil` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_ssoIdentity_key` ON `User`(`ssoIdentity`);

-- OIDC group identifiers are case-sensitive. Prisma does not model collations.
ALTER TABLE `Group`
    MODIFY `ssoProvider` VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    MODIFY `ssoGroupId` VARCHAR(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL;
