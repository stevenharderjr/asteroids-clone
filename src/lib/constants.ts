// src/lib/constants.ts
export const width = 800;
export const height = 600;
export const PI2 = Math.PI * 2;

// Define constants for scoring.
export const SNIPE_TIME_THRESHOLD = 1000; // 1 second threshold for a snipe.
export const SNIPE_MULTIPLIER = 2; // Snipe shots score double.
export const MIN_SNIPE_DISTANCE = 0.25; // 25% of bullet's range.
export const minHitScore = 10; // Score for the largest asteroid (targetRadius = 70)
export const maxHitScore = 100; // Score for the smallest asteroid (targetRadius = 12)

export const sparkLifetime = 50; // frames

// Mass boundaries (using targetRadius as a proxy for mass)
export const minMass = 12; // smallest targetRadius
export const maxRadius = 70; // largest targetRadius
export const massWeightExponent = 1.5;

// Outer wrap margin for asteroids
export const outerMargin = 50;

// Shooting parameters
export const shootCooldown = 100; // ms between shots
export const bulletSpeed = 7;
export const numAsteroids = 8;

// Fragmentation order and sizes
export type FragmentType = 'full' | 'large' | 'medium' | 'small';
export const fragmentOrder: FragmentType[] = ['full', 'large', 'medium', 'small'];
// In src/lib/constants.ts (or at the top of gameLogic.ts)
export const smallestFragmentArea = Math.PI * 12 * 12;
export const typeRadiusMapping: Record<FragmentType, number> = {
	full: 60,
	large: 44,
	medium: 28,
	small: 12
};
