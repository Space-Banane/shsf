-- CreateTable
CREATE TABLE `DependencyInstall` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `functionId` INTEGER NOT NULL,
    `status` ENUM('running', 'succeeded', 'failed') NOT NULL DEFAULT 'running',
    `message` VARCHAR(1024) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DependencyInstall_functionId_status_idx`(`functionId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DependencyInstall` ADD CONSTRAINT `DependencyInstall_functionId_fkey` FOREIGN KEY (`functionId`) REFERENCES `Function`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
