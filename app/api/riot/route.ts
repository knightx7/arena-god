import { NextRequest, NextResponse } from "next/server";
import { REGION_TO_CONTINENT, Region } from "../../types";

const RIOT_TOKEN = process.env.RIOT_API_TOKEN;

if (!RIOT_TOKEN) {
	throw new Error("RIOT_API_TOKEN environment variable is not set");
}

const headers = {
	"X-Riot-Token": RIOT_TOKEN,
};

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const endpoint = searchParams.get("endpoint");
	const gameName = searchParams.get("gameName");
	const tagLine = searchParams.get("tagLine");
	const puuid = searchParams.get("puuid");
	const matchId = searchParams.get("matchId");
	const region = searchParams.get("region") as Region;

	if (!endpoint) {
		return NextResponse.json(
			{ error: "Endpoint is required" },
			{ status: 400 }
		);
	}

	const continent = region
		? REGION_TO_CONTINENT[region]
		: REGION_TO_CONTINENT.NA;
	const RIOT_API_BASE = `https://${continent}.api.riotgames.com`;

	try {
		let url = "";
		switch (endpoint) {
			case "account":
				if (!gameName || !tagLine) {
					return NextResponse.json(
						{ error: "Game name and tag line are required" },
						{ status: 400 }
					);
				}
				url = `${RIOT_API_BASE}/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`;
				break;

			case "matches":
				if (!puuid) {
					return NextResponse.json(
						{ error: "PUUID is required" },
						{ status: 400 }
					);
				}
				url = `${RIOT_API_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=1700&start=0&count=40`;
				break;

			case "match":
				if (!matchId) {
					return NextResponse.json(
						{ error: "Match ID is required" },
						{ status: 400 }
					);
				}
				url = `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}`;
				break;

			default:
				return NextResponse.json(
					{ error: "Invalid endpoint" },
					{ status: 400 }
				);
		}

		const response = await fetch(url, { headers });
		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(data, { status: response.status });
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error in Riot API route:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
