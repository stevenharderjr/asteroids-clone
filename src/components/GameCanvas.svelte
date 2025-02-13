<script lang="ts">
	import { onMount } from 'svelte';
	import {
		width,
		height,
		PI2,
		shootCooldown,
		bulletSpeed,
		numAsteroids,
		outerMargin,
		sparkLifetime
	} from '../lib/constants';
	import type { Asteroid, Bullet, Spark } from '../lib/gameLogic';
	import {
		spawnAsteroid,
		spawnExplosion,
		fragmentAsteroid,
		updateAsteroids,
		updateBullets,
		updateSparks,
		handleCollisions
	} from '../lib/gameLogic';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

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
	let keys: Record<string, boolean> = {};
	let asteroids: Asteroid[] = [];
	let bullets: Bullet[] = [];
	let sparks: Spark[] = [];
	let score = 0;
	let bulletRangePercent = 100;
	let lastShotTime = 0;

	function shootBullet() {
		const bulletOriginOffset = 20;
		const bulletX = ship.x + bulletOriginOffset * Math.cos(ship.angle);
		const bulletY = ship.y + bulletOriginOffset * Math.sin(ship.angle);
		const maxDistance = (bulletRangePercent / 100) * width;
		bullets.push({
			x: bulletX,
			y: bulletY,
			vx: bulletSpeed * Math.cos(ship.angle),
			vy: bulletSpeed * Math.sin(ship.angle),
			distanceTraveled: 0,
			maxDistance
		});
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
			shootBullet();
			lastShotTime = Date.now();
		}
		ship.x += ship.velocity.x;
		ship.y += ship.velocity.y;
		if (ship.x < 0) ship.x += width;
		if (ship.x > width) ship.x -= width;
		if (ship.y < 0) ship.y += height;
		if (ship.y > height) ship.y -= height;

		// Update asteroids, bullets, sparks.
		updateAsteroids(asteroids);
		updateBullets(bullets);
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
					score++;
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
	}

	function draw() {
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, width, height);
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
		ctx.fillStyle = 'red';
		bullets.forEach((b) => {
			ctx.beginPath();
			ctx.arc(b.x, b.y, 3, 0, PI2);
			ctx.fill();
		});
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
		ctx.font = '20px sans-serif';
		ctx.fillText(`Asteroid count: ${asteroids.length}`, 10, 30);
	}

	function gameLoop() {
		update();
		draw();
		requestAnimationFrame(gameLoop);
	}

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		// Initialize asteroids.
		asteroids = [];
		for (let i = 0; i < numAsteroids; i++) {
			asteroids.push(spawnAsteroid());
		}
		gameLoop();
		window.addEventListener('keydown', (e) => (keys[e.key] = true));
		window.addEventListener('keyup', (e) => (keys[e.key] = false));
	});
</script>

<canvas bind:this={canvas} {width} {height}></canvas>
