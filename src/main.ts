import "./prototypes/room";
import "./prototypes/link";
import "./prototypes/tower";
import "./prototypes/spawn";

import * as StatsManager from "./shared/statsManager";
import * as Profiler from "./lib/screeps-profiler";
import * as MemoryManager from "./shared/memoryManager";

import * as RoomManager from "./components/rooms/roomManager";
import * as CreepManager from "./components/creeps/creepManager";
import * as AssimilationManager from "./packages/assimilation/assimilationManager";
import * as OffenseManager from "./packages/warfare/managers/offense/offenseManager";

delete Memory.log;

console.log(`====== RESET ====== RESET ====== RESET ====== RESET ====== RESET ======`);
// Profiler.enable();

/*
Profiler.registerObject(StatsManager, "StatsManager");
Profiler.registerObject(RoomManager, "RoomManager");
Profiler.registerObject(CreepManager, "CreepManager");
Profiler.registerObject(AssimilationManager, "AssimilationManager");
Profiler.registerObject(OffenseManager, "OffenseManager");
*/

StatsManager.init();

export function loop() {
	Profiler.wrap(function () {
		console.log();
		PathFinder.use(true);
		RoomManager.loadRooms(); // This must be done early because we hook a lot of properties to Room.prototype!!
		MemoryManager.loadMemory();
		MemoryManager.cleanMemory();
		CreepManager.loadCreeps();
		let CpuInit = Game.cpu.getUsed();

		let cpuBeforeStats = Game.cpu.getUsed();
		StatsManager.runBuiltinStats();
		StatsManager.addStat("cpu.stats", Game.cpu.getUsed() - cpuBeforeStats);
		StatsManager.addStat("cpu.init", CpuInit);

		try {
			RoomManager.governRooms();
		} catch (e) {
			console.log("RoomManager Exception", (<Error> e).message);
		}
		try {
			AssimilationManager.govern();
		} catch (e) {
			console.log("AssimilationManager Exception", (<Error> e).message);
		}
		try {
			OffenseManager.govern();
		} catch (e) {
			console.log("OffenseManager Exception", (<Error> e).message);
		}
		if (!!Memory.showLogCreep) {
			Memory.log.creeps.forEach((message: String, index: number) => {
				console.log("log.creeps", message);
			});
		}
		if (!!Memory.showLogMove) {
			Memory.log.move.forEach((message: String, index: number) => {
				console.log("log.move", message);
			});
		}
		if (!!Memory.showLogAsm) {
			Memory.log.asm.forEach((message: String, index: number) => {
				console.log("log.ASM", message);
			});
		}
		delete Memory.log;
		if (!!Memory.showTransactions && Game.cpu.getUsed() < Game.cpu.limit) {
			console.log();
			console.log(`Incoming Transactions:`);
			_.take(Game.market.incomingTransactions, 5).forEach((t: Transaction) => {
				console.log(t.sender.username, t.resourceType, t.amount, t.from, t.to, t.description);
			});
			console.log();
			console.log(`Outgoing Transactions:`);
			_.take(Game.market.outgoingTransactions, 5).forEach((t: Transaction) => {
				console.log(t.recipient.username, t.resourceType, t.amount, t.from, t.to, t.description);
			});
		}
		let perc = _.floor(Game.gcl.progress / (Game.gcl.progressTotal / 100));
		console.log();
		console.log(`End of tick ${Game.time}.\t`
			+ `GCL:${Game.gcl.level}@${perc}%\t`
			+ `CPU:${_.ceil(Game.cpu.getUsed())}/${Game.cpu.limit}\t`
			+ `RES:${Game.cpu.tickLimit}/${Game.cpu.bucket}`);
		StatsManager.addStat("cpu.getUsed", Game.cpu.getUsed());
	});
}
