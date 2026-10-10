-- Add encrypted, OpenAI-compatible AI provider settings per user.
ALTER TABLE `User`
    ADD COLUMN `aiProviderEndpoint` VARCHAR(1024) NULL,
    ADD COLUMN `aiProviderModel` VARCHAR(256) NULL,
    ADD COLUMN `aiProviderApiKey` TEXT NULL,
    ADD COLUMN `aiProviderCapabilities` TEXT NULL;
