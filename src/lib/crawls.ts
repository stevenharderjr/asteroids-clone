import { PI2, width, height } from './constants';

export interface Crawl {
	x: number;
	y: number;
	text: string;
	alpha: number; // Current transparency (1 = opaque, 0 = fully transparent)
	lifetime: number; // Remaining frames to live
	initialLifetime: number; // Total lifetime (for alpha calculation)
	vx: number; // Horizontal velocity (pixels per frame)
	vy: number; // Vertical velocity (pixels per frame)
	initialFontSize: number; // Font size when the crawl is at the starting position
	finalFontSize: number; // Font size when the crawl is at the top
}

/**
 * Creates a new crawl.
 * @param text The text to display.
 * @param options An optional object that can include:
 *   - x, y: the starting position (defaults to the bottom-center of the canvas)
 *   - vx, vy: the velocity vector (if provided, normalized to 1 pixel per frame; defaults to upward)
 *   - lifetime: the number of frames the crawl lasts (default 180)
 *   - initialFontSize: the font size at the starting position (default 30)
 *   - finalFontSize: the font size at the top of the crawl (default 14)
 */
export function createCrawl(
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
): Crawl {
	const defaultX = width / 2;
	const defaultY = height;
	const defaultVx = 0;
	const defaultVy = -3;
	const defaultLifetime = 180;
	const defaultInitialFontSize = 100;
	const defaultFinalFontSize = 1;

	const x = options?.x ?? defaultX;
	const y = options?.y ?? defaultY;
	const lifetime = options?.lifetime ?? defaultLifetime;
	const initialFontSize = options?.initialFontSize ?? defaultInitialFontSize;
	const finalFontSize = options?.finalFontSize ?? defaultFinalFontSize;

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
		initialFontSize,
		finalFontSize
	};
}

/**
 * Updates the crawls: each crawl moves according to its velocity, its lifetime decreases,
 * and its alpha is updated based on the remaining lifetime.
 */
export function updateCrawls(crawls: Crawl[]): Crawl[] {
	const updated: Crawl[] = [];
	for (const c of crawls) {
		c.x += c.vx;
		c.y += c.vy;
		c.lifetime--;
		c.alpha = c.lifetime / c.initialLifetime;
		if (c.lifetime > 0) {
			updated.push(c);
		}
	}
	return updated;
}

/**
 * Draws the crawls on the canvas.
 * The font size is interpolated between the crawl's initialFontSize and finalFontSize
 * based on its vertical position relative to the canvas height.
 */
// export function drawCrawls(ctx: CanvasRenderingContext2D, crawls: Crawl[]): void {
// 	ctx.textAlign = 'center';
// 	ctx.textBaseline = 'middle';

// 	for (const c of crawls) {
// 		// Compute a scale factor based on the vertical position.
// 		// At the bottom (y near height), we use initialFontSize; at the top (y near 0), we use finalFontSize.
// 		const scaleFactor = c.y / height; // 1 at bottom, 0 at top.
// 		const fontSize = c.finalFontSize + (c.initialFontSize - c.finalFontSize) * scaleFactor;

// 		ctx.font = `bold ${fontSize}px 'VT323', monospace`;
// 		ctx.fillStyle = `rgba(255,150,0,${c.alpha.toFixed(2)})`;
// 		ctx.fillText(c.text, c.x, c.y);
// 	}
// }
export function drawCrawls(ctx: CanvasRenderingContext2D, crawls: Crawl[]): void {
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	for (const c of crawls) {
		// Compute vertical scale: 1 at bottom, 0 at top.
		const verticalScale = c.y / height;
		// Use a non-linear transformation for horizontal scale to produce a pyramid effect.
		// For example, square the vertical scale:
		const horizontalScale = Math.pow(verticalScale, 2);

		// Interpolate the font size using the vertical scale.
		const fontSize = c.initialFontSize * verticalScale;

		ctx.save();
		ctx.translate(c.x, c.y);
		// Apply non-uniform scaling: horizontalScale for x, verticalScale for y.
		ctx.scale(horizontalScale, verticalScale);
		ctx.font = `bold ${fontSize}px 'VT323', monospace`;
		ctx.fillStyle = `rgba(255,150,0,${c.alpha.toFixed(2)})`;
		ctx.fillText(c.text, 0, 0);
		ctx.restore();
	}
}
