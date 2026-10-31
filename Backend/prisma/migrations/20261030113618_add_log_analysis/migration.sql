-- AlterTable
ALTER TABLE `User` ADD COLUMN `logAnalysisEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `logAnalysisModel` VARCHAR(256) NULL;

-- CreateTable
CREATE TABLE `LogAnalysis` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `triggerLogId` INTEGER NOT NULL,
    `status` ENUM('pending', 'running', 'completed', 'skipped', 'failed', 'disabled') NOT NULL DEFAULT 'pending',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `model` VARCHAR(256) NOT NULL,
    `inputVersion` INTEGER NULL,
    `inputHash` VARCHAR(64) NULL,
    `failureProbability` DOUBLE NULL,
    `failureDetected` BOOLEAN NULL,
    `attentionPriority` INTEGER NULL,
    `attentionConfidence` DOUBLE NULL,
    `decision` JSON NULL,
    `providerModel` VARCHAR(256) NULL,
    `costUsd` DOUBLE NULL,
    `inputTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `error` VARCHAR(512) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LogAnalysis_triggerLogId_key`(`triggerLogId`),
    INDEX `LogAnalysis_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LogAnalysis` ADD CONSTRAINT `LogAnalysis_triggerLogId_fkey` FOREIGN KEY (`triggerLogId`) REFERENCES `TriggerLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
