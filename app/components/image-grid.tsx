"use client";

import Image from "next/image";
import { ImageTile } from "../lib/images";
import { getArenaProgress, setArenaProgress } from "../lib/storage";
import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Circle, ArrowUpDown, ArrowDownUp } from "lucide-react";
import { ArenaProgress } from "../types";

interface ImageGridProps {
	images: ImageTile[];
	displayImages?: ImageTile[];
}

type SortMode = "completion" | "alphabetical";
type SortDirection = "asc" | "desc";
type FilterMode = "all" | "played" | "firstPlace";

export function ImageGrid({ images, displayImages = images }: ImageGridProps) {
	const [mounted, setMounted] = useState(false);
	const [progress, setProgress] = useState<ArenaProgress>({
		firstPlaceChampions: [],
		playedChampions: [],
	});
	const [sortMode, setSortMode] = useState<SortMode>("completion");
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
	const [filterMode, setFilterMode] = useState<FilterMode>("all");

	useEffect(() => {
		setMounted(true);
		setProgress(getArenaProgress());
	}, []);

	const firstPlaceCount = progress.firstPlaceChampions.length;
	const playedCount = progress.playedChampions.length;
	const totalCount = images.length;

	const toggleChampion = (championName: string) => {
		const isCompleted = progress.firstPlaceChampions.includes(championName);
		const newFirstPlaceChampions = isCompleted
			? progress.firstPlaceChampions.filter(
					(name) => name !== championName
			  )
			: [...progress.firstPlaceChampions, championName];
		const newProgress: ArenaProgress = {
			...progress,
			firstPlaceChampions: newFirstPlaceChampions,
			playedChampions: [
				...new Set([...progress.playedChampions, championName]),
			],
		};
		setProgress(newProgress);
		setArenaProgress(newProgress);
	};

	const filteredAndSortedImages = useMemo(() => {
		let items = displayImages;
		if (filterMode === "played") {
			items = displayImages.filter((img) =>
				progress.playedChampions.includes(img.name)
			);
		} else if (filterMode === "firstPlace") {
			items = displayImages.filter((img) =>
				progress.firstPlaceChampions.includes(img.name)
			);
		}

		return [...items].sort((a, b) => {
			if (sortMode === "completion") {
				const aCompleted = progress.firstPlaceChampions.includes(
					a.name
				);
				const bCompleted = progress.firstPlaceChampions.includes(
					b.name
				);
				if (aCompleted !== bCompleted) {
					return sortDirection === "asc"
						? aCompleted
							? -1
							: 1
						: aCompleted
						? 1
						: -1;
				}
				return a.name.localeCompare(b.name);
			}
			return sortDirection === "asc"
				? a.name.localeCompare(b.name)
				: b.name.localeCompare(a.name);
		});
	}, [displayImages, filterMode, sortMode, sortDirection, progress]);

	if (!mounted) {
		return null;
	}

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<div className="flex items-center justify-between mb-2">
					<h3 className="text-lg font-medium">Progress</h3>
					<div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-4">
						<span>
							<span className="font-bold text-green-500">
								{firstPlaceCount}
							</span>{" "}
							1st Place
						</span>
						<span>
							<span className="font-bold text-yellow-400">
								{playedCount}
							</span>{" "}
							Played
						</span>
						<span>
							<span className="font-bold">{totalCount}</span> Total
						</span>
					</div>
				</div>
				<div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full">
					<div
						className="absolute top-0 left-0 h-full bg-yellow-400 rounded-full"
						style={{
							width: `${(playedCount / totalCount) * 100}%`,
							zIndex: 1,
						}}
					/>
					<div
						className="absolute top-0 left-0 h-full bg-green-500 rounded-full"
						style={{
							width: `${
								(firstPlaceCount / totalCount) * 100
							}%`,
							zIndex: 2,
						}}
					/>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<select
					value={sortMode}
					onChange={(e) => setSortMode(e.target.value as SortMode)}
					className="px-3 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
				>
					<option value="completion">Sort by Completion</option>
					<option value="alphabetical">Sort Alphabetically</option>
				</select>
				<button
					onClick={() =>
						setSortDirection((prev) =>
							prev === "asc" ? "desc" : "asc"
						)
					}
					className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
					title={
						sortDirection === "asc"
							? "Reverse order"
							: "Normal order"
					}
				>
					{sortDirection === "asc" ? (
						<ArrowUpDown className="w-5 h-5" />
					) : (
						<ArrowDownUp className="w-5 h-5" />
					)}
				</button>
				<div className="flex-grow" />
				<div className="flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 p-0.5">
					<button
						onClick={() => setFilterMode("all")}
						className={`px-3 py-1 text-sm rounded-md ${
							filterMode === "all"
								? "bg-gray-200 dark:bg-gray-700"
								: ""
						}`}
					>
						All
					</button>
					<button
						onClick={() => setFilterMode("played")}
						className={`px-3 py-1 text-sm rounded-md ${
							filterMode === "played"
								? "bg-gray-200 dark:bg-gray-700"
								: ""
						}`}
					>
						Played
					</button>
					<button
						onClick={() => setFilterMode("firstPlace")}
						className={`px-3 py-1 text-sm rounded-md ${
							filterMode === "firstPlace"
								? "bg-gray-200 dark:bg-gray-700"
								: ""
						}`}
					>
						1st Place
					</button>
				</div>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
				{filteredAndSortedImages.map((image) => {
					const isCompleted = progress.firstPlaceChampions.includes(
						image.name
					);
					return (
						<div
							key={image.name}
							className="group relative flex flex-col items-center"
						>
							<button
								onClick={() => toggleChampion(image.name)}
								className="relative w-full aspect-square mb-2 group"
							>
								<Image
									src={image.src}
									alt={image.name}
									fill
									className={`object-cover rounded-lg ${
										isCompleted
											? "opacity-100"
											: "opacity-50"
									} group-hover:opacity-100`}
									sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
								/>
								<div
									className={`absolute top-2 right-2 p-1 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-sm ${
										isCompleted ? "scale-110" : "scale-100"
									}`}
								>
									{isCompleted ? (
										<CheckCircle2 className="w-5 h-5 text-green-500" />
									) : (
										<Circle className="w-5 h-5 text-gray-400" />
									)}
								</div>
								<div className="absolute top-2 left-2 flex flex-col gap-1">
									<a
										href={`https://u.gg/lol/champions/arena/${image.name.toLowerCase()}-arena-build`}
										target="_blank"
										rel="noopener noreferrer"
										onClick={(e) => e.stopPropagation()}
										className="px-2 py-0.5 text-xs font-medium bg-blue-500/90 text-white rounded-full hover:bg-blue-600 transition-colors shadow-sm ring-1 ring-blue-600/50"
									>
										u.gg
									</a>
									<a
										href={`https://blitz.gg/lol/champions/${image.name}/arena`}
										target="_blank"
										rel="noopener noreferrer"
										onClick={(e) => e.stopPropagation()}
										className="px-2 py-0.5 text-xs font-medium bg-red-500/90 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm ring-1 ring-red-600/50"
									>
										blitz
									</a>
									<a
										href={`https://www.metasrc.com/lol/arena/build/${image.name.toLowerCase()}`}
										target="_blank"
										rel="noopener noreferrer"
										onClick={(e) => e.stopPropagation()}
										className="px-2 py-0.5 text-xs font-medium bg-gray-500/90 text-white rounded-full hover:bg-gray-600 transition-colors shadow-sm ring-1 ring-gray-600/50"
									>
										metasrc
									</a>
								</div>
							</button>
							<span className="text-sm text-center font-medium">
								{image.name}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
