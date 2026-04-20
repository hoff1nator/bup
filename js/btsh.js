'use strict';
// BTS support (https://github.com/phihag/bts/) via HTTP

function btsh(baseurl, tournament_key) {
	var ws = null;
	var WS_PATH = '/ws/bup';
	var reconnect_timeout = 1000;
	var bts_update_callback = null;
	var bts_update_courts_callback = null;
	var btsh_court_selection_pending = null;
	var display_initialized = false;
	var battery;
	

	if (!battery && (typeof navigator != 'undefined') && navigator.getBattery) {
		navigator.getBattery().then(function(bat) {
			battery = bat;
		});
	}

	function _bat_status() {
		if (!battery) {
			return undefined;
		}
		return {
			charging: battery.charging,
			level: battery.level,
			chargingTime: battery.chargingTime,
			dischargingTime: battery.dischargingTime,
		};
	}

	function _device_data() {
		return {
			id: refmode_client_ui.get_node_id(),
			battery: _bat_status(),
			court: state.settings.court_id,
		};
	}

	function _request_json(s, component, options, cb) {
		options.dataType = 'text';
		options.timeout = s.settings.network_timeout;
		network.$request(component, options).done(function(res_json) {
			try {
				var res = JSON.parse(res_json);
			} catch (e) {
				return cb(e);
			}

			if (res.status !== 'ok') {
				return cb({msg: res.message + ' ' + s._('network:error:status', {status: res.status})});
			}

			return cb(null, res);
		}).fail(function (xhr) {
			var msg = ((xhr.status === 0) ?
				s._('network:error:bts') :
				s._('network:error:http', {code: xhr.status})
			);
			return cb({
				type: 'network-error',
				status: xhr.status,
				msg: msg,
			});
		});
	}

	function send_score(s) {
		if (s.settings.court_id === 'referee') {
			network.errstate('btsh.score', null);
			return;
		}
		if (! /^bts_/.test(s.setup.match_id)) {
			return;
		}
		const req_match_id = s.setup.match_id;
		const match_id = req_match_id.substring('bts_'.length);

		const netscore = calc.netscore(s, true);
		const duration_ms = (s.metadata.start && s.metadata.end) ? (s.metadata.end - s.metadata.start) : null;
		const end_ts = s.metadata.end ? s.metadata.end : null;
		const score_data = {
			court_id: s.settings.court_id,
			match_id: match_id,
			network_team1_serving: s.game.team1_serving,
			network_teams_player1_even: s.game.teams_player1_even,
			network_score: netscore,
			team1_won: s.match.team1_won,
			finish_confirmed: s.match.finish_confirmed,
			presses: s.presses,
			duration_ms: duration_ms,
			end_ts: end_ts,
			marks: s.match.marks,
			shuttle_count: s.match.shuttle_count,
			device: _device_data(),
		};
		send_score_changed(score_data);
	}

	function sync(s) {
		send_score(s);
	}

	/* s, press */
	function send_press(s) {
		sync(s);
	}

	function fetch_courts(s, callback) {
		bts_update_courts_callback = callback;
		connect();
		if (s.btsh_courts && s.btsh_courts != null){
			callback(null, s.btsh_courts);
		}
	}

	function _court_picker_is_visible() {
		return (
			state &&
			settings.get_mode(state) === 'umpire' &&
			(!state.settings.court_id || state.settings.court_id === 'referee')
		);
	}

	function _filter_event_to_assigned_court(event) {
		if (!event || !state || !state.settings) {
			return event;
		}
		var assigned_court_id = state.settings.court_id;
		if (!assigned_court_id || assigned_court_id === 'referee') {
			return event;
		}
		if (!event.matches || !Array.isArray(event.matches)) {
			return event;
		}
		event.matches = event.matches.filter(function(match) {
			return match && match.setup && match.setup.court_id === assigned_court_id;
		});
		return event;
	}

	function _court_picker_match(court) {
		if (!court || !court.match_id || !state || !state.bts_event || !state.bts_event.matches) {
			return null;
		}
		return state.bts_event.matches.find(function(match) {
			return match && match.setup && (match.setup.match_id === court.match_id);
		}) || null;
	}

	function _court_picker_team_text(match, team_id) {
		var team = match && match.setup && match.setup.teams ? match.setup.teams[team_id] : null;
		if (!team || !team.players || team.players.length === 0) {
			return 'N.N.';
		}
		if (!match.setup.is_doubles) {
			return team.players[0].name || 'N.N.';
		}
		if (team.players.length === 1) {
			return (team.players[0].name || 'N.N.') + ' / N.N.';
		}
		return (team.players[0].name || 'N.N.') + ' / ' + (team.players[1].name || 'N.N.');
	}

	function _court_picker_set_visible(container, visible) {
		if (!container) {
			return;
		}
		if (visible) {
			container.classList.remove('default-invisible');
			container.style.display = '';
		} else {
			container.classList.add('default-invisible');
			container.style.display = 'none';
		}
	}

	function _render_court_picker() {
		var container = document.querySelector('.btsh_court_picker');
		_court_picker_set_visible(container, false);
	}

	function select_court_assignment(court_id) {
		btsh_court_selection_pending = court_id;
		ws_send({
			type: 'select_court_assignment',
			tournament_key: tournament_key,
			court_id: court_id,
		});
	}

	function ui_init() {
		if (!baseurl) {
			baseurl = '../';
		}
		var m = window.location.pathname.match(/^(.*\/)bup\/(?:bup\.html|index\.html)?$/);
		if (m) {
			baseurl = m[1];
		}

		click.qs('.settings_send_export', function (e) {
			e.preventDefault();
			persist_display_settings();
		});
		click.qs('.settings_reset_export', function (e) {
			e.preventDefault();
			reset_display_settings();
		});
		_render_court_picker();
	}

	async function persist_display_settings() {
		ws_send({ type: 'persist_display_settings', tournament_key: tournament_key, panel_settings: _panel_settings_payload() });
	}

	async function reset_display_settings() {
		ws_send({ type: 'reset_display_settings', tournament_key: tournament_key, panel_settings: _panel_settings_payload() });
	}

	async function send_device_info() {
		ws_send({ type: 'device_info', tournament_key: tournament_key, device: _device_data() });
		setTimeout(send_device_info, 1000*60*5);
	}
	async function send_score_changed(score) {
		network.errstate('btsh.score', null);
		ws_send({ type: 'score_update', tournament_key: tournament_key, score: score });
	}

	async function send_command_done(command) {
		ws_send({ type: 'command_done', tournament_key: tournament_key, wait_for_command: command})
	}

	function _panel_settings_payload() {
		return Object.assign({}, state.settings, {
			devicemode: settings.get_mode(state) === 'display' ? 'display' : 'umpire',
		});
	}

	function confirm_match_finished() {		
		if (state.match && (state.match.team1_won != null) && state.metadata.end && state.metadata.end != null){
			control.post_match_confirm(state);
		}	
	}

	async function ws_send(json) {
		if (ws == null) {
			connect();
		}
		ws.sendmsg(json);
	}

	function service_name() {
		return 'BTSh';
	}

	function editable(/*s*/) {
		return false;
	}

	function courts(s) {
		return s.btsh_courts;
	}

	function connect() {
		try {
			if (ws == null) {
				ws = new WebSocket(construct_url(WS_PATH), 'bts-bup');
				ws.sendmsg = ws_sendmsg;
				ws.onopen = function () {
					reload_match_information();
					send_device_info();
					match_storage.remove_all(12);
				};
				ws.onmessage = handle_message;
				ws.onclose = function () {
					ws = null;
					send_bts_not_reachable();
					setTimeout(connect, reconnect_timeout);
				};
			}
		} catch (e) {
			ws = null;
			send_bts_not_reachable();
			setTimeout(connect, reconnect_timeout);
		}
	}
	function construct_url(abspath) {
		var l = window.location;
		return (
			((l.protocol === 'https:') ? 'wss://' : 'ws://') +
			l.hostname +
			(((l.port !== 80) && (l.port !== 443)) ? ':' + l.port : '') +
			abspath
		);
	}

	async function ws_sendmsg(msg) {
		
		waitForSocketConnection(ws, () => {
			const msg_json = JSON.stringify(msg);
			ws.send(msg_json);
		});

	}

	// Make the function wait until the connection is made...
	function waitForSocketConnection(socket, callback){
	    setTimeout(
	        function () {
	            if (socket.readyState === 1) {
	                if (callback != null){
	                    callback();
	                }
	            } else {
	                waitForSocketConnection(socket, callback);
	            }

	        }, 5); // wait 5 milisecond for the connection...
	}

	function handle_message(ws_msg) {
		var msg_json = ws_msg.data;
		var msg = JSON.parse(msg_json);
		if (!msg) {
			send({
				type: 'error',
				message: 'Could not parse message',
			});
		}
		switch (msg.type) {
			case 'change':
				default_change_handler(msg);
				break;
			case 'error':
				network.errstate('btsh.score', msg);
				break;
			default:
				send({
					type: 'error',
					rid: msg.rid,
					message: 'Unsupported message ' + msg.type,
				});
		}
	}

	function default_change_handler(c) {
		switch (c.ctype) {
			case 'score-update':
				state.bts_event = _filter_event_to_assigned_court(c.val.event);
				console.log('[bup] score-update received', {
					ts: Date.now(),
					court_id: state && state.settings ? state.settings.court_id : null,
					match_states: state && state.bts_event && state.bts_event.matches ? state.bts_event.matches.map(function(match) {
						return {
							match_id: match && match.setup ? match.setup.match_id : null,
							state: match && match.setup ? match.setup.state : null,
							now_on_court: match && match.setup ? match.setup.now_on_court : null,
							called_timestamp: match && match.setup ? match.setup.called_timestamp : null,
							end_ts: match ? match.end_ts : null,
						};
					}) : [],
				});
				if (bts_update_callback != null) {
					bts_update_callback(null, state, state.bts_event);
					if (
						state.settings.court_id != '' &&
						state.bts_event.matches[0] &&
						state.bts_event.matches[0].end_ts != null
					) {
						console.log('[bup] score-update scheduling reload_match_information', {
							ts: Date.now(),
							court_id: state && state.settings ? state.settings.court_id : null,
							first_match_id: state.bts_event.matches[0] && state.bts_event.matches[0].setup ? state.bts_event.matches[0].setup.match_id : null,
							first_match_end_ts: state.bts_event.matches[0] ? state.bts_event.matches[0].end_ts : null,
						});
						setTimeout(reload_match_information, 60000);
					}
				}
				_render_court_picker();
				break;
			case 'settings-update':
				state.settings = c.val;
				state.dads = c.val.advertisements;
				if (state.settings && state.settings.court_id && state.settings.court_id !== 'referee') {
					btsh_court_selection_pending = null;
				}
				settings.update(state);
				settings.on_mode_change(state);
				_render_court_picker();
				break;
			case 'confirm-match-finished':
				confirm_match_finished();
				break;
			case 'advertisement_add':
				state.dads.push(c.val)
				break;
			case 'advertisement_remove':
				if (state.dads) {
					const changed_t = utils.find(state.dads, m => m._id === c.val.advertisement_id);
					if (changed_t) {
						state.dads.splice(state.dads.indexOf(changed_t), 1);
					}
				}
				break;
			case 'courts-update':
				var courts = c.val.map(function (rc) {
					var res = {
						id: rc._id,
						label: rc.num,
					};
					if (rc.match_id) {
						res.match_id = 'bts_' + rc.match_id;
					}
					send_command_done(c);
					return res;
				});
				courts.push({
					id: 'referee',
					description: state._('court:referee'),
				});

				state.btsh_courts = courts;
				if (bts_update_courts_callback && bts_update_courts_callback != null) {
					bts_update_courts_callback(null, state.btsh_courts);
				}
				if(state.settings.devicemode == "umpire") {
					if (!state.initialized || !state.match || state.match.finish_confirmed) {
						settings.show();
						settings.on_mode_change(state);
					}
				} else {
					settings.hide_displaymode();
				}
				_render_court_picker();
				break;
			default:
				break;
		}
		send_command_done(c);
	}

	function reload_match_information() {
		ws.sendmsg({ type: 'init', initialize_display: !display_initialized, tournament_key: tournament_key, panel_settings: _panel_settings_payload() });
		display_initialized = true;
	}
	
	function subscribe(s, cb, calc_timeout) {
		bts_update_callback = cb;
		if (state && state.bts_event && state.bts_event != null) {
			bts_update_callback(null, state, state.bts_event);
			state.bts_event = null;
		}
		connect();
	}

	function send_bts_not_reachable() {
		if (bts_update_callback && bts_update_callback != null) {
			var msg = state._('network:error:bts');
			bts_update_callback({
				type: 'network-error',
				msg: msg,
			}, state, null);
		}
	}

	return {
		ui_init: ui_init,
		send_press: send_press,
		sync: sync,
		courts: courts,
		fetch_courts: fetch_courts,
		service_name: service_name,
		editable: editable,
		limited_ui: true,
		push_service: true,
		select_court_assignment: select_court_assignment,
		subscribe: subscribe,
		reload_match_information: reload_match_information,
	};
}

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var calc = require('./calc');
	var displaymode = require('./displaymode');
	var eventutils = require('./eventutils');
	var network = require('./network');
	var refmode_client_ui = require('./refmode_client_ui');
	var settings = require('./settings');
	var click = require('./click');

	module.exports = btsh;
}
/*/@DEV*/
