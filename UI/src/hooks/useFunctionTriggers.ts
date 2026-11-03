import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import {
	createTrigger,
	deleteTrigger,
	getTriggers,
	runTrigger,
	updateTrigger,
} from "../services/backend.triggers";
import type { Trigger } from "../types/Prisma";

export interface TriggerInput {
	name: string;
	description: string;
	cron: string;
	data: string;
	enabled: boolean;
}

/**
 * Trigger list state and CRUD for one function. Each action reports failures
 * with a toast and resolves to whether it succeeded, as the trigger modals
 * expect.
 */
export function useFunctionTriggers(
	functionId: number | null,
	{ onRan }: { onRan?: () => void | Promise<void> } = {},
) {
	const [triggers, setTriggers] = useState<Trigger[]>([]);

	const create = useCallback(
		async (input: TriggerInput) => {
			if (functionId === null) return false;
			try {
				const response = await createTrigger(functionId, input);
				if (response.status !== "OK") {
					toast.error("Error creating trigger: " + response.message);
					return false;
				}
				const reloaded = await getTriggers(functionId);
				if (reloaded.status === "OK") setTriggers(reloaded.data);
				return true;
			} catch (error) {
				console.error("Error creating trigger:", error);
				toast.error("An error occurred while creating the trigger.");
				return false;
			}
		},
		[functionId],
	);

	const update = useCallback(
		async (triggerId: number, input: TriggerInput) => {
			if (functionId === null) return false;
			try {
				const response = await updateTrigger(functionId, triggerId, input);
				if (response.status !== "OK") {
					toast.error("Error updating trigger: " + response.message);
					return false;
				}
				setTriggers((prev) =>
					prev.map((trigger) =>
						trigger.id === triggerId ? response.data : trigger,
					),
				);
				return true;
			} catch (error) {
				console.error("Error updating trigger:", error);
				toast.error("An error occurred while updating the trigger.");
				return false;
			}
		},
		[functionId],
	);

	const remove = useCallback(
		async (triggerId: number) => {
			if (functionId === null) return false;
			try {
				const response = await deleteTrigger(functionId, triggerId);
				if (response.status !== "OK") {
					toast.error("Error deleting trigger: " + response.message);
					return false;
				}
				setTriggers((prev) =>
					prev.filter((trigger) => trigger.id !== triggerId),
				);
				return true;
			} catch (error) {
				console.error("Error deleting trigger:", error);
				toast.error("An error occurred while deleting the trigger.");
				return false;
			}
		},
		[functionId],
	);

	const run = useCallback(
		async (trigger: Trigger | null) => {
			if (functionId === null || !trigger) return false;
			try {
				const response = await runTrigger(functionId, trigger.id);
				if (response.status !== "OK") {
					toast.error("Error running trigger: " + response.message);
					return false;
				}
				toast.success("Trigger executed");
				await onRan?.();
				return true;
			} catch (error) {
				console.error("Error running trigger:", error);
				toast.error("An error occurred while running the trigger.");
				return false;
			}
		},
		[functionId, onRan],
	);

	return { triggers, setTriggers, create, update, remove, run };
}
