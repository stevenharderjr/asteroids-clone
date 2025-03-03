import {
	width,
	height,
	PI2,
	ASTEROID_WRAP_FALLBACK_MARGIN,
	SPARK_MAX_LIFETIME,
	ASTEROID_MASS_WEIGHT_EXPONENT,
	SNIPE_MIN_SCORE_MULTIPLIER,
	SNIPE_MAX_TIME_THRESHOLD,
	SNIPE_MIN_DISTANCE
} from './constants';
import { getLevelConfig } from './levelConfig';
import { writable } from 'svelte/store';

export const currentLevel = writable(1);
export const shipsRemaining = writable(3);
export const dead = writable(false);
// --- Constants for Fragmentation ---
export const smallestFragmentRadius = 12;
export const smallestFragmentArea = Math.PI * smallestFragmentRadius * smallestFragmentRadius; // area of 12px radius

// --- Type Definitions ---
export interface Ship {
	x: number;
	y: number;
	vx: number;
	vy: number;
	speed: number;
	angle: number;
	turnRate: number;
	acceleration: number;
	radius: number;
}

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
	range: number;
	shotTime: number; // Time when the bullet was fired (ms)
	deltaShotTime: number; // Time since the previous bullet was fired (ms)
}

export interface Spark {
	x: number;
	y: number;
	vx: number;
	vy: number;
	age: number;
	color: string;
	alpha: number;
}

export interface ScoreResult {
	value: number;
	label?: string;
}

let nearestAsteroid: Asteroid | null;
let targetAsteroid: Asteroid | null;
let collision: Asteroid | null = null;

// --- Spawning Functions ---

// Spawn an asteroid off-screen with a random targetRadius between smallest and 70.
export function spawnAsteroid(): Asteroid {
	// Choose a random edge for spawning.
	const edge = Math.floor(Math.random() * 4);
	let x: number, y: number;
	// Use 25% of the canvas dimension as an offset.
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
		default:
			x = 0;
			y = 0;
	}

	// Compute a target point on the canvas for the asteroid to head toward.
	const targetX = Math.random() * width;
	const targetY = Math.random() * height;
	let angle = Math.atan2(targetY - y, targetX - x);
	// Add some variation.
	angle += (Math.random() - 0.5) * (Math.PI / 6);

	// Get the current level physics.
	const {
		asteroid: { min, max }
	} = getLevelConfig();
	// Choose the asteroid's target radius randomly between the dynamic min and max.
	const targetRadius = Math.random() * (max.radius - min.radius) + min.radius;
	const area = Math.PI * targetRadius * targetRadius;
	// Choose a random speed between the min and max speeds.
	const speed = Math.random() * (max.initialSpeed - min.initialSpeed) + min.initialSpeed;

	// Create some jaggedness.
	const vertexCount = Math.floor(8 + Math.random() * 5);
	const offsets: number[] = [];
	for (let i = 0; i < vertexCount; i++) {
		offsets.push(0.8 + Math.random() * 0.4);
	}
	const offsetAngle = Math.random() * PI2;

	return {
		x,
		y,
		angle,
		speed,
		radius: targetRadius,
		targetRadius,
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
	const weight = Math.pow(normalizedMass, ASTEROID_MASS_WEIGHT_EXPONENT);
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
			age: 0,
			color: '',
			alpha: 1
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
// In your fragmentAsteroid function (from gameLogic.ts):
export function fragmentAsteroid(bullet: Bullet, asteroid: Asteroid): Asteroid[] {
	// Destructure one level from the physics object.
	const {
		asteroid: {
			min,
			min: { fragSpeed: minFragSpeed },
			max: { fragSpeed: maxFragSpeed }
		}
	} = getLevelConfig();
	const minFragArea = min.area;

	// If the asteroid's area is less than twice the minimum fragment area, do not fragment.
	if (asteroid.area < 2 * minFragArea) return [];

	let availableArea = asteroid.area * 0.6;
	const fragments: Asteroid[] = [];

	// Fixed spread for randomness.
	const spreadRange = 40 * (Math.PI / 180); // 40° total variation.

	while (availableArea >= minFragArea) {
		const maxFragArea = Math.max(minFragArea, availableArea * 0.5);
		const fragArea = Math.random() * (maxFragArea - minFragArea) + minFragArea;
		if (fragArea > availableArea) break;

		const fragRadius = Math.sqrt(fragArea / Math.PI);
		const baseRadius = fragRadius; // Target radius equals computed radius.

		// Position the fragment so its outer edge is tangent to the parent's inner edge.
		const maxPosRadius = Math.max(0, asteroid.radius - fragRadius);
		const pos = randomPointInCircle(maxPosRadius);

		// Compute the placement unit vector.
		const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
		const placementUnit = dist > 0 ? { x: pos.x / dist, y: pos.y / dist } : { x: 1, y: 0 };
		const w1 = 2; // Weight for the placement component.

		// Compute the parent's velocity vector.
		const parentVx = asteroid.speed * Math.cos(asteroid.angle);
		const parentVy = asteroid.speed * Math.sin(asteroid.angle);
		const randomAngle = (Math.random() - 0.5) * spreadRange;
		const extraVx = Math.cos(randomAngle);
		const extraVy = Math.sin(randomAngle);

		let fragVx = parentVx + w1 * placementUnit.x + extraVx;
		let fragVy = parentVy + w1 * placementUnit.y + extraVy;
		let fragSpeed = Math.sqrt(fragVx * fragVx + fragVy * fragVy);

		// Cap the fragment's speed to at most parent's speed times the limit factor.
		if (fragSpeed > maxFragSpeed) {
			const scale = maxFragSpeed / fragSpeed;
			fragVx *= scale;
			fragVy *= scale;
			fragSpeed = maxFragSpeed;
		} else if (fragSpeed < minFragSpeed) {
			const scale = minFragSpeed / fragSpeed;
			fragVx *= scale;
			fragVy *= scale;
			fragSpeed = minFragSpeed;
		}

		const fragAngle = Math.atan2(fragVy, fragVx);
		const vertexCount = Math.floor(8 + Math.random() * 5);
		const offsets: number[] = [];
		for (let j = 0; j < vertexCount; j++) {
			offsets.push(0.8 + Math.random() * 0.4);
		}
		const offsetAngle = Math.random() * PI2;

		fragments.push({
			x: asteroid.x + pos.x,
			y: asteroid.y + pos.y,
			angle: fragAngle,
			speed: fragSpeed,
			radius: fragRadius,
			targetRadius: baseRadius,
			area: fragArea,
			vertexCount,
			offsets,
			offsetAngle
		});

		availableArea -= fragArea;
	}

	return fragments;
}

// --- Update Functions ---
export function updateAsteroids(asteroids: Asteroid[], ship: Ship): Asteroid | null {
	collision = null;
	const asteroidCount = asteroids.length;
	let i = asteroidCount;
	if (i < 1) {
		targetAsteroid = null;
		return null;
	}
	let near = width + height;
	const { x: shipX, y: shipY, radius: shipRadius } = ship;
	while (i--) {
		const a = asteroids[i];
		const { x, y, speed, angle, radius } = a;
		a.x += speed * Math.cos(angle);
		a.y += speed * Math.sin(angle);

		const xMax = width + radius;
		const yMax = height + radius;
		if (x < -radius) a.x = xMax;
		if (x > xMax) a.x = -radius;
		if (y < -radius) a.y = yMax;
		if (y > yMax) a.y = -radius;

		// Check for collision with the ship.
		const dx = a.x - shipX;
		const dy = a.y - shipY;
		const collisionDistance = radius + shipRadius;
		const compDistance = dx ** 2 + dy ** 2 - collisionDistance ** 2;
		if (compDistance > near) {
			near = compDistance;
			nearestAsteroid = a;
			if (asteroidCount < 4) targetAsteroid = a;
		}

		if (compDistance < 1) {
			/// detailed comparison if close
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < collisionDistance) {
				targetAsteroid = null;
				collision = a;
			}
		}
	}
	return collision || null;
}

