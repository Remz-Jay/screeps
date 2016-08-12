export let room: Room;
export let walls: StructureWall[];

export function load(r: Room) {
	room = r;
	walls = getWalls();
}

export function saveToMemory() {
	Memory.walls = _.pluck(walls, "hits");
}
export function getAverageStrength() {
	return _.round(_.sum<StructureWall>(walls, "hits") / _.size(walls));
}
export function getMinimumStrength() {
	return _.round(_.min(walls, "hits").hits);
}
export function getWeakestWall() {
	return _.min(walls, function (o) {
		return o.hits;
	});
}
export function adjustStrength() {
	let current = Memory.config.Wall[room.name].strength;
	let avg = getAverageStrength();
	if (avg > current) {
		Memory.config.Wall[room.name].strength = avg;
		console.log("Adjusting Wall Strength for room " + room.name + " to " + avg);
	}
}

export function getWalls(): StructureWall[] {
	let w = room.find(FIND_STRUCTURES, {
		filter: (s: Structure) => s.structureType === STRUCTURE_WALL,
	}) as StructureWall[];
	if (Memory.config.Wall === undefined) {
		Memory.config.Wall = {};
	}
	if (Memory.config.Wall[room.name] === undefined) {
		Memory.config.Wall[room.name] = {};
	}
	if (Memory.config.Wall[room.name].strength === undefined) {
		Memory.config.Wall[room.name].strength = 10000;
	}
	return w;
}