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
}

export type MatchInfo = RiotMatchInfo;
