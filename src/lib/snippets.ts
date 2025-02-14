import { width, height } from '$lib/constants';

export interface Snippet {
	x: number;
	y: number;
	text: string;
	alpha: number; // Current transparency (1 = opaque, 0 = fully transparent)
	lifetime: number; // Remaining frames to live
	initialLifetime: number; // Total lifetime (for alpha calculation)
	initialFontSize: number;
	finalFontSize: number;
	vx: number; // Horizontal velocity (pixels per frame)
	vy: number; // Vertical velocity (pixels per frame)
}

// Create a new snippet using any object with x and y properties.
// The options parameter is optional. If vx and/or vy are provided,
// the snippet will move in that direction at 1 pixel per frame; otherwise, it moves upward.
export function createSnippet(
	text: string,
	options?: {
		x?: number;
		y?: number;
		vx?: number;
		vy?: number;
		lifetime?: number;
		initialFontSize?: number;
		finalFontSize?: number;
	}
): Snippet {
	// Default values.
	const defaultX = width / 2;
	const defaultY = height / 2;
	const defaultVx = 0;
	const defaultVy = -1;
	const defaultLifetime = 60;
	const defaultInitialFontSize = 14;
	const defaultFinalFontSize = 20;

	const { initialFontSize, finalFontSize } = options || {};

	const x = options?.x !== undefined ? options.x : defaultX;
	const y = options?.y !== undefined ? options.y : defaultY;
	const lifetime = options?.lifetime !== undefined ? options.lifetime : defaultLifetime;

	// Determine velocity.
	let vx: number, vy: number;
	if (options?.vx !== undefined && options?.vy !== undefined) {
		const mag = Math.sqrt(options.vx * options.vx + options.vy * options.vy);
		if (mag > 0) {
			vx = options.vx / mag;
			vy = options.vy / mag;
		} else {
			vx = defaultVx;
			vy = defaultVy;
		}
	} else {
		vx = defaultVx;
		vy = defaultVy;
	}

	return {
		x,
		y,
		text: text.toUpperCase(),
		alpha: 1,
		lifetime,
		initialLifetime: lifetime,
		vx,
		vy,
		initialFontSize: initialFontSize || defaultInitialFontSize,
		finalFontSize: finalFontSize || defaultFinalFontSize
	};
}

// Update all snippets: each snippet moves according to its velocity and fades out.
export function updateSnippets(snippets: Snippet[]): Snippet[] {
	const updated: Snippet[] = [];
	for (const s of snippets) {
		s.x += s.vx;
		s.y += s.vy;
		s.lifetime--;
		s.alpha = s.lifetime / s.initialLifetime;
		if (s.lifetime > 0) updated.push(s);
	}
	return updated;
}

// Draw the snippets on the canvas.
export function drawSnippets(ctx: CanvasRenderingContext2D, snippets: Snippet[]): void {
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	for (const s of snippets) {
		const { initialFontSize, finalFontSize } = s;
		// As s.alpha goes from 1 to 0, increase font size.
		const fontSize = initialFontSize + (finalFontSize - initialFontSize) * (1 - s.alpha);
		ctx.font = `bold ${fontSize}px sans-serif`;
		ctx.fillStyle = `rgba(150,255,150,${s.alpha.toFixed(2)})`;
		ctx.fillText(s.text, s.x, s.y);
	}
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
}
