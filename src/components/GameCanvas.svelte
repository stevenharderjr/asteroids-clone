<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from '../lib/snippets';
	import { createSnippet, updateSnippets, drawSnippets } from '../lib/snippets';
	import {
		width,
		height,
		PI2,
		shootCooldown,
		bulletSpeed,
		numAsteroids,
		outerMargin,
		sparkLifetime,
		SNIPE_TIME_THRESHOLD
	} from '../lib/constants';
	import type { Asteroid, Bullet, Spark } from '../lib/gameLogic';
	import {
		computeScoreForHit,
		spawnAsteroid,
		spawnExplosion,
		fragmentAsteroid,
		updateAsteroids,
		updateBullets,
		updateSparks
	} from '../lib/gameLogic';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	// Offscreen canvas for the static star background.
	let starCanvas: HTMLCanvasElement;
	let starCtx: CanvasRenderingContext2D;
	// Calculate the diagonal length to cover the rotated canvas.
	const diagonal = Math.sqrt(width * width + height * height);
	// Global rotation for the star background.
	let starRotation = 0;
	// A very slow rotation speed (radians per frame)
	const starRotationSpeed = 0.0005;

	// Game state.
	let ship = {
		x: width / 2,
		y: height / 2,
		angle: 0,
		velocity: { x: 0, y: 0 },
		rotationSpeed: (Math.PI / 180) * 3,
		acceleration: 0.1,
		radius: 10
	};

	let snippets: Snippet[] = [];
	let keys: Record<string, boolean> = {};
	let asteroids: Asteroid[] = [];
	let bullets: Bullet[] = [];
	let sparks: Spark[] = [];
	let score = 0;
	let bulletRangePercent = 100;
	let lastShotTime = 0;

	function shootBullet(
		ship: { x: number; y: number; angle: number },
		bulletRangePercent: number,
		bulletSpeed: number,
		lastShotTime: number
	): { bullet: Bullet; newLastShotTime: number } {
		const bulletOriginOffset = 20;
		const bulletX = ship.x + bulletOriginOffset * Math.cos(ship.angle);
		const bulletY = ship.y + bulletOriginOffset * Math.sin(ship.angle);
		const maxDistance = (bulletRangePercent / 100) * width;
		const shotTime = Date.now();
		const deltaShotTime = shotTime - lastShotTime;
		const bullet: Bullet = {
			x: bulletX,
			y: bulletY,
			vx: bulletSpeed * Math.cos(ship.angle),
			vy: bulletSpeed * Math.sin(ship.angle),
			distanceTraveled: 0,
			maxDistance,
			shotTime,
			deltaShotTime
		};
		return { bullet, newLastShotTime: shotTime };
	}

	function update() {
		// Ship movement.
		if (keys['ArrowLeft']) ship.angle -= ship.rotationSpeed;
		if (keys['ArrowRight']) ship.angle += ship.rotationSpeed;
		if (keys['ArrowUp']) {
			ship.velocity.x += ship.acceleration * Math.cos(ship.angle);
			ship.velocity.y += ship.acceleration * Math.sin(ship.angle);
		}
		if (keys[' '] && Date.now() - lastShotTime > shootCooldown) {
			const { bullet, newLastShotTime } = shootBullet(
				ship,
				bulletRangePercent,
				bulletSpeed,
				lastShotTime
			);
			lastShotTime = newLastShotTime;
			bullets.push(bullet);
		}
		ship.x += ship.velocity.x;
		ship.y += ship.velocity.y;
		if (ship.x < 0) ship.x += width;
		if (ship.x > width) ship.x -= width;
		if (ship.y < 0) ship.y += height;
		if (ship.y > height) ship.y -= height;

		// Update asteroids, bullets, sparks.
		updateAsteroids(asteroids);
		bullets = updateBullets(bullets);
		// Handle collisions.
		for (let i = bullets.length - 1; i >= 0; i--) {
			const bullet = bullets[i];
			let hit = false;
			for (let j = asteroids.length - 1; j >= 0; j--) {
				const asteroid = asteroids[j];
				const dx = bullet.x - asteroid.x;
				const dy = bullet.y - asteroid.y;
				if (dx * dx + dy * dy < asteroid.radius * asteroid.radius) {
					hit = true;
					const { value, label } = computeScoreForHit(asteroid, bullet);
					score += value;
					snippets.push(createSnippet(label || '' + value, bullet));
					if (asteroid.type !== 'small') {
						const fragments = fragmentAsteroid(bullet, asteroid);
						spawnExplosion(bullet.x, bullet.y, bullet, asteroid, sparks);
						asteroids.splice(j, 1);
						asteroids.push(...fragments);
					} else {
						spawnExplosion(bullet.x, bullet.y, bullet, asteroid, sparks);
						asteroids.splice(j, 1);
						// asteroids.push(spawnAsteroid());
					}
					break;
				}
			}
			if (hit) {
				bullets.splice(i, 1);
			}
		}
		sparks = updateSparks(sparks);
		snippets = updateSnippets(snippets);
		starRotation -= starRotationSpeed;
	}

	function draw() {
		// Clear the canvas.
		ctx.clearRect(0, 0, width, height);

		// Draw the star background.
		ctx.save();
		// Translate to the center of the canvas.
		ctx.translate(width / 2, height / 2);
		// Rotate slowly.
		ctx.rotate(starRotation);
		// Draw the starCanvas such that it is centered.
		ctx.drawImage(starCanvas, -diagonal / 2, -diagonal / 2, diagonal, diagonal);
		ctx.restore();

		// Then draw other game elements on top (ship, asteroids, bullets, sparks, etc.)
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
		ctx.stroke();
		ctx.restore();
		// Draw asteroids.
		ctx.strokeStyle = 'gray';
		asteroids.forEach((a) => {
			ctx.beginPath();
			for (let i = 0; i < a.vertexCount; i++) {
				const currentAngle = i * (PI2 / a.vertexCount) + a.offsetAngle;
				const r = a.radius * a.offsets[i];
				const vx = a.x + r * Math.cos(currentAngle);
				const vy = a.y + r * Math.sin(currentAngle);
				if (i === 0) ctx.moveTo(vx, vy);
				else ctx.lineTo(vx, vy);
			}
			ctx.closePath();
			ctx.stroke();
		});
		// Draw bullets.
		ctx.fillStyle = 'rgb(0,220,255)'; // A lovely orange.
		bullets.forEach((b) => {
			const angle = Math.atan2(b.vy, b.vx);
			ctx.save();
			// Move to the bullet's position.
			ctx.translate(b.x, b.y);
			// Rotate the canvas so that the ellipse is aligned with the bullet's direction.
			ctx.rotate(angle);
			ctx.beginPath();
			// Draw an ellipse: adjust the radii as needed.
			// For example, 4px for the major axis and 1.5px for the minor axis.
			ctx.ellipse(0, 0, 4, 1.5, 0, 0, PI2);
			ctx.fill();
			ctx.restore();
		});
		// Draw snippets
		drawSnippets(ctx, snippets);
		// Draw sparks.
		sparks.forEach((spark) => {
			const t = spark.age / sparkLifetime;
			const green = Math.round(150 * (1 - t));
			const alpha = 1 - t;
			ctx.fillStyle = `rgba(255, ${green}, 0, ${alpha})`;
			ctx.beginPath();
			ctx.arc(spark.x, spark.y, 2, 0, PI2);
			ctx.fill();
		});
		// Draw score.
		ctx.fillStyle = 'white';
		ctx.font = '14px sans-serif';
		ctx.fillText(`Score: ${score}`, 10, 10);
	}

	function gameLoop() {
		update();
		draw();
		requestAnimationFrame(gameLoop);
	}

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		generateStarBackground(); // Generate the starry background once.
		// Initialize asteroids.
		asteroids = [];
		for (let i = 0; i < numAsteroids; i++) {
			asteroids.push(spawnAsteroid());
		}
		gameLoop();
		window.addEventListener('keydown', (e) => (keys[e.key] = true));
		window.addEventListener('keyup', (e) => (keys[e.key] = false));
	});

	// Generate the star background on an offscreen canvas.
	function generateStarBackground() {
		starCanvas = document.createElement('canvas');
		starCanvas.width = diagonal;
		starCanvas.height = diagonal;
		starCtx = starCanvas.getContext('2d')!;
		// Fill background with black.
		starCtx.fillStyle = 'black';
		starCtx.fillRect(0, 0, diagonal, diagonal);
		// Draw stars.
		const starCount = 200;
		for (let i = 0; i < starCount; i++) {
			// Randomly choose a star size.
			// Most stars will be 1x1, but about 20% will be 2x2.
			const starSize = Math.random() < 0.2 ? 2 : 1;
			const x = Math.floor(Math.random() * diagonal);
			const y = Math.floor(Math.random() * diagonal);
			starCtx.fillStyle = 'white';
			starCtx.fillRect(x, y, starSize, starSize);
		}
	}
</script>

<canvas bind:this={canvas} {width} {height}></canvas>