export function locateReticle() {
	if (!targetAsteroid) return;
	const { x, y, radius } = targetAsteroid;
	return { x, y, radius: radius + 16 };
}

export function updateBullets(bullets: Bullet[]): Bullet[] {
	const updatedBullets = [];
	let i = bullets.length;
	if (i < 1) return [];
	while (i--) {
		const b = bullets[i];
		const { distanceTraveled, range: maxDistance } = b;
		if (distanceTraveled >= maxDistance) continue;
		const { vx, vy } = b;
		const stepDistance = Math.sqrt(vx * vx + vy * vy);
		b.distanceTraveled += stepDistance;
		b.x += vx;
		b.y += vy;
		const { x, y } = b;
		// Wrap positions.
		if (x < 0) b.x += width;
		if (x > width) b.x -= width;
		if (y < 0) b.y += height;
		if (y > height) b.y -= height;
		updatedBullets.push(b);
	}
	return updatedBullets;
}

export function updateSparks(sparks: Spark[]): Spark[] {
	let i = sparks.length;
	if (i < 1) return [];
	const updatedSparks = [];
	while (i--) {
		const spark = sparks[i];
		const { vx, vy, age } = spark;
		if (age > SPARK_MAX_LIFETIME) continue;
		spark.x += vx;
		spark.y += vy;
		spark.age++;
		updatedSparks.push(spark);
	}
	return updatedSparks;
}

export function computeScoreForHit(asteroid: Asteroid, bullet: Bullet): ScoreResult {
	const { range, distanceTraveled, deltaShotTime } = bullet;
	const maxScore = 100;
	const minScore = 10;
	// Linear interpolation: smallest asteroid (targetRadius == 12) yields max score,
	// largest (targetRadius == 70) yields min score.
	const t = (asteroid.targetRadius - 12) / (70 - 12);
	const baseScore = Math.round(maxScore - t * (maxScore - minScore));

	// Check if both snipe conditions are met.
	let multiplier = asteroid === targetAsteroid ? 4 : 1;
	if (distanceTraveled >= SNIPE_MIN_DISTANCE && deltaShotTime > SNIPE_MAX_TIME_THRESHOLD) {
		multiplier = Math.max(
			multiplier,
			Math.round(2 * (distanceTraveled / (SNIPE_MIN_DISTANCE * range)))
		);
	}

	const finalScore = baseScore * multiplier;

	return {
		value: finalScore,
		label: multiplier > 1 ? `SNIPE (${baseScore}×${multiplier})` : undefined
	};
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
