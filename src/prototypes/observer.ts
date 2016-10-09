interface StructureObserver {
	roomIndex: {x: number, y: number};
	run(): void;
	getRoomName(x: number, y: number): string;
	getScanRoom(): string;
}

Object.defineProperty(StructureObserver.prototype, "roomIndex", {
	get: function () {
		if (!this._roomIndex) {
			let indexGroups = this.room.name.match(/([EW])(\d+)([SN])(\d+)/);
			this._roomIndex = {
				x: indexGroups[1] === "E" ? Number(indexGroups[2]) : -(Number(indexGroups[2]) + 1),
				y: indexGroups[3] === "S" ? Number(indexGroups[4]) : -(Number(indexGroups[4]) + 1),
			};
		}
		return this._roomIndex;
	},
	enumerable: true,
	configurable: true,
});
Object.defineProperty(StructureObserver.prototype, "getRoomName", {
	value: function (x: number, y: number) {
		return (x < 0 ? "W" + (-x - 1) : "E" + x) + (y < 0 ? "N" + (-y - 1) : "S" + y);
	},
	enumerable: false,
	configurable: true,
});

StructureObserver.prototype.getScanRoom = function(): string {
	if (!_.isNumber(this.memory.scannedX) || !_.isNumber(this.memory.scannedY)) {
		this.memory.scannedX = -OBSERVER_RANGE;
		this.memory.scannedY = -OBSERVER_RANGE;
	} else {
		this.memory.scannedX = this.memory.scannedX  + 1;
		if (this.memory.scannedX > OBSERVER_RANGE) {
			this.memory.scannedX = -OBSERVER_RANGE;
			this.memory.scannedY = this.memory.scannedY + 1;
			if (this.memory.scannedY > OBSERVER_RANGE) {
				this.memory.scannedY = -OBSERVER_RANGE;
			}
		}
	}
	let roomName = this.getRoomName(this.roomIndex.x + this.memory.scannedX, this.roomIndex.y + this.memory.scannedY);
	// Skip observing this room if we currently have vision or if we recently scanned it.
	if (!!Game.rooms[roomName] || (!!Memory.rooms[roomName] && !!Memory.rooms[roomName].scanTime && (Game.time - Memory.rooms[roomName].scanTime) < 100)) {
		return this.getScanRoom();
	} else {
		return roomName;
	}
};
StructureObserver.prototype.run = function () {
	const roomName = this.getScanRoom();
	delete this.memory.scanTime;
	delete this.memory.scannedRoom;
	if (!Memory.rooms[roomName]) {
		Memory.rooms[roomName] = {
			scanTime: Game.time,
		};
	} else {
		Memory.rooms[roomName].scanTime = Game.time;
	}
	console.log("[OBSERVER]", this.room.name, "Scanning", roomName);
	this.observeRoom(roomName);
};
