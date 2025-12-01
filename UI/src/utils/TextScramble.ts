export const enableScrambleAnimation = true;

interface QueueItem {
	from: string;
	to: string;
	start: number;
	end: number;
	char?: string;
}

export class TextScramble {
	el: HTMLElement;
	chars: string;
	queue: QueueItem[] = []; // added initializer
	frame: number = 0; // added initializer
	frameRequest: number = 0; // added initializer
	resolve!: () => void; // added definite assignment operator

	constructor(el: HTMLElement) {
		this.el = el;
		this.chars = "!<>-_\\/[]{}\u2014=+*^?#________";
		this.update = this.update.bind(this);
	}
	setText(newText: string): Promise<void> {
		if (!enableScrambleAnimation) {
			this.el.innerText = newText;
			return Promise.resolve();
		}
		const oldText: string = this.el.innerText;
		const length: number = Math.max(oldText.length, newText.length);
		const promise: Promise<void> = new Promise(
			(resolve) => (this.resolve = resolve),
		);
		this.queue = [];
		for (let i = 0; i < length; i++) {
			const from: string = oldText[i] || "";
			const to: string = newText[i] || "";
			const start: number = Math.floor(Math.random() * 40);
			const end: number = start + Math.floor(Math.random() * 40);
			this.queue.push({ from, to, start, end });
		}
		cancelAnimationFrame(this.frameRequest);
		this.frame = 0;
		this.update();
		return promise;
	}
	update(): void {
		let output: string = "";
		let complete: number = 0;
		for (let i = 0, n = this.queue.length; i < n; i++) {
			let { from, to, start, end, char } = this.queue[i];
			if (this.frame >= end) {
				complete++;
				output += to;
			} else if (this.frame >= start) {
				if (!char || Math.random() < 0.28) {
					char = this.randomChar();
					this.queue[i].char = char;
				}
				output += `<span class="text-blue-400">${char}</span>`;
			} else {
				output += from;
			}
		}
		this.el.innerHTML = output;
		if (complete === this.queue.length) {
			this.resolve();
		} else {
			this.frameRequest = requestAnimationFrame(this.update);
			this.frame++;
		}
	}
	randomChar(): string {
		return this.chars[Math.floor(Math.random() * this.chars.length)];
	}
}
