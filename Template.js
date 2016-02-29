var Template = Template || (function() {
	'use strict';

	var scriptVersion = 0.1,
		scriptName = "Template",
		isDebugEnabled = false,

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

	debug = function(message) {
 		if (isDebugEnabled) {
 			log(scriptName + ": " + message);
 		}
 	},

 	dispose = function() {
 		debug('In dispose');
 	},

 	handleInput = function(msg) {
 		debug("In handleInput");
		var args, range, show, enable;
		if ("api" !== msg.type || !playerIsGM(msg.playerid)) {
			debug('Recieved non-API or non-GM chat input - ignoring.');
			return;
		}
		args = msg.content.split(/\s+/);		
		switch(args[0]) {			
			default:
				break;
		}
 	},

 	initialize = function () {
		debug("In initialize");		
		if (!_.has(state, scriptName)) {
			debug("No instance found in state object. Creating instance.");
			
			state[scriptName] = {
				version: scriptVersion
			};

			message("Installed " + scriptName + " v" + scriptVersion);
		}
		if (state[scriptName].version !== scriptVersion) {
			debug("Newer version of script detected. Disposing old instance and creating new.");			
			
			dispose();

			var oldVersion = state.Template.version;
			state[scriptName] = {
				version: scriptVersion,
			};

			message("Upgraded " + scriptName + " from  v" + oldVersion + " to v" + scriptVersion);
 		}
	},

	message = function(message, player) {
 		sendChat("MotionSensor", '/w ' + player + ' <div style="padding:1px;border: 1px solid #5f8cbf;background: #eff3f8; color: #4e4e4f; font-size: 80%;">' + message + '</div>');
 	},

	messageGM = function(message) {
 		message(message, 'gm');
 	},

 	registerEventHandlers = function() {
		on("chat:message", handleInput);
	},

	showHelp = function() {		
	};

	return {
		Initialize: initialize,
		RegisterEventHandlers: registerEventHandlers
	};
}());

on("ready", function(){
	'use strict';
	Template.Initialize();
	Template.RegisterEventHandlers();
});