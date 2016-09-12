import * as WallManager from "../../../components/walls/wallManager";
import WarfareCreepAction from "../warfareCreepAction";

export interface IDismantler {
	action(): boolean;
}

let roomCallback = function (roomName: string): CostMatrix {
	try {
		let room = Game.rooms[roomName];
		if (!room) {
			return;
		}
		let matrix = room.getCreepMatrix();
		// avoid the edges
		for (let i = 1; i < 50; i++) {
			matrix.set(0, i, 50);
		}
		for (let i = 1; i < 50; i++) {
			matrix.set(49, i, 50);
		}
		for (let i = 1; i < 50; i++) {
			matrix.set(i, 0, 50);
		}
		for (let i = 1; i < 50; i++) {
			matrix.set(i, 49, 50);
		}
		return matrix;
	} catch (e) {
		console.log(JSON.stringify(e), "Dismantler.roomCallback", roomName);
		return new PathFinder.CostMatrix();
	}
};

export default class Dismantler extends WarfareCreepAction implements IDismantler {
	public noTarget: boolean = false;
	public hasHealer: boolean = true;
	public hardPath: boolean = true;
	public boosts: string[] = [
		RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, // +300% fatigue decrease speed
		RESOURCE_CATALYZED_ZYNTHIUM_ACID, // +300% dismantle effectiveness
	];

	public setCreep(creep: Creep, positions?: RoomPosition[]) {
		super.setCreep(creep, positions);
	}

	public checkTough(): boolean {
		return (this.creep.getActiveBodyparts(TOUGH) > 0);
	}

	public moveToHeal(): boolean {
		if (!this.checkTough() || this.creep.memory.waitForHealth) {
			this.creep.memory.waitForHealth = true;
			this.creep.memory.positionIterator = this.positionIterator = 0;
			if (!this.creep.pos.isNearTo(this.positions[this.positionIterator])) {
				this.moveTo(this.positions[this.positionIterator]);
			}
			return false;
		}
		return true;
	}

	public moveToSafeRange(): boolean {
		let targets = this.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 2, {
			filter: (c: Creep) => c.getActiveBodyparts(ATTACK) > 0
			|| c.getActiveBodyparts(RANGED_ATTACK) > 0,
		});
		if (targets.length > 0) {
			let goals = _.map(targets, function (t: Creep) {
				return {pos: t.pos, range: 3};
			});
			let path = PathFinder.search(this.creep.pos, goals, {
				flee: true,
				maxRooms: 1,
				plainCost: 2,
				swampCost: 10,
				maxOps: 500,
				roomCallback: roomCallback,
			});
			let pos = path.path[0];
			Memory.log.move.push(`${this.creep.name} - ${this.creep.memory.role} - moveToSafeRange #${++this.moveIterator}`);
			this.creep.move(this.creep.pos.getDirectionTo(pos));
			return false;
		}
		return true;
	}

	public dismantle(): boolean {
		if (!this.positions) {
			return false;
		}
		if (this.positionIterator < this.positions.length && this.creep.pos.isNearTo(this.positions[this.positionIterator])) {
			let structures  = this.creep.room.lookForAt<Structure>(LOOK_STRUCTURES, this.positions[this.positionIterator]);
			if (structures.length) {
				this.creep.dismantle(structures[0]);
				return false;
			}
		} else if (!this.noTarget && this.positionIterator >= this.positions.length) {
			let target = this.findTargetStructure();
			if (!!target) {
				if (!this.creep.pos.isNearTo(target)) {
					this.creep.moveTo(target);
				} else {
					this.creep.dismantle(target);
					if (Game.time % 6 === 0) {
						this.creep.say("OM NOM", true);
					} else if (Game.time % 6 === 1) {
						this.creep.say("NOM!", true);
					}
				}
				return false;
			} else if (!!this.creep.room.controller && !this.creep.room.controller.my) {
				WallManager.load(this.creep.room);
				target =  WallManager.getWeakestWall();
				if (!this.creep.pos.isNearTo(target)) {
					this.creep.moveTo(target);
				} else {
					this.creep.dismantle(target);
					if (Game.time % 6 === 0) {
						this.creep.say("OM NOM", true);
					} else if (Game.time % 6 === 1) {
						this.creep.say("NOM!", true);
					}
				}
			}
		}
		return true;
	}

	public move(): boolean {
		if (!this.hasHealer && (!this.moveToHeal() || !this.moveToSafeRange() || !!this.creep.memory.waitForHealth)) {
			return;
		} else if (this.hasHealer && !this.checkTough()) {
			let closest = this.creep.pos.findClosestByRange(this.creep.room.myCreeps, {
				filter: (c: Creep) => c.id !== this.creep.id && c.getActiveBodyparts(HEAL) > 5,
			});
			if (!!closest && !this.creep.pos.isNearTo(closest)) {
				// get in range
				this.creep.moveTo(closest);
				return false;
			} else if (!!closest) {
				// stay in range
				this.creep.move(this.creep.pos.getDirectionTo(closest.pos));
				return false;
			}
		} else {
			if (!this.positions) {
				return false;
			}
			if (this.positionIterator < this.positions.length) {
				if (!this.creep.pos.isNearTo(this.positions[this.positionIterator])) {
					let pfg: PathFinderGoal = this.createPathFinderMap(<RoomPosition> this.positions[this.positionIterator], 1);
					this.moveTo(pfg);
				} else {
					this.positionIterator = ++this.creep.memory.positionIterator;
					return this.move();
				}
				return true;
			}
			return false;
		}
	}

	public action(): boolean {
		if (this.creep.room.name === this.creep.memory.homeRoom && !this.getBoosted()) {
			return false;
		}
		if (this.creep.hits === this.creep.hitsMax && !!this.creep.memory.waitForHealth) {
			delete this.creep.memory.waitForHealth;
		}
		if (!this.positions && this.creep.room.name !== this.creep.memory.config.targetRoom) {
				this.moveToTargetRoom();
		} else {
			if (this.dismantle()) {
				this.move();
			}
		}
		return true;
	}
}
