import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeps a scrollable output element pinned to the bottom as `content` grows,
 * until the user scrolls up; scrolling back to the bottom re-enables it.
 */
export function useAutoScroll(content: string) {
	const ref = useRef<HTMLDivElement>(null!);
	const [autoScroll, setAutoScroll] = useState(true);

	useEffect(() => {
		if (autoScroll && ref.current) {
			ref.current.scrollTop = ref.current.scrollHeight;
		}
	}, [content, autoScroll]);

	const onScroll = useCallback(() => {
		if (!ref.current) return;
		const { scrollTop, scrollHeight, clientHeight } = ref.current;
		setAutoScroll(Math.abs(scrollHeight - clientHeight - scrollTop) < 10);
	}, []);

	const resume = useCallback(() => {
		setAutoScroll(true);
		if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
	}, []);

	return { ref, autoScroll, onScroll, resume };
}
