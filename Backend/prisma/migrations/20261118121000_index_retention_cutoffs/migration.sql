-- CreateIndex
CREATE INDEX `Session_expiresAt_createdAt_idx` ON `Session`(`expiresAt`, `createdAt`);

-- CreateIndex
CREATE INDEX `GuestSession_expiresAt_idx` ON `GuestSession`(`expiresAt`);
