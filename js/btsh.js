'use strict';
// BTS support (https://github.com/phihag/bts/) via HTTP

function btsh(baseurl, tournament_key) {
	var ws = null;
	var WS_PATH = (function() {
		try {
			var searchParams = new URLSearchParams(window.location.search || '');
			var hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
			if (searchParams.get('bupws_v2') === '1' || hashParams.get('bupws_v2') === '1') {
				return '/ws/bup_v2';
			}
		} catch (_err) {
			// Ignore URL parsing failures and fall back to v1.
		}
		return '/ws/bup';
	})();
	var reconnect_timeout = 1000;
	var reconnect_timer = null;
	var _disconnect_since = null;
	var bts_connection_error_active = false;
	var bts_update_callback = null;
	var bts_update_courts_callback = null;
	var btsh_court_selection_pending = null;
	var display_initialized = false;
	var last_v2_display_state = null;
	var last_v2_multi_display_state = null;
	var last_v2_tournament_assets = null;
	var last_sent_score_signature = null;
	var last_received_score_update_signature = null;
	var v2_debug_forced_by_url = (function() {
		try {
			var searchParams = new URLSearchParams(window.location.search || '');
			var hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
			return searchParams.get('bupws_v2_debug') === '1' || hashParams.get('bupws_v2_debug') === '1';
		} catch (_err) {
			return false;
		}
	})();
	var v2_debug = v2_debug_forced_by_url;
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
		var score_signature = _score_data_signature(score_data);
		if (score_signature === last_sent_score_signature) {
			return;
		}
		last_sent_score_signature = score_signature;
		send_score_changed(score_data);
	}

	function _score_data_signature(score_data) {
		var presses = score_data.presses || [];
		var last_press = presses.length ? presses[presses.length - 1] : {};
		return JSON.stringify({
			court_id: score_data.court_id || '',
			match_id: score_data.match_id || '',
			network_team1_serving: score_data.network_team1_serving,
			network_teams_player1_even: score_data.network_teams_player1_even,
			network_score: score_data.network_score || [],
			team1_won: score_data.team1_won,
			finish_confirmed: score_data.finish_confirmed,
			end_ts: score_data.end_ts || null,
			marks: score_data.marks || null,
			shuttle_count: score_data.shuttle_count || null,
			presses_len: presses.length,
			last_press_type: last_press && last_press.type || '',
			last_press_timestamp: last_press && last_press.timestamp || '',
		});
	}

	function _score_event_signature(event) {
		event = event || {};
		return JSON.stringify({
			matches: (event.matches || []).map(function(match) {
				match = match || {};
				var setup = match.setup || {};
				return {
					match_id: setup.match_id || '',
					court_id: setup.court_id || '',
					state: setup.state || '',
					now_on_court: setup.now_on_court,
					called_timestamp: setup.called_timestamp || null,
					preparation_call_timestamp: setup.preparation_call_timestamp || null,
					network_score: match.network_score || [],
					network_team1_left: match.network_team1_left,
					network_team1_serving: match.network_team1_serving,
					network_teams_player1_even: match.network_teams_player1_even,
					end_ts: match.end_ts || null,
					presses_json: match.presses_json || '',
				};
			}),
			courts: (event.courts || []).map(function(court) {
				court = court || {};
				return {
					court_id: court.court_id || '',
					match_id: court.match_id || '',
					called_timestamp: court.called_timestamp || null,
				};
			}),
		});
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

	async function send_presence_update(match_id, team_presence) {
		ws_send(Object.assign({
			type: 'presence_update',
			tournament_key: tournament_key,
			match_id: match_id,
		}, team_presence));
	}

	function _panel_settings_payload() {
		return Object.assign({}, state.settings, {
			devicemode: settings.get_mode(state) === 'display' ? 'display' : 'umpire',
		});
	}

	function confirm_match_finished(command) {
		if (_apply_confirm_match_finished_command(command)) {
			control.post_match_confirm(state);
			return;
		}
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

	function _check_reload() {
		if (_disconnect_since && (Date.now() - _disconnect_since >= 60000)) {
			location.reload();
			return true;
		}
		return false;
	}

	function connect() {
		try {
			if (ws == null) {
				var next_ws = new WebSocket(construct_url(WS_PATH), 'bts-bup');
				ws = next_ws;
				ws.sendmsg = ws_sendmsg;
				ws.onopen = function () {
					if (ws !== next_ws) {
						return;
					}
					_disconnect_since = null;
					if (reconnect_timer !== null) {
						clearTimeout(reconnect_timer);
						reconnect_timer = null;
					}
					clear_bts_not_reachable();
					reload_match_information();
					send_device_info();
					match_storage.remove_all(12);
				};
				ws.onmessage = handle_message;
				ws.onclose = function () {
					if (ws === next_ws) {
						ws = null;
					}
					if (!_disconnect_since) _disconnect_since = Date.now();
					schedule_reconnect();
				};
			}
		} catch (e) {
			ws = null;
			if (!_disconnect_since) _disconnect_since = Date.now();
			schedule_reconnect();
		}
	}

	function schedule_reconnect() {
		if (_check_reload()) {
			return;
		}
		if (reconnect_timer !== null) {
			return;
		}
		reconnect_timer = setTimeout(function () {
			reconnect_timer = null;
			if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
				ws = null;
				connect();
			}
			if (!ws || ws.readyState !== WebSocket.OPEN) {
				send_bts_not_reachable();
			}
		}, reconnect_timeout);
	}

	function switch_ws_protocol(next_path) {
		if (!next_path || WS_PATH === next_path) {
			return;
		}
		WS_PATH = next_path;
		display_initialized = false;
		last_v2_display_state = null;
		last_v2_multi_display_state = null;
		last_v2_tournament_assets = null;
		last_received_score_update_signature = null;
		var old_ws = ws;
		ws = null;
		if (old_ws) {
			old_ws.onclose = function () {};
			try {
				old_ws.close();
			} catch (_err) {
				// Ignore close errors; connect() below establishes the desired protocol.
			}
		}
		connect();
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
		var socket = ws;
		waitForSocketConnection(socket, () => {
			const msg_json = JSON.stringify(msg);
			try {
				socket.send(msg_json);
				clear_bts_not_reachable();
			} catch (e) {
				if (ws === socket) {
					ws = null;
				}
				send_bts_not_reachable();
				schedule_reconnect();
			}
		});

	}

	// Make the function wait until the connection is made...
	function waitForSocketConnection(socket, callback, started_ts){
		started_ts = started_ts || Date.now();
	    setTimeout(
	        function () {
	            if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
	                ws = null;
	                connect();
	                socket = ws;
	            }
	            if (socket && socket.readyState === WebSocket.OPEN) {
	                if (callback != null){
	                    callback();
	                }
	            } else if (Date.now() - started_ts < ((state && state.settings && state.settings.network_timeout) || 1000)) {
	                waitForSocketConnection(socket, callback, started_ts);
	            } else {
	                send_bts_not_reachable();
	                schedule_reconnect();
	            }

	        }, 5); // wait 5 milisecond for the connection...
	}

	function handle_message(ws_msg) {
		var msg_json = ws_msg.data;
		var msg = JSON.parse(msg_json);
		if (!msg) {
			network.errstate('btsh.score', {
				type: 'error',
				msg: 'Could not parse message',
			});
			return;
		}
		if (msg.type !== 'error') {
			network.errstate('btsh.score', null);
		}
		switch (msg.type) {
			case 'use-bup-v2':
				switch_ws_protocol('/ws/bup_v2');
				break;
			case 'use-bup-v1':
				switch_ws_protocol('/ws/bup');
				break;
			case 'change':
				default_change_handler(msg);
				break;
			case 'display_state':
				_handle_v2_display_state(msg);
				break;
			case 'display_multi_state':
				_handle_v2_display_multi_state(msg);
				break;
			case 'display_score_update':
				_handle_v2_display_score_update(msg);
				break;
			case 'display_points_update':
				_handle_v2_display_points_update(msg);
				break;
			case 'display_timer_update':
				_handle_v2_display_timer_update(msg);
				break;
			case 'court_picker_state':
				_handle_v2_court_picker_state(msg);
				break;
			case 'error':
				network.errstate('btsh.score', msg);
				break;
			default:
				network.errstate('btsh.score', {
					type: 'error',
					msg: 'Unsupported message ' + msg.type,
				});
		}
	}

	function _apply_v2_score_update_to_court_state(court_state, msg) {
		if (!court_state || !court_state.match || court_state.match.id !== msg.match_id) {
			return null;
		}
		_apply_v2_points_update_to_court_state(court_state, msg);
		_apply_v2_timer_update_to_court_state(court_state, msg);
		return court_state;
	}

	function _apply_v2_points_update_to_court_state(court_state, msg) {
		if (!court_state || !court_state.match || court_state.match.id !== msg.match_id) {
			return null;
		}
		court_state.score = msg.score || {};
		court_state.service = msg.service || {};
		court_state.match.status = msg.status || court_state.match.status;
		if (msg.end_timestamp !== undefined) {
			court_state.match.end_timestamp = msg.end_timestamp || null;
		}
		(court_state.teams || []).forEach(function(team) {
			team.is_winner = msg.winner_side ? (team.side === msg.winner_side) : false;
		});
		return court_state;
	}

	function _apply_v2_timer_update_to_court_state(court_state, msg) {
		if (!court_state || !court_state.match || court_state.match.id !== msg.match_id) {
			return null;
		}
		if (msg.timers !== undefined) {
			court_state.timers = msg.timers || {};
		}
		return court_state;
	}

	function _apply_v2_incremental_update_to_display_state(msg, apply_to_court_state) {
		return apply_to_court_state(last_v2_display_state, msg);
	}

	function _apply_v2_incremental_update_to_multi_display_state(msg, apply_to_court_state) {
		if (!last_v2_multi_display_state || !last_v2_multi_display_state.court_states) {
			return null;
		}
		var court_state = last_v2_multi_display_state.court_states.find(function(candidate) {
			return candidate && candidate.court && candidate.court.id === msg.court_id;
		});
		if (!apply_to_court_state(court_state, msg)) {
			return null;
		}
		return last_v2_multi_display_state;
	}

	function _apply_v2_score_update_to_display_state(msg) {
		return _apply_v2_incremental_update_to_display_state(msg, _apply_v2_score_update_to_court_state);
	}

	function _apply_v2_score_update_to_multi_display_state(msg) {
		return _apply_v2_incremental_update_to_multi_display_state(msg, _apply_v2_score_update_to_court_state);
	}

	function _merge_v2_tournament_assets(msg) {
		if (!msg || !msg.tournament) {
			return msg;
		}
		if (
			msg.tournament.logo_url ||
			msg.tournament.logo_background_color ||
			msg.tournament.logo_foreground_color
		) {
			last_v2_tournament_assets = {
				logo_assets_version: msg.tournament.logo_assets_version || null,
				logo_url: msg.tournament.logo_url || null,
				logo_background_color: msg.tournament.logo_background_color || '#000000',
				logo_foreground_color: msg.tournament.logo_foreground_color || '#aaaaaa',
			};
			return msg;
		}
		if (last_v2_tournament_assets) {
			msg.tournament.logo_url = last_v2_tournament_assets.logo_url;
			msg.tournament.logo_background_color = last_v2_tournament_assets.logo_background_color;
			msg.tournament.logo_foreground_color = last_v2_tournament_assets.logo_foreground_color;
		}
		return msg;
	}

	function _update_v2_court_list_from_multi_state(msg) {
		var court_states = msg && msg.court_states ? msg.court_states : [];
		state.btsh_courts = court_states.map(function(court_state) {
			var court = court_state && court_state.court ? court_state.court : {};
			return {
				id: court.id,
				label: court.label != null ? String(court.label) : '',
				match_id: court_state && court_state.match && court_state.match.id,
			};
		});
		if (bts_update_courts_callback && bts_update_courts_callback != null) {
			bts_update_courts_callback(null, state.btsh_courts);
		}
	}

	function _update_v2_court_list_from_picker_state(msg) {
		var courts = msg && msg.courts ? msg.courts : [];
		state.btsh_courts = courts.map(function(court) {
			return {
				id: court.court_id,
				label: court.court_num != null ? String(court.court_num) : '',
				match_id: court.match && court.match.id,
			};
		});
		if (bts_update_courts_callback && bts_update_courts_callback != null) {
			bts_update_courts_callback(null, state.btsh_courts);
		}
		_render_court_picker();
	}

	function _apply_v2_court_to_settings(court_id) {
		if (!state || !state.settings) {
			return;
		}
		state.settings.court_id = court_id || '';
		state.settings.displaymode_court_id = court_id || '';
		[
			'.settings [name="court_select"]',
			'.settings [name="displaymode_court_id"]',
		].forEach(function(selector) {
			var select = document.querySelector(selector);
			if (!select) {
				return;
			}
			if (!court_id && !select.querySelector('option[value=""]')) {
				uiu.el(select, 'option', { value: '' }, '--');
			}
			select.value = court_id || '';
		});
	}

	function _apply_v2_display_settings(display_settings) {
		if (!state || !state.settings || !display_settings) {
			return;
		}
		if (display_settings.style) {
			state.settings.displaymode_style = display_settings.style;
		}
		if (typeof display_settings.displaymode_reverse_order === 'boolean') {
			state.settings.displaymode_reverse_order = display_settings.displaymode_reverse_order;
		}
		[
			'd_c0',
			'd_cb0',
			'd_c1',
			'd_cb1',
			'd_cbg',
			'd_cfg',
			'd_cfgdark',
			'd_cbg2',
			'd_cbg3',
			'd_cbg4',
			'd_cfg2',
			'd_cfg3',
			'd_cexp',
			'd_cborder',
			'd_ct',
			'd_ctim_blue',
			'd_ctim_active',
			'd_cserv',
			'd_cserv2',
			'd_crecv',
			'd_scale',
			'd_team_colors',
			'd_show_pause',
			'd_show_court_number',
			'd_show_competition',
			'd_show_round',
			'd_show_players',
			'd_show_team_name',
			'd_show_middle_name',
			'd_abbreviate_first_name',
			'd_show_doubles_receiving',
			'd_tournament_overview_courts',
		].forEach(function(key) {
			if (display_settings[key] !== undefined) {
				state.settings[key] = display_settings[key];
			}
		});
		if (typeof display_settings.show_second_given_name === 'boolean') {
			state.settings.d_show_middle_name = display_settings.show_second_given_name;
		}
		if (typeof display_settings.fullscreen_ask === 'string' && display_settings.fullscreen_ask) {
			state.settings.fullscreen_ask = display_settings.fullscreen_ask;
		}
	}

	function _apply_v2_display_identity(display, client_mode) {
		if (!state || !state.settings || !display) {
			return;
		}
		state.settings.devicemode = client_mode === 'umpire' ? 'umpire' : 'display';
		state.settings.client_id = display.client_id || '';
		state.settings.hostname = display.hostname || '';
		state.settings.monitor_label = display.monitor_label || display.client_id || '';
	}

	function _ensure_v2_display_background() {
		if (!state) {
			return;
		}
		state.ui.displaymode_visible = true;
		if (typeof refmode_referee_ui !== 'undefined' && refmode_referee_ui && typeof refmode_referee_ui.hide === 'function') {
			refmode_referee_ui.hide();
		}
		if (typeof render !== 'undefined' && render && typeof render.hide === 'function') {
			render.hide();
		}
		uiu.show_qs('.displaymode_layout');
		uiu.addClass_qs('.settings_layout', 'settings_layout_displaymode');
		if (state.initialized) {
			control.stop_match(state);
		}
		settings.hide_displaymode();
		settings.hide(true, true);
		state.ui.settings_visible = false;
		state.ui.displaymode_settings_visible = false;
		[
			'#settings_wrapper',
			'.setup_network_container',
			'.import_container',
			'#setup_manual_form',
			'.settings_network_login_container',
		].forEach(function(selector) {
			var container = document.querySelector(selector);
			if (container) {
				uiu.hide(container);
			}
		});
		[
			'.setup_network_status',
			'#setup_network_matches',
			'.setup_network_message',
		].forEach(function(selector) {
			var container = document.querySelector(selector);
			if (container) {
				uiu.empty(container);
			}
		});
		document.querySelectorAll('.modal-wrapper').forEach(function(container) {
			uiu.remove(container);
		});
	}

	function _ensure_v2_umpire_background() {
		if (!state) {
			return;
		}
		if (typeof displaymode !== 'undefined' && displaymode && typeof displaymode.hide === 'function') {
			displaymode.hide();
		} else {
			var display_layout = document.querySelector('.displaymode_layout');
			if (display_layout) {
				if (typeof autosize !== 'undefined' && autosize && typeof autosize.unmaintain_all === 'function') {
					autosize.unmaintain_all(display_layout);
				}
				uiu.empty(display_layout);
				uiu.hide(display_layout);
			}
			uiu.removeClass_qs('.settings_layout', 'settings_layout_displaymode');
			state.ui.displaymode_visible = false;
		}
		settings.hide_displaymode();
		uiu.removeClass_qs('.settings_layout', 'settings_layout_displaymode');
		state.ui.displaymode_visible = false;
		state.ui.displaymode_settings_visible = false;
		if (typeof refmode_referee_ui !== 'undefined' && refmode_referee_ui && typeof refmode_referee_ui.hide === 'function') {
			refmode_referee_ui.hide();
		}
		settings.on_mode_change(state);
	}

	function _send_v2_render_ack(msg, started_ts, ok, error) {
		if (!msg || !msg.message_id) {
			return;
		}
		var send_ack = function() {
			ws_send({
				type: 'display_rendered',
				tournament_key: tournament_key,
				message_id: msg.message_id,
				payload_type: msg.type || null,
				ok: ok !== false,
				error: error ? String(error.message || error) : null,
				render_ms: Math.max(0, Date.now() - started_ts),
			});
		};
		if (typeof window !== 'undefined' && window.requestAnimationFrame) {
			window.requestAnimationFrame(send_ack);
		} else {
			setTimeout(send_ack, 0);
		}
	}

	function _apply_v2_debug_flag_from_msg(msg) {
		if (v2_debug_forced_by_url || !msg) {
			return;
		}
		if (typeof msg.debug_output_enabled === 'boolean') {
			v2_debug = msg.debug_output_enabled;
		} else if (msg.val && typeof msg.val.bts_debug_output_enabled === 'boolean') {
			v2_debug = msg.val.bts_debug_output_enabled;
		}
	}

	function _handle_v2_display_state(msg) {
		var started_ts = Date.now();
		var ok = false;
		var render_error = null;
		try {
			msg = _merge_v2_tournament_assets(msg);
			_apply_v2_debug_flag_from_msg(msg);
			if (v2_debug) {
				console.log('[bup v2] display_state received', {
					ts: Date.now(),
					court_id: msg && msg.court ? msg.court.id : null,
					match_id: msg && msg.match ? msg.match.id : null,
				});
			}
			_apply_v2_court_to_settings(msg && msg.court ? msg.court.id : '');
			_apply_v2_display_settings(msg && msg.display_settings);
			_apply_v2_display_identity(msg && msg.display, msg && msg.client_mode);
			delete msg.v2_changed_court_id;
			delete msg.v2_changed_update_type;
			last_v2_display_state = msg;
			last_v2_multi_display_state = null;
			_ensure_v2_display_background();
			if (displaymode.render_v2_display_state && displaymode.render_v2_display_state(state, msg)) {
				ok = true;
				return;
			}
			throw new Error('V2 display_state renderer did not handle payload');
		} catch (err) {
			render_error = err;
			throw err;
		} finally {
			_send_v2_render_ack(msg, started_ts, ok, render_error);
		}
	}

	function _handle_v2_display_multi_state(msg) {
		var started_ts = Date.now();
		var ok = false;
		var render_error = null;
		try {
			msg = _merge_v2_tournament_assets(msg);
			_apply_v2_debug_flag_from_msg(msg);
			if (v2_debug) {
				console.log('[bup v2] display_multi_state received', {
					ts: Date.now(),
					courts: msg && msg.court_states ? msg.court_states.length : 0,
					selected_court_id: msg ? msg.selected_court_id : null,
				});
			}
			_apply_v2_court_to_settings(msg && msg.selected_court_id ? msg.selected_court_id : '');
			_apply_v2_display_settings(msg && msg.display_settings);
			_apply_v2_display_identity(msg && msg.display, msg && msg.client_mode);
			delete msg.v2_changed_court_id;
			delete msg.v2_changed_update_type;
			last_v2_display_state = null;
			last_v2_multi_display_state = msg;
			_update_v2_court_list_from_multi_state(msg);
			_ensure_v2_display_background();
			if (displaymode.render_v2_display_state && displaymode.render_v2_display_state(state, msg)) {
				ok = true;
				return;
			}
			throw new Error('V2 display_multi_state renderer did not handle payload');
		} catch (err) {
			render_error = err;
			throw err;
		} finally {
			_send_v2_render_ack(msg, started_ts, ok, render_error);
		}
	}

	function _handle_v2_display_incremental_update(msg, log_name, apply_to_court_state) {
		var started_ts = Date.now();
		var ok = false;
		var render_error = null;
		try {
			_apply_v2_debug_flag_from_msg(msg);
			if (v2_debug) {
				console.log('[bup v2] ' + log_name + ' received', {
					ts: Date.now(),
					court_id: msg ? msg.court_id : null,
					match_id: msg ? msg.match_id : null,
				});
			}
			var next_display_state = last_v2_multi_display_state
				? _apply_v2_incremental_update_to_multi_display_state(msg, apply_to_court_state)
				: _apply_v2_incremental_update_to_display_state(msg, apply_to_court_state);
			if (!next_display_state) {
				network.errstate('btsh.score', {
					type: 'error',
					msg: 'Could not apply V2 ' + log_name + ' to current event',
				});
				return;
			}
			next_display_state.v2_changed_court_id = msg.court_id || null;
			next_display_state.v2_changed_update_type = msg.type || null;
			_ensure_v2_display_background();
			if (displaymode.render_v2_display_score_update && displaymode.render_v2_display_score_update(state, next_display_state)) {
				ok = true;
				return;
			}
			throw new Error('V2 display_score_update renderer did not handle payload');
		} catch (err) {
			render_error = err;
			throw err;
		} finally {
			_send_v2_render_ack(msg, started_ts, ok, render_error);
		}
	}

	function _handle_v2_display_score_update(msg) {
		_handle_v2_display_incremental_update(msg, 'display_score_update', _apply_v2_score_update_to_court_state);
	}

	function _handle_v2_display_points_update(msg) {
		_handle_v2_display_incremental_update(msg, 'display_points_update', _apply_v2_points_update_to_court_state);
	}

	function _handle_v2_display_timer_update(msg) {
		_handle_v2_display_incremental_update(msg, 'display_timer_update', _apply_v2_timer_update_to_court_state);
	}

	function _v2_picker_state_to_event(msg) {
		var event = {
			id: msg && msg.tournament && msg.tournament.key ? 'bts_' + msg.tournament.key : 'bts',
			tournament_name: msg && msg.tournament ? msg.tournament.name : '',
			courts: [],
			matches: [],
		};
		(msg && msg.courts ? msg.courts : []).forEach(function(court) {
			if (!court || !court.court_id) {
				return;
			}
			var match_id = court.match && court.match.id ? 'bts_' + court.match.id.replace(/^bts_/, '') : null;
			event.courts.push({
				court_id: court.court_id,
				label: court.court_num != null ? String(court.court_num) : '',
				match_id: match_id,
			});
			if (!court.match) {
				return;
			}
			var setup = court.match.setup || {};
			setup.match_id = match_id;
			setup.event_name = setup.event_name || court.match.event_name || '';
			setup.match_name = setup.match_name || court.match.round_name || '';
			setup.is_doubles = !!setup.is_doubles;
			setup.teams = setup.teams || [
				{ players: [{ name: court.match.team1 || 'N.N.' }] },
				{ players: [{ name: court.match.team2 || 'N.N.' }] },
			];
			event.matches.push({
				setup: setup,
				network_score: court.match.network_score || [],
			});
		});
		return event;
	}

	function _handle_v2_court_picker_state(msg) {
		var started_ts = Date.now();
		var ok = false;
		var render_error = null;
		try {
			_apply_v2_debug_flag_from_msg(msg);
			if (v2_debug) {
				console.log('[bup v2] court_picker_state received', {
					ts: Date.now(),
					courts: msg && msg.courts ? msg.courts.length : 0,
				});
			}
			if (!btsh_court_selection_pending) {
				_apply_v2_court_to_settings('');
			}
			_apply_v2_display_settings(msg && msg.display_settings);
			_apply_v2_display_identity(msg && msg.display, msg && msg.client_mode);
			last_v2_display_state = null;
			last_v2_multi_display_state = null;
			_update_v2_court_list_from_picker_state(msg);
			if (msg && msg.client_mode === 'umpire') {
				state.bts_event = _v2_picker_state_to_event(msg);
				if (bts_update_callback != null) {
					bts_update_callback(null, state, state.bts_event);
				}
				_ensure_v2_umpire_background();
				if (!btsh_court_selection_pending) {
					settings.show();
					settings.on_mode_change(state);
				}
				ok = true;
				return;
			}
			_ensure_v2_display_background();
			if (displaymode.render_v2_display_state && displaymode.render_v2_display_state(state, msg)) {
				ok = true;
				return;
			}
			throw new Error('V2 court_picker renderer did not handle payload');
		} catch (err) {
			render_error = err;
			throw err;
		} finally {
			_send_v2_render_ack(msg, started_ts, ok, render_error);
		}
	}

	function _presses_signature(presses) {
		if (!presses || presses.length === 0) {
			return '0';
		}
		var last_press = presses[presses.length - 1] || {};
		return [
			presses.length,
			last_press.type || '',
			last_press.timestamp || '',
		].join(':');
	}

	function _normalize_bts_match_id(match_id) {
		return String(match_id || '').replace(/^bts_/, '');
	}

	function _command_matches_current_match(command) {
		if (!command || (!command.match_id && !command.raw_match_id)) {
			return true;
		}
		var current_match_id = state && state.metadata ? String(state.metadata.id || '') : '';
		var normalized_current_match_id = _normalize_bts_match_id(current_match_id);
		return (
			_normalize_bts_match_id(command.match_id) === normalized_current_match_id ||
			_normalize_bts_match_id(command.raw_match_id) === normalized_current_match_id
		);
	}

	function _apply_confirm_match_finished_command(command) {
		if (!state || !state.initialized || !state.match || !state.presses || !state.metadata) {
			if (v2_debug) console.log('[bup] confirm-match-finished ignored: no active local match', {
				ts: Date.now(),
				command: command || null,
			});
			return false;
		}
		if (!_command_matches_current_match(command)) {
			if (v2_debug) console.log('[bup] confirm-match-finished ignored: match id mismatch', {
				ts: Date.now(),
				current_match_id: state.metadata.id || null,
				command: command || null,
			});
			return false;
		}
		if (state.match.finish_confirmed) {
			return true;
		}
		if (!state.match.finished) {
			if (v2_debug) console.log('[bup] confirm-match-finished ignored: local match not finished yet', {
				ts: Date.now(),
				current_match_id: state.metadata.id || null,
				command: command || null,
			});
			return false;
		}
		try {
			state.presses.push({
				type: 'postmatch-confirm',
				timestamp: (command && command.timestamp) || Date.now(),
			});
			calc.state(state);
			render.show();
			render.ui_render(state);
			if (v2_debug) console.log('[bup] confirm-match-finished applied locally', {
				ts: Date.now(),
				current_match_id: state.metadata.id || null,
				finish_confirmed: state.match ? state.match.finish_confirmed : null,
			});
			return true;
		} catch (err) {
			console.error('[bup] confirm-match-finished local apply failed', err);
			return false;
		}
	}

	function _apply_current_match_update_from_event(event) {
		if (!state || !state.initialized || !state.metadata || !event || !event.matches) {
			return;
		}
		var current_match_id = String(state.metadata.id || '');
		var normalized_current_match_id = _normalize_bts_match_id(current_match_id);
		var match = event.matches.find(function(candidate) {
			if (!candidate || !candidate.setup) {
				return false;
			}
			var candidate_match_id = String(candidate.setup.match_id || '');
			return (
				candidate_match_id === current_match_id ||
				_normalize_bts_match_id(candidate_match_id) === normalized_current_match_id
			);
		});
		if (!match && event.matches.length === 1) {
			match = event.matches[0];
			if (v2_debug) console.log('[bup v2] current match update using single-match fallback', {
				ts: Date.now(),
				current_match_id: current_match_id,
				event_match_id: match && match.setup ? match.setup.match_id : null,
			});
		}
		if (!match) {
			if (v2_debug) console.log('[bup v2] current match update skipped: no matching event match', {
				ts: Date.now(),
				current_match_id: current_match_id,
				event_match_ids: event.matches.map(function(candidate) {
					return candidate && candidate.setup ? candidate.setup.match_id : null;
				}),
			});
			return;
		}
		var server_presses = eventutils.get_presses(match);
		if (!server_presses) {
			if (v2_debug) console.log('[bup v2] current match update skipped: no server presses', {
				ts: Date.now(),
				match_id: match && match.setup ? match.setup.match_id : null,
				state: match && match.setup ? match.setup.state : null,
			});
			return;
		}
		if (_presses_signature(server_presses) === _presses_signature(state.presses)) {
			if (v2_debug) console.log('[bup v2] current match update skipped: presses unchanged', {
				ts: Date.now(),
				match_id: match && match.setup ? match.setup.match_id : null,
				signature: _presses_signature(server_presses),
			});
			return;
		}
		var server_has_confirmation = server_presses.some(function(press) {
			return press && press.type === 'postmatch-confirm';
		});
		if (!server_has_confirmation && !(match.setup && match.setup.state === 'finished')) {
			if (v2_debug) console.log('[bup v2] current match update skipped: not a finished confirmation update', {
				ts: Date.now(),
				match_id: match && match.setup ? match.setup.match_id : null,
				server_press_count: server_presses.length,
				server_last_press: server_presses.length ? server_presses[server_presses.length - 1] : null,
				state: match && match.setup ? match.setup.state : null,
			});
			return;
		}
		try {
			calc.init_state(state, match.setup, server_presses);
			calc.state(state);
			render.show();
			render.ui_render(state);
			if (v2_debug) console.log('[bup v2] current match updated from server', {
				ts: Date.now(),
				match_id: match && match.setup ? match.setup.match_id : null,
				server_press_count: server_presses.length,
				server_last_press: server_presses.length ? server_presses[server_presses.length - 1] : null,
				finish_confirmed: state.match ? state.match.finish_confirmed : null,
			});
		} catch (err) {
			console.error('[bup v2] current match update failed', err);
		}
	}

	function _release_match_if_active(val) {
		if (!state || !state.initialized || !state.metadata || !val || !val.match_id) {
			return false;
		}
		var active_match_id = String(state.metadata.id || '').replace(/^bts_/, '');
		var release_match_id = String(val.match_id || '').replace(/^bts_/, '');
		if (active_match_id !== release_match_id) {
			return false;
		}
		if (v2_debug) console.log('[bup v2] releasing active match opened on another tablet', {
			ts: Date.now(),
			match_id: release_match_id,
			court_id: val.court_id || null,
			owner_client_id: val.owner_client_id || null,
		});
		control.stop_match(state);
		settings.show();
		control.set_current(state);
		return true;
	}

	function default_change_handler(c) {
		if (!c || !c.ctype) {
			return;
		}
		switch (c.ctype) {
			case 'score-update':
				if (!c.val || !c.val.event) {
					send_command_done(c);
					return;
				}
				var score_update_signature = _score_event_signature(c.val && c.val.event);
				if (score_update_signature === last_received_score_update_signature) {
					send_command_done(c);
					return;
				}
				last_received_score_update_signature = score_update_signature;
				state.bts_event = _filter_event_to_assigned_court(c.val.event) || { matches: [] };
				if (v2_debug) console.log('[bup v2] score-update received', {
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
				_apply_current_match_update_from_event(state.bts_event);
				if (bts_update_callback != null) {
					bts_update_callback(null, state, state.bts_event);
					var first_match = state.bts_event && state.bts_event.matches ? state.bts_event.matches[0] : null;
					if (
						state.settings.court_id != '' &&
						first_match &&
						first_match.end_ts != null
					) {
						if (v2_debug) console.log('[bup v2] score-update scheduling reload_match_information', {
							ts: Date.now(),
							court_id: state && state.settings ? state.settings.court_id : null,
							first_match_id: first_match && first_match.setup ? first_match.setup.match_id : null,
							first_match_end_ts: first_match ? first_match.end_ts : null,
						});
						setTimeout(reload_match_information, 60000);
					}
				}
				_render_court_picker();
				break;
			case 'settings-update':
				_apply_v2_debug_flag_from_msg(c);
				var previous_settings = state.settings || settings.load();
				var next_settings = utils.deep_copy(settings.default_settings);
				utils.obj_update(next_settings, previous_settings);
				if (c.val) {
					utils.obj_update(next_settings, c.val);
				}
				if (
					(!c.val || !Object.prototype.hasOwnProperty.call(c.val, 'tablet_mode'))
					&& previous_settings
					&& previous_settings.tablet_mode
				) {
					next_settings.tablet_mode = previous_settings.tablet_mode;
				}
				if (
					(next_settings.tablet_mode !== 'umpire') &&
					(next_settings.tablet_mode !== 'scorecard') &&
					(next_settings.tablet_mode !== 'scorecard_with_attendance')
				) {
					next_settings.tablet_mode = 'umpire';
				}
				var had_assigned_court = !!(
					previous_settings &&
					previous_settings.court_id &&
					previous_settings.court_id !== 'referee'
				);
				var lost_assigned_court = (
					had_assigned_court &&
					(!next_settings.court_id || next_settings.court_id === 'referee')
				);
				var has_assigned_court = !!(
					next_settings &&
					next_settings.court_id &&
					next_settings.court_id !== 'referee'
				);
				var local_court_selection_applied = !!(
					btsh_court_selection_pending &&
					has_assigned_court &&
					String(btsh_court_selection_pending) === String(next_settings.court_id)
				);
				var court_changed = (
					previous_settings &&
					Object.prototype.hasOwnProperty.call(next_settings, 'court_id') &&
					String(previous_settings.court_id || '') !== String(next_settings.court_id || '')
				);
				var switched_to_umpire = (
					previous_settings &&
					previous_settings.devicemode !== 'umpire' &&
					next_settings.devicemode === 'umpire'
				);
				var switched_to_display = (
					previous_settings &&
					previous_settings.devicemode !== 'display' &&
					next_settings.devicemode === 'display'
				);
				state.settings = next_settings;
				state.dads = (c.val && c.val.advertisements) ? c.val.advertisements : [];
				if (has_assigned_court) {
					btsh_court_selection_pending = null;
				}
				if (switched_to_umpire) {
					_ensure_v2_umpire_background();
				} else if (switched_to_display) {
					_ensure_v2_display_background();
				}
				settings.update(state);
				settings.on_mode_change(state);
				if (
					local_court_selection_applied &&
					settings.get_mode(state) === 'umpire'
				) {
					settings.hide(true);
					settings.on_mode_change(state);
				} else if (
					(switched_to_umpire || lost_assigned_court || court_changed) &&
					settings.get_mode(state) === 'umpire'
				) {
					if (state.ui) {
						state.ui.scorecard_editor_visible = false;
					}
					if (state.initialized) {
						control.stop_match(state);
					}
					settings.show();
					settings.on_mode_change(state);
				}
				_render_court_picker();
				break;
			case 'confirm-match-finished':
				confirm_match_finished(c.val);
				break;
			case 'release-match':
				_release_match_if_active(c.val);
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
					_ensure_v2_umpire_background();
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

	function match_opened(s) {
		if (!s || !s.settings || s.settings.court_id === 'referee' || !s.setup || !/^bts_/.test(s.setup.match_id || '')) {
			return;
		}
		ws_send({
			type: 'match_opened',
			tournament_key: tournament_key,
			court_id: s.settings.court_id,
			match_id: String(s.setup.match_id).substring('bts_'.length),
			panel_settings: _panel_settings_payload(),
		});
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
		bts_connection_error_active = true;
		if (bts_update_callback && bts_update_callback != null) {
			var msg = state._('network:error:bts');
			bts_update_callback({
				type: 'network-error',
				msg: msg,
			}, state, null);
		}
	}

	function clear_bts_not_reachable() {
		network.errstate('btsh.score', null);
		if (bts_connection_error_active && bts_update_callback && bts_update_callback != null && state && state.bts_event) {
			bts_update_callback(null, state, state.bts_event || null);
		}
		bts_connection_error_active = false;
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
		match_opened: match_opened,
		reload_match_information: reload_match_information,
		send_presence_update: send_presence_update,
	};
}

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var calc = require('./calc');
	var displaymode = require('./displaymode');
	var eventutils = require('./eventutils');
	var network = require('./network');
	var refmode_client_ui = require('./refmode_client_ui');
	var render = require('./render');
	var settings = require('./settings');
	var click = require('./click');

	module.exports = btsh;
}
/*/@DEV*/
