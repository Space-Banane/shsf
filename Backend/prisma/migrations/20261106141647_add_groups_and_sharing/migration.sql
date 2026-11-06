-- CreateTable
CREATE TABLE `Group` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `description` VARCHAR(256) NULL,
    `ssoProvider` VARCHAR(128) NULL,
    `ssoGroupId` VARCHAR(256) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Group_name_key`(`name`),
    UNIQUE INDEX `Group_ssoProvider_ssoGroupId_key`(`ssoProvider`, `ssoGroupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMember` (
    `groupId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `source` ENUM('local', 'sso') NOT NULL DEFAULT 'local',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GroupMember_userId_idx`(`userId`),
    PRIMARY KEY (`groupId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResourceShare` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `namespaceId` INTEGER NULL,
    `functionId` INTEGER NULL,
    `storageId` INTEGER NULL,
    `userId` INTEGER NULL,
    `groupId` INTEGER NULL,
    `permission` ENUM('view', 'execute', 'edit') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ResourceShare_namespaceId_userId_key`(`namespaceId`, `userId`),
    UNIQUE INDEX `ResourceShare_namespaceId_groupId_key`(`namespaceId`, `groupId`),
    UNIQUE INDEX `ResourceShare_functionId_userId_key`(`functionId`, `userId`),
    UNIQUE INDEX `ResourceShare_functionId_groupId_key`(`functionId`, `groupId`),
    UNIQUE INDEX `ResourceShare_storageId_userId_key`(`storageId`, `userId`),
    UNIQUE INDEX `ResourceShare_storageId_groupId_key`(`storageId`, `groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NULL,
    `action` VARCHAR(64) NOT NULL,
    `targetType` VARCHAR(32) NOT NULL,
    `targetId` INTEGER NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceShare` ADD CONSTRAINT `ResourceShare_namespaceId_fkey` FOREIGN KEY (`namespaceId`) REFERENCES `Namespace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceShare` ADD CONSTRAINT `ResourceShare_functionId_fkey` FOREIGN KEY (`functionId`) REFERENCES `Function`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceShare` ADD CONSTRAINT `ResourceShare_storageId_fkey` FOREIGN KEY (`storageId`) REFERENCES `FunctionStorage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceShare` ADD CONSTRAINT `ResourceShare_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceShare` ADD CONSTRAINT `ResourceShare_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
