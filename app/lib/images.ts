import fs from "fs";
import path from "path";

export interface ImageTile {
	name: string;
	src: string;
}

export async function getImageTiles(): Promise<ImageTile[]> {
	const imagesDirectory = path.join(process.cwd(), "public/tiles_base");
	const imageFiles = fs.readdirSync(imagesDirectory);

	return imageFiles
		.filter((file) => file.endsWith(".jpg"))
		.map((file) => ({
			name: path.parse(file).name,
			src: `/tiles_base/${file}`,
		}));
}
