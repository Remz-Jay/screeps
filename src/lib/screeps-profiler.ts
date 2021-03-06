let usedOnStart = 0;
let enabled = false;
let depth = 0;

interface Game {
	profiler: any;
}

function setupProfiler() {
	depth = 0; // reset depth, this needs to be done each tick.
	Game.profiler = {
		stream(duration: number, filter: string) {
			setupMemory("stream", duration || 10, filter);
		},
		email(duration: number, filter: string) {
			setupMemory("email", duration || 100, filter);
		},
		profile(duration: number, filter: string) {
			setupMemory("profile", duration || 100, filter);
		},
		reset: resetMemory,
	};

	overloadCPUCalc();
}

function setupMemory(profileType: string, duration: number, filter: string) {
	resetMemory();
	if (!Memory.profiler) {
		Memory.profiler = {
			map: {},
			totalTime: 0,
			enabledTick: Game.time + 1,
			disableTick: Game.time + duration,
			type: profileType,
			filter,
		};
	}
}

function resetMemory() {
	Memory.profiler = null;
}

function overloadCPUCalc() {
	const simName: string = "sim";
	if (Game.rooms[simName]) {
		usedOnStart = 0; // This needs to be reset, but only in the sim.
		Game.cpu.getUsed = function getUsed() {
			return performance.now() - usedOnStart;
		};
	}
}

function getFilter() {
	return Memory.profiler.filter;
}

function wrapFunction(name: string, originalFunction: any) {
	return function wrappedFunction() {
		if (Profiler.isProfiling()) {
			const nameMatchesFilter = name === getFilter();
			const start = Game.cpu.getUsed();
			if (nameMatchesFilter) {
				depth = depth + 1;
			}
			const result = originalFunction.apply(this, arguments);
			if (depth > 0 || !getFilter()) {
				const end = Game.cpu.getUsed();
				Profiler.record(name, end - start);
			}
			if (nameMatchesFilter) {
				depth = depth - 1;
			}
			return result;
		}

		return originalFunction.apply(this, arguments);
	};
}

function hookUpPrototypes() {
	Profiler.prototypes.forEach(proto => {
		profileObjectFunctions(proto.val, proto.name);
	});
}

function profileObjectFunctions(object: any, label: string) {
	const objectToWrap = object.prototype ? object.prototype : object;

	Object.keys(objectToWrap).forEach(functionName => {
		const extendedLabel = `${label}.${functionName}`;
		try {
			if (typeof objectToWrap[functionName] === "function" && functionName !== "getUsed") {
				const originalFunction = objectToWrap[functionName];
				objectToWrap[functionName] = profileFunction(originalFunction, extendedLabel);
			}
		} catch (e) {
			// console.log(JSON.stringify(e), "Profiler.profileObjectFunctions");
		}
		/* eslint no-empty:0 */
	});

	return objectToWrap;
}

function profileFunction(fn: any, functionName: string) {
	const fnName = functionName || fn.name;
	if (!fnName) {
		console.log("Couldn\"t find a function name for - ", fn);
		console.log("Will not profile this function.");
		return fn;
	}

	return wrapFunction(fnName, fn);
}

const Profiler = {
	printProfile() {
		console.log(Profiler.output());
	},

	emailProfile() {
		Game.notify(Profiler.output());
	},

	output() {
		const elapsedTicks = Game.time - Memory.profiler.enabledTick + 1;
		const header = "calls\t\ttime\t\tavg\t\tfunction";
		const footer = [
			`Avg: ${(Memory.profiler.totalTime / elapsedTicks).toFixed(2)}`,
			`Total: ${Memory.profiler.totalTime.toFixed(2)}`,
			`Ticks: ${elapsedTicks}`,
		].join("\t");
		return [].concat(header, Profiler.lines().slice(0, 20), footer).join("\n");
	},

	lines() {
		const stats = Object.keys(Memory.profiler.map).map(functionName => {
			const functionCalls = Memory.profiler.map[functionName];
			return {
				name: functionName,
				calls: functionCalls.calls,
				totalTime: functionCalls.time,
				averageTime: functionCalls.time / functionCalls.calls,
			};
		}).sort((val1, val2) => {
			return val2.totalTime - val1.totalTime;
		});

		const lines = stats.map(data => {
			return [
				data.calls,
				data.totalTime.toFixed(1),
				data.averageTime.toFixed(3),
				data.name,
			].join("\t\t");
		});

		return lines;
	},

	prototypes: [
		{name: "Game", val: Game},
		{name: "Room", val: Room},
		{name: "Structure", val: Structure},
		{name: "Spawn", val: Spawn},
		{name: "Creep", val: Creep},
		{name: "RoomPosition", val: RoomPosition},
		{name: "Source", val: Source},
		{name: "Flag", val: Flag},
	],

	record(functionName: string, time: number) {
		if (!Memory.profiler.map[functionName]) {
			Memory.profiler.map[functionName] = {
				time: 0,
				calls: 0,
			};
		}
		Memory.profiler.map[functionName].calls = Memory.profiler.map[functionName].calls + 1;
		Memory.profiler.map[functionName].time = Memory.profiler.map[functionName].time + time;
	},

	endTick() {
		if (Game.time >= Memory.profiler.enabledTick) {
			const cpuUsed = Game.cpu.getUsed();
			Memory.profiler.totalTime = Memory.profiler.totalTime + cpuUsed;
			Profiler.report();
		}
	},

	report() {
		if (Profiler.shouldPrint()) {
			Profiler.printProfile();
		} else if (Profiler.shouldEmail()) {
			Profiler.emailProfile();
		}
	},

	isProfiling() {
		return enabled && !!Memory.profiler && Game.time <= Memory.profiler.disableTick;
	},

	type() {
		return Memory.profiler.type;
	},

	shouldPrint() {
		const streaming = Profiler.type() === "stream";
		const profiling = Profiler.type() === "profile";
		const onEndingTick = Memory.profiler.disableTick === Game.time;
		return streaming || (profiling && onEndingTick);
	},

	shouldEmail() {
		return Profiler.type() === "email" && Memory.profiler.disableTick === Game.time;
	},
};

export function wrap(callback: any) {
	if (enabled) {
		setupProfiler();
	}

	if (Profiler.isProfiling()) {
		usedOnStart = Game.cpu.getUsed();

		// Commented lines are part of an on going experiment to keep the profiler
		// performant, and measure certain types of overhead.

		// var callbackStart = Game.cpu.getUsed();
		const returnVal = callback();
		// var callbackEnd = Game.cpu.getUsed();
		Profiler.endTick();
		// var end = Game.cpu.getUsed();

		// var profilerTime = (end - start) - (callbackEnd - callbackStart);
		// var callbackTime = callbackEnd - callbackStart;
		// var unaccounted = end - profilerTime - callbackTime;
		// console.log("total-", end, "profiler-", profilerTime, "callbacktime-",
		// callbackTime, "start-", start, "unaccounted", unaccounted);
		return returnVal;
	}

	return callback();
}

export function enable() {
	enabled = true;
	hookUpPrototypes();
}

export function registerObject(object: any, label: string) {
	return profileObjectFunctions(object, label);
}

export function registerFN(fn: any, functionName: string) {
	return profileFunction(fn, functionName);
}
