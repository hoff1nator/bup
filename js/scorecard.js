'use strict';
var scorecard = (function() {

var _selected_winner_team_id = 0;
var _status_text = '';
var _status_error = false;

function is_enabled(s) {
	return (
		s &&
		settings.get_mode(s) === 'umpire' &&
		s.settings &&
		(s.settings.tablet_mode === 'scorecard' || s.settings.tablet_mode === 'scorecard_with_attendance') &&
		s.initialized &&
		s.setup &&
		s.match &&
		s.game &&
		s.setup.teams &&
		s.setup.teams.length === 2 &&
		s.setup.teams[0] &&
		s.setup.teams[1]
	);
}

function is_active(s) {
	return is_enabled(s);
}

function _team_label(team) {
	if (!team || !team.players || team.players.length === 0) {
		return '—';
	}
	return team.players.map(function(player) {
		return player.name;
	}).join(' / ');
}

function _team_player_name(team, idx) {
	if (!team || !team.players || !team.players[idx]) {
		return '';
	}
	return team.players[idx].name || '';
}

function _team_footer(team) {
	if (!team) {
		return '—';
	}
	if (team.name) {
		return team.name;
	}
	if (team.players && team.players.length) {
		var first = team.players[0];
		if (first.state) {
			return first.state;
		}
		if (first.country) {
			return first.country;
		}
		if (first.club) {
			return first.club;
		}
	}
	return '—';
}

function _set_status(text, is_error) {
	_status_text = text || '';
	_status_error = !!is_error;
}

function _display_value(value) {
	return (value === undefined || value === null || value === '') ? '—' : String(value);
}

function _display_time(ts) {
	return ts ? utils.time_str(ts) : '—';
}

function _tabletoperator_str(tabletoperators) {
	if (!tabletoperators || tabletoperators.length === 0) {
		return '—';
	}
	if (tabletoperators.length === 1) {
		return tabletoperators[0].name || '—';
	}
	return tabletoperators.map(function(operator) {
		return operator.name;
	}).join(' / ');
}

function _current_game_idx(s) {
	return s.match.finished_games.length;
}

function _current_set_points(setup, game_idx) {
	// Most matches only carry setup.counting (e.g. "3x21"), not an explicit
	// scoring_format object - calc.js's own game-winner logic already
	// normalizes this fallback internally (_normalize_setup), but that
	// helper isn't exported, so mirror it here via the exported
	// scoring_format_from_counting instead of assuming scoring_format is
	// always present (it wasn't, which is why the slider always ran 0-99
	// regardless of the actual counting scheme).
	var scoring_format = (setup && setup.scoring_format) || (setup && calc.scoring_format_from_counting(setup.counting));
	if (!scoring_format) {
		return null;
	}

	var num_sets = Number(scoring_format.numSets);
	var is_last_possible_set = Number.isFinite(num_sets) && (game_idx === num_sets - 1);
	return (
		(is_last_possible_set ? scoring_format.last_set_points : scoring_format.set_points) ||
		scoring_format.set_points ||
		scoring_format.last_set_points ||
		null
	);
}

function _max_loser_points(setup, game_idx) {
	var set_points = _current_set_points(setup, game_idx);
	if (!set_points) {
		return 99;
	}

	var max_points = Number(set_points.max_points);
	if (Number.isFinite(max_points)) {
		return Math.max(0, max_points - 1);
	}

	var end_points = Number(set_points.end_points);
	if (Number.isFinite(end_points)) {
		return Math.max(0, end_points - 1);
	}

	return 99;
}

function _build_finished_score(setup, game_idx, winner_team_id, loser_points) {
	if (!Number.isFinite(loser_points) || loser_points < 0) {
		return null;
	}

	for (var winner_points = loser_points + 1; winner_points <= 99; winner_points++) {
		var score = (winner_team_id === 0) ?
			[winner_points, loser_points] :
			[loser_points, winner_points];
		var winner = calc.game_winner(setup, game_idx, score[0], score[1]);
		if (
			((winner_team_id === 0) && (winner === 'left')) ||
			((winner_team_id === 1) && (winner === 'right'))
		) {
			return score;
		}
	}

	return null;
}

function _preview_score_str(s) {
	if (!s || !s.ui || !s.ui.scorecard_editor_visible || s.match.finish_confirmed) {
		return ':';
	}
	var loser_points_input = uiu.qs('.scorecard_loser_points');
	var loser_points = parseInt(loser_points_input.value, 10);
	if (!Number.isFinite(loser_points) || loser_points < 0) {
		return ':';
	}
	var score = _build_finished_score(
		s.setup,
		_current_game_idx(s),
		_selected_winner_team_id,
		loser_points
	);
	return score ? (score[0] + ':' + score[1]) : ':';
}

function _render_score_parts(row, score_str) {
	var parts = String(score_str || ':').split(':');
	var left = parts[0] || '';
	var right = parts.length > 1 ? parts[1] : '';
	uiu.el(row, 'span', {
		'class': 'scorecard_sheet_score_left',
	}, left);
	uiu.el(row, 'span', {
		'class': 'scorecard_sheet_score_colon',
	}, ':');
	uiu.el(row, 'span', {
		'class': 'scorecard_sheet_score_right',
	}, right);
}

function _measure_outer_sheet_height_vh(container) {
	if (!container || !window || !window.innerHeight) {
		return 16;
	}

	var outer_sheet = container.querySelector('.scorecard_sheet_team .scorecard_sheet_rows');
	if (!outer_sheet) {
		return 16;
	}

	var outer_height_px = outer_sheet.getBoundingClientRect().height || 0;
	if (!outer_height_px) {
		return 16;
	}

	return outer_height_px * 100 / window.innerHeight;
}

function _measure_available_results_height_vh(container) {
	if (!container || !window || !window.innerHeight) {
		return 48;
	}

	var outer_sheet = container.querySelector('.scorecard_sheet_team .scorecard_sheet_rows');
	if (!outer_sheet) {
		return 48;
	}

	var outer_rect = outer_sheet.getBoundingClientRect();
	var container_rect = container.getBoundingClientRect();
	var available_height_px = container_rect.bottom - outer_rect.top;
	if (!available_height_px) {
		return 48;
	}

	return available_height_px * 100 / window.innerHeight;
}

function _ensure_started_state(s) {
	if (s.game.start_team1_left === null) {
		control.on_press({
			type: 'pick_side',
			team1_left: false,
		});
	}
}

function _apply_set_result() {
	var s = state;
	var loser_points_input = uiu.qs('.scorecard_loser_points');
	var loser_points = parseInt(loser_points_input.value, 10);
	var max_loser_points = _max_loser_points(s.setup, _current_game_idx(s));
	if (!Number.isFinite(loser_points) || loser_points < 0 || loser_points > max_loser_points) {
		_set_status(s._('scorecard:error:loser_points'), true);
		render_ui(s);
		return;
	}

	var score = _build_finished_score(
		s.setup,
		_current_game_idx(s),
		_selected_winner_team_id,
		loser_points
	);
	if (!score) {
		_set_status(s._('scorecard:error:invalid_score'), true);
		render_ui(s);
		return;
	}

	_ensure_started_state(s);
	control.on_press({
		type: 'editmode_set-score',
		score: score,
		by_side: false,
		resumed: true,
	});

	if (state.match.finished) {
		_set_status('', false);
	} else {
		control.on_press({
			type: 'postgame-confirm',
		});
		_set_status('', false);
	}

	uiu.qs('.scorecard_loser_points').value = '0';
	if (state.ui) {
		state.ui.scorecard_editor_visible = false;
	}
	render_ui(state);
}

function hide() {
	if (state.ui) {
		state.ui.scorecard_editor_visible = false;
	}
	render.ui_render(state);
	update_settings_ui(state);
}

function show() {
	if (!is_enabled(state)) {
		return;
	}
	if (state.ui) {
		state.ui.scorecard_editor_visible = false;
	}
	settings.hide(true);
	render.show();
	render.ui_render(state);
	update_settings_ui(state);
}

function on_settings_change(s) {
	if (!is_enabled(s) && s.ui) {
		s.ui.scorecard_editor_visible = false;
	}
	update_settings_ui(s);
}

function update_settings_ui(s) {
	return;
}

function render_ui(s) {
	var active = is_active(s);
	uiu.$visible_qs('.scorecard_container', active);
	if (!active) {
		return;
	}

	// "scorecard_with_attendance" reuses the exact same slip layout and
	// interaction (winner buttons, loser-points slider) as the original
	// "scorecard" mode - only the color theme differs, toggled here via a
	// CSS modifier class rather than a second copy of this markup/logic.
	uiu.setClass(
		uiu.qs('.scorecard_container'),
		'scorecard_theme_dark',
		s.settings.tablet_mode === 'scorecard_with_attendance'
	);

	uiu.text_qs('.scorecard_meta_competition', _display_value(s.setup.event_name));
	uiu.text_qs('.scorecard_meta_round', _display_value(s.setup.match_name));
	uiu.text_qs('.scorecard_meta_date', _display_value(s.setup.scheduled_date));
	uiu.text_qs('.scorecard_meta_time', _display_value(s.setup.scheduled_time_str));
	uiu.text_qs(
		'.scorecard_meta_court',
		_display_value(compat.courtnum(s.match.court_id || s.settings.court_id))
	);
	uiu.text_qs('.scorecard_meta_umpire', _display_value(s.match.umpire_name || s.settings.umpire_name));
	uiu.text_qs('.scorecard_meta_service_judge', _display_value(s.match.service_judge_name || s.settings.service_judge_name));
	uiu.text_qs('.scorecard_meta_tabletoperator', _tabletoperator_str(s.setup.tabletoperators));
	uiu.text_qs('.scorecard_meta_called', _display_time(s.setup.called_timestamp));
	uiu.text_qs('.scorecard_meta_end', _display_time(s.metadata && s.metadata.end));
	uiu.text_qs('.scorecard_set_heading', s._('scorecard:set_heading', {
		num: s.match.finished_games.length + 1,
	}));

	uiu.text_qs('.scorecard_team0_player1', _display_value(_team_player_name(s.setup.teams[0], 0)));
	uiu.text_qs('.scorecard_team0_player2', _display_value(_team_player_name(s.setup.teams[0], 1)));
	uiu.text_qs('.scorecard_team0_footer', _display_value(_team_footer(s.setup.teams[0])));
	uiu.text_qs('.scorecard_team1_player1', _display_value(_team_player_name(s.setup.teams[1], 0)));
	uiu.text_qs('.scorecard_team1_player2', _display_value(_team_player_name(s.setup.teams[1], 1)));
	uiu.text_qs('.scorecard_team1_footer', _display_value(_team_footer(s.setup.teams[1])));

	uiu.qsEach('.scorecard_winner_button', function(button) {
		var team_id = parseInt(button.getAttribute('data-team-id'), 10);
		uiu.text(button, _team_label(s.setup.teams[team_id]));
		uiu.setClass(button, 'scorecard_selected', team_id === _selected_winner_team_id);
		button.disabled = !!s.match.finish_confirmed;
	});

	var result_rows = uiu.qs('.scorecard_sheet_result_rows');
	uiu.empty(result_rows);
	var has_unconfirmed_last_result = s.match.finished && !s.match.finish_confirmed;
	var has_pending_result_row = !s.match.finished && !s.match.finish_confirmed;
	var num_result_rows = Math.max(
		1,
		s.match.finished_games.length +
		((has_unconfirmed_last_result || has_pending_result_row) ? 1 : 0)
	);
	var scorecard_container = uiu.qs('.scorecard_container');
	var base_result_row_height = Math.max(
		0,
		_measure_outer_sheet_height_vh(scorecard_container) - 0.6
	);
	var fixed_available_results_height = Math.max(
		0,
		_measure_available_results_height_vh(scorecard_container) - 1
	);
	var scoresheet_current_height = (
		(num_result_rows <= 2) ?
		(base_result_row_height * num_result_rows) :
		fixed_available_results_height
	);
	var scorecard_result_row_height = (
		(num_result_rows <= 2) ?
		base_result_row_height :
		(scoresheet_current_height / num_result_rows)
	);
	result_rows.style.gridTemplateRows = 'repeat(' + num_result_rows + ', ' + scorecard_result_row_height + 'vh)';
	scorecard_container.style.setProperty(
		'--scorecard-scoresheet-current-height',
		scoresheet_current_height + 'vh'
	);
	for (var row_idx = 0; row_idx < num_result_rows; row_idx++) {
		var game = s.match.finished_games[row_idx];
		var row = uiu.el(result_rows, 'div', {
			'class': 'scorecard_sheet_result_row',
		});
		if (game) {
			_render_score_parts(row, game.score[0] + ':' + game.score[1]);
			continue;
		}
		if (has_unconfirmed_last_result && (row_idx === s.match.finished_games.length)) {
			_render_score_parts(row, s.game.score[0] + ':' + s.game.score[1]);
			continue;
		}
		if (s.ui && s.ui.scorecard_editor_visible && !s.match.finish_confirmed) {
			uiu.setClass(row, 'scorecard_sheet_result_row_active', true);
			_render_score_parts(row, _preview_score_str(s));
			continue;
		}
		if (has_pending_result_row) {
			var enter_button = uiu.el(row, 'button', {
				'class': 'scorecard_inline_apply',
				'type': 'button',
			}, s._('scorecard:enter_set'));
			click.on(enter_button, function() {
				if (state.ui) {
					state.ui.scorecard_editor_visible = true;
				}
				render_ui(state);
			});
			continue;
		}
		_render_score_parts(row, ':');
	}

	uiu.qsEach('.scorecard_team_button', function(button) {
		var team_id = parseInt(button.getAttribute('data-team-id'), 10);
		uiu.setClass(button, 'scorecard_selected', team_id === _selected_winner_team_id);
		uiu.setClass(
			button,
			'scorecard_sheet_team_winner',
			(s.match.finished || s.match.finish_confirmed) &&
			(team_id === (s.match.team1_won ? 0 : 1))
		);
	});

	uiu.$visible_qs('.scorecard_editor', !!(s.ui && s.ui.scorecard_editor_visible && !s.match.finish_confirmed));
	uiu.$visible_qs('.scorecard_actions', false);
	uiu.qs('.scorecard_loser_points').disabled = !!s.match.finish_confirmed;
	var loser_points_input = uiu.qs('.scorecard_loser_points');
	var loser_points_value = uiu.qs('.scorecard_loser_points_value');
	var max_loser_points = _max_loser_points(s.setup, _current_game_idx(s));
	loser_points_input.max = String(max_loser_points);
	if (parseInt(loser_points_input.value, 10) > max_loser_points) {
		loser_points_input.value = String(max_loser_points);
	}
	uiu.text(loser_points_value, loser_points_input.value);
	uiu.qs('.scorecard_apply').disabled = !!s.match.finish_confirmed;

	var status_el = uiu.qs('.scorecard_status');
	uiu.text(status_el, _status_text);
	uiu.setClass(status_el, 'scorecard_error', _status_error);
}

function ui_init() {
	click.qs('.scorecard_apply', function() {
		_apply_set_result();
	});

	click.qs('.scorecard_cancel', function() {
		if (state.ui) {
			state.ui.scorecard_editor_visible = false;
		}
		_set_status('', false);
		render_ui(state);
	});

	click.qs('.scorecard_leave', function() {
		if (state.match && state.match.finish_confirmed) {
			hide();
			control.post_match_confirm();
			return;
		}
		if (state.ui) {
			state.ui.scorecard_editor_visible = false;
		}
		render_ui(state);
		settings.show();
	});

	uiu.qsEach('.scorecard_winner_button', function(button) {
		click.on(button, function() {
			_selected_winner_team_id = parseInt(button.getAttribute('data-team-id'), 10);
			_set_status('', false);
			render_ui(state);
		});
	});

	var loser_points_input = uiu.qs('.scorecard_loser_points');
	loser_points_input.addEventListener('input', function() {
		_set_status('', false);
		render_ui(state);
	});
}

return {
	is_enabled: is_enabled,
	is_active: is_active,
	hide: hide,
	on_settings_change: on_settings_change,
	render_ui: render_ui,
	ui_init: ui_init,
	update_settings_ui: update_settings_ui,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var calc = require('./calc');
	var click = require('./click');
	var control = require('./control');
	var render = require('./render');
	var settings = require('./settings');
	var uiu = require('./uiu');
	var utils = require('./utils');

	module.exports = scorecard;
}
/*/@DEV*/
