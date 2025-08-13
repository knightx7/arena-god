"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ArenaProgress, MatchResult, Region, REGIONS } from "../types";
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
	setRegion as setStoredRegion,
} from "../lib/storage";
import {
	getRiotAccount,
	getMatchIds,
	getMatchInfo,
	getPlayerMatchResult,
} from "../lib/riot-api";

const PLACEMENT_COLORS = {
	1: "bg-yellow-500 dark:bg-yellow-600",
	2: "bg-gray-400 dark:bg-gray-700",
	3: "bg-gray-400 dark:bg-gray-700",
	4: "bg-gray-400 dark:bg-gray-700",
	5: "bg-gray-400 dark:bg-gray-700",
	6: "bg-gray-400 dark:bg-gray-700",
	7: "bg-gray-400 dark:bg-gray-700",
	8: "bg-gray-400 dark:bg-gray-700",
} as const;

export function MatchHistory() {
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

	const formatEta = (seconds: number) => {
		if (seconds < 60) {
			return "less than a minute remaining";
		}
		const minutes = Math.ceil(seconds / 60);
		return `approx. ${minutes} minute${minutes > 1 ? "s" : ""} remaining`;
	};

	useEffect(() => {
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
	}, []);

	const processMatches = async (
		matchIds: string[],
		puuid: string,
		region: Region
	) => {
		setFetchProgress({ total: matchIds.length, fetched: 0 });

		const BATCH_SIZE = 10;
		const BATCH_DELAY = 12100; // 100 requests per 120 seconds = 1.2s/req. 10 reqs/batch = 12s/batch. Add buffer.
		const processedMatches: (MatchResult & { isNewMatch: boolean })[] = [];

		for (let i = 0; i < matchIds.length; i += BATCH_SIZE) {
			const batch = matchIds.slice(i, i + BATCH_SIZE);
			const batchPromises = batch.map(async (matchId) => {
				try {
					const cachedParticipants = getCachedMatch(matchId);
					if (cachedParticipants) {
						return {
							...getPlayerMatchResult(cachedParticipants, puuid),
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
					const participants = matchInfo.data.info.participants;
					cacheMatch(matchId, participants);
					return {
						...getPlayerMatchResult(participants, puuid),
						matchId,
						isNewMatch: true,
					};
				} catch (error) {
					console.error(`Error processing match ${matchId}:`, error);
					return null;
				}
			});

			const batchResults = await Promise.all(batchPromises);
			const validResults = batchResults.filter(
				(r): r is MatchResult & { isNewMatch: boolean } =>
					Boolean(r && r.champion && r.placement)
			);
			processedMatches.push(...validResults);

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
		return processedMatches;
	};

	const updateArenaProgress = (
		newMatches: (MatchResult & { isNewMatch: boolean })[]
	) => {
		if (newMatches.length === 0) return;

		const currentProgress = getArenaProgress();
		const played = newMatches.map((m) => m.champion);
		const firstPlace = newMatches
			.filter((m) => m.placement === 1)
			.map((m) => m.champion);

		const newProgress: ArenaProgress = {
			playedChampions: [
				...new Set([
					...(currentProgress.playedChampions || []),
					...played,
				]),
			],
			firstPlaceChampions: [
				...new Set([
					...(currentProgress.firstPlaceChampions || []),
					...firstPlace,
				]),
			],
		};
		setArenaProgress(newProgress);
	};

	const handleUpdate = async () => {
		if (!gameName || !tagLine) {
			setError("Please enter both game name and tag line");
			return;
		}

		setIsLoading(true);
		setError(null);
		setFetchProgress(null);
		setEta(null);

		try {
			// 1. Get Account PUUID
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

			// 2. Determine update strategy
			const cachedHistory = getMatchHistory();
			if (cachedHistory.length > 0) {
				// Incremental update
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
					setMatchHistoryState(sortedHistory);
					setMatchHistory(sortedHistory);

					const newMatchesForProgress = processedNewMatches.filter(
						(r) => r.isNewMatch
					);
					updateArenaProgress(newMatchesForProgress);
				}
			} else {
				// Full 2-year history fetch
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
				setMatchHistoryState(sortedHistory);
				setMatchHistory(sortedHistory);

				const newMatchesForProgress = newHistory.filter(
					(r) => r.isNewMatch
				);
				updateArenaProgress(newMatchesForProgress);
			}
		} catch (error) {
			console.error("Failed to update match history:", error);
			setError("Failed to update match history");
		} finally {
			setIsLoading(false);
			setFetchProgress(null);
			setEta(null);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row gap-4 sm:items-end">
				<div className="flex-1">
					<label
						htmlFor="gameName"
						className="block text-sm font-medium mb-1"
					>
						Game Name
					</label>
					<input
						type="text"
						id="gameName"
						value={gameName}
						onChange={(e) => setGameName(e.target.value)}
						className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
						placeholder="Enter game name"
					/>
				</div>
				<div className="flex-1">
					<label
						htmlFor="tagLine"
						className="block text-sm font-medium mb-1"
					>
						Tag Line
					</label>
					<input
						type="text"
						id="tagLine"
						value={tagLine}
						onChange={(e) => setTagLine(e.target.value)}
						className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
						placeholder="Enter tag line"
					/>
				</div>
				<div className="flex-1">
					<label
						htmlFor="region"
						className="block text-sm font-medium mb-1"
					>
						Region
					</label>
					<select
						id="region"
						value={region}
						onChange={(e) => {
							const newRegion = e.target.value as Region;
							setRegion(newRegion);
							setStoredRegion(newRegion);
						}}
						className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 h-[42px]"
					>
						{REGIONS.map((r) => (
							<option key={r} value={r}>
								{r}
							</option>
						))}
					</select>
				</div>
				<button
					onClick={handleUpdate}
					disabled={isLoading}
					className="h-[42px] px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? "Updating..." : "Update"}
				</button>
			</div>

			{fetchProgress && (
				<div className="text-center space-y-2 pt-4">
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Fetching match data... This may take several minutes.
					</p>
					<div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
						<div
							className="bg-blue-600 h-2.5 rounded-full"
							style={{
								width: `${
									(fetchProgress.fetched /
										fetchProgress.total) *
									100
								}%`,
							}}
						></div>
					</div>
					<p className="text-sm font-medium">
						{`Processed ${fetchProgress.fetched} of ${fetchProgress.total} matches.`}
					</p>
					{eta && (
						<p className="text-xs text-gray-500 dark:text-gray-400">
							{eta}
						</p>
					)}
				</div>
			)}

			{error && (
				<div className="p-4 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-100">
					{error}
				</div>
			)}

			<div className="space-y-4">
				<h2 className="text-xl font-semibold">Recent Matches</h2>
				<div className="grid gap-4">
					{matchHistory.map((match) => (
						<div
							key={match.matchId}
							className={`p-4 border rounded-lg dark:border-gray-700 transition-colors ${
								match.placement === 1
									? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
									: ""
							}`}
						>
							<div className="flex items-center gap-4">
								<div className="relative w-16 h-16 flex-shrink-0">
									<Image
										src={`/tiles_base/${match.champion}.jpg`}
										alt={match.champion}
										fill
										className="object-cover rounded-lg"
										sizes="64px"
									/>
								</div>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-lg">
											{match.champion}
										</span>
										<div
											className={`px-2 py-1 rounded-full text-white text-sm font-medium ${
												PLACEMENT_COLORS[
													match.placement as keyof typeof PLACEMENT_COLORS
												] ||
												"bg-gray-500 dark:bg-gray-600"
											}`}
										>
											#{match.placement}
										</div>
									</div>
									<div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
										Match ID: {match.matchId}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
