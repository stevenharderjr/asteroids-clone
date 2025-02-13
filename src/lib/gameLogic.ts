// src/lib/gameLogic.ts

import {
	width,
	height,
	PI2,
	outerMargin,
	typeRadiusMapping,
	fragmentOrder,
	minMass,
	maxMass,
	massWeightExponent,
	sparkLifetime
} from './constants';

// --- Type Definitions ---
export type FragmentType = 'full' | 'large' | 'medium' | 'small';

export interface Asteroid {
	x: number;
	y: number;
	angle: number;
	speed: number;
	radius: number;
	targetRadius: number;
	vertexCount: number;
	offsets: number[];
	offsetAngle: number;
	type: FragmentType;
}

export interface Bullet {
	x: number;
	y: number;
	vx: number;
	vy: number;
	distanceTraveled: number;
	maxDistance: number;
}

export interface Spark {
	x: number;
	y: number;
	vx: number;
	vy: number;
	age: number;
}

// --- Spawning Functions ---

// Spawns an asteroid off-screen.
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
	const randomIndex = Math.floor(Math.random() * fragmentOrder.length);
	const type: FragmentType = fragmentOrder[randomIndex];
	const baseRadius = typeRadiusMapping[type];
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
		radius: baseRadius,
		targetRadius: baseRadius,
		vertexCount,
		offsets,
		offsetAngle,
		type
	};
}

// Spawns explosion sparks at (x,y) using a weighted combination of bullet and asteroid velocities.
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
	const normalizedMass = (asteroid.targetRadius - minMass) / (maxMass - minMass);
	const weight = Math.pow(normalizedMass, massWeightExponent);
	const explosionVx = (1 - weight) * bulletVx + weight * asteroidVx;
	const explosionVy = (1 - weight) * bulletVy + weight * asteroidVy;
	const explosionBaseAngle = Math.atan2(explosionVy, explosionVx);
	const spreadRange = Math.PI / 3; // ±30° spread.
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

// Fragments an asteroid into 3–5 fragments of the next smaller type.
export function fragmentAsteroid(bullet: Bullet, asteroid: Asteroid): Asteroid[] {
	const currentIndex = fragmentOrder.indexOf(asteroid.type);
	if (currentIndex === -1 || currentIndex === fragmentOrder.length - 1) {
		return []; // Already smallest.
	}
	const nextType: FragmentType = fragmentOrder[currentIndex + 1];
	const fragmentCount = Math.floor(Math.random() * 3) + 3; // 3-5 fragments.
	const bulletVx = bullet.vx;
	const bulletVy = bullet.vy;
	const asteroidVx = asteroid.speed * Math.cos(asteroid.angle);
	const asteroidVy = asteroid.speed * Math.sin(asteroid.angle);
	const normalizedMass = (asteroid.targetRadius - minMass) / (maxMass - minMass);
	const weight = Math.pow(normalizedMass, massWeightExponent);
	const explosionVx = (1 - weight) * bulletVx + weight * asteroidVx;
	const explosionVy = (1 - weight) * bulletVy + weight * asteroidVy;
	const explosionBaseAngle = Math.atan2(explosionVy, explosionVx);
	const spreadRange = 40 * (Math.PI / 180); // 40° total variation.
	let fragments: Asteroid[] = [];
	for (let i = 0; i < fragmentCount; i++) {
		const fragAngle = explosionBaseAngle + (Math.random() - 0.5) * spreadRange;
		const fragSpeed = 1 + Math.random() * 2;
		const baseRadius = typeRadiusMapping[nextType];
		const fragRadius = baseRadius * (0.9 + Math.random() * 0.2);
		const vertexCount = Math.floor(8 + Math.random() * 5);
		let offsets: number[] = [];
		for (let j = 0; j < vertexCount; j++) {
			offsets.push(0.8 + Math.random() * 0.4);
		}
		const offsetAngle = Math.random() * PI2;
		fragments.push({
			x: bullet.x,
			y: bullet.y,
			angle: fragAngle,
			speed: fragSpeed,
			radius: fragRadius,
			targetRadius: baseRadius,
			vertexCount,
			offsets,
			offsetAngle,
			type: nextType
		});
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

export function updateBullets(bullets: Bullet[]): void {
	// Update each bullet.
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
	// Filter out bullets that have traveled too far.
	bullets = bullets.filter((b) => b.distanceTraveled <= b.maxDistance);
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

// --- Collision Handling ---
// Processes collisions and returns updated arrays.
export function handleCollisions(
	bullets: Bullet[],
	asteroids: Asteroid[],
	sparks: Spark[]
): { bullets: Bullet[]; asteroids: Asteroid[]; sparks: Spark[] } {
	let remainingBullets: Bullet[] = [];
	for (const bullet of bullets) {
		let bulletHit = false;
		for (let i = asteroids.length - 1; i >= 0; i--) {
			const asteroid = asteroids[i];
			const dx = bullet.x - asteroid.x;
			const dy = bullet.y - asteroid.y;
			if (dx * dx + dy * dy < asteroid.radius * asteroid.radius) {
				bulletHit = true;
				// Collision detected.
				if (asteroid.type !== 'small') {
					const fragments = fragmentAsteroid(bullet, asteroid);
					spawnExplosion(bullet.x, bullet.y, bullet, asteroid, sparks);
					asteroids.splice(i, 1);
					asteroids.push(...fragments);
				} else {
					spawnExplosion(bullet.x, bullet.y, bullet, asteroid, sparks);
					asteroids.splice(i, 1);
					// asteroids.push(spawnAsteroid());
				}
				break;
			}
		}
		if (!bulletHit) {
			remainingBullets.push(bullet);
		}
	}
	return { bullets: remainingBullets, asteroids, sparks };
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
