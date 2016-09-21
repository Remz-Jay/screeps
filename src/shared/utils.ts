global.colorWrap = function(text: string, color: string) {
	return `<font color="${color}">${text}</font>`;
};

// Thanks Dissi!
global.getColorBasedOnPercentage = function(thePercentage: number) {
	let hue = Math.floor((100 - thePercentage) * 120 / 100);  // go from green to red
	let saturation = Math.abs(thePercentage - 50) / 50;
	return global.hsv2rgb(hue, saturation, 1);
};

global.hsv2rgb = function(h: number, s: number, v: number) {
	// adapted from http://schinckel.net/2012/01/10/hsv-to-rgb-in-javascript/
	let rgb: number[] = [];
	let i: number;
	let data: number[] = [];
	if (s === 0) {
		rgb = [v, v, v];
	} else {
		h = h / 60;
		i = Math.floor(h);
		data = [v * (1 - s), v * (1 - s * (h - i)), v * (1 - s * (1 - (h - i)))];
		switch (i) {
			case 0:
				rgb = [v, data[2], data[0]];
				break;
			case 1:
				rgb = [data[1], v, data[0]];
				break;
			case 2:
				rgb = [data[0], v, data[2]];
				break;
			case 3:
				rgb = [data[0], data[1], v];
				break;
			case 4:
				rgb = [data[2], data[0], v];
				break;
			default:
				rgb = [v, data[0], data[1]];
				break;
		}
	}
	return "#" + rgb.map(function(x){
			return ("0" + Math.round(x * 255).toString(16)).slice(-2);
		}).join("");
};

// Thanks ags131 !
// console.log(`<span style="line-height:1">${utils.table(incoming)}</span>`)
global.table = function(data: any[], widths?: number[]){
	let leftTopCorner = "╔";
	let rightTopCorner = "╗";
	let leftBottomCorner = "╚";
	let rightBottomCorner = "╝";
	let hBar = "═";
	let vBar = "║";
	// let hSBar = "─";
	let vSBar = "│";
	let bottomDSTee = "╧";
	let topDSTee = "╤";
	let rows: any[] = [];
	let width = 0;
	if (!widths) {
		widths = [];
		data.forEach(row => {
			_.values(row).forEach((v, i) => {
				// console.log(v,i)
				if (!widths[i]) {
					widths[i] = 0;
				}
				widths[i] = Math.max((v || 0).toString().length, widths[i]);
			});
		});
		// console.log(widths)
	}
	data.forEach(d => {
		let arr = d instanceof Array ? d : _.values(d);
		let r = `${vBar} ` + arr.map((v: string, i: number) => (" ".repeat(widths[i]) + v).slice(-widths[i])).join(` ${vSBar} `) + ` ${vBar}`;
		width = r.length;
		// console.log(r)
		rows.push(r);
	});
	let topBar = widths.map(w => hBar.repeat(w + 2)).join(topDSTee);
	let bottomBar = widths.map(w => hBar.repeat(w + 2)).join(bottomDSTee);
	rows.unshift(`${leftTopCorner}${topBar}${rightTopCorner}`);
	rows.push(`${leftBottomCorner}${bottomBar}${rightBottomCorner}`);
	return rows.join("\n");
};

// Implementation of Lodash 4.15.0 functions
/**
 * The base implementation of `_.clamp` which doesn't coerce arguments.
 *
 * @private
 * @param {number} number The number to clamp.
 * @param {number} [lower] The lower bound.
 * @param {number} upper The upper bound.
 * @returns {number} Returns the clamped number.
 */
global.baseClamp = function(n: number, lower: number, upper: number): number {
	if (n === n) {
		if (upper !== undefined) {
			n = n <= upper ? n : upper;
		}
		if (lower !== undefined) {
			n = n >= lower ? n : lower;
		}
	}
	return n;
};

/*------------------------------------------------------------------------*/

/**
 * Clamps `number` within the inclusive `lower` and `upper` bounds.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Number
 * @param {number} number The number to clamp.
 * @param {number} [lower] The lower bound.
 * @param {number} upper The upper bound.
 * @returns {number} Returns the clamped number.
 * @example
 *
 * _.clamp(-10, -5, 5);
 * // => -5
 *
 * _.clamp(10, -5, 5);
 * // => 5
 */
global.clamp = function(n: number, lower: number, upper: number): number {
	if (upper === undefined) {
		upper = lower;
		lower = undefined;
	}
	if (upper !== undefined) {
		upper = upper === upper ? upper : 0;
	}
	if (lower !== undefined) {
		lower = lower === lower ? lower : 0;
	}
	return global.baseClamp(n, lower, upper);
};