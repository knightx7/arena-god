"use client";

import { useState, useEffect } from "react";
import { ImageGrid } from "./image-grid";
import { MatchHistory } from "./match-history";
import { ImageTile } from "../lib/images";
import { ArenaProgress, MatchResult, Region } from "../types";
import {
	getRiotId,
	setRiotId,
	getMatchHistory,
	setMatchHistory,
	getCachedMatch,
	cacheMatch,
	getArenaProgress,
	setArenaProgress,
	getRegion,
} from "../lib/storage";
import {
	getRiotAccount,
	getMatchIds,
	getMatchInfo,
	getPlayerMatchResult,
} from "../lib/riot-api";

interface TabsProps {
	images: ImageTile[];
}

export function Tabs({ images }: TabsProps) {
	const [activeTab, setActiveTab] = useState("tracker");
	const [searchQuery, setSearchQuery] = useState("");

	// State lifted from MatchHistory
	const [gameName, setGameName] = useState("");
	const [tagLine, setTagLine] = useState("");
	const [region, setRegion] = useState<Region>("NA");
	const [matchHistory, setMatchHistoryState] = useState<MatchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fetchProgress, setFetchProgress] = useState<{
		total: number;
		fetched: number;
	} | null>(null);
	const [eta, setEta] = useState<string | null>(null);
	const [updateSummary, setUpdateSummary] = useState<{
		firstPlaces: number;
	} | null>(null);

	// State for ImageGrid
	const [arenaProgress, setArenaProgressState] =
		useState<ArenaProgress | null>(null);

	useEffect(() => {
		// Load initial data from storage
		const storedRiotId = getRiotId();
		if (storedRiotId) {
			setGameName(storedRiotId.gameName);
			setTagLine(storedRiotId.tagLine);
		}
		const storedRegion = getRegion();
		if (storedRegion) {
			setRegion(storedRegion);
		}
		setMatchHistoryState(getMatchHistory());
		setArenaProgressState(getArenaProgress());
	}, []);

	const filteredImages = images.filter((image) =>
		image.name.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Logic lifted from MatchHistory
	const formatEta = (seconds: number) => {
		if (seconds < 60) {
			return "less than a minute remaining";
		}
		const minutes = Math.ceil(seconds / 60);
		return `approx. ${minutes} minute${minutes > 1 ? "s" : ""} remaining`;
	};

	const recalculateProgressFromHistory = (
		history: MatchResult[]
	): ArenaProgress => {
		const playedChampions = new Set<string>();
		const firstPlaceChampions = new Set<string>();

		for (const match of history) {
			playedChampions.add(match.champion);
			if (match.placement === 1) {
				firstPlaceChampions.add(match.champion);
			}
		}

		return {
			playedChampions: Array.from(playedChampions),
			firstPlaceChampions: Array.from(firstPlaceChampions),
		};
	};

	const processMatches = async (
		matchIds: string[],
		puuid: string,
		region: Region
	) => {
		setFetchProgress({ total: matchIds.length, fetched: 0 });

		const BATCH_SIZE = 10;
		const BATCH_DELAY = 1200;
		const allProcessedMatches: (MatchResult & { isNewMatch: boolean })[] =
			[];
		setMatchHistoryState([]); // Clear visual history before starting

		for (let i = 0; i < matchIds.length; i += BATCH_SIZE) {
			const batch = matchIds.slice(i, i + BATCH_SIZE);
			const batchPromises = batch.map(async (matchId) => {
				try {
					const cachedResult = getCachedMatch(matchId);
					if (cachedResult) {
						return {
							...cachedResult,
							matchId,
							isNewMatch: false,
						};
					}
					const matchInfo = await getMatchInfo(matchId, region);
					if ("error" in matchInfo || !matchInfo.data) {
						console.error(
							`Failed to fetch match info for ${matchId}`
						);
						return null;
					}
					const playerResult = getPlayerMatchResult(
						matchInfo.data.info.participants,
						puuid
					);
					if (playerResult) {
						cacheMatch(matchId, playerResult);
						return {
							...playerResult,
							matchId,
							isNewMatch: true,
						};
					}
					return null;
				} catch (error: unknown) {
					console.error(
						`Error processing match ${matchId}:`,
						error
					);
					return null;
				}
			});

			const batchResults = await Promise.all(batchPromises);
			const validResults = batchResults.filter(
				(r): r is MatchResult & { isNewMatch: boolean } =>
					Boolean(r && r.champion && r.placement)
			);

			if (validResults.length > 0) {
				allProcessedMatches.push(...validResults);
				setMatchHistoryState((prev) =>
					[...prev, ...validResults].sort((a, b) =>
						b.matchId.localeCompare(a.matchId)
					)
				);
				const firstsInBatch = validResults.filter(
					(r) => r.placement === 1
				).length;
				if (firstsInBatch > 0) {
					setUpdateSummary((prev) => ({
						firstPlaces: (prev?.firstPlaces || 0) + firstsInBatch,
					}));
				}
			}

			setFetchProgress((prev) => ({
				total: matchIds.length,
				fetched: prev ? prev.fetched + batch.length : batch.length,
			}));

			const batchesRemaining = Math.ceil(
				(matchIds.length - (i + batch.length)) / BATCH_SIZE
			);
			const secondsRemaining = batchesRemaining * (BATCH_DELAY / 1000);
			setEta(formatEta(secondsRemaining));

			if (i + BATCH_SIZE < matchIds.length) {
				await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
			}
		}
		return allProcessedMatches;
	};

	const handleUpdate = async (
		gameName: string,
		tagLine: string,
		region: Region
	) => {
		if (!gameName || !tagLine) {
			setError("Please enter both game name and tag line");
			return;
		}

		setIsLoading(true);
		setError(null);
		setFetchProgress(null);
		setEta(null);
		setUpdateSummary(null);

		try {
			const account = await getRiotAccount(gameName, tagLine, region);
			if ("error" in account && account.error) {
				setError(
					typeof account.error === "string"
						? account.error
						: account.error.status.message
				);
				setIsLoading(false);
				return;
			}
			if (!account.data) {
				setError("No account data received");
				setIsLoading(false);
				return;
			}
			const puuid = account.data.puuid;
			setRiotId({
				gameName: account.data.gameName,
				tagLine: account.data.tagLine,
			});

			const cachedHistory = getMatchHistory();
			if (cachedHistory.length > 0) {
				const cachedMatchIdSet = new Set(
					cachedHistory.map((m) => m.matchId)
				);
				const newMatchIds: string[] = [];
				let start = 0;
				const count = 100;
				let foundOverlap = false;

				while (true) {
					const matchIdsResponse = await getMatchIds(
						puuid,
						region,
						start,
						count
					);
					if ("error" in matchIdsResponse || !matchIdsResponse.data) {
						setError("Failed to fetch new matches.");
						break;
					}

					const pageIds = matchIdsResponse.data;
					const newIdsOnPage: string[] = [];
					for (const id of pageIds) {
						if (cachedMatchIdSet.has(id)) {
							foundOverlap = true;
							break;
						}
						newIdsOnPage.push(id);
					}
					newMatchIds.push(...newIdsOnPage);

					if (foundOverlap || pageIds.length < count) {
						break;
					}
					start += count;
				}

				if (newMatchIds.length > 0) {
					const processedNewMatches = await processMatches(
						newMatchIds,
						puuid,
						region
					);
					const combinedHistory = [
						...processedNewMatches,
						...cachedHistory,
					];
					const sortedHistory = combinedHistory.sort((a, b) =>
						b.matchId.localeCompare(a.matchId)
					);
					setMatchHistory(sortedHistory);
					const newProgress =
						recalculateProgressFromHistory(sortedHistory);
					setArenaProgress(newProgress);
					setArenaProgressState(newProgress);
				}
			} else {
				const twoYearsAgo = new Date();
				twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
				const now = new Date();
				const timeIntervals: { startTime: number; endTime: number }[] =
					[];
				let current = new Date(twoYearsAgo);

				while (current < now) {
					const start = new Date(current);
					const end = new Date(current);
					end.setMonth(end.getMonth() + 1);
					const effectiveEnd = end > now ? now : end;
					timeIntervals.push({
						startTime: Math.floor(start.getTime() / 1000),
						endTime: Math.floor(effectiveEnd.getTime() / 1000),
					});
					current = new Date(end);
				}

				const allMatchIds = new Set<string>();
				for (const interval of timeIntervals.reverse()) {
					let start = 0;
					const count = 100;
					while (true) {
						const matchIdsResponse = await getMatchIds(
							puuid,
							region,
							start,
							count,
							interval.startTime,
							interval.endTime
						);
						if (
							"error" in matchIdsResponse ||
							!matchIdsResponse.data
						) {
							console.error(
								`Failed to fetch matches for a time interval.`
							);
							break;
						}
						matchIdsResponse.data.forEach((id) =>
							allMatchIds.add(id)
						);
						if (matchIdsResponse.data.length < count) {
							break;
						}
						start += count;
					}
				}

				const uniqueMatchIds = Array.from(allMatchIds);
				const newHistory = await processMatches(
					uniqueMatchIds,
					puuid,
					region
				);
				const sortedHistory = newHistory.sort((a, b) =>
					b.matchId.localeCompare(a.matchId)
				);
				setMatchHistory(sortedHistory);
				const newProgress =
					recalculateProgressFromHistory(sortedHistory);
				setArenaProgress(newProgress);
				setArenaProgressState(newProgress);
			}
		} catch (error: unknown) {
			if (error instanceof Error) {
				console.error("Failed to update match history:", error);
				setError("Failed to update match history");
			}
		} finally {
			setIsLoading(false);
			setFetchProgress(null);
			setEta(null);
		}
	};

	return (
		<div className="w-full max-w-7xl mx-auto px-4">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
				<div className="flex gap-2">
					<button
						onClick={() => setActiveTab("tracker")}
						className={`px-4 py-2 rounded-md transition-colors ${
							activeTab === "tracker"
								? "bg-blue-500 text-white"
								: "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
						}`}
					>
						Arena God Tracker
					</button>
					<button
						onClick={() => setActiveTab("history")}
						className={`px-4 py-2 rounded-md transition-colors ${
							activeTab === "history"
								? "bg-blue-500 text-white"
								: "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
						}`}
					>
						Match History
					</button>
				</div>
				{activeTab === "tracker" && (
					<div className="w-full sm:w-64">
						<input
							type="text"
							placeholder="Search champions..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				)}
			</div>

			<div className="mt-6">
				{activeTab === "tracker" ? (
					<ImageGrid
						images={images}
						displayImages={filteredImages}
						progress={arenaProgress}
						setProgress={setArenaProgressState}
					/>
				) : (
					<MatchHistory
						gameName={gameName}
						setGameName={setGameName}
						tagLine={tagLine}
						setTagLine={setTagLine}
						region={region}
						setRegion={setRegion}
						matchHistory={matchHistory}
						isLoading={isLoading}
						error={error}
						fetchProgress={fetchProgress}
						eta={eta}
						updateSummary={updateSummary}
						onUpdate={handleUpdate}
					/>
				)}
			</div>
		</div>
	);
}
