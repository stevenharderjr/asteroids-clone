import { get } from 'svelte/store';
import {
	width,
	PLAYER_MAX_TURN_RATE,
	PLAYER_MAX_TURN_ACCEL,
	PLAYER_MAX_TURN_DECEL,
	BULLET_MAX_RANGE_PERCENT,
	BULLET_MIN_RANGE_PERCENT,
	ASTEROID_MAX_COUNT,
	BULLET_MIN_SPEED,
	BULLET_MAX_SPEED,
	PLAYER_MIN_TURN_ACCEL,
	PLAYER_MIN_TURN_DECEL,
	PLAYER_MIN_TURN_RATE,
	ASTEROID_MIN_RADIUS,
	ASTEROID_MAX_RADIUS,
	PLAYER_MAX_SHOT_COOLDOWN,
	PLAYER_MIN_SHOT_COOLDOWN,
	ASTEROID_MIN_COUNT,
	ASTEROID_MAX_EXPLOSION_FACTOR,
	ASTEROID_MIN_EXPLOSION_FACTOR,
	ASTEROID_MIN_FRAG_SPEED,
	ASTEROID_MAX_FRAG_SPEED,
	ASTEROID_MIN_INITIAL_SPEED,
	ASTEROID_MAX_INITIAL_SPEED,
	PLAYER_MIN_ACCELERATION,
	PLAYER_MAX_ACCELERATION
} from './constants';
import { currentLevel } from './gameLogic'; // adjust the path if needed

// Your interpolation helper:
interface LevelConfig {
	start: number;
	end: number;
	startLevel: number;
	endLevel: number;
}
function interpolateValue(config: LevelConfig, currentLevel: number): number {
	if (currentLevel <= config.startLevel) return config.start;
	if (currentLevel >= config.endLevel) return config.end;
	const t = (currentLevel - config.startLevel) / (config.endLevel - config.startLevel);
	return config.start + t * (config.end - config.start);
}

// Your level-dependent configuration:
const config = {
	asteroid: {
		minRadius: { start: 24, end: ASTEROID_MIN_RADIUS, startLevel: 1, endLevel: 17 },
		maxRadius: { start: 70, end: ASTEROID_MAX_RADIUS, startLevel: 1, endLevel: 17 },
		minInitialSpeed: {
			start: ASTEROID_MIN_INITIAL_SPEED,
			end: ASTEROID_MIN_INITIAL_SPEED,
			startLevel: 1,
			endLevel: 1
		},
		maxInitialSpeed: {
			start: ASTEROID_MAX_INITIAL_SPEED,
			end: ASTEROID_MAX_INITIAL_SPEED,
			startLevel: 1,
			endLevel: 1
		},
		minFragSpeed: {
			start: ASTEROID_MIN_FRAG_SPEED,
			end: ASTEROID_MIN_FRAG_SPEED,
			startLevel: 20,
			endLevel: 50
		},
		maxFragSpeed: {
			start: ASTEROID_MAX_INITIAL_SPEED,
			end: ASTEROID_MAX_FRAG_SPEED,
			startLevel: 20,
			endLevel: 50
		},
		maxExplosionFactor: {
			start: ASTEROID_MAX_EXPLOSION_FACTOR,
			end: ASTEROID_MAX_EXPLOSION_FACTOR,
			startLevel: 1,
			endLevel: 1
		},
		minExplosionFactor: {
			start: ASTEROID_MIN_EXPLOSION_FACTOR,
			end: ASTEROID_MIN_EXPLOSION_FACTOR,
			startLevel: 1,
			endLevel: 1
		}
	},
	ship: {
		acceleration: {
			start: PLAYER_MIN_ACCELERATION,
			end: PLAYER_MAX_ACCELERATION,
			startLevel: 1,
			endLevel: 30
		},
		turnAccel: {
			start: PLAYER_MIN_TURN_ACCEL,
			end: PLAYER_MAX_TURN_ACCEL,
			startLevel: 1,
			endLevel: 10
		},
		turnDecel: {
			start: PLAYER_MIN_TURN_DECEL,
			end: PLAYER_MAX_TURN_DECEL,
			startLevel: 1,
			endLevel: 10
		},
		maxTurnRate: {
			start: PLAYER_MIN_TURN_RATE,
			end: PLAYER_MAX_TURN_RATE,
			startLevel: 1,
			endLevel: 10
		}
	},
	bullet: {
		rangePercent: {
			start: BULLET_MAX_RANGE_PERCENT,
			end: BULLET_MIN_RANGE_PERCENT,
			startLevel: 1,
			endLevel: 10
		},
		speed: { start: BULLET_MIN_SPEED, end: BULLET_MAX_SPEED, startLevel: 1, endLevel: 1 },
		shotCooldown: {
			start: PLAYER_MAX_SHOT_COOLDOWN,
			end: PLAYER_MIN_SHOT_COOLDOWN,
			startLevel: 1,
			endLevel: 20
		}
	},
	initialAsteroidCount: {
		start: ASTEROID_MIN_COUNT,
		end: ASTEROID_MAX_COUNT,
		startLevel: 1,
		endLevel: 50
	},
	fragmentSpeedLimit: { start: 100, end: 150, startLevel: 18, endLevel: 50 }
};

