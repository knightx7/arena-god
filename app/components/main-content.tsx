"use client";

import { useState, useEffect } from "react";
import { ArenaGodTracker } from "./arena-god-tracker";
import { Tabs } from "./tabs";
import { getArenaProgress } from "../lib/storage";
import { ArenaProgress } from "../types";

export function MainContent({ images }: { images: string[] }) {
	const [progress, setProgress] = useState<ArenaProgress>({
		firstPlaceChampions: [],
		topFourChampions: [],
		playedChampions: [],
	});

	useEffect(() => {
		setProgress(getArenaProgress());

		const handleStorageChange = () => {
			setProgress(getArenaProgress());
		};

		window.addEventListener("storage", handleStorageChange);

		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, []);

	return (
		<div>
			<ArenaGodTracker progress={progress} />
			<div className="my-8">
				<hr className="dark:border-gray-700" />
			</div>
			<Tabs images={images} />
		</div>
	);
}
