-- CreateTable
CREATE TABLE `FunctionFolder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(256) NOT NULL,
    `functionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FunctionFolder_functionId_name_key`(`functionId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FunctionFolder` ADD CONSTRAINT `FunctionFolder_functionId_fkey` FOREIGN KEY (`functionId`) REFERENCES `Function`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
