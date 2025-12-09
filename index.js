// analisar.js
const fs = require("fs");
const path = require("path");

const DATA_DIR = "./jsons"; // ajuste se necessário
const OUTPUT_TXT = "estatisticas.txt";
const OUTPUT_JSON = "estatisticas.json";

const partidasUnicas = new Map(); // id -> match
const mapas = {}; // nome -> stats

function processarMatch(match) {
	const id = match?.attributes?.id;
	const gamemode = match?.metadata?.gamemodeName;

	if (!id || gamemode !== "Ranked") return;
	if (partidasUnicas.has(id)) return;
	partidasUnicas.set(id, match);

	const mapName = match.metadata?.sessionMapName || match.attributes?.sessionMap || "Desconhecido";
	const overview = Array.isArray(match.segments)
		? match.segments.find((s) => s.type === "overview")
		: null;
	if (!overview) return;

	const hasWon = !!overview.metadata?.hasWon;
	const roundsPlayed = Number(overview.stats?.roundsPlayed?.value ?? 0);
	const roundsWon = Number(overview.stats?.roundsWon?.value ?? 0);

	if (!mapas[mapName]) {
		mapas[mapName] = {
			mapa: mapName,
			partidas: 0,
			vitorias: 0,
			roundsTotais: 0,
			roundsGanhos: 0,
		};
	}

	mapas[mapName].partidas += 1;
	if (hasWon) mapas[mapName].vitorias += 1;
	mapas[mapName].roundsTotais += roundsPlayed;
	mapas[mapName].roundsGanhos += roundsWon;
}

function gerarEstatisticas() {
	const arr = Object.values(mapas).map((s) => {
		const winRate = s.partidas > 0 ? (s.vitorias / s.partidas) * 100 : 0;
		const roundWinRate = s.roundsTotais > 0 ? (s.roundsGanhos / s.roundsTotais) * 100 : 0;
		return {
			mapa: s.mapa,
			partidas: s.partidas,
			vitorias: s.vitorias,
			winRate: Number(winRate.toFixed(2)),
			roundsGanhos: s.roundsGanhos,
			roundsTotais: s.roundsTotais,
			roundWinRate: Number(roundWinRate.toFixed(2)),
		};
	});

	// ordenar por taxa de vitórias (desc)
	arr.sort((a, b) => b.winRate - a.winRate || b.partidas - a.partidas);

	const resumo = {
		totalPartidasRankedUnicas: partidasUnicas.size,
		mapas: arr,
	};

	// gerar TXT
	let txt = "=== ESTATÍSTICAS DE PARTIDAS RANKED ===\n\n";
	txt += `Total de partidas Ranked (IDs únicos): ${resumo.totalPartidasRankedUnicas}\n\n`;
	txt += "=== MAPAS (ordenado por taxa de vitória desc) ===\n";

	for (const m of arr) {
		txt += `\nMapa: ${m.mapa}\n`;
		txt += `  Partidas: ${m.partidas}\n`;
		txt += `  Vitórias: ${m.vitorias}\n`;
		txt += `  Taxa de vitória: ${m.winRate}%\n`;
		txt += `  Rounds ganhos: ${m.roundsGanhos}/${m.roundsTotais} (${m.roundWinRate}%)\n`;
	}

	fs.writeFileSync(OUTPUT_TXT, txt, "utf8");
	fs.writeFileSync(OUTPUT_JSON, JSON.stringify(resumo, null, 2), "utf8");

	console.log(txt);
	console.log(`\nArquivos gerados: ${OUTPUT_TXT} e ${OUTPUT_JSON}`);
}

function lerArquivos() {
	if (!fs.existsSync(DATA_DIR)) {
		console.error(`Pasta ${DATA_DIR} não encontrada. Crie e coloque os arquivos .json lá.`);
		process.exit(1);
	}

	const arquivos = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
	if (arquivos.length === 0) {
		console.error("Nenhum arquivo .json encontrado em", DATA_DIR);
		process.exit(1);
	}

	for (const arq of arquivos) {
		const full = path.join(DATA_DIR, arq);
		try {
			const raw = fs.readFileSync(full, "utf8");
			const json = JSON.parse(raw);
			// suportar estrutura onde matches está em json.data.matches
			const matches = json.data?.matches ?? json.matches ?? [];
			if (!Array.isArray(matches)) continue;
			for (const m of matches) processarMatch(m);
		} catch (err) {
			console.warn(`Erro lendo/parsing ${arq}:`, err.message);
		}
	}

	gerarEstatisticas();
}

// run
lerArquivos();
