import { MatchInfo as RiotMatchInfo } from "../lib/riot-api";

export interface RiotId {
	gameName: string;
	tagLine: string;
}

export interface MatchResult {
	champion: string;
	placement: number;
	matchId: string;
}

export interface ArenaProgress {
	firstPlaceChampions: string[];
	playedChampions: string[];
}

export type MatchInfo = RiotMatchInfo;

export const REGIONS = [
	"NA",
	"EUW",
	"EUNE",
	"KR",
	"JP",
	"BR",
	"LAN",
	"LAS",
	"OCE",
	"TR",
	"RU",
] as const;

export type Region = (typeof REGIONS)[number];

export const REGION_TO_CONTINENT: Record<Region, string> = {
	NA: "americas",
	BR: "americas",
	LAN: "americas",
	LAS: "americas",
	EUW: "europe",
	EUNE: "europe",
	TR: "europe",
	RU: "europe",
	KR: "asia",
	JP: "asia",
	OCE: "sea",
};
