import { Tabs } from "./components/tabs";
import { getImageTiles } from "./lib/images";

export default async function Home() {
	const images = await getImageTiles();

	return (
		<div className="min-h-screen p-4">
			<h1 className="text-3xl font-bold text-center mb-8">
				Arena God Tracker
			</h1>
			<Tabs images={images} />
		</div>
	);
}
