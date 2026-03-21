import { describe, it, expect } from "vitest";
import { validateCronExpression } from "../../lib/Cron";

describe("validateCronExpression", () => {
    it("returns true for a valid cron expression", async () => {
        const result = await validateCronExpression("0 0 * * *");
        expect(result).toBe(true);
    });

    it("returns false for an invalid cron expression", async () => {
        const result = await validateCronExpression("invalid-cron");
        expect(result).toBe(false);
    });
});