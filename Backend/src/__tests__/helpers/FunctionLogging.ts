import { TriggerLog } from '@prisma/client';
import { describe, it, expect } from 'vitest';
import { getExitCodeFromLog, stripHeadersFromPayload } from '../../lib/FunctionLogging';

describe('getExitCodeFromLog', () => {
  it('should return the correct exit code',async () => {
    const expectedExitCode = 0; // Replace with the expected exit code for your test case
    const test = {
      createdAt: new Date(),
      functionId: 1,
      id: 1,
      result: JSON.stringify({ exitCode: expectedExitCode }),
    } as TriggerLog;

    expect(await getExitCodeFromLog(test)).toBe(expectedExitCode);
  });
});

describe("stripHeadersFromPayload", () => {
	it("should strip the headers from the payload", async () => {
		const payload = JSON.stringify({
			ran_by: "exec",
			headers: {
				insert: "header",
			},
			queries: {},
			source_ip: "REDACTED",
			route: "experience",
			method: "GET",
		});
		const expected = JSON.stringify({
			ran_by: "exec",
			queries: {},
			source_ip: "REDACTED",
			route: "experience",
			method: "GET",
		});

		expect(await stripHeadersFromPayload(payload)).toBe(expected);
	});
});
