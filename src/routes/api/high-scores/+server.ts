// src/routes/api/high-scores/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import clientPromise from '$lib/db';

// GET: Retrieve the top 10 high scores
export const GET: RequestHandler = async () => {
	const client = await clientPromise;
	const db = client.db('asteroids');
	const scores = await db.collection('highScores').find({}).sort({ score: -1 }).limit(10).toArray();
	return new Response(JSON.stringify(scores), { status: 200 });
};

// POST: Submit a new high score
export const POST: RequestHandler = async ({ request }) => {
	const { name, score } = await request.json();
	const client = await clientPromise;
	const db = client.db('asteroids');
	await db.collection('highScores').insertOne({ name, score, date: new Date() });
	return new Response(JSON.stringify({ success: true }), { status: 200 });
};
