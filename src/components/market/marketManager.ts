export function governMarket(): void {
	if (!!Memory.transactions && Memory.transactions.length > 0) {
		processTransactionLogs();
		runTransactions();
	}
	if (Game.cpu.bucket > global.BUCKET_MIN) {
		if (global.time % 20 === 0) {
			console.log(`[MARKET] Running actions`);
			cleanupOrders();
			dumpResource("O");
			// dumpResource("H");
			dumpResource("Z");
			autoSell();
			findDeals();
		}
	}
}
function runTransactions() {
	let before = Game.cpu.getUsed();
	let roomList = _.filter(Game.rooms, (r: Room) => !!r.controller && !!r.controller.my && r.controller.level > 5 && !!r.storage && !!r.terminal);
	roomList.forEach((r: Room) => {
		try {
			r.terminal.processTransactions();
		} catch (e) {
			console.log(`MarketManager.processTransactions, terminal in room ${r.name} reports: ${e.message}`);
		}
	});
	console.log(`MarketManager.processTransactions took ${_.round(Game.cpu.getUsed() - before, 2)}`);
}

function autoSell() {
	let before = Game.cpu.getUsed();
	let roomList = _.filter(Game.rooms, (r: Room) => !!r.controller && !!r.controller.my && r.controller.level > 5 && !!r.storage && !!r.terminal);
	roomList.forEach((r: Room) => {
		try {
			r.terminal.autoSell();
		} catch (e) {
			console.log(`MarketManager.autoSell, terminal in room ${r.name} reports: ${e.message}`);
		}
	});
	console.log(`MarketManager.autoSell took ${_.round(Game.cpu.getUsed() - before, 2)}`);
}

function cleanupOrders(): void {
	_.forOwn(Game.market.orders, (order: Order, id: string) => {
		if (order.resourceType !== SUBSCRIPTION_TOKEN && order.totalAmount > 100 && order.remainingAmount < 100) {
			Game.market.cancelOrder(order.id);
		}
		// console.log(global.colorWrap(`[MARKET] ${order.id}, ${order.type}, ${order.resourceType}, ${order.price}, ${order.remainingAmount}`, "cyan"));
	});
}
interface MarketThresholdsObject {
	[k: string]: number;
}
const marketThresholds: MarketThresholdsObject = {
	H: 1.0,
	O: 1.0,
	Z: 1.0,
	K: 1.0,
	U: 1.0,
	L: 1.0,
	X: 1.5,
};

function findDeals(): void {
	let before = Game.cpu.getUsed();
	console.log(`[MARKET] Doing a market price scan.`);
	_.forOwn(marketThresholds, (price: number, resource: string) => {
		let orders = Game.market.getAllOrders({resourceType: resource, type: ORDER_SELL}).filter((order: Order) =>
			order.price < price
			&& !_.has(Game.rooms, order.roomName)
			&& Game.map.getRoomLinearDistance("W6N42", order.roomName) < 71
			&& Game.market.calcTransactionCost(order.remainingAmount, "W6N42", order.roomName) <= global.TERMINAL_MAX
		) as Order[];
		if (!!orders && orders.length > 0) {
			orders.forEach((order: Order) => {
				let cost = order.remainingAmount * order.price;
				let transferCost = Game.market.calcTransactionCost(order.remainingAmount, "W6N42", order.roomName);
				let sellsFor = order.remainingAmount * price;
				let profit = sellsFor - cost;
				console.log(global.colorWrap(`[MARKET] found an interesting deal on ${resource}: ${order.remainingAmount.toLocaleString()} at ${order.price}. `
					+ `Range: ${Game.map.getRoomLinearDistance("W6N42", order.roomName)} (${order.roomName}). `
					+ `Cost: ${cost.toLocaleString()}, Profit: ${profit.toLocaleString()}, Transfer: ${transferCost.toLocaleString()} energy. ID: ${order.id}`, "cyan"));
			});
		}
	});
	console.log(`MarketManager.findDeals took ${_.round(Game.cpu.getUsed() - before, 2)}`);
}
global.findDeals = findDeals;

