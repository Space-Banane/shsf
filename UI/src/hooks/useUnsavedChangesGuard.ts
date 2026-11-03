import { useEffect, useRef } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { useConfirm } from "../components/modals/ConfirmModal";

/**
 * Warns before the user loses unsaved edits by reloading or closing the tab,
 * and asks for confirmation before in-app navigation away from the page.
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
	const confirm = useConfirm();
	const promptOpenRef = useRef(false);

	useBeforeUnload(
		(event) => {
			if (!hasUnsavedChanges) return;
			event.preventDefault();
			event.returnValue = "";
		},
		{ capture: true },
	);

	const blocker = useBlocker(hasUnsavedChanges);

	useEffect(() => {
		if (blocker.state !== "blocked" || promptOpenRef.current) return;

		promptOpenRef.current = true;
		void (async () => {
			const shouldLeave = await confirm({
				title: "Unsaved Changes",
				message:
					"You have unsaved changes in this file. Leave this page and discard them?",
				confirmText: "Leave Page",
				cancelText: "Stay Here",
				variant: "delete",
			});

			if (shouldLeave) {
				blocker.proceed();
			} else {
				blocker.reset();
			}
			promptOpenRef.current = false;
		})();
	}, [blocker, confirm]);
}
