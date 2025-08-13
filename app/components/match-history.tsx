"use client";

import Image from "next/image";
import { MatchResult, Region, REGIONS } from "../types";
import { setRegion as setStoredRegion } from "../lib/storage";

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

interface MatchHistoryProps {
	// Props from parent
	gameName: string;
	setGameName: (name: string) => void;
	tagLine: string;
	setTagLine: (tag: string) => void;
	region: Region;
	setRegion: (region: Region) => void;
	matchHistory: MatchResult[];
	isLoading: boolean;
	error: string | null;
	fetchProgress: { total: number; fetched: number } | null;
	eta: string | null;
	liveStats: { firstPlaces: number } | null;
	onUpdate: (gameName: string, tagLine: string, region: Region) => void;
}

export function MatchHistory({
	gameName,
	setGameName,
	tagLine,
	setTagLine,
	region,
	setRegion,
	matchHistory,
	isLoading,
	error,
	fetchProgress,
	eta,
	liveStats,
	onUpdate,
}: MatchHistoryProps) {
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
					onClick={() => onUpdate(gameName, tagLine, region)}
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
					{liveStats && liveStats.firstPlaces > 0 && (
						<p className="text-sm text-yellow-500 font-semibold animate-pulse">
							Found {liveStats.firstPlaces} new 1st place
							finish
							{liveStats.firstPlaces > 1 ? "es" : ""}!
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
