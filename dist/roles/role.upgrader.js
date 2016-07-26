var Worker = require('class.worker');
function RoleUpgrader() {
    Worker.call(this);
    this.role = 'upgrader';
    this.max = function(capacity){ return 3; };

    /** @param {Creep} creep **/
    this.run = function(creep) {
        if(creep.memory.dumping && creep.carry.energy == 0) {
            creep.memory.dumping = false;
            creep.memory.source = false;
            creep.say('U:COL');
        }
        if(!creep.memory.dumping && creep.carry.energy == creep.carryCapacity) {
            creep.memory.dumping = true;
            creep.memory.source = false;
            creep.say('U:UPGR');
        }
        if(creep.memory.dumping) {
            var target = creep.room.controller;
            if (creep.upgradeController(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        } else {
            if(creep.memory.source == false) {
                //Prefer energy from containers
                var source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => structure.structureType == STRUCTURE_CONTAINER &&
                    structure.store[RESOURCE_ENERGY] > 100
                });
                //Go to source otherwise
                if (source == null) {
                    source = creep.pos.findClosestByPath(FIND_SOURCES, {
                        filter: (source) => (source.energy > 100) || source.ticksToRegeneration < 30
                    });
                }
                if (source != null) creep.memory.source = source.id;
            }
            if(creep.memory.source != false) {
                var source = Game.getObjectById(creep.memory.source);
                if(source instanceof Structure) { //Sources aren't structures
                    var status = creep.withdraw(source, RESOURCE_ENERGY);
                    switch (status) {
                        case ERR_NOT_ENOUGH_RESOURCES:
                        case ERR_INVALID_TARGET:
                        case ERR_NOT_OWNER:
                        case ERR_FULL:
                            creep.memory.source = false;
                            break;
                        case ERR_NOT_IN_RANGE:
                            creep.moveTo(source);
                            break;
                        case OK: break;
                        default: console.log('Unhandled ERR in upgrader.source.container:'+status);
                    }
                } else {
                    var status = creep.harvest(source);
                    switch (status) {
                        case ERR_NOT_ENOUGH_RESOURCES:
                        case ERR_INVALID_TARGET:
                        case ERR_NOT_OWNER:
                        case ERR_FULL:
                            creep.memory.source = false;
                            break;
                        case ERR_NOT_IN_RANGE:
                            creep.moveTo(source);
                            break;
                        case OK: break;
                        default: console.log('Unhandled ERR in upgrader.source.harvest:'+status);
                    }
                }
            }
        }
    }
};
RoleUpgrader.prototype = _.create(Worker.prototype,{
    'constructor': RoleUpgrader
});
module.exports = RoleUpgrader;