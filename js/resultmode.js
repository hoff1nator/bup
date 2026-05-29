'use strict';
// Direct result entry mode - persistent mode that polls for the next match
// and allows entering the final score without point-by-point umpiring.

var resultmode = (function() {

var _poll_cancel = null;  // Cancellation function for the polling loop
var _current_match = null;
var _presence = [false, false];  // Which teams have confirmed presence
var _overlays_added = false;  // Track if overlays have been added
var _overlays_added_rest = false;
var _call_settings = null;  // Populated from event.call_settings on each poll
var _wake_lock = null;
var _wake_video = null;

function _acquire_wake_lock() {
	if (navigator.wakeLock) {
		navigator.wakeLock.request('screen').then(function(lock) {
			_wake_lock = lock;
			_wake_lock.addEventListener('release', function() {
				_wake_lock = null;
				if (state.ui.resultmode_visible) _acquire_wake_lock();
			});
		}).catch(function() {});
	}
	if (!_wake_video) {
		var v = document.createElement('video');
		v.setAttribute('playsinline', '');
		v.setAttribute('muted', '');
		v.muted = true;
		v.setAttribute('loop', '');
		v.style.position = 'fixed';
		v.style.width = '1px';
		v.style.height = '1px';
		v.style.opacity = '0.01';
		v.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAB9tZGF0AAAADGdkAAoT////AAADAAMAAAMAAAADAB4AAAADbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAEAAAABAAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAACUdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAEAAAAAAIAAAABQAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAACAAAAAAAAAAAAEAAAAAALxtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAAAAACAAAAAgVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAZ21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAC1zdGJsAAAAsXN0c2QAAAAAAAAAAQAAAKFhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAIAAUAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY//8AAAAvYXZjQwFkAAr/4QAZZAAK1ADAIAACAB5IAAADAG4KgMBgAAADAAUeKBYnZgEAABhzdHRzAAAAAAAAAAEAAAABAAABAAAAAAx0c2MAAAAAAAABAAAAAQAAABRzdHNzAAAAAAAAAAEAAAABAAAAKHN0c3oAAAAAAAAAAAAAAAEAAAMGAAAAFHN0Y28AAAAAAAAAAQAAABQ=';
		document.body.appendChild(v);
		v.play().catch(function() {});
		_wake_video = v;
	}
}

function _release_wake_lock() {
	if (_wake_lock) {
		_wake_lock.release().catch(function() {});
		_wake_lock = null;
	}
	if (_wake_video) {
		_wake_video.pause();
		_wake_video.remove();
		_wake_video = null;
	}
}

function _max_games(counting) {
	switch (counting) {
	case '5x11_15':
	case '5x11_15^90':
	case '5x11_15~NLA':
	case '5x11/3':
	case '5x11_11':
		return 5;
	case '3x21':
	case '3x15_18':
	case '2x21+11':
		return 3;
	case '1x21':
	case '1x11_15':
		return 1;
	default:
		return 3;
	}
}

function _winning_games(counting) {
	switch (counting) {
	case '5x11_15':
	case '5x11_15^90':
	case '5x11_15~NLA':
	case '5x11/3':
	case '5x11_11':
		return 3;
	case '3x21':
	case '2x21+11':
	case '3x15_18':
		return 2;
	case '1x21':
	case '1x11_15':
		return 1;
	default:
		return 2;
	}
}

function _players_str(setup, team_idx) {
	var team = setup.teams[team_idx];
	if (!team || !team.players || team.players.length === 0) {
		return 'N.N.';
	}
	if (setup.is_doubles) {
		var p2 = (team.players.length > 1) ? team.players[1].name : 'N.N.';
		return team.players[0].name + ' / ' + p2;
	}
	return team.players[0].name;
}

function _collect_scores(container) {
	var rows = container.querySelectorAll('.resultmode_game_row');
	var game_scores = [];
	for (var i = 0; i < rows.length; i++) {
		var inputs = rows[i].querySelectorAll('input');
		game_scores.push([inputs[0].value.trim(), inputs[1].value.trim()]);
	}
	return game_scores;
}

function _numeric_scores(game_scores) {
	return game_scores.map(function(gs) {
		return [parseInt(gs[0], 10), parseInt(gs[1], 10)];
	});
}

function _validate_scores(counting, game_scores) {
	var results = [];
	for (var i = 0; i < game_scores.length; i++) {
		var gs = game_scores[i];
		if (gs[0] === '' && gs[1] === '') {
			results.push('empty');
			continue;
		}
		var l = parseInt(gs[0], 10);
		var r = parseInt(gs[1], 10);
		if (isNaN(l) || isNaN(r) || l < 0 || r < 0) {
			results.push('invalid');
			continue;
		}
		results.push(calc.game_winner(counting, i, l, r));
	}
	return results;
}

function _update_validation(container, counting) {
	var game_scores = _collect_scores(container);
	var validations = _validate_scores(counting, game_scores);
	var rows = container.querySelectorAll('.resultmode_game_row');

	var left_wins = 0;
	var right_wins = 0;
	var match_decided_at = -1;
	var winning_count = _winning_games(counting);

	for (var i = 0; i < validations.length; i++) {
		var row = rows[i];
		row.classList.remove('resultmode_left', 'resultmode_right', 'resultmode_invalid', 'resultmode_empty', 'resultmode_inprogress', 'resultmode_decided');
		if (validations[i] === 'left') left_wins++;
		if (validations[i] === 'right') right_wins++;
		if (match_decided_at === -1 && (left_wins >= winning_count || right_wins >= winning_count)) {
			match_decided_at = i;
		}
		row.classList.add('resultmode_' + validations[i]);
	}

	for (var j = 0; j < rows.length; j++) {
		if (match_decided_at !== -1 && j > match_decided_at) {
			rows[j].classList.add('resultmode_decided');
		}
	}

	var complete_scores = [];
	for (var k = 0; k <= match_decided_at; k++) {
		if (validations[k] !== 'left' && validations[k] !== 'right') {
			match_decided_at = -1;
			break;
		}
		complete_scores.push(game_scores[k]);
	}

	var confirm_btn = container.querySelector('.resultmode_confirm_btn');
	if (match_decided_at !== -1) {
		confirm_btn.removeAttribute('disabled');
	} else {
		confirm_btn.setAttribute('disabled', 'disabled');
	}

	return {
		decided: match_decided_at !== -1,
		complete_scores: complete_scores,
		match_winner: match_decided_at !== -1 ? (left_wins >= winning_count ? 'left' : 'right') : null,
	};
}

function _build_presses(setup, numeric_scores) {
	var ts = Date.now();
	var presses = [];

	if (numeric_scores.length > 1) {
		presses.push({
			type: 'editmode_set-finished_games',
			scores: numeric_scores.slice(0, numeric_scores.length - 1),
			by_side: false,
			timestamp: ts,
		});
	}

	presses.push({
		type: 'editmode_set-score',
		score: numeric_scores[numeric_scores.length - 1],
		by_side: false,
		resumed: true,
		timestamp: ts + 1,
	});

	presses.push({
		type: 'postmatch-confirm',
		timestamp: ts + 2,
	});

	return presses;
}

// Helper: get court label from event data
function _get_court_label(event) {
	var my_court_id = state.settings.court_id;
	if (!my_court_id) return '';
	var courts = (event && event.courts) || (state.event && state.event.courts);
	if (courts) {
		var court = courts.find(function(c) {
			return c.court_id == my_court_id || c.id == my_court_id;
		});
		if (court) return court.description || court.label || my_court_id;
	}
	return my_court_id;
}

// Helper: build team header
function _build_header(setup) {
	var header = document.createElement('div');
	header.className = 'resultmode_header';

	var team1_el = document.createElement('div');
	team1_el.className = 'resultmode_team resultmode_team1';
	team1_el.textContent = _players_str(setup, 0);
	header.appendChild(team1_el);

	var vs_el = document.createElement('div');
	vs_el.className = 'resultmode_vs';
	vs_el.textContent = 'vs';
	header.appendChild(vs_el);

	var team2_el = document.createElement('div');
	team2_el.className = 'resultmode_team resultmode_team2';
	team2_el.textContent = _players_str(setup, 1);
	header.appendChild(team2_el);

	return header;
}

function _is_tshirt_round(setup, event) {
	if (!event || !event.tshirt_enabled) return false;
	return setup.round_name === 'HF';
}

function _get_all_players(setup) {
	var players = [];
	for (var t = 0; t < 2; t++) {
		var team = setup.teams[t];
		if (!team || !team.players) continue;
		for (var p = 0; p < team.players.length; p++) {
			var pl = team.players[p];
			if (pl.name) {
				players.push({
					name: pl.name,
					firstname: pl.firstname || '',
					lastname: pl.lastname || '',
					team_idx: t,
					player_idx: p,
				});
			}
		}
	}
	return players;
}

var _tshirt_sizes = {};

function _show_tshirt_selection(match, event) {
	var setup = match.setup;
	var layout = document.querySelector('.resultmode_layout');
	layout.innerHTML = '';

	layout.appendChild(_build_header(setup));

	var headline = document.createElement('div');
	headline.className = 'resultmode_presence_headline';
	headline.textContent = (state.lang === 'de') ? 'T-Shirt Größe wählen' : 'Select T-Shirt Size';
	layout.appendChild(headline);

	var SIZES = (event && event.tshirt_sizes) ? event.tshirt_sizes.split(',') : ['XS', 'S', 'M', 'L', 'XL'];
	var players = _get_all_players(setup);
	_tshirt_sizes = {};
	_tshirt_team_sent = [false, false];

	var container = document.createElement('div');
	container.className = 'resultmode_tshirt_container';

	for (var i = 0; i < players.length; i++) {
		(function(player, idx) {
			var row = document.createElement('div');
			row.className = 'resultmode_tshirt_row';

			var name_el = document.createElement('div');
			name_el.className = 'resultmode_tshirt_name';
			name_el.textContent = player.name;
			row.appendChild(name_el);

			var btns_el = document.createElement('div');
			btns_el.className = 'resultmode_tshirt_buttons';

			for (var s = 0; s < SIZES.length; s++) {
				(function(size) {
					var btn = document.createElement('button');
					btn.className = 'resultmode_tshirt_btn';
					btn.textContent = size;
					btn.addEventListener('click', function() {
						_tshirt_sizes[idx] = size;
						var siblings = btns_el.querySelectorAll('.resultmode_tshirt_btn');
						for (var b = 0; b < siblings.length; b++) siblings[b].classList.remove('resultmode_tshirt_selected');
						btn.classList.add('resultmode_tshirt_selected');
						_check_tshirt_complete(match, players);
					});
					btns_el.appendChild(btn);
				})(SIZES[s]);
			}

			row.appendChild(btns_el);
			container.appendChild(row);
		})(players[i], i);
	}

	layout.appendChild(container);

	var ready_el = document.createElement('div');
	ready_el.className = 'resultmode_tshirt_ready';
	ready_el.id = 'tshirt_ready';
	ready_el.textContent = (state.lang === 'de') ? 'Warte auf alle Größen\u2026' : 'Waiting for all sizes\u2026';
	layout.appendChild(ready_el);
}

var _tshirt_team_sent = [false, false];

function _check_tshirt_team_presence(match, players) {
	for (var t = 0; t < 2; t++) {
		if (_tshirt_team_sent[t]) continue;
		var team_done = true;
		for (var i = 0; i < players.length; i++) {
			if (players[i].team_idx === t && !_tshirt_sizes[i]) {
				team_done = false;
				break;
			}
		}
		if (team_done) {
			_tshirt_team_sent[t] = true;
			var team_key = (t === 0) ? 'team1_present' : 'team2_present';
			var update = {};
			update[team_key] = true;
			network.send_setup_update(state, match.setup.match_id, update, function() {});
		}
	}
}

function _check_tshirt_complete(match, players) {
	_check_tshirt_team_presence(match, players);

	var all_selected = true;
	for (var i = 0; i < players.length; i++) {
		if (!_tshirt_sizes[i]) { all_selected = false; break; }
	}
	var ready_el = document.getElementById('tshirt_ready');
	if (!all_selected) {
		if (ready_el) {
			ready_el.textContent = (state.lang === 'de') ? 'Warte auf alle Größen\u2026' : 'Waiting for all sizes\u2026';
			ready_el.classList.remove('resultmode_tshirt_ready_done');
		}
		return;
	}

	var player_data = [];
	var event_name = match.setup.event_name || '';
	for (var i = 0; i < players.length; i++) {
		player_data.push({
			firstname: players[i].firstname,
			lastname: players[i].lastname,
			name: players[i].name,
			event_name: event_name,
			size: _tshirt_sizes[i],
		});
	}

	if (ready_el) {
		ready_el.textContent = (state.lang === 'de') ? 'Wird gespeichert\u2026' : 'Saving\u2026';
		ready_el.classList.add('resultmode_tshirt_ready_done');
	}

	network.send_tshirt_sizes(state, match.setup.match_id, player_data, function() {
		network.send_setup_update(state, match.setup.match_id, {teams_present: true, team1_present: true, team2_present: true}, function() {
			match.setup.teams_present = true;
			_show_score_entry(match);
		});
	});
}

function _show_match(match, event) {
	_current_match = match;
	_update_match_id_label(match.setup.match_num);

	if (!match.setup.teams_present) {
		_presence = [false, false];
		if (_is_tshirt_round(match.setup, event)) {
			_show_tshirt_selection(match, event);
		} else {
			_show_presence(match);
		}
	} else {
		_show_score_entry(match);
	}
}

function _show_presence(match) {
	var setup = match.setup;
	var layout = document.querySelector('.resultmode_layout');
	layout.innerHTML = '';

	layout.appendChild(_build_header(setup));

	var presence_headline = document.createElement('div');
	presence_headline.className = 'resultmode_presence_headline';
	presence_headline.textContent = (state.lang === 'de') ? 'Spieler Anwesend' : 'Players Reporting Present';
	layout.appendChild(presence_headline);

	var presence_container = document.createElement('div');
	presence_container.className = 'resultmode_presence_container';

	var btns = [];
	for (var i = 0; i < 2; i++) {
		(function(team_idx) {
			var btn = document.createElement('button');
			btn.className = 'resultmode_presence_btn';
			btn.textContent = _players_str(setup, team_idx);
			btns.push(btn);
			btn.addEventListener('click', function() {
				_presence[team_idx] = true;
				btn.classList.add('resultmode_presence_confirmed');
				var team_key = (team_idx === 0) ? 'team1_present' : 'team2_present';
				var update = {};
				update[team_key] = true;
				if (_presence[0] && _presence[1]) {
					update.teams_present = true;
					network.send_setup_update(state, setup.match_id, update, function() {
						match.setup.teams_present = true;
						_show_score_entry(match);
					});
				} else {
					network.send_setup_update(state, setup.match_id, update, function() {});
				}
			});
			presence_container.appendChild(btn);
		})(i);
	}

	layout.appendChild(presence_container);
}

function _show_score_entry(match) {
	var setup = match.setup;
	var counting = setup.counting;
	var max_games = _max_games(counting);

	var layout = document.querySelector('.resultmode_layout');
	layout.innerHTML = '';

	layout.appendChild(_build_header(setup));

	var game_info_parts = [];
	if (setup.event_name) game_info_parts.push(setup.event_name);
	if (setup.match_name) game_info_parts.push(setup.match_name);
	if (setup.match_num) game_info_parts.push('#' + setup.match_num);
	if (game_info_parts.length > 0) {
		var match_name_el = document.createElement('div');
		match_name_el.className = 'resultmode_match_name';
		match_name_el.textContent = game_info_parts.join(' \u2013 ');
		layout.appendChild(match_name_el);
	}

	// Score input rows
	var games_container = document.createElement('div');
	games_container.className = 'resultmode_games';

	for (var i = 0; i < max_games; i++) {
		var row = document.createElement('div');
		row.className = 'resultmode_game_row';

		var label = document.createElement('span');
		label.className = 'resultmode_game_label';
		label.textContent = state._('resultmode:set', {num: i + 1}, 'Set ' + (i + 1));
		row.appendChild(label);

		var score_inputs = document.createElement('div');
		score_inputs.className = 'resultmode_score_inputs';

		var input1 = document.createElement('input');
		input1.type = 'number';
		input1.min = '0';
		input1.max = '100';
		input1.className = 'resultmode_score_input';
		input1.placeholder = '0';
		score_inputs.appendChild(input1);

		var sep = document.createElement('span');
		sep.className = 'resultmode_score_sep';
		sep.textContent = '\u2013';
		score_inputs.appendChild(sep);

		var input2 = document.createElement('input');
		input2.type = 'number';
		input2.min = '0';
		input2.max = '100';
		input2.className = 'resultmode_score_input';
		input2.placeholder = '0';
		score_inputs.appendChild(input2);

		row.appendChild(score_inputs);
		games_container.appendChild(row);
	}

	layout.appendChild(games_container);

	var confirm_btn = document.createElement('button');
	confirm_btn.className = 'resultmode_confirm_btn';
	confirm_btn.textContent = 'Confirm Result';
	confirm_btn.setAttribute('disabled', 'disabled');
	layout.appendChild(confirm_btn);

	// Wire up live validation
	var inputs = games_container.querySelectorAll('input');
	for (var j = 0; j < inputs.length; j++) {
		inputs[j].addEventListener('input', function() {
			_update_validation(layout, counting);
		});
	}

	// Confirm button
	confirm_btn.addEventListener('click', function() {
		var result = _update_validation(layout, counting);
		if (!result.decided) return;

		var numeric = _numeric_scores(result.complete_scores);
		var winner_idx = (result.match_winner === 'left') ? 0 : 1;
		var winner_name = _players_str(setup, winner_idx);
		var score_str = numeric.map(function(s) { return s[0] + '\u2013' + s[1]; }).join(', ');

		_show_confirm_dialog(match, numeric, winner_name, score_str);
	});
}

function _add_overlays(event) {
	var wrapper = document.querySelector('.resultmode_wrapper');

	if (!_overlays_added) {
		_overlays_added = true;

		// Top-left: court/field label
		var court_el = document.createElement('div');
		court_el.className = 'resultmode_court_label';
		wrapper.appendChild(court_el);
	}

	// Update court label each poll (event data may not have been available earlier)
	var court_label_el = wrapper.querySelector('.resultmode_court_label');
	if (court_label_el) {
		court_label_el.textContent = _get_court_label(event);
	}

	if (!_overlays_added_rest) {
		_overlays_added_rest = true;

		// Bottom-left: match ID (updated per match)
		var match_id_el = document.createElement('div');
		match_id_el.className = 'resultmode_match_id_label';
		wrapper.appendChild(match_id_el);

		// Bottom-right: fullscreen toggle
		var fs_btn = document.createElement('button');
		fs_btn.className = 'resultmode_settings_btn';
		fs_btn.title = 'Fullscreen';
		fs_btn.textContent = '\u26f6';
		fs_btn.addEventListener('click', function() {
			if (document.fullscreenElement) {
				document.exitFullscreen();
			} else {
				document.documentElement.requestFullscreen();
			}
		});
		wrapper.appendChild(fs_btn);
	}
}

function _update_match_id_label(match_id) {
	var el = document.querySelector('.resultmode_match_id_label');
	if (el) {
		el.textContent = match_id ? 'Match Nummer: #' + match_id : '';
	}
}

function _show_waiting() {
	_presence = [false, false];
	_update_match_id_label('');

	var layout = document.querySelector('.resultmode_layout');
	layout.innerHTML = '';

	var waiting = document.createElement('div');
	waiting.className = 'resultmode_waiting';
	waiting.textContent = 'Waiting for next match\u2026';
	layout.appendChild(waiting);
}

function _show_confirm_dialog(match, numeric_scores, winner_name, score_str) {
	var dialog = document.querySelector('.resultmode_confirm_dialog');
	var msg_el = dialog.querySelector('.resultmode_confirm_msg');
	msg_el.textContent = winner_name + ' wins: ' + score_str;

	var ok_btn = dialog.querySelector('.resultmode_confirm_ok');
	var cancel_btn = dialog.querySelector('.resultmode_confirm_cancel');

	// Remove old listeners by replacing elements
	var new_ok = ok_btn.cloneNode(true);
	var new_cancel = cancel_btn.cloneNode(true);
	ok_btn.parentNode.replaceChild(new_ok, ok_btn);
	cancel_btn.parentNode.replaceChild(new_cancel, cancel_btn);

	new_ok.addEventListener('click', function() {
		dialog.style.display = 'none';
		_submit_result(match, numeric_scores);
	}, {once: true});

	new_cancel.addEventListener('click', function() {
		dialog.style.display = 'none';
	}, {once: true});

	dialog.style.display = 'flex';
}

function _submit_result(match, numeric_scores) {
	var presses = _build_presses(match.setup, numeric_scores);

	var tmp_state = {
		initialized: false,
		ui: {},
		settings: state.settings,
		metadata: {id: match.setup.match_id},
		event: state.event,
	};

	calc.init_state(tmp_state, match.setup, presses, true);
	calc.state(tmp_state);

	network.send_press(tmp_state, presses[presses.length - 1]);

	// Mark this match as submitted so the poller skips it
	_current_match = null;

	// Show waiting screen while polling picks up the next match
	_show_waiting();
}

function _on_poll(err, event) {
	if (err) {
		// Show error but stay in mode
		var layout = document.querySelector('.resultmode_layout');
		if (layout) {
			layout.innerHTML = '';
			var err_el = document.createElement('div');
			err_el.className = 'resultmode_waiting';
			err_el.textContent = 'Network error. Retrying\u2026';
			layout.appendChild(err_el);
		}
		return;
	}

	// Add overlays and refresh court label with fresh event data
	_add_overlays(event);

	// Update call settings from fresh event data
	_call_settings = event.call_settings || null;
	var courts_to_call_enabled = _call_settings ? _call_settings.courts_to_call_enabled : true;

	// Find the next unfinished match on this court only
	var matches = event.matches || [];
	var my_court_id = state.settings.court_id;
	var current_still_present = false;
	var next = null;
	for (var i = 0; i < matches.length; i++) {
		var m = matches[i];
		if (m.setup.incomplete) continue;
		if (my_court_id && m.setup.court_id !== my_court_id) continue;
		if (courts_to_call_enabled && !m.setup.called_to_court) continue;
		// If current match is still in the list, keep showing it (user may be entering results)
		if (_current_match && m.setup.match_id === _current_match.setup.match_id) {
			current_still_present = true;
			continue;
		}
		// Find first unfinished match
		if (!next) {
			var mwinner = m.network_score ? calc.match_winner(m.setup.counting, m.network_score) : 'inprogress';
			if (mwinner !== 'left' && mwinner !== 'right') {
				next = m;
			}
		}
	}

	if (!current_still_present && next) {
		_show_match(next, event);
	} else if (!current_still_present && !next) {
		_current_match = null;
		_show_waiting();
	}
}

function show() {
	if (state.ui.resultmode_visible) {
		return;
	}
	state.ui.resultmode_visible = true;
	_current_match = null;
	_overlays_added = false;  // Reset for new session
	_overlays_added_rest = false;

	var wrapper = document.querySelector('.resultmode_wrapper');
	wrapper.style.display = 'block';

	_show_waiting();
	_acquire_wake_lock();

	// Start polling
	if (_poll_cancel) {
		_poll_cancel();
	}
	_poll_cancel = network.subscribe(state, function(err, s, event) {
		_on_poll(err, event);
	}, function(s) {
		return s.settings.network_update_interval;
	});

	buphistory.record(state);
}

function hide() {
	_release_wake_lock();
	if (!state.ui.resultmode_visible) {
		return;
	}
	state.ui.resultmode_visible = false;
	_current_match = null;

	if (_poll_cancel) {
		_poll_cancel();
		_poll_cancel = null;
	}

	var wrapper = document.querySelector('.resultmode_wrapper');
	if (wrapper) {
		wrapper.style.display = 'none';
	}

	var dialog = document.querySelector('.resultmode_confirm_dialog');
	if (dialog) {
		dialog.style.display = 'none';
	}
}

// Called from settings when "Enter Result" is clicked in match list
function show_match(match) {
	if (!state.ui.resultmode_visible) {
		show();
	}
	_current_match = match;
	_show_match(match);
}

function ui_init() {
	// Nothing needed at startup - UI is built dynamically
}

return {
	show: show,
	hide: hide,
	show_match: show_match,
	ui_init: ui_init,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var buphistory = require('./buphistory');
	var calc = require('./calc');
	var network = require('./network');
	var settings = require('./settings');

	module.exports = resultmode;
}
/*/@DEV*/
