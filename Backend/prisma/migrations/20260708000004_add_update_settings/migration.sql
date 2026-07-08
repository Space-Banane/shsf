-- AlterTable: add auto_update_enabled and update_last_check to InstanceSettingType enum
ALTER TABLE `InstanceSetting` MODIFY `type` ENUM('instance_uuid', 'registration_disabled', 'link_lock', 'guest_access_disabled', 'external_access_disabled', 'disabled_images', 'link_status', 'auto_update_enabled', 'update_last_check') NOT NULL;
