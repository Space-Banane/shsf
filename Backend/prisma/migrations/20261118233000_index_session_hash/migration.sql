-- Session lookups filter on hash for every authenticated request. A TEXT
-- column cannot be indexed without a prefix, so bound it to the exact hash
-- length (64-char hex) and make it unique to turn the lookup into an index hit.

-- AlterTable
ALTER TABLE `Session` MODIFY `hash` VARCHAR(64) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Session_hash_key` ON `Session`(`hash`);