// Memoization variables.
let cachedLevel: number | null = null;
let cachedConfig: any = null;

export function getLevelConfig(level?: number) {
	const L = level || get(currentLevel);
	if (cachedLevel === L && cachedConfig) {
		return cachedConfig;
	}

	// Compute dynamic values from the configuration.
	const asteroidMinRadius = interpolateValue(config.asteroid.minRadius, L);
	const asteroidMaxRadius = interpolateValue(config.asteroid.maxRadius, L);
	const asteroidMinInitialSpeed = interpolateValue(config.asteroid.minInitialSpeed, L);
	const asteroidMaxInitialSpeed = interpolateValue(config.asteroid.maxInitialSpeed, L);
	const asteroidMinFragSpeed = interpolateValue(config.asteroid.minFragSpeed, L);
	const asteroidMaxFragSpeed = interpolateValue(config.asteroid.maxFragSpeed, L);
	const asteroidMaxExplosionFactor = interpolateValue(config.asteroid.maxExplosionFactor, L);
	const asteroidMinExplosionFactor = interpolateValue(config.asteroid.minExplosionFactor, L);

	const shipTurnAccel = interpolateValue(config.ship.turnAccel, L);
	const shipTurnDecel = interpolateValue(config.ship.turnDecel, L);
	const shipMaxTurnRate = interpolateValue(config.ship.maxTurnRate, L);
	const shipAcceleration = interpolateValue(config.ship.acceleration, L);

	const bulletRangePercent = interpolateValue(config.bullet.rangePercent, L);
	const bulletRange = Math.round((bulletRangePercent / 100) * width);
	const bulletSpeed = interpolateValue(config.bullet.speed, L);
	const shotCooldown = interpolateValue(config.bullet.shotCooldown, L);

	const initialAsteroidCount = interpolateValue(config.initialAsteroidCount, L);

	// For fragment limiting speed factor, use the percentage scale as before.
	const fragmentLimitingSpeedFactor = (100 + (L - 1)) / 100;

	// Package all values into one object.
	cachedConfig = {
		asteroid: {
			min: {
				initialSpeed: asteroidMinInitialSpeed,
				fragSpeed: asteroidMinFragSpeed,
				radius: asteroidMinRadius,
				area: Math.PI * asteroidMinRadius * asteroidMinRadius,
				explosionFactor: asteroidMinExplosionFactor
			},
			max: {
				initialSpeed: asteroidMaxInitialSpeed,
				fragSpeed: asteroidMaxFragSpeed,
				radius: asteroidMaxRadius,
				area: Math.PI * asteroidMaxRadius * asteroidMaxRadius,
				explosionFactor: asteroidMaxExplosionFactor
			}
		},
		ship: {
			turnAccel: shipTurnAccel,
			turnDecel: shipTurnDecel,
			maxTurnRate: shipMaxTurnRate,
			acceleration: shipAcceleration
		},
		bullet: { range: bulletRange, speed: bulletSpeed, shotCooldown },
		initialAsteroidCount,
		fragmentLimitingSpeedFactor
	};
	cachedLevel = L;
	// console.log(JSON.stringify(cachedConfig));
	return cachedConfig;
}
