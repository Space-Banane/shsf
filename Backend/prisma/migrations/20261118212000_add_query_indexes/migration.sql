-- Additive index migration for the log, storage, file and share read paths.
-- Duplicate FunctionFile / FunctionStorageItem rows must fail the unique indexes,
-- so clean those up before deploying if a legacy database contains any.

-- CreateIndex
CREATE INDEX `AuditLog_targetType_targetId_createdAt_idx` ON `AuditLog`(`targetType`, `targetId`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `FunctionFile_functionId_name_key` ON `FunctionFile`(`functionId`, `name`);

-- CreateIndex
CREATE INDEX `FunctionStorageItem_expiresAt_idx` ON `FunctionStorageItem`(`expiresAt`);

-- CreateIndex
CREATE UNIQUE INDEX `FunctionStorageItem_storageId_key_key` ON `FunctionStorageItem`(`storageId`, `key`);

-- CreateIndex
CREATE INDEX `TriggerLog_functionId_createdAt_idx` ON `TriggerLog`(`functionId`, `createdAt`);

-- CreateIndex
-- MariaDB removes the automatically created `ResourceShare_groupId_fkey` /
-- `ResourceShare_userId_fkey` index as soon as an explicit equivalent exists.
CREATE INDEX `ResourceShare_groupId_idx` ON `ResourceShare`(`groupId`);

-- CreateIndex
CREATE INDEX `ResourceShare_userId_idx` ON `ResourceShare`(`userId`);
