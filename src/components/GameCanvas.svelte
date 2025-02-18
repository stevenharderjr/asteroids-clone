<script lang="ts">
	import { onMount } from 'svelte';
	import { type Snippet, createSnippet, updateSnippets, drawSnippets } from '../lib/snippets';
	import {
		width,
		height,
		PI2,
		ASTEROID_WRAP_FALLBACK_MARGIN,
		SPARK_MAX_LIFETIME,
		SNIPE_MIN_TIME_THRESHOLD
	} from '$lib/constants';
	import type { Ship, Asteroid, Bullet, Spark } from '../lib/gameLogic';
	import {
		computeScoreForHit,
		spawnAsteroid,
		spawnExplosion,
		fragmentAsteroid,
		updateAsteroids,
		updateBullets,
		updateSparks,
		currentLevel,
		locateReticle,
		shipsRemaining,
		dead
	} from '../lib/gameLogic';
	import { getLevelConfig } from '$lib/levelConfig';

	$: level = $currentLevel;
	$: ships = Array($shipsRemaining);
	$: gameOver = typeof $shipsRemaining === 'number' && $shipsRemaining < 1;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	// Offscreen canvas for the static star background.
	let starCanvas: HTMLCanvasElement;
	let starCtx: CanvasRenderingContext2D;
	let offscreenStarCanvas: HTMLCanvasElement;
	let offscreenStarCtx: CanvasRenderingContext2D;
	// Calculate the diagonal length to cover the rotated canvas.
	const diagonal = Math.sqrt(width * width + height * height);
	// Global rotation for the star background.
	let starRotation = 0;
	// A very slow rotation speed (radians per frame)
	const starRotationSpeed = 0.0005;
	let reticleRotation = 0;
	const reticleRotationSpeed = 0.1;

	// Game state.
	let ship: Ship = {
		x: width / 2,
		y: height / 2,
		vx: 0,
		vy: -0.1,
		speed: 0,
		angle: 0,
		turnRate: 0, // New property to store current turning speed.
		acceleration: 0.1,
		radius: 10
	};

	const deadShip: Ship = {
		x: -width,
		y: -height,
		vx: 0,
		vy: 0,
		speed: 0,
		angle: 0,
		turnRate: 0, // New property to store current turning speed.
		acceleration: 0,
		radius: 0
	};

	let snippets: Snippet[] = [];
	let keys: Record<string, boolean> = {};
	let asteroids: Asteroid[] = [];
	let bullets: Bullet[] = [];
	let sparks: Spark[] = [];
	let score = 0;
	let lastShotTime = 0;

	// Add a paused state.
	let gameOn = false;
	let paused = false;
	let pauseMessage: Snippet | null = null;

	// Listen for Enter key to toggle pause.
	function handleKeyDown(e: KeyboardEvent) {
		// If Enter (key code 13 or key "Enter") is pressed, toggle pause.
		if (paused) {
			paused = false;
		} else if (e.key === 'Enter') {
			if (gameOver) {
				resetGame();
			} else paused = !paused;
		}
		keys[e.key] = true;
	}

	function handleKeyUp(e: KeyboardEvent) {
		keys[e.key] = false;
	}

	function shootBullet(
		ship: { x: number; y: number; angle: number },
		bulletRangePercent: number,
		bulletSpeed: number,
		lastShotTime: number
	): { bullet: Bullet; newLastShotTime: number } {
		const bulletOriginOffset = 20;
		const bulletX = ship.x + bulletOriginOffset * Math.cos(ship.angle);
		const bulletY = ship.y + bulletOriginOffset * Math.sin(ship.angle);
		const shotTime = Date.now();
		const deltaShotTime = shotTime - lastShotTime;
		const bullet: Bullet = {
			x: bulletX,
			y: bulletY,
			vx: bulletSpeed * Math.cos(ship.angle),
			vy: bulletSpeed * Math.sin(ship.angle),
			distanceTraveled: 0,
			range: getLevelConfig(level).bullet.range,
			shotTime,
			deltaShotTime
		};
		return { bullet, newLastShotTime: shotTime };
	}

	function update() {
		if (paused) return;
		const config = getLevelConfig(level);
		const {
			ship: { turnAccel, turnDecel, maxTurnRate },
			bullet: { range: bulletRange, speed: bulletSpeed, shotCooldown }
		} = config;

		if ($dead) {
			ship = deadShip;
		} else {
			// Easing for ship turning:
			if (keys['ArrowLeft']) {
				// Decrease turnRate (make it negative) up to a max negative value.
				ship.turnRate = Math.max(ship.turnRate - turnAccel, -maxTurnRate);
			} else if (keys['ArrowRight']) {
				// Increase turnRate (make it positive) up to max positive.
				ship.turnRate = Math.min(ship.turnRate + turnAccel, maxTurnRate);
			} else {
				// No turning input: ease turnRate back toward 0.
				if (ship.turnRate > 0) {
					ship.turnRate = Math.max(ship.turnRate - turnDecel, 0);
				} else if (ship.turnRate < 0) {
					ship.turnRate = Math.min(ship.turnRate + turnDecel, 0);
				}
			}

			// Apply the turning rate to the ship's angle.
			ship.angle += ship.turnRate;

			// Ship movement.
			if (keys['ArrowUp']) {
				ship.vx += ship.acceleration * Math.cos(ship.angle);
				ship.vy += ship.acceleration * Math.sin(ship.angle);
			}

			ship.x += ship.vx;
			ship.y += ship.vy;
			if (ship.x < 0) ship.x += width;
			if (ship.x > width) ship.x -= width;
			if (ship.y < 0) ship.y += height;
			if (ship.y > height) ship.y -= height;

			// Shooting.
			if (keys[' '] && Date.now() - lastShotTime > shotCooldown) {
				const { bullet, newLastShotTime } = shootBullet(
					ship,
					bulletRange,
					bulletSpeed,
					lastShotTime
				);
				lastShotTime = newLastShotTime;
				bullets.push(bullet);
			}
		}

		// Update asteroids, bullets, sparks.
		const collision = updateAsteroids(asteroids, ship);
		bullets = updateBullets(bullets);
		// Handle collisions.
		for (let i = bullets.length - 1; i >= 0; i--) {
			const bullet = bullets[i];
			let hit = false;
			for (let j = asteroids.length - 1; j >= 0; j--) {
				const asteroid = asteroids[j];
				let dx = bullet.x - asteroid.x;
				let dy = bullet.y - asteroid.y;
				if (dx * dx + dy * dy < asteroid.radius * asteroid.radius) {
					hit = true;
					const { value, label } = computeScoreForHit(asteroid, bullet);
					score += value;
					snippets.push(createSnippet(label || '' + value, bullet));
					const fragments = fragmentAsteroid(bullet, asteroid);
					spawnExplosion(bullet.x, bullet.y, bullet, asteroid, sparks);
					asteroids.splice(j, 1);
					asteroids.push(...fragments);
					break;
				}
			}
			if (hit) {
				bullets.splice(i, 1);
			}
		}
		if (gameOn && !asteroids.length) nextLevel();
		sparks = updateSparks(sparks);
		snippets = updateSnippets(snippets);
	}

	function draw() {
		// Clear the canvas.
		ctx.clearRect(0, 0, width, height);

		// // Draw the star background.
		// starCtx.save();
		// // Translate to the center of the canvas.
		// starCtx.translate(width / 2, height / 2);
		// // Rotate slowly.
		// starCtx.rotate(starRotation);
		// // Draw the starCanvas such that it is centered.
		// starCtx.drawImage(starCanvas, -diagonal / 2, -diagonal / 2, diagonal, diagonal);
		// starCtx.restore();

		// Then draw other game elements on top (ship, asteroids, bullets, sparks, etc.)

		// Draw asteroids.
		ctx.strokeStyle = 'gray';
		for (const a of asteroids) {
			const { x, y, vertexCount, offsetAngle, radius, offsets } = a;
			ctx.beginPath();
			let i = vertexCount;
			if (i < 1) continue;
			const lastIndex = i - 1;
			while (i--) {
				const currentAngle = i * (PI2 / vertexCount) + offsetAngle;
				const r = radius * offsets[i];
				const vx = x + r * Math.cos(currentAngle);
				const vy = y + r * Math.sin(currentAngle);
				if (i === lastIndex) ctx.moveTo(vx, vy);
				else ctx.lineTo(vx, vy);
			}
			ctx.closePath();
			ctx.fillStyle = '#0008';
			ctx.fill();

			ctx.stroke();
		}
		// Draw bullets.
		ctx.fillStyle = 'rgb(0,220,255)';
		for (const b of bullets) {
			const { x, y, vx, vy } = b;
			const angle = Math.atan2(vy, vx);
			ctx.save();
			// Move to the bullet's position.
			ctx.translate(x, y);
			// Rotate the canvas so that the ellipse is aligned with the bullet's direction.
			ctx.rotate(angle);
			ctx.beginPath();
			// Draw an ellipse: adjust the radii as needed.
			// For example, 4px for the major axis and 1.5px for the minor axis.
			ctx.ellipse(0, 0, 4, 1.5, 0, 0, PI2);
			ctx.fill();
			ctx.restore();
		}

		if (!$dead) {
			// Draw ship.
			ctx.save();
			ctx.translate(ship.x, ship.y);
			ctx.rotate(ship.angle);
			ctx.strokeStyle = 'white';
			ctx.beginPath();
			ctx.moveTo(20, 0);
			ctx.lineTo(-10, 10);
			ctx.lineTo(-10, -10);
			ctx.closePath();
			ctx.fillStyle = '#0008';
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		}
		// Draw snippets
		drawSnippets(ctx, snippets);
		// Draw sparks.
		for (const spark of sparks) {
			const { age, x, y } = spark;
			const t = age / SPARK_MAX_LIFETIME;
			const green = Math.round(150 * (1 - t));
			const alpha = 1 - t;
			ctx.fillStyle = `rgba(${green}, 220, 255, ${alpha})`;
			ctx.beginPath();
			ctx.arc(x, y, 2, 0, PI2);
			ctx.fill();
		}
		// Draw score.
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillStyle = 'white';
		ctx.font = '14px sans-serif';
		ctx.fillText(`Score: ${score}`, 10, 10);

		// Draw reticle
		const reticle = locateReticle();
		if (reticle) {
			reticleRotation += 0.02;
			const { x, y, radius } = reticle;
			ctx.save();
			// Translate to the asteroid's center.
			ctx.translate(x, y);
			// Rotate the reticle.
			ctx.rotate(reticleRotation);
			ctx.strokeStyle = 'lime';
			ctx.lineWidth = 2;

			// Determine the square size.
			const padding = -5;
			const reticleRadius = radius + padding;
			// We'll treat the square as centered on (0,0) with side length = 2 * reticleRadius.
			const halfSide = reticleRadius;
			// Define a segment length (how long each corner line is)
			const segLen = 10;

			ctx.beginPath();
			// Top-left corner:
			ctx.moveTo(-halfSide, -halfSide);
			ctx.lineTo(-halfSide + segLen, -halfSide);
			ctx.moveTo(-halfSide, -halfSide);
			ctx.lineTo(-halfSide, -halfSide + segLen);

			// Top-right corner:
			ctx.moveTo(halfSide, -halfSide);
			ctx.lineTo(halfSide - segLen, -halfSide);
			ctx.moveTo(halfSide, -halfSide);
			ctx.lineTo(halfSide, -halfSide + segLen);

			// Bottom-left corner:
			ctx.moveTo(-halfSide, halfSide);
			ctx.lineTo(-halfSide + segLen, halfSide);
			ctx.moveTo(-halfSide, halfSide);
			ctx.lineTo(-halfSide, halfSide - segLen);

			// Bottom-right corner:
			ctx.moveTo(halfSide, halfSide);
			ctx.lineTo(halfSide - segLen, halfSide);
			ctx.moveTo(halfSide, halfSide);
			ctx.lineTo(halfSide, halfSide - segLen);

			ctx.stroke();
			ctx.restore();
		}
	}

	function gameLoop() {
		// Update star background rotation.
		updateStarBackground();
		update();
		draw();
		requestAnimationFrame(gameLoop);
	}

	onMount(() => {
		starCtx = starCanvas.getContext('2d')!;
		starCanvas.width = width;
		starCanvas.height = height;
		generateStarBackground(); // Generate the starry background once.

		ctx = canvas.getContext('2d')!;
		// Initialize asteroids.
		asteroids = [];
		setTimeout(() => {
			initAsteroids();
		}, 2000);
		gameLoop();
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
	});

	// Generate the star background on an offscreen canvas.
	function generateStarBackground() {
		offscreenStarCanvas = document.createElement('canvas');
		offscreenStarCanvas.width = diagonal;
		offscreenStarCanvas.height = diagonal;
		offscreenStarCtx = offscreenStarCanvas.getContext('2d')!;

		// Fill with black.
		offscreenStarCtx.fillStyle = 'black';
		offscreenStarCtx.fillRect(0, 0, diagonal, diagonal);

		// Draw stars.
		const starCount = 200;
		for (let i = 0; i < starCount; i++) {
			const starSize = Math.random() < 0.2 ? 2 : 1;
			const x = Math.floor(Math.random() * diagonal);
			const y = Math.floor(Math.random() * diagonal);
			offscreenStarCtx.fillStyle = 'white';
			offscreenStarCtx.fillRect(x, y, starSize, starSize);
		}
	}

	function updateStarBackground() {
		starRotation -= starRotationSpeed;
		// Clear the star background canvas.
		starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
		starCtx.save();
		// Translate to the center of the starCanvas.
		starCtx.translate(starCanvas.width / 2, starCanvas.height / 2);
		// Rotate the background.
		starCtx.rotate(starRotation);
		// Draw the pre-generated star image.
		// Since starCanvas is our visible element, we can either draw our offscreen image
		// (if you created one) or redraw the stars here.
		// For simplicity, assume we stored our pre-generated star image in a separate offscreen canvas,
		// say offscreenStarCanvas.
		starCtx.drawImage(offscreenStarCanvas, -diagonal / 2, -diagonal / 2, diagonal, diagonal);
		// Alternatively, if you generated the stars directly on starCanvas initially,
		// you might want to re-draw them here.
		// (For now, we'll assume you're redrawing from an offscreen image.)
		starCtx.restore();
	}

	function initAsteroids() {
		const { initialAsteroidCount } = getLevelConfig();
		for (let i = 0; i < initialAsteroidCount; i++) {
			asteroids.push(spawnAsteroid());
		}
		gameOn = true;
	}

	function nextLevel() {
		gameOn = false;
		currentLevel.update((n) => n + 1);
		setTimeout(initAsteroids, 3000);
	}

	// Reset game state to initial values.
	function resetGame() {
		// Reset ship.
		ship = {
			x: width / 2,
			y: height / 2,
			vx: 0,
			vy: -0.1,
			speed: 0,
			angle: 0,
			turnRate: 0, // New property to store current turning speed.
			acceleration: 0.1,
			radius: 10
		};
		// Clear arrays.
		snippets = [];
		keys = {};
		asteroids = [];
		bullets = [];
		sparks = [];
		// Reset score and lastShotTime.
		score = 0;
		lastShotTime = 0;
		// Reset game state flags.
		gameOn = false;
		paused = false;
		pauseMessage = null;
		// Reset star rotation.
		starRotation = 0;
		reticleRotation = 0;
		// Reset level store to 1.
		gameOver = false;
		dead.set(false);
		shipsRemaining.set(3);
		currentLevel.set(1);
		// Initialize asteroids after a delay if desired.
		setTimeout(initAsteroids, 2000);
	}
</script>

<div class="game-container">
	<canvas class="star-background" bind:this={starCanvas}></canvas>
	{#if gameOver}
		<div class="game-over blink">GAME OVER</div>
	{:else}
		<div class="crawl-container">
			{#if paused}
				<div class="crawl-text">
					<p>GAME PAUSED</p>
					<p style="position:relative; left:20px;">PRESS ANY KEY TO CONTINUE...</p>
				</div>
			{/if}
			{#key level}
				<div class="crawl-text">
					LEVEL {level}
				</div>
			{/key}
		</div>
	{/if}
	<canvas class="game-elements" bind:this={canvas} {width} {height}></canvas>
</div>

<style>
	canvas {
		position: absolute;
		top: 0;
	}
	.star-background {
		z-index: 1;
	}
	.game-elements {
		z-index: 3;
	}
	.player-status {
		position: absolute;
		bottom: 0;
		right: 0;
	}
	.game-over {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 1000;
		color: lime;
		font-size: 40px;
		font-weight: 800;
	}
</style>
