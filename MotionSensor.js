var MotionSensor = MotionSensor || (function() {
	'use strict';

	var scriptVersion = 0.1,
		defaultRange = 20,
		defaultPulseCyclic = false,
		defaultPulseEasingFunction = "easeOutCubic",
		defaultPulseMaxSizeRatio = 1.25,
		defaultPulseMinSizeRatio = 0.125,
		defaultPulseRate = 1500,
		intervalRate = 100,
		intervalHandle = null,
		prodUrl = "https://s3.amazonaws.com/files.d20.io/images/",
		devUrl = "https://s3.amazonaws.com/files.staging.d20.io/images/",


	animateSensors = function() {
 		var activePage = Campaign().get("playerpageid");
 		var date, anchorLeft, anchorTop, anchorWidth, anchorHeight, maxWidth, maxHeight, minWidth, minHeight, width, height;
 		_.chain(state.MotionSensor.activeSensors)
 			.filter(function(sensor) {
 				return sensor.page === activePage;
 			})
 			.each(function(sensor) {
 				_.each(sensor.sensorTargets, function(target) {
 					date = new Date().getTime();
 					anchorLeft = target.target.get("left");
 					anchorTop = target.target.get("top");
 					anchorWidth = target.target.get("width");
 					anchorHeight = target.target.get("height");
 					maxWidth = anchorWidth * state.MotionSensor.pulseMaxSizeRatio;
 					maxHeight = anchorHeight * state.MotionSensor.pulseMaxSizeRatio;
 					minWidth = anchorWidth * state.MotionSensor.pulseMinSizeRatio;
 					minHeight = anchorHeight * state.MotionSensor.pulseMinSizeRatio;

 					if (!state.MotionSensor.pulseCyclic) {
 						width = interp(minWidth, maxWidth, date, state.MotionSensor.pulseRate, state.MotionSensor.pulseEasingFunction);
						height = interp(minHeight, maxHeight, date, state.MotionSensor.pulseRate, state.MotionSensor.pulseEasingFunction);
					} else {						
						if ((date % state.MotionSensor.pulseRate) > (state.MotionSensor.pulseRate / 2)) {
							width = interp(maxWidth, minWidth, date, state.MotionSensor.pulseRate / 2, state.MotionSensor.pulseEasingFunction);
							height = interp(maxHeight, minHeight, date, state.MotionSensor.pulseRate / 2, state.MotionSensor.pulseEasingFunction);
						} else {
							width = interp(minWidth, maxWidth, date, state.MotionSensor.pulseRate, state.MotionSensor.pulseEasingFunction);
							height = interp(minHeight, maxHeight, date, state.MotionSensor.pulseRate, state.MotionSensor.pulseEasingFunction);
						}
					}

 					target.sensorToken.set("width", width);
 					target.sensorToken.set("height", height);
 				});
 			});
 	},

 	ch = function (c) {
		var entities = {
			'<' : 'lt',
			'>' : 'gt',
			"'" : '#39',
			'@' : '#64',
			'{' : '#123',
			'|' : '#124',
			'}' : '#125',
			'[' : '#91',
			']' : '#93',
			'"' : 'quot',
			'-' : 'mdash',
			' ' : 'nbsp'
		};
		if(_.has(entities,c) ){
			return ('&'+entities[c]+';');
		}
		return '';
	},

	configurePulse = function(param, val) {
		debug("In configurePulse");
		switch (param) {
			case "cyclic":
				if (val !== "true" && val !== "false") {
					message("The value for cyclic should be either true or false.");
					return;
				}
				state.MotionSensor.pulseCyclic = val === "true";
				message("Pulse Cyclic set to: " + state.MotionSensor.pulseCyclic);
				break;
			case "easingFunction":
				var easingFunction = getEasingFunction(val);
				if (easingFunction) {
					state.MotionSensor.pulseEasingName = val;
					state.MotionSensor.pulseEasingFunction = easingFunction;
					message("Easing function set to: " + val);
				} else {
					message("An invalid parameter was supplied for easingFunction. Type !motion-sensor-help to see the list of valid easing functions");					
				}
				break;
			case "maxSizeRatio":
				var maxSizeRatio = parseFloat(val);
				if (!maxSizeRatio || maxSizeRatio <= 0) {
					message("The value for maxSizeRatio should a valid float greater than zero");
					return;
				}
				state.MotionSensor.pulseMaxSizeRatio = maxSizeRatio;
				message("Max Size Ratio set to: " + (maxSizeRatio * 100) + "%");
				break;
			case "minSizeRatio":
				var minSizeRatio = parseFloat(val);
				if (!minSizeRatio || minSizeRatio < 0) {
					message("The value for minSizeRatio should be a valid float greater than or equal to zero");
					return;
				}
				state.MotionSensor.pulseMinSizeRatio = minSizeRatio;
				message("Min Size Ratio set to: " + (minSizeRatio * 100) + "%");
				break;
			case "rate":
				var rate = parseInt(val, 10);
				if (!rate || rate <= 0) {
					message("The value for rate should be a valid integer greater than zero");
					return;
				}
				state.MotionSensor.pulseRate = rate;
				message("Pulse Rate set to: " + rate + "ms");
				break;
			default:
				message("The parameter " + param + " is not valid.");
				break;
		}
	},

	createSensor = function(o, range) {
		debug("In createSensor");
		
		debug("Disabling graphic change event to prevent stack overflow on createObj :( API full of lies");
		state.MotionSensor.isCreatingSensor = true;
		
		if (_.contains(state.MotionSensor.activeSensors, function(sensor) { return sensor.id === o.id; })) {
			debug("Exiting - Sensor with id: " + o.id + " already exists");
			return;
		}

		var controlledby = o.get("controlledby");
		if (controlledby.length < 1) {
			controlledby = getObj("character", o.get("_represents")).get("controlledby");
		}		

		debug("Creating Sensor for: " + o.id + " controlled by: " + controlledby);
		state.MotionSensor.activeSensors[o.id] = {
			id: o.id,
			sensorSource: o,
			page: o.get('pageid'),
			range: range,
			sensorTargets: {}
		};

		var px, py, tx, ty, diff, width, height;
		px = o.get("left") + (o.get("width") / 2);
		py = o.get("top") + (o.get("height") / 2);

		debug("Retrieving all tokens on page: " + o.get("pageid"));
		var currentTokens = findObjs({
			  _pageid: o.get("pageid"),
			  _type: "graphic",
			  _subtype: "token",
			  layer: "objects"
		});
		debug("Retrieved " + _.size(currentTokens) + " tokens");

		debug("Building inital sensorTargets collection");
		_.each(currentTokens, function(token) {
			if (token.id === o.id) {
				debug("Ignoring self for target selection");
				return;
			}
			if (_.contains(state.MotionSensor.ignoreTargets, token.id)) {
				debug("Ignoring manually hidden target or sensor blip with id: " + token.id);
				return;
			}
			tx = token.get("left") + (token.get("width") / 2);
			ty = token.get("top") + (token.get("height") / 2);
			width = token.get("width");
			height = token.get("height");
			diff = Math.sqrt((tx - px) * (tx - px) + (ty - py) * (ty - py)) / 70;
			debug("The target " + token.id + " is " + diff + " units from the sensor source");
			if (diff <= range) {
				debug("Creating sensor blip for: " + token.id + " controlled by: " + controlledby);
				var st = createObj("graphic", {
												pageid: o.get("pageid"),
												imgsrc: state.MotionSensor.blipSource,
												rotation: 0,
												layer: "objects",
												width: width,
												height: height,
												left: token.get("left"),
												top: token.get("top"),
												controlledby: controlledby,
												playersedit_name: false,
												playersedit_bar1: false,
												playersedit_bar2: false,
												playersedit_bar3: false,
												playersedit_aura1: false,
												playersedit_aura2: false,
												light_radius: "1",
												light_dimradius: "0",
												light_hassight: true,
												light_angle: "0",
												light_losangle: "0",
												isdrawing: true
											});
				debug("Created sensor token with id " + st.id + " controlled by: " + st.get("controlledby"));
				toBack(st);
				state.MotionSensor.ignoreTargets[st.id] = st.id;
				state.MotionSensor.activeSensors[o.id].sensorTargets[token.id] = {
					targetId: token.id,
					target: token,
					sensorTokenId: st.id,
					sensorToken: st
				};
			}
 		});
		debug("Reenabling graphic change event now that sensor creation is done");
		state.MotionSensor.isCreatingSensor = false;
	},

	debug = function(message) {
 		if (state.MotionSensor.isDebugEnabled) {
 			log("MotionSensor: " + message);
 		}
 	},

	destroySensor = function(id) {
		debug("In destroySensor");
		debug("Destroying sensor with id: " + id);
		var sensor = state.MotionSensor.activeSensors[id];
		if (sensor === undefined && sensor === null) {
			debug("Exiting - No active sensor found for id: " + id);
			return;
		}
		_.each(sensor.sensorTargets, function(target) {
			debug("Removing sensor token for target: " + target.targetId);
			var st = getObj("graphic", target.sensorTokenId);
			if (st) {
				st.remove();				
				delete state.MotionSensor.ignoreTargets[target.sensorTokenId];
			}
		});
		debug("All sensor tokens removed for sensor: " + id);
		debug("Deleting sensor");
		delete state.MotionSensor.activeSensors[id];
		debug("Sensor deleted");
	},

	getEasingFunction = function(name) {
		switch (name) {
			case "linear":
				return function (t) { return t; };
			case "easeInQuad":
				return function (t) { return t * t; };
			case "easeOutQuad":
				return function (t) { return t * (2 - t); };
			case "easeInOutQuad":
				return function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; };
			case "easeInCubic":
				return function (t) { return t * t * t; };
			case "easeOutCubic":
				return function (t) { return (--t) * t * t + 1; };
			case "easeInOutCubic":
				return function (t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; };
			case "easeInQuart":
				return function (t) { return t * t * t * t; };
			case "easeOutQuart":
				return function (t) { return 1 - (--t) * t * t * t; };
			case "easeInOutQuart":
				return function (t) { return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t; };
			case "easeInQuint":
				return function (t) { return t * t * t * t * t; };
			case "easeOutQuint": 
				return function (t) { return 1 + (--t) * t * t * t * t; };
			case "easeInOutQuint":
				return function (t) { return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t; };
			default:
				return undefined;
		}
	},

    handleChangeGraphic = function(obj) {
    	debug("In handleChangeGraphic");
 		debug("Graphic changed with id: " + obj.id);
 		
 		if (state.MotionSensor.isCreatingSensor) {
 			debug("Ignoring graphic change event while creating sensors");
 			return;
 		}

 		var sensor = state.MotionSensor.activeSensors[obj.id];
 		if (sensor) {
 			var range = sensor.range;
 			destroySensor(obj.id);
 			createSensor(obj, range);
 		} else {
	 		_.chain(state.MotionSensor.activeSensors)
	 			.filter(function(sensor) {
	 				var isOnSamePage, isSameAsSensor, isIgnoredTarget;
	 				isOnSamePage = sensor.page === obj.get("pageid");
	 				isSameAsSensor = sensor.id === obj.id;
	 				isIgnoredTarget = _.contains(state.MotionSensor.ignoreTargets, obj.id);
	 				debug("Changed graphic IsOnSamePage: " + isOnSamePage + " IsSameAsSensor: " + isSameAsSensor + " IsIgnoredTarget: " + isIgnoredTarget);
	 				return isOnSamePage && !isSameAsSensor && !isIgnoredTarget;
	 			})
	 			.each(function(sensor){
	 				var px, py, tx, ty, diff, containsTarget, width, height;
	 				px = sensor.sensorSource.get("left") + (sensor.sensorSource.get("width") / 2);
	 				py = sensor.sensorSource.get("top") + (sensor.sensorSource.get("height") / 2);
	 				tx = obj.get("left") + (obj.get("width") / 2);
	 				ty = obj.get("top") + (obj.get("height") / 2);
 					width = obj.get("width");
 					height = obj.get("height");
	 				diff = Math.sqrt((tx - px) * (tx - px) + (ty - py) * (ty - py)) / 70;
	 				debug("The target " + obj.id + " is " + diff + " units from the sensor source");
	 				if (sensor.sensorTargets[obj.id]) {
	 					containsTarget = true;
	 				} else {
	 					containsTarget = false;
	 				}
	 				debug("Disabling graphic change event to prevent stack overflow on createObj :( API full of lies");
	 				state.MotionSensor.isCreatingSensor = true;
	 				if (diff <= sensor.range && !containsTarget) {
	 					debug("New target has entered sensor range - creating token");
	 					var controlledby = sensor.sensorSource.get("controlledby");
						if (controlledby.length < 1) {
							controlledby = getObj("character", sensor.sensorSource.get("_represents")).get("controlledby");
						}		
						debug("Creating sensor blip for: " + obj.id + " controlled by: " + controlledby);
	 					var st = createObj("graphic", {
												pageid: obj.get("pageid"),
												imgsrc: state.MotionSensor.blipSource,
												rotation: 0,
												layer: "objects",
												width: width,
												height: height,
												left: obj.get("left"),
												top: obj.get("top"),
												controlledby: controlledby,
												playersedit_name: false,
												playersedit_bar1: false,
												playersedit_bar2: false,
												playersedit_bar3: false,
												playersedit_aura1: false,
												playersedit_aura2: false,
												light_radius: "1",
												light_dimradius: "0",
												light_hassight: true,
												light_angle: "0",
												light_losangle: "0",
												isdrawing: true
											});
						debug("Created sensor blip with id " + st.id + " controlled by: " + st.get("controlledby"));
						toBack(st);
						state.MotionSensor.ignoreTargets[st.id] = st.id;
						sensor.sensorTargets[obj.id] = {
							targetId: obj.id,
							target: obj,
							sensorTokenId: st.id,
							sensorToken: st
						};
	 				} else if (diff >= sensor.range && containsTarget) {
	 					debug("Existing target has left sensor range - deleting token");
	 					sensor.sensorTargets[obj.id].sensorToken.remove();
	 					delete state.MotionSensor.ignoreTargets[sensor.sensorTargets[obj.id].sensorTokenId];
	 					delete sensor.sensorTargets[obj.id];	 					
	 				} else if (diff <= sensor.range && containsTarget) {
	 					debug("Existing target has changed location within sensor range - updating token");
	 					sensor.sensorTargets[obj.id].sensorToken.set("left", obj.get("left"));
	 					sensor.sensorTargets[obj.id].sensorToken.set("top", obj.get("top"));
	 				}
	 				debug("Reenabling graphic change event now that sensor creation is done");
	 				state.MotionSensor.isCreatingSensor = false;
	 			});
		}
 	},

 	handleDestroyGraphic = function(obj) {
 		debug("In handleDestroyGraphic");
 		debug("Graphic destroyed with id: " + obj.id);
		var found = _.findWhere(state.MotionSensor.sensors, { id: obj.id });
		if (found) {
			debug("Destroyed graphic had attached sensor, destroying sensor");
			destroySensor(obj.id);
		}
		found = state.MotionSensor.ignoreTargets[obj.id];
		if (found) {
			debug("Destroyed an ignored target, deleting from ingoreTargets");
			delete state.MotionSensor.ignoreTargets[obj.id];
		}
 	},

 	handleInput = function(msg) {
		debug("MotionSensor: In handleInput");
		var args, range, show, enable;

		if ("api" !== msg.type || !playerIsGM(msg.playerid)) {
			debug('MotionSensor: Recieved non-API or non-GM chat input - ignoring.');
			return;
		}
        
		args = msg.content.split(/\s+/);
		
		switch(args[0]) {
			case '!motion-sensor-start':
				if(!(msg.selected && msg.selected.length > 0)) {
					showHelp();
					return;
				}
				if (state.MotionSensor.blipSource.length < 1) {
					message("You must add a source image for the sensor before enabling a sensor. Please use the command !motion-sensor-src to do so now.");
					return;
				}
                range = args[1] || defaultRange;
				_.chain(msg.selected)
					.map(function (o) {
						return getObj(o._type,o._id);
					})
					.filter(function(o) {
						return 'token' === o.get('subtype');
					})
					.each(function(o) {
						createSensor(o, range);
					});
				break;
			case '!motion-sensor-stop':
				if(!(msg.selected && msg.selected.length > 0)) {
					showHelp();
					return;
				}
				_.chain(msg.selected)
					.map(function (o) {
						return getObj(o._type,o._id);
					})
					.filter(function(o) {
						return 'token' === o.get('subtype');
					})
					.each(function(o) {
						destroySensor(o.id);
					});
				break;
			case '!motion-sensor-show':
				if(!(msg.selected && msg.selected.length > 0)) {
					showHelp();
					return;
				}
				show = args[1] || "true";
				if (show !== "true" && show !== "false") {
					showHelp();
					return;
				}
				_.chain(msg.selected)
					.map(function (o) {
						return getObj(o._type,o._id);
					})
					.filter(function(o) {
						return 'token' === o.get('subtype');
					})
					.each(function(o) {
						if (show === "true") {
							debug("Removing " + o.id + " from the list of ignored objects");
							message("Now showing the selected object on all motion sensors");
							delete state.MotionSensor.ignoreTargets[o.id];
						} else if (show === "false") {
							debug("Adding " + o.id + " to the list of ignored objects");
							message("Now hiding the selected object from all motion sensors");
							state.MotionSensor.ignoreTargets[o.id] = o.id;
						}
					});
				break;
			case '!motion-sensor-src':
				if (!args[1] || args[1].length < 1) {
					showHelp();
					return;
				}
				if (!(args[1].lastIndexOf(prodUrl, 0) === 0 || args[1].lastIndexOf(devUrl, 0) === 0)) {
					debug("Attempted to add blip source with bad URL: " + args[1]);
					message("Your URL should start with either https://s3.amazonaws.com/files.d20.io/images/ on the production server or https://s3.amazonaws.com/files.staging.d20.io/images/ on the dev server.");
					return;
				}
				state.MotionSensor.blipSource = args[1];
				debug("Blip source set to: " + state.MotionSensor.blipSource);
				message("Motion blip source set to: " + state.MotionSensor.blipSource);
				break;
			case '!motion-sensor-debug':
				if (!args[1] || args[1].length < 1) {
					showHelp();
					return;
				}
				enable = args[1] || "true";
				if (enable !== "true" && enable !== "false") {
					showHelp();
					return;
				}
				state.MotionSensor.isDebugEnabled = enable;
				debug((enable) ? "Debugging enabled" : "Debugging disabled");
				message((enable) ? "Debugging enabled" : "Debugging disabled");
				break;
			case '!motion-sensor-pulse-cfg':
				if (!args[1] || args[1].length < 1 || !args[2] || args[2].length < 1) {
					showHelp();
					return;
				}
				configurePulse(args[1], args[2]);								
				break;
			case '!motion-sensor-reset':
				debug("Resetting MotionSensor to initial state.");
				var sensorIds = _.map(state.MotionSensor.activeSensors, function (sensor) {
					return sensor.id;
				});
				_.each(sensorIds, function (id) {
					destroySensor(id);
				});
				state.MotionSensor.activeSensors = {};
				state.MotionSensor.ignoreTargets = {};
				state.MotionSensor.blipSource = "";
				message("MotionSensor has been reset to initial state. You will need to reconfigure the image source and any sensors");
				break;
			case '!ignored':
				message("There are " + _.size(state.MotionSensor.ignoreTargets) + " ignored targets");
				break;
		}
 	},

 	initialize = function () {
		debug("In initialize");

		if (!_.has(state, "MotionSensor")) {
			debug("No MotionSensor instance found in state object. Creating instance.");
			state.MotionSensor = {
				version: scriptVersion,
				blipSource: '',
				isCreatingSensor: false,
				isDebugEnabled: false,
				activeSensors: {},
				ignoreTargets: {},
				pulseCyclic: defaultPulseCyclic,
				pulseEasingName: defaultPulseEasingFunction,
				pulseEasingFunction: getEasingFunction(defaultPulseEasingFunction),
				pulseMinSizeRatio: defaultPulseMinSizeRatio,
				pulseMaxSizeRatio: defaultPulseMaxSizeRatio,
				pulseRate: defaultPulseRate
			};
		}

		if (state.MotionSensor.version !== scriptVersion) {
			debug("Newer version of MotionSensor script detected. Disposing old instance and creating new.");			
			var sensorIds = _.map(state.MotionSensor.activeSensors, function (sensor) {
				return sensor.id;
			});
			_.each(sensorIds, function (id) {
				destroySensor(id);
			});
			state.MotionSensor = {
				version: scriptVersion,
				blipSource: '',
				isCreatingSensor: false,
				isDebugEnabled: false,
				activeSensors: {},
				ignoreTargets: {},
				pulseCyclic: defaultPulseCyclic,
				pulseEasingName: defaultPulseEasingFunction,
				pulseEasingFunction: getEasingFunction(defaultPulseEasingFunction),
				pulseMinSizeRatio: defaultPulseMinSizeRatio,
				pulseMaxSizeRatio: defaultPulseMaxSizeRatio,
				pulseRate: defaultPulseRate
			};
			message("MotionSensor v" + scriptVersion + " has been installed. You may need to reapply your image source and sensors.");
 		}

 		if (state.MotionSensor.blipSource.length < 1) {
 			debug("No blip image source defined - cannot create tokens");
 			message("It looks like you haven't set up an image source for MotionSensor. Please use the !motion-sensor-src command to configure one now.");
 		}
 		var n = _.size(state.MotionSensor.activeSensors);
 		debug("Found " + n + " active sensors");
 		n = 0;
 		_.each(state.MotionSensor.activeSensors, function (sensor) {
 			n = n + _.size(sensor.targets);
 		});
 		debug("Found " + n + " sensor targets");
 		n = _.size(state.MotionSensor.ignoreTargets);
 		debug("Found " + n + " ignored targets");

 		n = 0;
 		debug("Reinitializing sensors");
 		_.each(state.MotionSensor.activeSensors, function(sensor){
 			n = n + 1;
 			var range = sensor.range;
 			destroySensor(sensor.id);
 			createSensor(getObj("graphic", sensor.id), range);
 		});
 		debug("Reinitialized " + n + " sensors");

 		debug("Pulse Cyclic: " + state.MotionSensor.pulseCyclic);
 		debug("Pulse Min Size Ratio: " + (state.MotionSensor.pulseMinSizeRatio * 100) + "%");
 		debug("Pulse Max Size Ratio: " + (state.MotionSensor.pulseMaxSizeRatio * 100) + "%");
 		debug("Pulse Rate: " + state.MotionSensor.pulseRate + "ms");
 		debug("Pulse Easing Function: " + state.MotionSensor.pulseEasingName);
 		debug("Setting Easing Function: " + state.MotionSensor.pulseEasingName);
 		state.MotionSensor.pulseEasingFunction = getEasingFunction(state.MotionSensor.pulseEasingName);

 		debug("Starting update interval with " + intervalRate + "ms delay");
 		intervalHandle = setInterval(animateSensors, intervalRate);
 		debug("Interval started");
 	},

 	interp = function(minValue, maxValue, currentTime, period, easingFunction) {
 		var t = currentTime % period;
 		t = (t * 1.0) / (period * 1.0);
 		t = easingFunction(t);
 		return ((maxValue - minValue) * t) + minValue;
 	}, 	

 	message = function(message) {
 		sendChat("MotionSensor", '/w gm <div style="padding:1px;border: 1px solid #5f8cbf;background: #eff3f8; color: #4e4e4f; font-size: 80%;">' + message + '</div>');
 	},

 	registerEventHandlers = function() {
		on("chat:message", handleInput);
		on("destroy:graphic", handleDestroyGraphic);
		on("change:graphic", handleChangeGraphic);
	},

	showHelp = function() {
        sendChat('','/w gm '
			+'<div style="border: 1px solid #5f8cbf; background-color: white; padding: 3px 3px; font-size: 80%;">'
				+'<div style="font-weight: bold; border-bottom: 1px solid #5f8cbf;font-size: 130%;">'
					+'MotionSensor v' + scriptVersion
					+'<div style="clear: both"></div>'
				+'</div>'
				+'<div style="padding-left:10px;margin-bottom:3px;">'
					+'<p>Allows the addition of motion sensors to tokens in the game</p>'
				+'</div>'
				+'<b>Commands</b>'
				+'<div style="padding-left:10px;"><b><span >!motion-sensor-start '+ch('[')+'Range in Units'+ch(']')+'</span></b>'
					+'<div style="padding-left: 10px;padding-right:20px">'
						+'Activates a motion sensor for the selected token. Allows the use of an optional range parameter.'
						+'<ul>'
							+'<li style="border-top: 1px solid #5f8cbf;border-bottom: 1px solid #5f8cbf;">'
								+'<b><span >Range in Units</span></b> '+ch('-')+' Specifies the radius (in units) of the motion sensor. <b>Default: '+ defaultRange +'</b></li>'
							+'</li> '
						+'</ul>'
					+'</div>'
				+'</div>'
				+'<div style="padding-left:10px;"><b><span >!motion-sensor-stop</span></b>'
					+'<div style="padding-left: 10px;padding-right:20px">'
						+'Deactivates the motion sensor for the selected token'
					+'</div>'
				+'</div>'
				+'<div style="padding-left:10px;"><b><span >!motion-sensor-show '+ch('[')+'Show'+ch(']')+'</span></b>'
					+'<div style="padding-left: 10px;padding-right:20px">'
						+'Specifies whether or not a token will appear on the motion sensor.'
						+'<ul>'
							+'<li style="border-top: 1px solid #5f8cbf;border-bottom: 1px solid #5f8cbf;">'
								+'<b><span >Show</span></b> '+ch('-')+' Specifies whether or not the token should be shown on the motion sensor. <b>Default: true</b></li>'
							+'</li> '
						+'</ul>'
					+'</div>'
				+'</div>'
				+'<div style="padding-left:10px;"><b><span >!motion-sensor-src '+ch('<')+'Blip Source URL'+ch('>')+'</span></b>'
					+'<div style="padding-left: 10px;padding-right:20px">'
						+'Specifies the URL of the image to use for your motion sensor blips. This URL must point at an image that has been uploaded to your campaign library.'
						+'<ul>'
							+'<li style="border-top: 1px solid #5f8cbf;border-bottom: 1px solid #5f8cbf;">'
								+'<b><span >Blip Source URL</span></b> '+ch('-')+' The source URL for the image to be used as the sensor blip. This should start with either <i>' + prodUrl + '</i> on production servers or <i>' + devUrl + '</i> on development servers.</li>'
							+'</li> '
						+'</ul>'
					+'</div>'
				+ '</div>'
				+ '<div style="padding-left:10px;"><b><span >!motion-sensor-pulse-cfg ' + ch('<') + 'Parameter Name' + ch('>') + ' ' + ch('<') + 'Parameter Value' + ch('>') + '</span></b>'
					+ '<div style="padding-left: 10px;padding-right:20px">'
						+ 'Configures the parameters controlling the pulse animation for sensor beacons.'
						+ '<ul>'
							+ '<li style="border-top: 1px solid #5f8cbf;border-bottom: 1px solid #5f8cbf;">'
								+ '<b><span >Parameter Name</span></b> ' + ch('-') + 'Should be one of the following: </li>'
								+ '<ul>'
									+ '<li><b><span>cyclic</span></b> determines if the pulse returns to the starting dimensions or ends at the maximum extent</li>'
									+ '<li><b><span>minSizeRatio</span></b> sets the minimum size of the pulse compared to the generating token</li>'
									+ '<li><b><span>maxSizeRatio</span></b> sets the maximum size of the pulse compared to the generating token</li>'
									+ '<li><b><span>rate</span></b> sets the period of time (in ms) it takes for the pulse to complete its animation</li>'
									+ '<li><b><span>easingFunction</span></b> sets the easing function used to interpolate the animation</li>'
								+ '</ul>'
							+ '</li>'
							+ '<li style="border-top: 1px solid #5f8cbf;border-bottom: 1px solid #5f8cbf;">'
								+'<b><span >Parameter Value</span></b> ' + ch('-') + ' The value for the selected parameter</li>'
								+ '<ul>'
									+ '<li><b><span>cyclic</span></b> Should be either true or false</li>'
									+ '<li><b><span>minSizeRatio</span></b> Should be a float value greater than or equal to 0. (A value of 1 is equal to 100%)</li>'
									+ '<li><b><span>maxSizeRatio</span></b> Should be a float value greater than 0. (A value of 1 is equal to 100%)</li>'
									+ '<li><b><span>rate</span></b> Should be an integer value greater than 0</li>'
									+ '<li><b><span>easingFunction</span></b> Should be one of: linear, easeInQuad, easeOutQuad, easeInOutQuad, easeInCubic, easeOutCubic, easeInOutCubic, easeInQuart, easeInQuart, easeInOutQuart, easeInQuint, easeOutQuint, easeInOutQuint</li>'
								+ '</ul>'
							+ '</li>'
						+ '</ul>'
					+ '</div>'
				+ '</div>'
				+ '<div style="padding-left:10px;"><b><span >!motion-sensor-debug ' + ch('<') + 'Enabled' + ch('>') + '</span></b>'
					+ '<div style="padding-left: 10px;padding-right:20px">'
						+ 'Specifies whether or not logging to the debug console is enabled.'
						+ '<ul>'
							+ '<li style="border-top: 1px solid #5f8cbf;border-bottom: 1px solid #5f8cbf;">'
								+ '<b><span >Enable</span></b> '+ch('-')+' The value to be used for the deubgging state. Should be either true or false.</li>'
							+ '</li> '
						+ '</ul>'
					+ '</div>'
				+ '</div>'
				+ '<div style="padding-left:10px;"><b><span >!reset-motion-sensor</span></b>'
					+ '<div style="padding-left: 10px;padding-right:20px">'
						+ 'Resets the motion sensor plugin, deleting all active sensors.'
					+ '</div>'
				+ '</div>'
			+ '</div>');
    };

	return {
		Initialize: initialize,
		RegisterEventHandlers: registerEventHandlers
	};

}());

on("ready", function(){
	'use strict';
	MotionSensor.Initialize();
	MotionSensor.RegisterEventHandlers();
});