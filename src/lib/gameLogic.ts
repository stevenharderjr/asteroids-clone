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
import { writable } from 'svelte/store';

export const currentLevel = writable(1);
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
	color: string;
	alpha: number;
}

export interface ScoreResult {
	value: number;
	label?: string;
}

let lastGravitySpike = 0;
const gravitySpikeCooldown = 3000; // 3 seconds cooldown

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
export function fragmentAsteroid(bullet: Bullet, asteroid: Asteroid): Asteroid[] {
	// If the asteroid's area is too small to split into at least two smallest fragments, return [].
	if (asteroid.area < 2 * smallestFragmentArea) {
		return [];
	}

	let availableArea = asteroid.area;
	const fragments: Asteroid[] = [];

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
		const offsets: number[] = [];
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
			offsetAngle
		});

		availableArea -= fragArea;
	}

	return fragments;
}

export function applyGravitySpike(ship: Ship, asteroids: Asteroid[]) {
	if (Date.now() - lastGravitySpike < gravitySpikeCooldown) return;
	lastGravitySpike = Date.now();
	// Constants to tune the effect:
	const GRAVITY_STRENGTH = 180; // Base strength of the repelling force.
	const SPEED_THRESHOLD = 10; // Maximum allowed speed; above this, treat as bullet hit.
	const OPPOSITION_THRESHOLD = -1; // Dot product threshold.
	const SHIP_VELOCITY_FACTOR = 0.5; // How much the ship's velocity influences the force.

	// Loop through all asteroids.
	for (let i = 0; i < asteroids.length; i++) {
		const a = asteroids[i];
		// Compute vector from ship to asteroid.
		const dx = a.x - ship.x;
		const dy = a.y - ship.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist === 0) continue; // Avoid division by zero.

		// Compute repelling force that drops off with distance.
		const forceMag = GRAVITY_STRENGTH / dist;
		const forceX = (dx / dist) * forceMag;
		const forceY = (dy / dist) * forceMag;

		// Get asteroid's current velocity vector.
		const currentVx = a.speed * Math.cos(a.angle);
		const currentVy = a.speed * Math.sin(a.angle);

		// Incorporate the ship's velocity:
		// We'll add a portion of the ship's velocity to the repelling effect.
		const shipForceX = SHIP_VELOCITY_FACTOR * ship.vx || 0;
		const shipForceY = SHIP_VELOCITY_FACTOR * ship.vy || 0;

		// Compute the new velocity vector by summing:
		// 1. The current asteroid velocity,
		// 2. The repelling force,
		// 3. The ship's velocity component.
		const newVx = currentVx + forceX + shipForceX;
		const newVy = currentVy + forceY + shipForceY;
		const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy);

		// Option 1: If new speed exceeds threshold, treat as a bullet hit.
		if (newSpeed > SPEED_THRESHOLD) {
			const dummyBullet = {
				x: a.x,
				y: a.y,
				vx: newVx,
				vy: newVy,
				distanceTraveled: 0,
				maxDistance: 0,
				shotTime: Date.now(),
				deltaShotTime: 0
			} as Bullet;
			spawnExplosion(a.x, a.y, dummyBullet, a, []);
			const fragments = fragmentAsteroid(dummyBullet, a);
			asteroids.splice(i, 1);
			asteroids.push(...fragments);
			continue;
		}

		// Option 2: If the asteroid's current velocity is strongly opposed to the force,
		// fragment the asteroid.
		const dot = currentVx * forceX + currentVy * forceY;
		if (dot < OPPOSITION_THRESHOLD) {
			const dummyBullet = {
				x: a.x,
				y: a.y,
				vx: newVx,
				vy: newVy,
				distanceTraveled: 0,
				maxDistance: 0,
				shotTime: Date.now(),
				deltaShotTime: 0
			} as Bullet;
			spawnExplosion(a.x, a.y, dummyBullet, a, []);
			const fragments = fragmentAsteroid(dummyBullet, a);
			asteroids.splice(i, 1);
			asteroids.push(...fragments);
			continue;
		}

		// Otherwise, update the asteroid's velocity based on newVx and newVy.
		a.speed = newSpeed;
		a.angle = Math.atan2(newVy, newVx);
	}
}

// --- Update Functions ---
export function updateAsteroids(asteroids: Asteroid[]): void {
	let i = asteroids.length;
	if (i < 1) return;
	while (i--) {
		const a = asteroids[i];
		const { x, y, speed, angle } = a;
		a.x += speed * Math.cos(angle);
		a.y += speed * Math.sin(angle);
		if (x < -outerMargin) a.x = width + outerMargin;
		if (x > width + outerMargin) a.x = -outerMargin;
		if (y < -outerMargin) a.y = height + outerMargin;
		if (y > height + outerMargin) a.y = -outerMargin;
	}
}

export function updateBullets(bullets: Bullet[]): Bullet[] {
	const updatedBullets = [];
	let i = bullets.length;
	if (i < 1) return [];
	while (i--) {
		const b = bullets[i];
		const { distanceTraveled, maxDistance } = b;
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
		if (age > sparkLifetime) continue;
		spark.x += vx;
		spark.y += vy;
		spark.age++;
		updatedSparks.push(spark);
	}
	return updatedSparks;
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
	const baseScore = Math.round(maxScore - t * (maxScore - minScore));

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
