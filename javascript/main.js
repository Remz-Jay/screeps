//Game.spawns['Spawn1'].createCreep( [WORK, CARRY, MOVE], 'Harvester1' );
//Game.spawns['Spawn1'].createCreep( [WORK, CARRY, MOVE], 'Builder1',{ role: 'builder' } );
//Game.creeps['Harvester1'].suicide()
//http://support.screeps.com/hc/en-us/articles/205990342-StructureSpawn#renewCreep
//Game.spawns['Spawn1'].room.createConstructionSite( 23, 22, STRUCTURE_TOWER );
var _ = require('lodash');
var ScreepsStats = require('screepsstats');

global.Stats = new ScreepsStats();

var roles = {
    harvester: require('role.harvester'),
    mule: require('role.mule'),
    repairbot: require('role.repairbot'),
    upgrader: require('role.upgrader'),
    builder: require('role.builder'),
    scout: require('role.scout'),
    remoteHarvester: require('role.remoteharvester'),
    claim: require('role.claim'),
    remoteMule: require('role.remotemule'),
    //remoteBuilder: require('role.remotebuilder')
};

var classes = require('classLoader');
var utils = require('utilLoader');

module.exports.loop = function () {
    PathFinder.use(true);

    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    for (var name in Game.rooms) {
        var room = Game.rooms[name];
        var wall = new classes.Wall(room);
        wall.adjustStrength();

        var ramparts = new utils.Ramparts(room);
        ramparts.adjustStrength();

        var containers = new utils.Containers(room);

        var sources = new utils.Sources();
        sources.setRoom(name);
        sources.updateHarvesterPreference();

        console.log('Room "' + room.name + '" has ' + room.energyAvailable
            + '/' + room.energyCapacityAvailable + ' energy and '
            + containers.energyInContainers + '/' + containers.containerCapacityAvailable
            + ' (' +containers.energyPercentage + '%) in containers.'
            + ' (RCL='+room.controller.level+' @ '
            + _.floor(room.controller.progress/(room.controller.progressTotal/100)) + '%)'
        );
        var towers = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => {
                return s.structureType == STRUCTURE_TOWER
            }
        });
        _.each(towers, function(tower){
            var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < (structure.hitsMax * 0.8) &&
                structure.structureType != STRUCTURE_RAMPART &&
                structure.structureType != STRUCTURE_WALL
            });
            if (closestDamagedStructure) {
                tower.repair(closestDamagedStructure);
            }

            var closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (c) => {
                    return c.hits < c.hitsMax;
                }
            });
            if (closestDamagedCreep) {
                tower.heal(closestDamagedCreep);
            }

            var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (closestHostile) {
                tower.attack(closestHostile);
            }
        }, this);
        var building = false;
        var spawn = room.find(FIND_MY_SPAWNS)[0]; //TODO: What if more spawns?
        if (undefined == spawn) {
        } else {
            for (var index in roles) {
                var role = new roles[index];
                if (undefined != role.role) {
                    var x = _.filter(Game.creeps, (creep) => creep.memory.role == role.role);

                    console.log(
                        _.padLeft(role.role, 9) + '=\t' + x.length
                        + ' (max_' + role.max(containers.energyInContainers)
                        + ')\t\t(' + _.padLeft(utils.Creep.calculateRequiredEnergy(role.getBody(room.energyCapacityAvailable)), 4)
                        + ') [' + role.getBody(room.energyCapacityAvailable)
                        + ']'
                    );

                    if (!building && x.length < role.max(containers.energyInContainers)) {
                        var body = role.getBody(room.energyCapacityAvailable);
                        var spawnState = spawn.canCreateCreep(body);
                        if (spawnState == OK) {
                            var newName = spawn.createCreep(body, undefined, {role: role.role});
                            if (_.isString(newName)) {
                                console.log('Spawning new ' + role.role + ': ' + newName + ' at spawn ' + spawn.name);
                                building = true;
                            } else {
                                console.log('Unable to spawn ' + role.role + ': ' + newName + ' at spawn ' + spawn.name);
                            }
                        } else {
                            building = true; //skip all other attempts;
                            switch (spawnState) {
                                case ERR_NOT_ENOUGH_ENERGY:
                                    console.log('Not enough energy to create ' + role.role + ' at spawn ' + spawn.name);
                                    break;
                                case ERR_BUSY:
                                    break;
                                default:
                                    console.log('Unhandled Spawn State while Spawning:' + spawnState);
                            }
                        }
                    }
                }
            }
        }
    }

    for (var name in Game.creeps) {
        var creep = Game.creeps[name];
        for (var index in roles) {
            var role = new roles[index];
            if (creep.memory.role == role.role) {
                if (!creep.spawning) role.run(creep);
            }
        }
    }

    var perc = _.floor(Game.gcl.progress / (Game.gcl.progressTotal / 100));
    console.log('End of tick ' + Game.time +
        '.\t(GCL= ' + Game.gcl.level + ' @ ' + perc + '%\tCPU: '
        + _.ceil(Game.cpu.getUsed()) + '/' + Game.cpu.limit
        + '\tRES=' + Game.cpu.tickLimit + '/' + Game.cpu.bucket + ')');
    console.log();
    Stats.runBuiltinStats();
};