function resourceReport(): void {
	let outputBuffer: string[] = [];
	let resources: ResourceList = {"energy": 0};
	let roomList: Room[] = _.filter(Game.rooms, (r: Room) => !!r.controller && !!r.controller.my && r.controller.level > 3);
	let elementList: string[] = [
		"Resource",
		"Total",
	];
	_.forEach(roomList, (r: Room) => {
		if (!!r.controller && r.controller.my) {
			elementList.push(r.name);
			if (!!r.storage) {
				_.forEach(r.storage.store, (value: number, key: string) => {
					if (!!resources[key]) {
						resources[key] += value;
					} else {
						resources[key] = value;
					}
				});
			}
			if (!!r.terminal) {
				_.forEach(r.terminal.store, (value: number, key: string) => {
					if (!!resources[key]) {
						resources[key] += value;
					} else {
						resources[key] = value;
					}
				});
			}
		}
	});
	let cellWidth: number = 9;
	let header: string = "\u2551";
	let topLine: string = "\u2554";
	let guideLine: string = "\u2560";
	let bottomLine: string = "\u255a";
	elementList.forEach((s: string) => {
		header =  header.concat(" " + _.padRight(s, cellWidth) + "\u2551");
		topLine = topLine.concat(_.padLeft("", cellWidth + 1, "\u2550") + "\u2566");
		guideLine = guideLine.concat(_.padLeft("", cellWidth + 1, "\u2550") + "\u256c");
		bottomLine = bottomLine.concat(_.padLeft("", cellWidth + 1, "\u2550") + "\u2569");
	});
	topLine = topLine.slice(0, -1) + "\u2557";
	guideLine = guideLine.slice(0, -1) + "\u2563";
	bottomLine = bottomLine.slice(0, -1) + "\u255d";
	outputBuffer.push(topLine);
	outputBuffer.push(header);
	outputBuffer.push(guideLine);
	let tracers: string[] = [];
	RESOURCES_ALL.forEach((key: string) => {
		let globalRunning: boolean = false;
		let value: number = resources[key] || 0;
		if (value > 1000) {
			let line: string = "";
			line = line.concat(" " + formatAmount(value, cellWidth) + "\u2551");
			roomList.forEach((r: Room) => {
				let roomRunning: boolean = false;
				if (!!r.labReaction && r.labReaction === key) {
					roomRunning = true;
					globalRunning = true;
				}
				let storageVal: number = (!!r.storage) ? r.storage.store[key] || 0 : 0;
				let terminalVal: number = (!!r.terminal) ? r.terminal.store[key] || 0 : 0;
				let totalVal: number = storageVal + terminalVal;
				if (roomRunning) {
					line = line.concat(" " + formatAmount(totalVal, cellWidth, "CornflowerBlue") + "\u2551");
				} else {
					line = line.concat(" " + formatAmount(totalVal, cellWidth) + "\u2551");
				}
			});
			if (globalRunning) {
				line = "\u2551 <b>" + global.colorWrap(_.padRight(key, cellWidth), "CornflowerBlue") + "</b>\u2551".concat(line);
			} else {
				line = "\u2551 <b>" + _.padRight(key, cellWidth) + "</b>\u2551".concat(line);
			}
			outputBuffer.push(line);
		} else if (value > 0) {
			tracers.push(key + ` (${value})`);
		}
	});
	outputBuffer.push(guideLine);
	let storageLine = "";
	let terminalLine = "";
	let storages = 0;
	let storageTotal = 0;
	let terminals = 0;
	let terminalTotal = 0;
	_.forEach(roomList, (r: Room) => {
		if (!!r.controller && r.controller.my) {
			if (!!r.storage) {
				let storagePercentage = _.round(_.sum(r.storage.store) / (r.storage.storeCapacity / 100));
				storageLine = storageLine.concat(" "
					+ global.colorWrap(_.padRight(" " + storagePercentage + "%", cellWidth),
						global.getColorBasedOnPercentage(storagePercentage))
					+ "\u2551");
				storages++;
				storageTotal += _.sum(r.storage.store);
			} else {
				storageLine = storageLine.concat(" " + formatAmount(NaN, cellWidth) + "\u2551");
			}
			if (!!r.terminal) {
				let terminalPercentage = _.round(_.sum(r.terminal.store) / (r.terminal.storeCapacity / 100));
				terminalLine = terminalLine.concat(" "
					+ global.colorWrap(_.padRight(" " + terminalPercentage + "%", cellWidth),
						global.getColorBasedOnPercentage(terminalPercentage))
					+ "\u2551");
				terminals++;
				terminalTotal += _.sum(r.terminal.store);
			} else {
				terminalLine = terminalLine.concat(" " + formatAmount(NaN, cellWidth) + "\u2551");
			}
		}
	});
	let totalStoragePercentage = _.round(storageTotal / ((STORAGE_CAPACITY * storages) / 100));
	let totalStorageChunk = global.colorWrap(_.padRight(" " + totalStoragePercentage + "%", cellWidth),
		global.getColorBasedOnPercentage(totalStoragePercentage));
	let totalTerminalPercentage = _.round(terminalTotal / ((TERMINAL_CAPACITY * terminals) / 100));
	let totalTerminalChunk = global.colorWrap(_.padRight(" " + totalTerminalPercentage + "%", cellWidth),
		global.getColorBasedOnPercentage(totalTerminalPercentage));
	storageLine = "\u2551 <b>" + _.padRight("Storage", cellWidth) + "</b>\u2551 "
		+ totalStorageChunk + "\u2551".concat(storageLine);
	terminalLine = "\u2551 <b>" + _.padRight("Terminal", cellWidth) + "</b>\u2551 "
		+ totalTerminalChunk + "\u2551".concat(terminalLine);
	outputBuffer.push(storageLine);
	outputBuffer.push(terminalLine);
	outputBuffer.push(bottomLine);
	if (tracers.length > 0) {
		let tracerLine: string = "Also found traces of: ";
		tracers.forEach((s: String) => {
			tracerLine = tracerLine.concat(s + ", ");
		});
		tracerLine = tracerLine.slice(0, -2) + ".";
		outputBuffer.push(tracerLine);
	}
	console.log(outputBuffer.join("<br />"));
}
global.resourceReport = resourceReport;

