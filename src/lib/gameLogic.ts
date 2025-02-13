// src/lib/gameLogic.ts

import {
	width,
	height,
	PI2,
	outerMargin,
	sparkLifetime,
	massWeightExponent,
	SNIPE_MULTIPLIER,
	SNIPE_TIME_THRESHOLD,
	MIN_SNIPE_DISTANCE
} from './constants';

// --- Constants for Fragmentation ---
export const smallestFragmentRadius = 12;
export const smallestFragmentArea = Math.PI * smallestFragmentRadius * smallestFragmentRadius; // area of 12px radius

// --- Type Definitions ---
export interface Asteroid {
	x: number;
	y: number;
	angle: number;
	speed: number;
	radius: number; // current drawn radius (may be affected by jagged offsets)
	targetRadius: number; // the base radius when spawned
	area: number; // precomputed area = π * (targetRadius)²
	vertexCount: number;
	offsets: number[];
	offsetAngle: number;
}

export interface Bullet {
	x: number;
	y: number;
	vx: number;
	vy: number;
	distanceTraveled: number;
	maxDistance: number;
	shotTime: number; // Time when the bullet was fired (ms)
	deltaShotTime: number; // Time since the previous bullet was fired (ms)
}

export interface Spark {
	x: number;
	y: number;
	vx: number;
	vy: number;
	age: number;
}

export interface ScoreResult {
	value: number;
	label?: string;
}

// --- Spawning Functions ---

// Spawn an asteroid off-screen with a random targetRadius between smallest and 70.
export function spawnAsteroid(): Asteroid {
	const edge = Math.floor(Math.random() * 4);
	let x: number, y: number;
	const getRandomOffset = (dim: number) => dim * 0.25;
	switch (edge) {
		case 0:
			x = -getRandomOffset(width);
			y = Math.random() * height;
			break;
		case 1:
			x = width + getRandomOffset(width);
			y = Math.random() * height;
			break;
		case 2:
			y = -getRandomOffset(height);
			x = Math.random() * width;
			break;
		case 3:
			y = height + getRandomOffset(height);
			x = Math.random() * width;
			break;
	}
	const targetX = Math.random() * width;
	const targetY = Math.random() * height;
	let angle = Math.atan2(targetY - y, targetX - x);
	angle += (Math.random() - 0.5) * (Math.PI / 6);
	// Random radius between smallestFragmentRadius and 70.
	const minRadius = smallestFragmentRadius;
	const maxRadius = 70;
	const r = Math.random() * (maxRadius - minRadius) + minRadius;
	const area = Math.PI * r * r;
	const vertexCount = Math.floor(8 + Math.random() * 5);
	const offsets: number[] = [];
	for (let i = 0; i < vertexCount; i++) {
		offsets.push(0.8 + Math.random() * 0.4);
	}
	const speed = 1 + Math.random() * 2;
	const offsetAngle = Math.random() * PI2;
	return {
		x,
		y,
		angle,
		speed,
		radius: r,
		targetRadius: r,
		area,
		vertexCount,
		offsets,
		offsetAngle
	};
}

// Spawn explosion sparks at (x,y) based on bullet and asteroid velocities.
export function spawnExplosion(
	x: number,
	y: number,
	bullet: Bullet,
	asteroid: Asteroid,
	sparks: Spark[]
): void {
	const sparkCount = 10;
	const bulletVx = bullet.vx;
	const bulletVy = bullet.vy;
	const asteroidVx = asteroid.speed * Math.cos(asteroid.angle);
	const asteroidVy = asteroid.speed * Math.sin(asteroid.angle);
	// Weight based on parent's targetRadius normalized between smallest and max (70).
	const normalizedMass =
		(asteroid.targetRadius - smallestFragmentRadius) / (70 - smallestFragmentRadius);
	const weight = Math.pow(normalizedMass, massWeightExponent);
	const explosionVx = (1 - weight) * bulletVx + weight * asteroidVx;
	const explosionVy = (1 - weight) * bulletVy + weight * asteroidVy;
	const explosionBaseAngle = Math.atan2(explosionVy, explosionVx);
	const spreadRange = Math.PI / 3; // ±30°
	for (let i = 0; i < sparkCount; i++) {
		const sparkAngle = explosionBaseAngle + (Math.random() - 0.5) * spreadRange;
		const speed = 1 + Math.random() * 2;
		sparks.push({
			x,
			y,
			vx: speed * Math.cos(sparkAngle),
			vy: speed * Math.sin(sparkAngle),
			age: 0
		});
	}
}

