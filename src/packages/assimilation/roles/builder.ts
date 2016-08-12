import ASMCreepAction from "../assimilationCreepAction";

export interface IASMBuilder {
	action(): boolean;
}

export default class ASMBuilder extends ASMCreepAction implements IASMBuilder {

	public setCreep(creep: Creep) {
		super.setCreep(creep);
	}
	public builderLogic() {
		if (this.creep.memory.building && this.creep.carry.energy === 0) {
			delete this.creep.memory.building;
			delete this.creep.memory.target;
			delete this.creep.memory.source;
			delete this.creep.memory.target;
			this.creep.say("B:COL");
		}
		if (!this.creep.memory.building && !this.creep.memory.idle &&
			this.creep.carry.energy === this.creep.carryCapacity
		) {
			this.creep.memory.building = true;
			delete this.creep.memory.target;
			delete this.creep.memory.target;
			delete this.creep.memory.source;
			this.creep.say("B:BUILD");
		}

		if (this.creep.memory.building) {
			if (!this.creep.memory.target) {
				let target: ConstructionSite = this.creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES) as ConstructionSite;
				if (!!target) {
					this.creep.memory.target = target.id;
				} else {
					// nothing to build. return energy.
					delete this.creep.memory.building;
					this.creep.memory.idle = true;
					delete this.creep.memory.target;
					delete this.creep.memory.source;
					this.creep.say("B:IDLE");
					// this.moveTo(this.creep.pos.findClosestByPath(FIND_MY_SPAWNS));
				}
			}
			let target = Game.getObjectById(this.creep.memory.target) as ConstructionSite;
			if (!!target) {
				if (this.creep.build(target) === ERR_NOT_IN_RANGE) {
					this.moveTo(target.pos);
				}
			} else {
				delete this.creep.memory.target;
			}
		} else if (this.creep.memory.idle) {
			// scan for sites and return to active duty when found
			let target = this.creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES) as ConstructionSite;
			if (!!target) {
				this.creep.memory.target = target.id;
				delete this.creep.memory.target;
				this.creep.memory.building = true;
			} else {
				// nothing to build. return energy.
				delete this.creep.memory.building;
				this.creep.memory.idle = true;
				delete this.creep.memory.target;
				delete this.creep.memory.source;
				let spawn = Game.spawns[this.creep.memory.homeSpawn];
				if (this.creep.pos.isNearTo(spawn)) {
					if (this.creep.carry.energy > 0) {
						this.creep.transfer(spawn, RESOURCE_ENERGY);
					} else {
						spawn.recycleCreep(this.creep);
					}
				} else {
					this.moveTo(spawn.pos);
				}
				this.creep.say("B:IDLE!");
			}
		} else {
			if (!this.creep.memory.source) {
				// Prefer energy from containers
				let source: Source | StorageStructure = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
					filter: (structure: StorageStructure) => ((structure instanceof StructureContainer
					|| structure instanceof StructureStorage) && structure.store[RESOURCE_ENERGY] > 100)
					|| (structure instanceof StructureSpawn && structure.energy  >= (structure.energyCapacity * 0.8)),
				}) as StorageStructure;
				// Go to source otherwise
				if (!source) {
					source = this.creep.pos.findClosestByPath(FIND_SOURCES, {
						filter: (source: Source) => (source.energy > 100) || source.ticksToRegeneration < 30,
					}) as Source;
				}
				if (!!source) {
					this.creep.memory.source = source.id;
				}
			}
			if (!!this.creep.memory.source) {
				let source: RoomObject = Game.getObjectById(this.creep.memory.source) as RoomObject;
				if (source instanceof Structure) { // Sources aren't structures
					let status = this.creep.withdraw(source, RESOURCE_ENERGY);
					switch (status) {
						case ERR_NOT_ENOUGH_RESOURCES:
						case ERR_INVALID_TARGET:
						case ERR_NOT_OWNER:
						case ERR_FULL:
							delete this.creep.memory.source;
							break;
						case ERR_NOT_IN_RANGE:
							this.moveTo(source.pos);
							break;
						case OK:
							break;
						default:
							console.log(`Unhandled ERR in builder.source.container: ${status}`);
					}
				} else {
					let status = this.creep.harvest(source as Source);
					switch (status) {
						case ERR_NOT_ENOUGH_RESOURCES:
						case ERR_INVALID_TARGET:
						case ERR_NOT_OWNER:
						case ERR_FULL:
							delete this.creep.memory.source;
							break;
						case ERR_NOT_IN_RANGE:
							this.moveTo(source.pos);
							break;
						case OK:
							break;
						default:
							console.log(`Unhandled ERR in builder.source.harvest: ${status}`);
					}
				}
			}
		}
	};

	public action(): boolean {
		if (super.action()) {
			this.creep.say(this.creep.memory.config.targetRoom);
			if (this.creep.room.name !== this.creep.memory.config.targetRoom) {
				if (_.sum(this.creep.carry) < this.creep.carryCapacity) {
					this.harvestFromContainersAndSources();
				} else {
					this.moveToTargetRoom();
				}
			} else {
				this.builderLogic();
			}
		}
		return true;
	}
}