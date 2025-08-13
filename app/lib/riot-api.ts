import { z } from "zod";
import { Region } from "../types";

async function fetchWithRetry(
	url: string,
	maxRetries = 5,
	initialDelay = 2000
): Promise<Response> {
	let attempt = 0;
	while (attempt < maxRetries) {
		const response = await fetch(url);
		if (response.status !== 429) {
			return response;
		}

		attempt++;
		if (attempt >= maxRetries) {
			console.error("Max retries reached. Returning last 429 response.");
			return response;
		}

		const delay = initialDelay * Math.pow(2, attempt - 1);
		console.log(
			`Rate limited. Retrying in ${delay}ms... (Attempt ${attempt})`
		);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
	// This should be unreachable
	throw new Error("fetchWithRetry exhausted retries unexpectedly.");
}

// Types
export const RiotAccountSchema = z.object({
	puuid: z.string(),
	gameName: z.string(),
	tagLine: z.string(),
});

export const RiotErrorSchema = z.object({
	status: z.object({
		status_code: z.number(),
		message: z.string(),
	}),
});

export type RiotAccount = z.infer<typeof RiotAccountSchema>;
export type RiotError = z.infer<typeof RiotErrorSchema>;

export const MatchParticipantSchema = z.object({
	puuid: z.string(),
	championName: z.string(),
	placement: z.number(),
});

export const MatchInfoSchema = z.object({
	info: z.object({
		participants: z.array(MatchParticipantSchema),
	}),
});

export type MatchParticipant = z.infer<typeof MatchParticipantSchema>;
export type MatchInfo = z.infer<typeof MatchInfoSchema>;

// Server Actions
export async function getRiotAccount(
	gameName: string,
	tagLine: string,
	region: Region
) {
	try {
		const response = await fetchWithRetry(
			`/api/riot?endpoint=account&gameName=${encodeURIComponent(
				gameName
			)}&tagLine=${encodeURIComponent(tagLine)}&region=${region}`
		);

		const data = await response.json();

		if (response.status === 404) {
			return { error: RiotErrorSchema.parse(data) };
		}

		return { data: RiotAccountSchema.parse(data) };
	} catch (error) {
		console.error("Error fetching Riot account:", error);
		return { error: "Failed to fetch Riot account" };
	}
}

export async function getMatchIds(
	puuid: string,
	region: Region,
	start: number,
	count: number,
	startTime?: number,
	endTime?: number
) {
	try {
		let url = `/api/riot?endpoint=matches&puuid=${encodeURIComponent(
			puuid
		)}&region=${region}&start=${start}&count=${count}`;
		if (startTime) {
			url += `&startTime=${startTime}`;
		}
		if (endTime) {
			url += `&endTime=${endTime}`;
		}
		const response = await fetchWithRetry(url);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		return { data: z.array(z.string()).parse(data) };
	} catch (error) {
		console.error("Error fetching match IDs:", error);
		return { error: "Failed to fetch match IDs" };
	}
}

export async function getMatchInfo(matchId: string, region: Region) {
	try {
		const response = await fetchWithRetry(
			`/api/riot?endpoint=match&matchId=${encodeURIComponent(
				matchId
			)}&region=${region}`
		);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		return { data: MatchInfoSchema.parse(data) };
	} catch (error) {
		console.error("Error fetching match info:", error);
		return { error: "Failed to fetch match info" };
	}
}

// Helper function to get player's placement in a match
export function getPlayerMatchResult(
	participants: MatchParticipant[],
	playerPuuid: string
) {
	const player = participants.find(
		(p: MatchParticipant) => p.puuid === playerPuuid
	);

	if (!player) {
		return null;
	}

	return {
		champion: player.championName,
		placement: player.placement,
	};
}
