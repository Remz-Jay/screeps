var UtilCreep = require('util.creep');
var _ = require('lodash');
var UtilRoom = require('util.room');
var UtilContainers = require('util.containers');

let roomManager = new UtilRoom();

function ClassCreep() {
	this.maxCreeps = 1;
	this.minRCL = 1;
	this.creep = false;
	this.max = function (capacity, room) {
		return this.maxCreeps;
	};
	/**
	 *
	 * @param {int} capacity - The Spawn's current maximum Capacity
	 * @param {int} [energy] - The Spawn's current available Energy
	 * @param {int} [numCreeps] - The current number of creeps that exist with this role
	 * @param {int} [rcl] - The Room's RCL
	 * @returns {Array}
	 */
	this.getBody = function (capacity, energy, numCreeps, rcl) {
		var numParts = _.floor(capacity / UtilCreep.calculateRequiredEnergy(this.bodyPart));
		var body = [];
		for (var i = 0; i < numParts; i++) {
			body = body.concat(this.bodyPart);
		}
		return body;
	};

	this.findNewPath = function (target, memoryName = 'targetPath', move = true) {
		let path = this.findPathFinderPath(this.createPathFinderMap(target));
		if (!!path) {
			this.creep.memory[memoryName] = path;
			if (move) return this.moveByPath(path, target, memoryName);
		} else {
			return false;
		}
	};
	this.moveByPath = function (path, target, memoryName = 'targetPath') {
		if (!!this.creep.memory.lastPosition) {
			let lp = this.creep.memory.lastPosition;
			if (lp.x == this.creep.pos.x && lp.y == this.creep.pos.y && lp.roomName == this.creep.pos.roomName) {
				console.log(this.creep.name + ' (' + this.creep.memory.role + ') is stuck at '
					+ JSON.stringify(lp) + '. Recalculating route.');
				delete this.creep.memory.lastPosition;
				this.findNewPath(target, memoryName);
			}
		}
		this.creep.memory.lastPosition = this.creep.pos;
		let status = this.creep.moveByPath(path);
		switch (status) {
			case ERR_NOT_FOUND:
				delete this.creep.memory[memoryName];
				if (!!target) return this.findNewPath(target, memoryName);
				break;
			case ERR_TIRED:
				//console.log('Creep ' + this.creep.name + ' (' + this.creep.memory.role + ') is too tired to move. Add more MOVE parts?');
				// Delete the lastPosition, because the creep hasn't moved due to it being tired. No need to recalculate route now.
				delete this.creep.memory.lastPosition;
				return true;
				break;
			case OK:
				return true;
				break;
			default:
				console.log('Uncaught moveBy status ' + JSON.stringify(status) + ' in Class.Creep.moveByPath.');
		}
	};
	this.expireCreep = function () {
		//see if an upgrade for this creep is available
		if (!!this.creep.memory.homeRoom && !!this.creep.memory.homeSpawn) {
			try {
				let room = Game.rooms[this.creep.memory.homeRoom];
				let spawn = Game.spawns[this.creep.memory.homeSpawn];
				var containers = new UtilContainers(room);
				var x = _.filter(Game.creeps, c => c.memory.role == this.creep.memory.role
					&& ( !!c.memory.homeRoom && c.memory.homeRoom == room.name)
					&& ( !!c.memory.homeSpawn && c.memory.homeSpawn == spawn.name)
				);

				if (x.length > this.max(containers.energyInContainers, room)) {
					console.log('Expiring creep ' + this.creep.name + ' (' + this.creep.memory.role + ') in room '
						+ room.name + ' because we\'re over cap.');
					return true;
				}
				var body = this.getBody(room.energyCapacityAvailable, room.energyAvailable,
					x.length, room.controller.level
				);
				if (UtilCreep.calculateRequiredEnergy(body)
					> UtilCreep.calculateRequiredEnergy(_.pluck(this.creep.body, 'type'))) {
					console.log('Expiring creep ' + this.creep.name + ' (' + this.creep.memory.role + ') in room '
						+ room.name + ' for an upgrade.');
					return true;
				}
			} catch (e) {
				console.log(JSON.stringify(e), 'this.creep.renewCreep.ExpireCreep');
				return false;
			}

		}
		return false;
	};
	this.renewCreep = function (max = 1000) {
		if (this.creep.ticksToLive < 250) {
			this.creep.memory.hasRenewed = false;
		}
		if (!this.creep.memory.hasRenewed) {
			var spawns = this.creep.room.find(FIND_MY_SPAWNS);
			let renewStation;
			if (spawns.length > 0) {
				//if(spawns.length > 0 && this.creep.room.controller.level > 1 && UtilCreep.calculateRequiredEnergy(_.pluck(this.creep.body, 'type')) < this.creep.room.energyCapacityAvailable){
				renewStation = spawns[0];
				//} else {
				//    renewStation = (undefined == this.creep.memory.homeSpawn) ? Game.spawns['Bastion'] : Game.spawns[this.creep.memory.homeSpawn];
				//}
			} else {
				renewStation = (!this.creep.memory.homeSpawn) ? Game.spawns['Bastion'] : Game.spawns[this.creep.memory.homeSpawn];
			}
			let status;
			let phrase;
			if (this.expireCreep()) {
				status = renewStation.recycleCreep(this.creep);
				phrase = 'demolition.'
			} else {
				status = renewStation.renewCreep(this.creep);
				phrase = 'renew.'
			}
			switch (status) {
				case ERR_NOT_IN_RANGE:
					console.log(this.creep.name + ' (' + this.creep.memory.role + ') is moving to ' + renewStation.name + ' for ' + phrase);
					if (!this.creep.memory.renewPath) {
						this.findNewPath(renewStation, 'renewPath');
					} else {
						var path = this.deserializePathFinderPath(this.creep.memory.renewPath);
						this.moveByPath(path, renewStation, 'renewPath');
					}
					break;
				case OK:
					console.log(this.creep.name + ' (' + this.creep.memory.role + ') renewed at ' + renewStation.name + '. now at ' + this.creep.ticksToLive);
					if (this.creep.ticksToLive > max) {
						console.log('Done renewing.');
						this.creep.memory.hasRenewed = true;
						delete this.creep.memory.renewPath;
					}
					break;
				case ERR_FULL:
					this.creep.memory.hasRenewed = true;
					delete this.creep.memory.renewPath;
					break;
				case ERR_BUSY:
				case ERR_NOT_ENOUGH_ENERGY:
					console.log(this.creep.name + ' (' + this.creep.memory.role + ') is waiting for renew at ' + renewStation.name + '.');
					if (this.creep.carry.energy > 0) {
						this.creep.transfer(renewStation, RESOURCE_ENERGY);
					}
					break;
				default:
					console.log('Uncaught Creep Renew Error' + JSON.stringify(status));
			}
			return false;
		} else {
			return true;
		}

	};
	this.pickupResourcesInRange = function () {
		if (_.sum(this.creep.carry) < this.creep.carryCapacity) {
			let targets = this.creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1);
			if (targets.length > 0) {
				_.each(targets, function (t) {
					if (_.sum(this.creep.carry) < this.creep.carryCapacity) {
						this.creep.pickup(t);
					}
				}, this);
			}
			targets = this.creep.pos.findInRange(FIND_STRUCTURES, 1, {
				filter: (s) => {
					return s.structureType == STRUCTURE_CONTAINER
						&& s.store[RESOURCE_ENERGY] > 0;
				}
			});
			if (targets.length > 0) {
				_.each(targets, function (t) {
					if (_.sum(this.creep.carry) < this.creep.carryCapacity) {
						this.creep.withdraw(t, RESOURCE_ENERGY);
					}
				}, this);
			}
		}
	};
	let roomCallback = function (roomName) {
		try {
			let room = Game.rooms[roomName];
			if (!room) {
				return;
			}
			return roomManager.getCreepMatrixForRoom(roomName);
		} catch (e) {
			console.log(JSON.stringify(e), "Class.Creep.roomCallback", roomName);
			return new PathFinder.CostMatrix();
		}

	};

	this.moveTo = function (target) {
		this.creep.moveTo(target);
		return;
		try {
			//TODO: Change Costs when we are carrying items.
			let path = PathFinder.search(this.creep.pos, {pos: target.pos, range: 1}, {
				plainCost: 2,
				swampCost: 5,
				roomCallback: roomCallback,
			});

			let pos = path.path[0];
			return this.creep.move(this.creep.pos.getDirectionTo(pos));
		} catch (e) {
			console.log(JSON.stringify(e), "Class.Creep.moveTo");
			//fall back to regular move.
			this.creep.moveTo(target);
		}
	};
	/**
	 * If we're on an EXIT_, make sure we do one step into the room before continuing
	 * To avoid room switching.
	 * Returns false if we're not on an EXIT_.
	 * @returns {boolean|RoomPosition}
	 */
	this.nextStepIntoRoom = function (creep = this.creep) {
		var x = this.creep.pos.x;
		var y = this.creep.pos.y;
		if (this.creep.pos.x == 0) {
			x = 48;
			creep.move(RIGHT);
			return false;
		}
		if (this.creep.pos.x == 49) {
			x = 1;
			creep.move(LEFT);
			return false;
		}
		if (this.creep.pos.y == 0) {
			y = 48;
			creep.move(BOTTOM);
			return false;
		}
		if (this.creep.pos.y == 49) {
			y = 1;
			creep.move(TOP);
			return false;
		}
		return true;
	};
	this.createPathFinderMap = function (goals, range = 1) {
		if(!_.isArray(goals)) goals = [goals];
		return _.map(goals, function (source) {
			// We can't actually walk on sources-- set `range` to 1 so we path
			// next to it.
			return {pos: source.pos, range: range};
		});
	};
	this.deserializePathFinderPath = function (p) {
		var path = [];
		_.each(p, function (x) {
			path.push(new RoomPosition(x.x, x.y, x.roomName));
		}, this);
		return path;
	};

	this.findPathFinderPath = function (goal) {
		var path = PathFinder.search(this.creep.pos, goal, {
			// We need to set the defaults costs higher so that we
			// can set the road cost lower in `roomCallback`
			plainCost: 3,
			swampCost: 10,

			roomCallback: roomCallback,
		});
		if (path.path.length < 1) {
			//We're near the target.
			return false;
		} else {
			return path.path;
		}
	};
	this.shouldIStayOrShouldIGo = function () {
		if (!this.creep.memory.fleePath) {
			let hostiles = this.creep.room.find(FIND_HOSTILE_CREEPS);
			if (hostiles.length > 0) {
				this.creep.say('FTHISIMOUT');
				this.creep.memory.flee = true;
				if (!this.findNewPath(this.homeFlag, 'fleePath')) {
					this.creep.say('HALP!');
				}
			}
		} else {
			if (this.creep.pos.isNearTo(this.homeFlag)) {
				//We've made it home. See if the coast is clear again.
				let hostiles = this.targetFlag.room.find(FIND_HOSTILE_CREEPS);
				if (hostiles.length == 0) {
					delete this.creep.memory.flee;
					delete this.creep.memory.fleePath;
				}
			} else {
				var path = this.deserializePathFinderPath(this.creep.memory.fleePath);
				this.moveByPath(path, this.homeFlag, 'fleePath');
			}
		}
	};
	this.harvestFromContainersAndSources = function () {
		if (!this.creep.memory.source) {
			//Prefer energy from containers
			let source = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
				filter: structure => (structure.structureType == STRUCTURE_CONTAINER
					|| structure.structureType == STRUCTURE_STORAGE
					|| structure.structureType == STRUCTURE_LINK
				) && (
					(!!structure.store && structure.store[RESOURCE_ENERGY] > (this.creep.carryCapacity - _.sum(this.creep.carry))) // containers and storage
					|| (!!structure.energy && structure.energy > (this.creep.carryCapacity - _.sum(this.creep.carry))) // links
				)
			});
			//Go to source otherwise
			if (!source) {
				source = this.creep.pos.findClosestByPath(FIND_MY_SPAWNS, {
					filter: structure => structure.energy > 0
					&& structure.room.name == this.creep.room.name
				});
				if (!source) {
					source = this.creep.pos.findClosestByPath(FIND_SOURCES, {
						filter: source => (source.energy > 100) || source.ticksToRegeneration < 30
					});
				}
			}
			if (!!source) this.creep.memory.source = source.id;
		}
		if (!!this.creep.memory.source) {
			var source = Game.getObjectById(this.creep.memory.source);
			if (source instanceof Structure) { //Sources aren't structures
				var status = this.creep.withdraw(source, RESOURCE_ENERGY);
				switch (status) {
					case ERR_NOT_ENOUGH_RESOURCES:
					case ERR_INVALID_TARGET:
					case ERR_NOT_OWNER:
					case ERR_FULL:
						delete this.creep.memory.source;
						break;
					case ERR_NOT_IN_RANGE:
						this.creep.moveTo(source);
						break;
					case OK:
						break;
					default:
						console.log('Unhandled ERR in creep.source.container:' + status);
				}
			} else {
				var status = this.creep.harvest(source);
				switch (status) {
					case ERR_NOT_ENOUGH_RESOURCES:
					case ERR_INVALID_TARGET:
					case ERR_NOT_OWNER:
					case ERR_FULL:
						delete this.creep.memory.source;
						break;
					case ERR_NOT_IN_RANGE:
						this.creep.moveTo(source);
						break;
					case OK:
						break;
					default:
						console.log('Unhandled ERR in creep.source.harvest:' + status);
				}
			}
		}
	}
}
module.exports = ClassCreep;