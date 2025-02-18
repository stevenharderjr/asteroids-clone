<script lang="ts">
	export let fetchHighScores: () => Promise<void>;
	export let submitScore: () => Promise<void>;
	export let highScores: Array<{ name: string; score: number }>;
</script>

<!-- <div class="high-scores">
	<h2>High Scores</h2>
	<button on:click={fetchHighScores}>Refresh Scores</button>
	<ul>
		{#each highScores as hs}
			<li>{hs.name}: {hs.score}</li>
		{/each}
	</ul>
	<button on:click={submitScore}>Submit Score</button>
</div> -->
