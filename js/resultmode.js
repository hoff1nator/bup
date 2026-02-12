'use strict';
// Direct result entry mode - persistent mode that polls for the next match
// and allows entering the final score without point-by-point umpiring.

var resultmode = (function() {

var _poll_cancel = null;  // Cancellation function for the polling loop
var _current_match = null;
var _presence = [false, false];  // Which teams have confirmed presence

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

function _show_match(match) {
	_current_match = match;
	_update_match_id_label(match.setup.match_num);

	if (!match.setup.teams_present) {
		_presence = [false, false];
		_show_presence(match);
	} else {
		_show_score_entry(match);
	}
}

function _show_presence(match) {
	var setup = match.setup;
	var layout = document.querySelector('.resultmode_layout');
	layout.innerHTML = '';

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

	layout.appendChild(header);

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
				if (_presence[0] && _presence[1]) {
					network.send_setup_update(state, setup.match_id, {teams_present: true}, function() {
						match.setup.teams_present = true;
						_show_score_entry(match);
					});
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

	// Header
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

	layout.appendChild(header);

	if (setup.match_name) {
		var match_name_el = document.createElement('div');
		match_name_el.className = 'resultmode_match_name';
		match_name_el.textContent = setup.match_name;
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
		label.textContent = 'Game ' + (i + 1);
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

function _add_overlays() {
	var wrapper = document.querySelector('.resultmode_wrapper');
	if (wrapper.querySelector('.resultmode_settings_btn')) {
		return;
	}

	// Top-left: court/field label
	var court_el = document.createElement('div');
	court_el.className = 'resultmode_court_label';
	var court_desc = state.settings.court_description || state.settings.court_id || '';
	court_el.textContent = court_desc;
	wrapper.appendChild(court_el);

	// Bottom-left: match ID (updated per match)
	var match_id_el = document.createElement('div');
	match_id_el.className = 'resultmode_match_id_label';
	wrapper.appendChild(match_id_el);

	// Bottom-right: settings button
	var back_btn = document.createElement('button');
	back_btn.className = 'resultmode_settings_btn';
	back_btn.title = 'Settings';
	back_btn.textContent = '\u2699';
	back_btn.addEventListener('click', function() {
		hide();
		settings.show();
	});
	wrapper.appendChild(back_btn);
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

	var new_ok = ok_btn.cloneNode(true);
	ok_btn.parentNode.replaceChild(new_ok, ok_btn);
	var new_cancel = cancel_btn.cloneNode(true);
	cancel_btn.parentNode.replaceChild(new_cancel, cancel_btn);

	new_ok.addEventListener('click', function() {
		dialog.style.display = 'none';
		_submit_result(match, numeric_scores);
	});

	new_cancel.addEventListener('click', function() {
		dialog.style.display = 'none';
	});

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

	// Find the next unfinished match on this court
	var matches = event.matches || [];
	var next = null;
	for (var i = 0; i < matches.length; i++) {
		var m = matches[i];
		if (m.setup.incomplete) continue;
		// Skip the match we just submitted
		if (_current_match && m.setup.match_id === _current_match.setup.match_id) {
			next = m;
			break;
		}
		if (!_current_match) {
			// Check if this match is not yet finished
			var mwinner = m.network_score ? calc.match_winner(m.setup.counting, m.network_score) : 'inprogress';
			if (mwinner !== 'left' && mwinner !== 'right') {
				next = m;
				break;
			}
		}
	}

	if (next && (!_current_match || next.setup.match_id !== _current_match.setup.match_id)) {
		_show_match(next);
	} else if (!next && !_current_match) {
		_show_waiting();
	}
}

function show() {
	if (state.ui.resultmode_visible) {
		return;
	}
	state.ui.resultmode_visible = true;
	_current_match = null;

	var wrapper = document.querySelector('.resultmode_wrapper');
	wrapper.style.display = 'block';

	_add_overlays();
	_show_waiting();

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
