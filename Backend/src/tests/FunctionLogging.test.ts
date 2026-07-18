import { TriggerLog } from '@prisma/client';
import { describe, it, expect } from 'vitest';
import { getExitCodeFromLog, stripHeadersFromPayload } from '../lib/FunctionLogging';

describe('getExitCodeFromLog', () => {
  const makeLog = (result: string) =>
    ({
      createdAt: new Date(),
      functionId: 1,
      id: 1,
      result,
    }) as TriggerLog;

  it('reads the exit_code key written by persistFunctionExecutionLog', async () => {
    const log = makeLog(JSON.stringify({ exit_code: 137, tooks: [], output: '' }));
    expect(await getExitCodeFromLog(log)).toBe(137);
  });

  it('falls back to the legacy exitCode key', async () => {
    const log = makeLog(JSON.stringify({ exitCode: 0 }));
    expect(await getExitCodeFromLog(log)).toBe(0);
  });

  it('returns null when no exit code is present', async () => {
    const log = makeLog(JSON.stringify({ output: 'hi' }));
    expect(await getExitCodeFromLog(log)).toBe(null);
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
