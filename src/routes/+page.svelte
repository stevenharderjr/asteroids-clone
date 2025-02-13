<script lang="ts">
	import GameCanvas from '../components/GameCanvas.svelte';
	import Controls from '../components/Controls.svelte';
	import { onMount } from 'svelte';
	import { fetchHighScores, submitScore } from '$lib/gameLogic'; // Or implement your own API fetches

	let bulletRangePercent = 100;
	let highScores: Array<{ name: string; score: number }> = [];

	function setBulletRange(value: number) {
		bulletRangePercent = value;
	}

	async function updateHighScores() {
		// Call your API fetch function here.
		// For example:
		highScores = await fetchHighScores();
	}

	async function handleSubmitScore() {
		await submitScore();
		await updateHighScores();
	}
</script>

<GameCanvas {bulletRangePercent} />
<Controls {bulletRangePercent} {setBulletRange} {fetchHighScores} {submitScore} {highScores} />
