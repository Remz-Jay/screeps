import WarfareCreepAction from "../warfareCreepAction";

export interface IRanger {
	action(): boolean;
}

export default class Ranger extends WarfareCreepAction implements IRanger {

	public setCreep(creep: Creep) {
		super.setCreep(creep);
	}
	public range() {
		let targets: Creep[] | Structure[] = this.creep.pos.findInRange<Creep>(this.creep.room.hostileCreeps, 3);
		if (!!targets && targets.length > 2) {
			this.creep.rangedMassAttack();
		} else {
			let closestHostile = this.creep.pos.findClosestByRange<Creep>(this.creep.room.hostileCreeps);
			if (!!closestHostile) {
				if (this.creep.rangedAttack(closestHostile) === ERR_NOT_IN_RANGE) {
					this.moveTo(closestHostile.pos);
				}
			} else {
				targets = this.creep.pos.findInRange<Structure>(this.creep.room.hostileStructures, 3);
				if (!!targets && targets.length > 2) {
					this.creep.rangedMassAttack();
				} else {
					let closestHostile = this.creep.pos.findClosestByPath<Structure>(this.creep.room.hostileStructures, {
						filter: (s: Structure) => s.structureType === STRUCTURE_EXTENSION
						|| s.structureType === STRUCTURE_SPAWN
						|| s.structureType === STRUCTURE_TOWER,
						costCallback: this.roomCallback,
					});
					if (!!closestHostile) {
						if (this.creep.rangedAttack(closestHostile) === ERR_NOT_IN_RANGE) {
							this.moveTo(closestHostile.pos);
						}
					} else {
						this.followWarrior();
					}
				}
			}
		}
	}

	public action(): boolean {
		if (super.renewCreep()) {
			this.creep.say(this.creep.memory.config.targetRoom);
			if (this.creep.room.name !== this.creep.memory.config.targetRoom) {
				this.moveToTargetRoom();
			} else {
				this.range();
			}
		}
		return true;
	}
}
