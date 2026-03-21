import CronExpressionParser from "cron-parser";

export async function validateCronExpression(cron: string): Promise<boolean> {
    try {
        CronExpressionParser.parse(cron);
        return true;
    } catch {
        return false;
    }
}