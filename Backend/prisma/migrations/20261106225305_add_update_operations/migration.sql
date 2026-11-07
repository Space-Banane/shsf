-- CreateTable
CREATE TABLE `UpdateOperation` (
    `id` VARCHAR(36) NOT NULL,
    `status` ENUM('running', 'completed', 'failed', 'cancelled', 'rolled_back') NOT NULL DEFAULT 'running',
    `phase` ENUM('preflight', 'pull', 'replacement', 'migration', 'verification', 'completion', 'rollback', 'failure') NOT NULL DEFAULT 'preflight',
    `trigger` VARCHAR(16) NOT NULL,
    `imageRef` VARCHAR(512) NULL,
    `fromImageId` VARCHAR(80) NULL,
    `fromDigest` VARCHAR(255) NULL,
    `toImageId` VARCHAR(80) NULL,
    `toDigest` VARCHAR(255) NULL,
    `helperContainerId` VARCHAR(80) NULL,
    `exitCode` INTEGER NULL,
    `error` TEXT NULL,
    `log` TEXT NULL,
    `helperOutput` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `finishedAt` DATETIME(3) NULL,
    `deadlineAt` DATETIME(3) NOT NULL,

    INDEX `UpdateOperation_status_idx`(`status`),
    INDEX `UpdateOperation_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
