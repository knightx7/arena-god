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

	const handleUpdate = async () => {
		if (!gameName || !tagLine) {
			setError("Please enter both game name and tag line");
			return;
		}

		setIsLoading(true);
		setError(null);
		setFetchProgress(null);

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
			setRiotId({
				gameName: account.data.gameName,
				tagLine: account.data.tagLine,
			});

			// 2. Fetch all match IDs from the last 2 years
			const twoYearsAgo = new Date();
			twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
			const startTime = Math.floor(twoYearsAgo.getTime() / 1000);

			const allMatchIds: string[] = [];
			let start = 0;
			const count = 100;

			while (true) {
				const matchIdsResponse = await getMatchIds(
					account.data.puuid,
					region,
					start,
					count,
					startTime
				);
				if ("error" in matchIdsResponse || !matchIdsResponse.data) {
					setError("Failed to fetch a batch of match IDs.");
					break; // Stop but continue with what we have
				}
				allMatchIds.push(...matchIdsResponse.data);
				if (matchIdsResponse.data.length < count) {
					break; // Last page
				}
				start += count;
			}

			const uniqueMatchIds = [...new Set(allMatchIds)];
			setFetchProgress({
				total: uniqueMatchIds.length,
				fetched: 0,
			});

			// 3. Process matches in batches
			const BATCH_SIZE = 10;
			const BATCH_DELAY = 1200; // Riot rate limit: 100 requests per 2 minutes
			const newHistory: (MatchResult & { isNewMatch: boolean })[] = [];

			for (let i = 0; i < uniqueMatchIds.length; i += BATCH_SIZE) {
				const batch = uniqueMatchIds.slice(i, i + BATCH_SIZE);
				const batchPromises = batch.map(async (matchId) => {
					const cachedMatch = getCachedMatch(matchId);
					if (cachedMatch) {
						return {
							...getPlayerMatchResult(
								cachedMatch,
								account.data.puuid
							),
							matchId,
							isNewMatch: false,
						};
					}
					const matchInfo = await getMatchInfo(matchId, region);
					if ("error" in matchInfo || !matchInfo.data) return null;
					cacheMatch(matchId, matchInfo.data);
					return {
						...getPlayerMatchResult(
							matchInfo.data,
							account.data.puuid
						),
						matchId,
						isNewMatch: true,
					};
				});

				const batchResults = await Promise.all(batchPromises);
				const validResults = batchResults.filter(
					(r): r is MatchResult & { isNewMatch: boolean } =>
						Boolean(r && r.champion && r.placement)
				);
				newHistory.push(...validResults);

				setFetchProgress((prev) => ({
					total: uniqueMatchIds.length,
					fetched: prev ? prev.fetched + batch.length : batch.length,
				}));

				if (i + BATCH_SIZE < uniqueMatchIds.length) {
					await new Promise((resolve) =>
						setTimeout(resolve, BATCH_DELAY)
					);
				}
			}

			// 4. Update state and storage
			const sortedHistory = newHistory.sort((a, b) =>
				b.matchId.localeCompare(a.matchId)
			);
			setMatchHistoryState(sortedHistory);
			setMatchHistory(sortedHistory);

			const newMatches = newHistory.filter((result) => result.isNewMatch);
			if (newMatches.length > 0) {
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
			}
		} catch (error) {
			console.error("Failed to update match history:", error);
			setError("Failed to update match history");
		} finally {
			setIsLoading(false);
			setFetchProgress(null);
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
