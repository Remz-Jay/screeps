import CreepAction from "./creepAction";
import CreepGovernor from "./creepGovernor";
import Harvester from "./roles/harvester";
import Builder from "./roles/builder";
import HarvesterGovernor from "./governors/harvester";
import BuilderGovernor from "./governors/builder";
import Upgrader from "./roles/upgrader";
import UpgraderGovernor from "./governors/upgrader";
import LinkerGovernor from "./governors/linker";
import MuleGovernor from "./governors/mule";
import Mule from "./roles/mule";
import Linker from "./roles/linker";
// import Repair from "./roles/repair";
// import RepairGovernor from "./governors/repair";
import Miner from "./roles/miner";
import MinerGovernor from "./governors/miner";
import Scientist from "./roles/scientist";
import ScientistGovernor from "./governors/scientist";
import Biter from "./roles/biter";
import BiterGovernor from "./governors/biter";
// import DismantlerGovernor from "./governors/dismantler";
// import Dismantler from "./roles/dismantler";

const roles: {[key: string]: typeof CreepAction } = {
	Builder: Builder,
	Harvester: Harvester,
	Upgrader: Upgrader,
	Mule: Mule,
	Linker: Linker,
	// Repair: Repair,
	Miner: Miner,
	Scientist: Scientist,
	Biter: Biter,
	// Dismantler: Dismantler,
};

const governors: {[key: string]: typeof CreepGovernor } = {
	BuilderGovernor: BuilderGovernor,
	HarvesterGovernor: HarvesterGovernor,
	UpgraderGovernor: UpgraderGovernor,
	LinkerGovernor: LinkerGovernor,
	MuleGovernor: MuleGovernor,
	// RepairGovernor: RepairGovernor,
	MinerGovernor: MinerGovernor,
	ScientistGovernor: ScientistGovernor,
	BiterGovernor: BiterGovernor,
	// DismantlerGovernor: DismantlerGovernor,
};

export function createCreep(room: Room, config: CreepConfiguration): string|number {
	const spawn = room.getFreeSpawn();
	if (!!spawn) {
		let status: number | string = spawn.canCreateCreep(config.body, config.name);
		if (status === OK) {
			status = spawn.createCreepWhenIdle(config.body, config.name, config.properties);
			if (global.VERBOSE) {
				if (_.isNumber(status)) {
					console.log(`Unable to create ${config.properties.role} Creep (${status})`);
				} else {
					console.log(`Started creating new ${config.properties.role} Creep ${status}`);
				}
			}
		}
		return status;
	} else {
		return ERR_BUSY;
	}
}

export function governCreeps(room: Room) {
	let isSpawning = false;
	const prioritizedGovernors = _.sortBy(governors, "PRIORITY");
	for (const index in prioritizedGovernors) {
		if (room.controller.level >= prioritizedGovernors[index].MINRCL // Skip roles that aren't meant for this RCL
			&& (
				prioritizedGovernors[index].PRIORITY < global.PRIORITY_TRESHOLD // Always execute roles that have priority
				|| Game.cpu.bucket > global.BUCKET_MIN // Execute auxiliary roles when bucket allows for it
			)
		) {
			const governor: CreepGovernor = new prioritizedGovernors[index](room);
			const creepRole: string = prioritizedGovernors[index].ROLE;
			const creepsInRole: Creep[] = _.get(global.tickCache.rolesByRoom, `${creepRole}.${room.name}`, []);
			const numCreeps: number = creepsInRole.length;
			const creepLimit: number = governor.getCreepLimit();

			if (global.CREEPSTATS) {
				const body: string[] = governor.getBody();
				const requiredEnergy: number = CreepGovernor.calculateRequiredEnergy(body);
				console.log(
					_.padLeft(creepRole, 9) + ":\t" + numCreeps
					+ " (max:" + creepLimit
					+ ")\t\t(" + _.padLeft(requiredEnergy.toString(), 4)
					+ ") [" + body
					+ "]"
				);
			}
			if (numCreeps < creepLimit && !isSpawning && room.mySpawns.length > 0) {
				const config: CreepConfiguration = governor.getCreepConfig();
				if (!_.isNumber(this.createCreep(room, config))) {
					isSpawning = true;
				} else if (governor.emergency) {
					isSpawning = true; // prevent spawning of other roles until the emergency is over.
				}
			}
			if (numCreeps > 0) {
				const role: CreepAction = <CreepAction> new roles[<any> creepRole]();
				_.each(creepsInRole, function (creep: Creep) {
					if (!creep.spawning) {
						try {
							role.setCreep(<Creep> creep);
							role.setGovernor(governor);
							role.action();
						} catch (e) {
							console.log(`ERROR :: ${creepRole}: ${creep.name} ${creep.room.name} ${e.message}`);
						}
					}
				}, this);
			}
		}
	}
}
