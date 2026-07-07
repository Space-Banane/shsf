-- CreateTable
CREATE TABLE `InstanceSetting` (
    `type` ENUM('instance_uuid', 'registration_disabled', 'link_lock', 'guest_access_disabled', 'external_access_disabled', 'disabled_images', 'link_status') NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
