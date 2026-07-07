-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `displayName` VARCHAR(128) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` ENUM('Admin', 'User') NOT NULL DEFAULT 'User',
    `password` VARCHAR(256) NULL,
    `openRouterKey` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hash` TEXT NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Function` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `description` VARCHAR(256) NOT NULL,
    `image` VARCHAR(256) NOT NULL,
    `executionId` VARCHAR(256) NOT NULL,
    `executionAlias` VARCHAR(128) NULL,
    `userId` INTEGER NOT NULL,
    `max_ram` INTEGER NOT NULL DEFAULT 512,
    `timeout` INTEGER NOT NULL DEFAULT 15,
    `allow_http` BOOLEAN NOT NULL DEFAULT true,
    `env` TEXT NULL,
    `secure_header` VARCHAR(256) NULL,
    `retry_on_failure` BOOLEAN NOT NULL DEFAULT false,
    `max_retries` INTEGER NOT NULL DEFAULT 3,
    `tags` TEXT NULL,
    `startup_file` VARCHAR(256) NOT NULL,
    `cors_origins` TEXT NULL,
    `docker_mount` BOOLEAN NOT NULL DEFAULT false,
    `network_restricted` BOOLEAN NOT NULL DEFAULT false,
    `ffmpeg_install` BOOLEAN NOT NULL DEFAULT false,
    `opencv_install` BOOLEAN NOT NULL DEFAULT false,
    `git_url` VARCHAR(1024) NULL,
    `git_username` VARCHAR(256) NULL,
    `git_password` VARCHAR(512) NULL,
    `git_periodic_pull` BOOLEAN NOT NULL DEFAULT false,
    `git_pull_interval` INTEGER NOT NULL DEFAULT 10,
    `git_source_dir` VARCHAR(512) NULL,
    `git_branch` VARCHAR(256) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastRun` DATETIME(3) NULL,
    `namespaceId` INTEGER NOT NULL,
    `logging` TEXT NULL,
    `ratelimit` TEXT NULL,
    `guest_access` BOOLEAN NOT NULL DEFAULT false,
    `imported` BOOLEAN NOT NULL DEFAULT false,
    `ai_kicked_off` BOOLEAN NOT NULL DEFAULT false,
    `cache_enabled` BOOLEAN NOT NULL DEFAULT false,
    `cache_ttl` INTEGER NOT NULL DEFAULT 60,

    UNIQUE INDEX `Function_executionId_key`(`executionId`),
    UNIQUE INDEX `Function_executionAlias_key`(`executionAlias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FunctionCache` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `functionId` INTEGER NOT NULL,
    `hash` VARCHAR(256) NOT NULL,
    `result` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `FunctionCache_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `FunctionCache_functionId_hash_key`(`functionId`, `hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FunctionFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(256) NOT NULL,
    `content` TEXT NOT NULL,
    `functionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Namespace` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FunctionTrigger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `description` VARCHAR(256) NOT NULL,
    `cron` VARCHAR(128) NOT NULL,
    `data` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `functionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastRun` DATETIME(3) NULL,
    `lastRunSuccessful` BOOLEAN NULL,
    `nextRun` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TriggerLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `functionId` INTEGER NOT NULL,
    `result` TEXT NULL,
    `logs` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(256) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `purpose` VARCHAR(512) NULL,
    `expiresAt` DATETIME(3) NULL,
    `expired` BOOLEAN NOT NULL DEFAULT false,
    `hidden` BOOLEAN NOT NULL DEFAULT false,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccessToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FunctionStorage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `purpose` VARCHAR(256) NOT NULL,
    `user` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FunctionStorageItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(256) NOT NULL,
    `value` TEXT NOT NULL,
    `storageId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestUser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `displayName` VARCHAR(128) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `permittedFunctions` JSON NOT NULL,
    `password_hash` VARCHAR(256) NOT NULL,
    `guestOwnerId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GuestUser_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hash` TEXT NOT NULL,
    `guestUserId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Function` ADD CONSTRAINT `Function_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Function` ADD CONSTRAINT `Function_namespaceId_fkey` FOREIGN KEY (`namespaceId`) REFERENCES `Namespace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FunctionCache` ADD CONSTRAINT `FunctionCache_functionId_fkey` FOREIGN KEY (`functionId`) REFERENCES `Function`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FunctionFile` ADD CONSTRAINT `FunctionFile_functionId_fkey` FOREIGN KEY (`functionId`) REFERENCES `Function`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Namespace` ADD CONSTRAINT `Namespace_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FunctionTrigger` ADD CONSTRAINT `FunctionTrigger_functionId_fkey` FOREIGN KEY (`functionId`) REFERENCES `Function`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TriggerLog` ADD CONSTRAINT `TriggerLog_functionId_fkey` FOREIGN KEY (`functionId`) REFERENCES `Function`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessToken` ADD CONSTRAINT `AccessToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FunctionStorage` ADD CONSTRAINT `FunctionStorage_user_fkey` FOREIGN KEY (`user`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FunctionStorageItem` ADD CONSTRAINT `FunctionStorageItem_storageId_fkey` FOREIGN KEY (`storageId`) REFERENCES `FunctionStorage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestUser` ADD CONSTRAINT `GuestUser_guestOwnerId_fkey` FOREIGN KEY (`guestOwnerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestSession` ADD CONSTRAINT `GuestSession_guestUserId_fkey` FOREIGN KEY (`guestUserId`) REFERENCES `GuestUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
