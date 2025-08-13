import {
	RiotId,
	MatchResult,
	ArenaProgress,
	Region,
} from "../types";
import { MatchParticipant } from "./riot-api";

const STORAGE_KEYS = {
	RIOT_ID: "arena-god-riot-id",
	MATCH_HISTORY: "arena-god-match-history",
	ARENA_PROGRESS: "arena-god-progress",
	MATCH_CACHE: "arena-god-match-cache",
	REGION: "arena-god-region",
} as const;

export function getRegion(): Region | null {
	if (typeof window === "undefined") return null;
	const stored = localStorage.getItem(STORAGE_KEYS.REGION);
	if (!stored) return null;
	try {
		return JSON.parse(stored) as Region;
	} catch {
		return null;
	}
}

export function setRegion(region: Region) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.REGION, JSON.stringify(region));
}

export function getRiotId(): RiotId | null {
	if (typeof window === "undefined") return null;
	const stored = localStorage.getItem(STORAGE_KEYS.RIOT_ID);
	return stored ? JSON.parse(stored) : null;
}

export function setRiotId(riotId: RiotId) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.RIOT_ID, JSON.stringify(riotId));
}

export function getMatchHistory(): MatchResult[] {
	if (typeof window === "undefined") return [];
	const stored = localStorage.getItem(STORAGE_KEYS.MATCH_HISTORY);
	return stored ? JSON.parse(stored) : [];
}

export function setMatchHistory(history: MatchResult[]) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.MATCH_HISTORY, JSON.stringify(history));
}

export function getArenaProgress(): ArenaProgress {
	if (typeof window === "undefined")
		return {
			firstPlaceChampions: [],
			playedChampions: [],
		};
	const stored = localStorage.getItem(STORAGE_KEYS.ARENA_PROGRESS);
	const progress = stored
		? JSON.parse(stored)
		: {
				firstPlaceChampions: [],
				playedChampions: [],
		  };
	// Ensure old data structures are compatible
	if (progress.topFourChampions) {
		delete progress.topFourChampions;
	}
	return progress;
}

export function setArenaProgress(progress: ArenaProgress) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.ARENA_PROGRESS, JSON.stringify(progress));
}

export function getMatchCache(): Record<string, MatchParticipant[]> {
	if (typeof window === "undefined") return {};
	const stored = localStorage.getItem(STORAGE_KEYS.MATCH_CACHE);
	return stored ? JSON.parse(stored) : {};
}

export function setMatchCache(cache: Record<string, MatchParticipant[]>) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEYS.MATCH_CACHE, JSON.stringify(cache));
	} catch (error) {
		console.error("Failed to set match cache:", error);
		// Here we could implement a cache eviction strategy if we exceed quota
	}
}

export function getCachedMatch(matchId: string): MatchParticipant[] | null {
	const cache = getMatchCache();
	return cache[matchId] || null;
}

export function cacheMatch(matchId: string, participants: MatchParticipant[]) {
	const cache = getMatchCache();
	cache[matchId] = participants;
	setMatchCache(cache);
}
