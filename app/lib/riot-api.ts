import { z } from "zod";

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
export async function getRiotAccount(gameName: string, tagLine: string) {
	try {
		const response = await fetch(
			`/api/riot?endpoint=account&gameName=${encodeURIComponent(
				gameName
			)}&tagLine=${encodeURIComponent(tagLine)}`
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

export async function getMatchIds(puuid: string) {
	try {
		const response = await fetch(
			`/api/riot?endpoint=matches&puuid=${encodeURIComponent(puuid)}`
		);

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

export async function getMatchInfo(matchId: string) {
	try {
		const response = await fetch(
			`/api/riot?endpoint=match&matchId=${encodeURIComponent(matchId)}`
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
	matchInfo: MatchInfo,
	playerPuuid: string
) {
	const player = matchInfo.info.participants.find(
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
