import { PI2 } from '$lib/constants';

export interface Ripple {
	x: number;
	y: number;
	radius: number;
	lifetime: number; // frames remaining
	initialLifetime: number; // total frames
}

// Create a new ripple effect centered at (x,y)
export function createRipple(options: { x: number; y: number }, lifetime: number = 60): Ripple {
	const { x, y } = options;
	return { x, y, radius: 0, lifetime, initialLifetime: lifetime };
}

// Update all ripples: increase radius and decrease lifetime.
export function updateRipples(ripples: Ripple[]): Ripple[] {
	return ripples
		.map((r) => {
			// Increase radius (you can tweak the growth rate here)
			r.radius += 2; // pixels per frame
			r.lifetime--;
			return r;
		})
		.filter((r) => r.lifetime > 0);
}

// Draw ripples onto the canvas.
export function drawRipples(ctx: CanvasRenderingContext2D, ripples: Ripple[]): void {
	ripples.forEach((r) => {
		const alpha = r.lifetime / r.initialLifetime;
		ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(r.x, r.y, r.radius, 0, PI2);
		ctx.stroke();
	});
}
