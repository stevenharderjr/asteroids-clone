// src/lib/constants.ts
export const width = 800;
export const height = 600;
export const PI2 = Math.PI * 2;

// Define constants for steering easing.
export const PLAYER_MAX_TURN_RATE = 0.07; // radians per frame
export const PLAYER_MIN_TURN_RATE = 0.07;
export const PLAYER_MAX_TURN_ACCEL = 0.02; // how quickly the turn rate increases in response to input
export const PLAYER_MAX_TURN_DECEL = 0.02; // how quickly turn rate decays without input
export const PLAYER_MIN_TURN_ACCEL = 0.02;
export const PLAYER_MIN_TURN_DECEL = 0.02;

// Define constants for scoring.
export const SNIPE_MAX_TIME_THRESHOLD = 1000;
export const SNIPE_MIN_TIME_THRESHOLD = 1000;
export const SNIPE_MIN_SCORE_MULTIPLIER = 2;
export const SNIPE_MAX_SCORE_MULTIPLIER = 8;
export const SNIPE_MAX_DISTANCE = width * 0.5;
export const SNIPE_MIN_DISTANCE = width * 0.25;
export const ASTEROID_MIN_HIT_SCORE = 10; // Score for the largest asteroids
export const ASTEROID_MAX_HIT_SCORE = 200; // Score for the smallest fragments

export const SPARK_MAX_LIFETIME = 50; // frames
export const SPARK_MIN_LIFETIME = 50; // frames

export const ASTEROID_MIN_RADIUS = 12;
export const ASTEROID_MAX_RADIUS = 70;
export const ASTEROID_MASS_WEIGHT_EXPONENT = 1.5;
export const ASTEROID_MAX_COUNT = 8;
export const ASTEROID_MIN_COUNT = 8;
export const ASTEROID_MAX_INITIAL_SPEED = 2;
export const ASTEROID_MIN_INITIAL_SPEED = 1;
export const ASTEROID_MAX_FRAG_SPEED = 5;
export const ASTEROID_MIN_FRAG_SPEED = 0.1;
export const ASTEROID_WRAP_FALLBACK_MARGIN = 50;
export const ASTEROID_MIN_FRAGMENT_AREA = Math.PI * 8 * 8;
export const ASTEROID_MAX_EXPLOSION_FACTOR = 1;
export const ASTEROID_MIN_EXPLOSION_FACTOR = 0.1;

// Shooting parameters
export const PLAYER_MAX_SHOT_COOLDOWN = 300; // ms between shots
export const PLAYER_MIN_SHOT_COOLDOWN = 100; // ms between shots
export const BULLET_MIN_SPEED = 7;
export const BULLET_MAX_SPEED = 7;
export const BULLET_MAX_RANGE_PERCENT = 100;
export const BULLET_MIN_RANGE_PERCENT = 50;