function formatAmount(value: number, cellWidth: number = 0, overrideColor?: string): string {
	let strVal: string = global.formatNumber(value);
	strVal = _.padRight(strVal, cellWidth);
	if (_.isString(overrideColor)) {
		strVal = global.colorWrap(strVal, overrideColor);
	} else {
		let percentage = value / (global.STORAGE_MIN / 100);
		if (percentage > 100) {
			percentage += 50;
		}
		strVal = global.colorWrap(strVal, global.getColorBasedOnPercentage(100 - percentage));
		/*if (value > global.STORAGE_MIN) {
			strVal = global.colorWrap(strVal, "LightGreen");
		} else if (value > global.STORAGE_MIN / 2) {
			strVal = global.colorWrap(strVal, "Orange");
		} else {
			strVal = global.colorWrap(strVal, "Salmon");
		}*/
	}
	return strVal;
}
function dumpResource(resource: string) {
	let before = Game.cpu.getUsed();
	let perBatch: number = 2000;
	let roomList = _.filter(Game.rooms, (r: Room) => !!r.controller && !!r.controller.my && r.controller.level > 5 && !!r.storage && !!r.terminal);
	roomList.forEach((r: Room) => {
		if (!!r.storage.store[resource] && r.storage.store[resource] > (global.STORAGE_MIN * 1.2)
			&& r.terminal.store[resource] && r.terminal.store[resource] >= perBatch
		) {
			let canSell = r.terminal.store[resource];
			if (canSell > perBatch) {
				canSell = perBatch;
			}
			let availableEnergy = r.terminal.store.energy;
			console.log(`Room ${r.name} has ${formatAmount(r.storage.store[resource])} x ${resource} in storage.`);
			let price: number = marketThresholds[resource];
			let orders = Game.market.getAllOrders({resourceType: resource, type: ORDER_BUY}).filter((order: Order) =>
				order.price >= price
				&& order.remainingAmount >= canSell
				&& !_.has(Game.rooms, order.roomName)
				&& Game.map.getRoomLinearDistance(r.name, order.roomName) < 20
			) as Order[];
			if (!!orders && orders.length > 0) {
				let bestPrice = 0;
				let bestDistance = Infinity;
				let bestOrder: Order;
				orders.forEach((order: Order) => {
					let orderDistance = Game.map.getRoomLinearDistance(r.name, order.roomName);
					console.log(global.colorWrap(`[MARKET] found candidate: ${order.remainingAmount.toLocaleString()} at ${order.price}. `
						+ `Range: ${orderDistance} (${order.roomName}). `
						+ `ID: ${order.id}`, "cyan"));
					if (order.price > bestPrice) {
						bestPrice = order.price;
						bestDistance = orderDistance;
						bestOrder = order;
					} else if (order.price === bestPrice && orderDistance < bestDistance) {
						bestDistance = orderDistance;
						bestOrder = order;
					}
				});
				if (!!bestOrder) {
					let cost = canSell * bestOrder.price;
					let transferCost = Game.market.calcTransactionCost(canSell, r.name, bestOrder.roomName);
					if (availableEnergy >= transferCost) {
						console.log(global.colorWrap(`[MARKET] Decided to sell to: ${bestOrder.remainingAmount.toLocaleString()} at ${bestOrder.price}. `
							+ `Range: ${bestDistance} (${bestOrder.roomName}). `
							+ `Profit: ${cost.toLocaleString()}, Transfer: ${transferCost.toLocaleString()} energy. ID: ${bestOrder.id}`, "LightGreen"));
						Game.market.deal(bestOrder.id, canSell, r.name);
					} else {
						console.log(
							global.colorWrap(`[MARKET] ${r.name} as insufficient Terminal Energy to cover the transaction. (${availableEnergy} of ${transferCost})`,
							"OrangeRed")
						);
					}
				}
			}
		}
	});
	console.log(`MarketManager.dumpResource(${resource}) took ${_.round(Game.cpu.getUsed() - before, 2)}`);
}
global.dumpResource = dumpResource;
function transactionReport(numTransactions = 5): void {
	console.log(global.colorWrap(`[MARKET] Incoming Transactions:`, "Red"));
	_.take(Game.market.incomingTransactions, numTransactions).forEach((t: Transaction) => {
		t = _.defaults<Transaction>(t, {
			sender: {username: "NPC"},
			description: global.colorWrap("Market Transaction", "Orange"),
		});
		console.log(t.sender.username, t.resourceType, t.amount, t.from, t.to, t.description);
	});
	console.log(global.colorWrap(`Outgoing Transactions:`, "Teal"));
	_.take(Game.market.outgoingTransactions, numTransactions).forEach((t: Transaction) => {
		_.defaults<Transaction>(t, {
			recipient: {username: "NPC"},
			description: global.colorWrap("Market Transaction", "Orange"),
		});
		console.log(t.recipient.username, t.resourceType, t.amount, t.from, t.to, t.description);
	});
}
global.transactionReport = transactionReport;
function addTransaction(resource: string, amount: number, recipient: string, description: string = "") {
	if (RESOURCES_ALL.indexOf(resource) === -1) {
		console.log(`Invalid Resource!`);
		return;
	}
	if (!_.isNumber(amount)) {
		console.log(`Invalid Amount!`);
		return;
	}
	if (_.isNaN(Game.map.getRoomLinearDistance("W1N1", recipient))) {
		console.log(`Invalid Recipient!`);
		return;
	}
	if (!Memory.transactions) {
		Memory.transactions = [];
	}
	let sendObject = {
		id: Math.random().toString(21).substring(2, 9),
		recipient: recipient,
		resource: resource,
		totalAmount: amount,
		description: description,
		sentAmount: 0,
	};
	Memory.transactions.push(sendObject);
}
global.addTransaction = addTransaction;
function transactionStatus() {
	if (!!Memory.transactions) {
		console.log(`<span style="line-height:1">${global.table(Memory.transactions)}</span>`);
	}
}
global.transactionStatus = transactionStatus;

function processTransactionLogs() {
	Game.market.outgoingTransactions.forEach((t: Transaction) => {
		if (!!t.description && t.description.substr(0, 3) === "ID:") {
			let transactionId = t.description.substring(t.description.lastIndexOf("[") + 1, t.description.lastIndexOf("]"));
			let transaction = _.find(Memory.transactions, {id: transactionId});
			if (!!transaction) {
				let found = _.find(transaction.transactions, {transactionId: t.transactionId});
				if (!found) {
					if (!transaction.transactions) {
						transaction.transactions = [t];
					} else {
						transaction.transactions.push(t);
					}
				}
			}
		}
	});
}
Object.defineProperty(global, "rr", { get: function () { return global.resourceReport(); } });
Object.defineProperty(global, "tr", { get: function () { return global.transactionReport(); } });
