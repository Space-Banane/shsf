-- Add the opt-in instance setting for internal AI provider endpoints.
ALTER TABLE `InstanceSetting` MODIFY `type` ENUM('instance_uuid', 'registration_disabled', 'link_lock', 'guest_access_disabled', 'external_access_disabled', 'disabled_images', 'link_status', 'auto_update_enabled', 'update_last_check', 'allow_ai_provider_internal') NOT NULL;
