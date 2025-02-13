// src/lib/constants.ts
export const width = 800;
export const height = 600;
export const PI2 = Math.PI * 2;
export const sparkLifetime = 50; // frames

// Mass boundaries (using targetRadius as a proxy for mass)
export const minMass = 12; // smallest targetRadius
export const maxMass = 60; // largest targetRadius
export const massWeightExponent = 1.5;

// Outer wrap margin for asteroids
export const outerMargin = 50;

// Shooting parameters
export const shootCooldown = 300; // ms between shots
export const bulletSpeed = 7;
export const numAsteroids = 8;

// Fragmentation order and sizes
export type FragmentType = 'full' | 'large' | 'medium' | 'small';
export const fragmentOrder: FragmentType[] = ['full', 'large', 'medium', 'small'];
export const typeRadiusMapping: Record<FragmentType, number> = {
	full: 60,
	large: 44,
	medium: 28,
	small: 12
};