// Helper: returns a random point uniformly distributed within a circle of radius R.
function randomPointInCircle(R: number): { x: number; y: number } {
	const r = Math.sqrt(Math.random()) * R;
	const theta = Math.random() * PI2;
	return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

/**
 * Fragments an asteroid into smaller pieces.
 * Each fragment is positioned so its outer edge touches the parent's inner edge.
 * The fragment's velocity is determined by summing:
 *   - A placement component (a unit vector from the parent's center to the fragment's center, scaled by 2),
 *   - The parent's velocity,
 *   - The bullet's velocity (with reduced influence),
 * and then scaling the result by explosionForceScale to reduce the overall explosion force.
 *
 * The function subtracts each fragment's area from the parent's available area until the area left
 * is less than the area of a smallest fragment.
 */
export function fragmentAsteroid(bullet: Bullet, asteroid: Asteroid): Asteroid[] {
	// If the asteroid's area is too small to split into at least two smallest fragments, return [].
	if (asteroid.area < 2 * smallestFragmentArea) {
		return [];
	}

	let availableArea = asteroid.area;
	let fragments: Asteroid[] = [];

	// Compute parent's velocity vector.
	const parentV = {
		x: asteroid.speed * Math.cos(asteroid.angle),
		y: asteroid.speed * Math.sin(asteroid.angle)
	};
	// Bullet's velocity vector.
	const bulletV = { x: bullet.vx, y: bullet.vy };

	// Define weights for the components.
	const w1 = 2; // placement component weight
	const w2 = 1; // parent's velocity weight
	const w3 = 0.2; // bullet's velocity weight (reduced)

	// New constant to reduce overall explosion force.
	const explosionForceScale = 0.5;

	// Fixed spread for additional randomness.
	const spreadRange = 40 * (Math.PI / 180); // 40° total variation.

	while (availableArea >= smallestFragmentArea) {
		// Choose a fragment area between smallestFragmentArea and up to half of availableArea.
		const maxFragArea = Math.max(smallestFragmentArea, availableArea * 0.5);
		const fragArea = Math.random() * (maxFragArea - smallestFragmentArea) + smallestFragmentArea;
		if (fragArea > availableArea) break;

		// Compute the fragment's radius.
		const fragRadius = Math.sqrt(fragArea / Math.PI);

		// Determine a random placement for the fragment within the parent's circle.
		// Its center must be within a circle of radius (asteroid.radius - fragRadius)
		const maxPosRadius = Math.max(0, asteroid.radius - fragRadius);
		const pos = randomPointInCircle(maxPosRadius);

		// Compute placement component.
		const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
		const placementUnit = dist > 0 ? { x: pos.x / dist, y: pos.y / dist } : { x: 1, y: 0 };
		const vPlacement = { x: w1 * placementUnit.x, y: w1 * placementUnit.y };

		// Combine the components:
		const combinedVx = vPlacement.x + w2 * parentV.x + w3 * bulletV.x;
		const combinedVy = vPlacement.y + w2 * parentV.y + w3 * bulletV.y;

		// Scale down the overall explosion force.
		const scaledVx = explosionForceScale * combinedVx;
		const scaledVy = explosionForceScale * combinedVy;

		const fragAngle = Math.atan2(scaledVy, scaledVx);
		const fragSpeed =
			Math.sqrt(scaledVx * scaledVx + scaledVy * scaledVy) * (1 + Math.random() * 0.5);

		// Additional visual properties.
		const vertexCount = Math.floor(8 + Math.random() * 5);
		let offsets: number[] = [];
		for (let i = 0; i < vertexCount; i++) {
			offsets.push(0.8 + Math.random() * 0.4);
		}
		const offsetAngle = Math.random() * PI2;

		fragments.push({
			x: asteroid.x + pos.x,
			y: asteroid.y + pos.y,
			angle: fragAngle,
			speed: fragSpeed,
			radius: fragRadius,
			targetRadius: fragRadius,
			area: fragArea,
			vertexCount,
			offsets,
			offsetAngle,
			type: 'small' // All fragments are now considered "small"
		});

		availableArea -= fragArea;
	}

	return fragments;
}

// --- Update Functions ---
export function updateAsteroids(asteroids: Asteroid[]): void {
	asteroids.forEach((a) => {
		a.x += a.speed * Math.cos(a.angle);
		a.y += a.speed * Math.sin(a.angle);
		if (a.x < -outerMargin) a.x = width + outerMargin;
		if (a.x > width + outerMargin) a.x = -outerMargin;
		if (a.y < -outerMargin) a.y = height + outerMargin;
		if (a.y > height + outerMargin) a.y = -outerMargin;
	});
}

export function updateBullets(bullets: Bullet[]): Bullet[] {
	bullets.forEach((b) => {
		const stepDistance = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
		b.distanceTraveled += stepDistance;
		b.x += b.vx;
		b.y += b.vy;
		// Wrap positions.
		if (b.x < 0) b.x += width;
		if (b.x > width) b.x -= width;
		if (b.y < 0) b.y += height;
		if (b.y > height) b.y -= height;
	});
	// Return only the bullets that have not exceeded their maxDistance.
	return bullets.filter((b) => b.distanceTraveled <= b.maxDistance);
}

export function computeScoreForHit(
	asteroid: { targetRadius: number },
	bullet: { distanceTraveled: number; maxDistance: number; deltaShotTime: number }
): ScoreResult {
	const maxScore = 100;
	const minScore = 10;
	// Linear interpolation: smallest asteroid (targetRadius == 12) yields max score,
	// largest (targetRadius == 70) yields min score.
	const t = (asteroid.targetRadius - 12) / (70 - 12);
	let baseScore = Math.round(maxScore - t * (maxScore - minScore));

	// Check if both snipe conditions are met.
	let multiplier = 1;
	if (
		bullet.distanceTraveled >= MIN_SNIPE_DISTANCE * bullet.maxDistance &&
		bullet.deltaShotTime > SNIPE_TIME_THRESHOLD
	) {
		multiplier = Math.round(
			2 * (bullet.distanceTraveled / (MIN_SNIPE_DISTANCE * bullet.maxDistance))
		);
	}

	const finalScore = baseScore * multiplier;

	return {
		value: finalScore,
		label: multiplier > 1 ? `SNIPE (${baseScore}×${multiplier})` : undefined
	};
}

export function updateSparks(sparks: Spark[]): Spark[] {
	let newSparks: Spark[] = [];
	for (const spark of sparks) {
		if (spark.age >= sparkLifetime) continue;
		spark.x += spark.vx;
		spark.y += spark.vy;
		spark.age++;
		newSparks.push(spark);
	}
	return newSparks;
}

// --- API Functions ---
export async function fetchHighScores(): Promise<Array<{ name: string; score: number }>> {
	const res = await fetch('/api/high-scores');
	return await res.json();
}

export async function submitScore(name: string, score: number): Promise<void> {
	await fetch('/api/high-scores', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, score })
	});
}
