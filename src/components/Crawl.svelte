<script lang="ts">
	import { onMount } from 'svelte';
	let paused = false;
	let pauseText = 'PAUSE';
	function togglePause() {
		paused = !paused;
	}
</script>

<div style="position: relative; width: 800px; height: 600px;">
	<canvas width="800" height="600"></canvas>
	{#if paused}
		<div class="overlay-text">{pauseText}</div>
	{/if}
</div>

<button on:click={togglePause}>Toggle Pause</button>

<style>
	.overlay-text {
		position: absolute;
		top: 50%;
		left: 50%;
		/* Center the text */
		transform: translate(-50%, -50%) perspective(500px) rotateX(20deg) skewY(10deg);
		font-family: 'VT323', monospace;
		font-size: 48px;
		color: rgba(255, 150, 0, 1);
		font-weight: bold;
		text-align: center;
		white-space: nowrap;
		pointer-events: none;
	}
</style>
