'use strict';
// Presence-confirmation pre-step for kiosk tablets. Gates in front of
// scorecard.js: once both teams have confirmed presence, is_active()
// goes false and render.js falls through to the normal scorecard UI —
// no explicit hand-off, it's reactive to s.setup.teams_present.

var kiosk = (function() {

var _wake_lock = null;
var _wake_video = null;
var _last_match_id = null;

// Real Screen Wake Lock API where available, with a muted looping
// video as a fallback for browsers that don't support it (mirrors the
// v1 fork's resultmode.js, which this feature is ported from).
function _acquire_wake_lock() {
	if (navigator.wakeLock) {
		navigator.wakeLock.request('screen').then(function(lock) {
			_wake_lock = lock;
			_wake_lock.addEventListener('release', function() {
				_wake_lock = null;
				if (is_active(state)) _acquire_wake_lock();
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

function is_active(s) {
	return !!(
		s &&
		scorecard.is_enabled(s) &&
		s.setup.now_on_court &&
		!s.setup.teams_present
	);
}

function _team_label(team) {
	if (!team || !team.players || team.players.length === 0) {
		return '—';
	}
	return team.players.map(function(player) {
		return player.name;
	}).join(' / ');
}

function _confirm_presence(team_idx) {
	var s = state;
	if (!is_active(s)) {
		return;
	}
	if (!s.setup.match_id || !/^bts_/.test(s.setup.match_id)) {
		return;
	}
	var key = (team_idx === 0) ? 'team1_present' : 'team2_present';
	if (s.setup[key]) {
		return;
	}
	// Optimistic local update — the WS message persists it server-side
	// and fans it out to other panels (court overview, admin), but this
	// tablet's own UI reacts immediately rather than round-tripping.
	s.setup[key] = true;
	if (s.setup.team1_present && s.setup.team2_present) {
		s.setup.teams_present = true;
	}
	var match_id = s.setup.match_id.substring('bts_'.length);
	var payload = {};
	payload[key] = true;
	network.send_presence_update(match_id, payload);
	render.ui_render(s);
}

function render_ui(s) {
	var active = is_active(s);
	uiu.$visible_qs('.kiosk_container', active);
	if (!active) {
		_release_wake_lock();
		return;
	}

	_acquire_wake_lock();

	if (s.setup.match_id !== _last_match_id) {
		_last_match_id = s.setup.match_id;
	}

	uiu.text_qs('.kiosk_meta_competition', s.setup.event_name || '');
	uiu.text_qs('.kiosk_meta_round', s.setup.match_name || '');
	uiu.text_qs('.kiosk_meta_court', compat.courtnum(s.match.court_id || s.settings.court_id));

	uiu.qsEach('.kiosk_presence_button', function(button) {
		var team_idx = parseInt(button.getAttribute('data-team-id'), 10);
		var team = s.setup.teams && s.setup.teams[team_idx];
		uiu.text(button, _team_label(team));
		var present = !!(team_idx === 0 ? s.setup.team1_present : s.setup.team2_present);
		uiu.setClass(button, 'kiosk_presence_confirmed', present);
		button.disabled = present;
	});
}

function on_settings_change(s) {
	if (!is_active(s)) {
		_release_wake_lock();
	}
}

function ui_init() {
	uiu.qsEach('.kiosk_presence_button', function(button) {
		click.on(button, function() {
			var team_idx = parseInt(button.getAttribute('data-team-id'), 10);
			_confirm_presence(team_idx);
		});
	});
	click.qs('.kiosk_fullscreen_button', function() {
		fullscreen.toggle();
	});
}

return {
	is_active: is_active,
	render_ui: render_ui,
	on_settings_change: on_settings_change,
	ui_init: ui_init,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var click = require('./click');
	var compat = require('./compat');
	var fullscreen = require('./fullscreen');
	var network = require('./network');
	var render = require('./render');
	var scorecard = require('./scorecard');
	var uiu = require('./uiu');

	module.exports = kiosk;
}
/*/@DEV*/
