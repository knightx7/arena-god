"use client";

import { ArenaProgress } from "../types";
import Image from "next/image";

interface ArenaGodTrackerProps {
	progress: ArenaProgress;
}

const ChampionGrid = ({ champions }: { champions: string[] }) => {
	if (champions.length === 0) {
		return <p className="text-gray-500">No champions yet.</p>;
	}

	return (
		<div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
			{champions.map((champion) => (
				<div key={champion} className="relative aspect-square">
					<Image
						src={`/tiles_base/${champion}.jpg`}
						alt={champion}
						fill
						className="object-cover rounded-lg"
						sizes="(max-width: 768px) 25vw, (max-width: 1200px) 16vw, 10vw"
					/>
				</div>
			))}
		</div>
	);
};

export function ArenaGodTracker({ progress }: ArenaGodTrackerProps) {
	const { firstPlaceChampions, topFourChampions, playedChampions } = progress;

	const topFourOnly = topFourChampions.filter(
		(c) => !firstPlaceChampions.includes(c)
	);
	const playedOnly = playedChampions.filter(
		(c) => !topFourChampions.includes(c) && !firstPlaceChampions.includes(c)
	);

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold mb-4">Arena God Progress</h2>
			</div>
			<div className="space-y-6">
				<div>
					<h3 className="text-xl font-semibold mb-3">1st Place</h3>
					<ChampionGrid champions={firstPlaceChampions} />
				</div>
				<div>
					<h3 className="text-xl font-semibold mb-3">Top 4</h3>
					<ChampionGrid champions={topFourOnly} />
				</div>
				<div>
					<h3 className="text-xl font-semibold mb-3">Played</h3>
					<ChampionGrid champions={playedOnly} />
				</div>
			</div>
		</div>
	);
}
