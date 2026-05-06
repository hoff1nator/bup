'use strict';
var displaymode = (function() {

var ALL_STYLES = [
	'oncourt',
	'international',
	'bwf',
	'clean',
	'teamcourt',
	'tournamentcourt',
	'tournamentplayers',
	'stripes',
	'2court',
	'greyish',
	'tim',
	'top+list',
	'teamscore',
	'bwfonlyplayers',
	'onlyplayers',
	'clubplayers',
	'clubplayerslr',
	'onlyscore',
	'giantscore',
	'castall',
	'stream',
	'streamcourt',
	'streamcourt_dm',
	'streamteam',
	'tournament_overview',
	'tournament_overview_dm',
	'andre',
];
var MULTI_COURT_STYLES = [
	'2court',
	'castall',
	'greyish',
	'stream',
	'streamteam',
	'teamscore',
	'tim',
	'top+list',
	'tournament_overview',
	'tournament_overview_dm',
];
var FIELDLESS_MULTI_COURT_STYLES = [
	'greyish',
	'streamteam',
	'teamscore',
	'tim',
	'top+list',
	'tournament_overview',
	'tournament_overview_dm',
];
var ALL_COLORS = [
	'c0', 'c1', 'cb0', 'cb1',
	'cbg', 'cbg2', 'cbg3', 'cbg4',
	'cfg', 'cfg2', 'cfg3', 'cfg4', 'cfgdark',
	'cexp',
	'ct', // transparent
	'cborder',
	'cserv', 'cserv2', 'crecv',
	'ctim_blue', 'ctim_active',
];

var _hide_cursor_timeout;

function show_cursor() {
	if (_hide_cursor_timeout) {
		clearTimeout(_hide_cursor_timeout);
	} else {
		var d_container = uiu.qs('.displaymode_layout');
		var ads_container = uiu.qs('.d_ads');
		d_container.style.cursor = 'default';
		ads_container.style.cursor = 'default';
	}
	_hide_cursor_timeout = setTimeout(hide_cursor, 5000);
}

function hide_cursor() {
	_hide_cursor_timeout = null;
	var d_container = uiu.qs('.displaymode_layout');
	var ads_container = uiu.qs('.d_ads');
	d_container.style.cursor = 'none';
	ads_container.style.cursor = 'none';
}

function _setup_autosize(el, right_node, determine_height) {
	autosize.maintain(el, function() {
		var parent_node = el.parentNode;
		var w = parent_node.offsetWidth;
		if (right_node) {
			var prect = parent_node.getBoundingClientRect();
			var rrect = right_node.getBoundingClientRect();

			// The -20 at the end of the formula is a fixed value. Without the fix, the calculation 
			// sometimes resulted in the strings going just beyond the end of the planned range. 
			w = Math.max(10, Math.min(w, rrect.left - prect.left-20));
		}

		var h;
		if (determine_height) {
			h = determine_height(parent_node);
		} else {
			h = parent_node.offsetHeight / 1.1;
		}

		return {
			width: w,
			height: h,
		};
	});
}

function _calc_matchscore(matches) {
	var res = [0, 0];
	matches.forEach(function(m) {
		var winner = calc.match_winner(m.setup, m.network_score || []);
		if (winner === 'left') {
			res[0] += 1;
		} else if (winner === 'right') {
			res[1] += 1;
		}
	});
	return res;
}

function _double_doubles_namefunc(matches) {
	var by_lastname = {};
	matches.forEach(function(match) {
		match.setup.teams.forEach(function(team) {
			team.players.forEach(function(player) {
				var ln = _lastname(player);
				var name = player.name;
				var byl = by_lastname[ln];
				if (byl) {
					if (!utils.includes(byl, name)) {
						byl.push(name);
					}
				} else {
					by_lastname[ln] = [name];
				}
			});
		});
	});

	return function(player) {
		var ln = _lastname(player);
		var byl = by_lastname[ln];
		if (byl && (byl.length > 1)) { // !byl should never happen, but guard against unforeseen problems
			return _doubles_name(player);
		}
		return ln;
	};
}

function _doubles_name(player) {
	if (player.firstname && player.lastname) {
		return player.firstname[0] + '.\xa0' + player.lastname;
	}
	
	var m = /^(.).*?\s+(\S+)$/.exec(player.name);
	if (!m) {
		return player.name;
	}
	return m[1] + '.\xa0' + m[2];
}

function _lastname(player) {
	if (player.lastname) {
		return player.lastname;
	}

	var m = /^(.).*?\s+(\S+)$/.exec(player.name);
	if (!m) {
		return player.name;
	}
	return m[2];
}

function _list_render_player_names(container, players, winning) {
	var names_str;
	if (players.length === 0) {
		names_str = 'TBA';
	} else if (players.length === 1) {
		names_str = players[0].name;
	} else {
		names_str = _doubles_name(players[0]) + ' / ' + _doubles_name(players[1]);
	}
	var div = uiu.el(
		container, 'div', {
			'class': 'display_list_player_names_wrapper',
		}
	);
	var span = uiu.el(
		div, 'span', {
			'class': (winning ? 'display_list_winning' : ''),
			'style': (winning ? '' : 'color: #ddd;'),
		}, names_str
	);
	_setup_autosize(span);
}

function _list_render_team_name(tr, team_name) {
	var th = uiu.el(tr, 'th', {
		'class': 'display_list_teamname',
	});
	var div = uiu.el(th, 'div');
	var span = uiu.el(div, 'span', {}, team_name);
	return span;
}

function _calc_max_games(event) {
	var res = 0;
	event.matches.forEach(function(match) {
		res = Math.max(res, calc.max_game_count(match.setup));
	});
	return res;
}

function hash(settings, event) {
	return {
		style: settings.displaymode_style,
		colors: calc_colors(settings, event),
		scale: settings.d_scale,
		court_id: settings.displaymode_court_id,
		reverse_order: settings.displaymode_reverse_order,
		show_pause: settings.d_show_pause,
		show_court_number: settings.d_show_court_number,
		show_competition: settings.d_show_competition,
		show_round: settings.d_show_round,
		show_team_name: settings.d_show_team_name,
		show_middle_name: settings.d_show_middle_name,
		show_doubles_receiving: settings.d_show_doubles_receiving,
		team_colors: settings.d_team_colors,
		courts: utils.deep_copy(event.courts),
		matches: utils.deep_copy(event.matches),
	};
}

function determine_server(match, current_score) {
	var team_id;
	if (typeof match.network_team1_serving === 'boolean') {
		team_id = match.network_team1_serving ? 0 : 1;
	}
	if (team_id === undefined) return {};
	if (!match.network_teams_player1_even) {
		return {
			team_id: team_id,
		}; // This ensures that server.player_id is undefined
	}

	var player_id = 0;
	if (match.setup.is_doubles) {
		var p0even = match.network_teams_player1_even[team_id];
		if (p0even === null) {
			// only team known
			return {
				team_id: team_id,
			};
		}
		player_id = (p0even == (current_score[team_id] % 2 === 0)) ? 0 : 1;
	}

	// Network score only, but at end of game?
	// (the positions of players may be relayed, but should not be shown)
	var netscore = match.network_score;
	if (netscore && netscore.length > 0) {
		var game_idx = netscore.length - 1;
		var last_game = netscore[game_idx];
		var gwinner = calc.game_winner(match.setup, game_idx - 1, last_game[0], last_game[1]);
		if (gwinner !== 'inprogress') {
			return {
				team_id: team_id,
			};
		}
	}

	return {
		team_id: team_id,
		player_id: player_id,
	};
}

function determine_receiver(match, current_score) {
	var team_id;
	if (typeof match.network_team1_serving === 'boolean') {
		team_id = match.network_team1_serving ? 1 : 0; // welches Team hat den ersten Aufschlag angenommen?
	}
	if (team_id === undefined) return {};
	if (!match.network_teams_player1_even) {
		return {
			team_id: team_id,
		}; // This ensures that server.player_id is undefined
	}

	var player_id = 0;
	if (match.setup.is_doubles) {
		var p0even = match.network_teams_player1_even[team_id]; //Welcher spieler des Teams stand bei der Annahme bei 0 Rechts?
		if (p0even === null) {
			// only team known
			return {
				team_id: team_id,
			};
		}
		player_id = (p0even == (current_score[(team_id + 1) % 2] % 2 === 0)) ? 0 : 1;
	}

	// Network score only, but at end of game?
	// (the positions of players may be relayed, but should not be shown)
	var netscore = match.network_score;
	if (netscore && netscore.length > 0) {
		var game_idx = netscore.length - 1;
		var last_game = netscore[game_idx];
		var gwinner = calc.game_winner(match.setup, game_idx - 1, last_game[0], last_game[1]);
		if (gwinner !== 'inprogress') {
			return {
				team_id: team_id,
			};
		}
	}

	return {
		team_id: team_id,
		player_id: player_id,
	};
}

function _match_by_court(event, court) {
	return court.match_id ? utils.find(event.matches, function(m) {
		return court.match_id === m.setup.match_id;
	}) : null;
}

function _render_court_display(container, event, court, colors, top_team_idx) {
	var match = _match_by_court(event, court);
	if (top_team_idx === undefined) {
		top_team_idx = 0;
		if (match && court.chair) {
			var team0_left = network.calc_team0_left(match);
			if (typeof team0_left == 'boolean') {
				top_team_idx = (team0_left == (court.chair === 'west')) ? 0 : 1;
			}
		}
	}

	var team_names = event.team_names || [];
	var nscore = (match && match.network_score) ? match.network_score : [];
	var match_setup = match ? match.setup : {
		teams: [{
			name: team_names[0],
			players: [],
		}, {
			name: team_names[1],
			players: [],
		}],
	};
	var prev_scores = nscore.slice(0, -1);
	var current_score = (nscore.length > 0) ? nscore[nscore.length - 1] : ['', ''];
	var server = match ? determine_server(match, current_score) : {};

	for (var i = 0;i < 2;i++) {
		var is_top = i === 0;
		var top_key = is_top ? 'top' : 'bottom';
		var bottom_key = is_top ? 'bottom' : 'top';
		var team_idx = is_top ? top_team_idx : 1 - top_team_idx;
		var team = match_setup.teams[team_idx];

		var team_container = uiu.el(container, 'div', {
			style: (
				'position: absolute;left:0;height:50%;top:' + (i * 50) + '%;width:100%;' +
				'white-space:pre;'
			),
		});

		var team_name_container = uiu.el(team_container, 'div', {
			style: (
				'position:absolute;' + bottom_key + ':0;height:4vh;width:100%;' +
				'color:' + colors.fg3 + ';display:flex;align-items:center;'
			),
		});
		var team_name_el = uiu.el(team_name_container, 'span', {}, team.name);
		var prev_score_container = uiu.el(team_name_container, 'div', {
			style: 'position:absolute;right:0;height:100%;display:flex;align-items:center;',
		});
		prev_scores.forEach(function(ps) {
			var won = ps[team_idx] > ps[1 - team_idx];
			uiu.el(prev_score_container, 'div', {
				'style': (
					'display: inline-block;' +
					'margin: 0 0.4em;' +
					'min-width: 1.2em;' +
					'text-align: right;' +
					'font-size:3vh;' +
					'color:' + (won ? colors.serv2 : colors.recv)
				),
			}, ps[team_idx]);
		});
		_setup_autosize(team_name_el, prev_score_container);

		var players_container = uiu.el(team_container, 'div', {
			style: (
				'position:absolute;' + top_key + ':0;height:12vh;width:100%;' +
				'display:flex;flex-direction:column;justify-content:center;'),
		});

		var current_score_el = uiu.el(players_container, 'div', {
			style: (
				'line-height:12vh;font-size:12vh;' +
				'position:absolute;right:0;' + top_key + ':0;' +
				'color:' + colors.fg
			),
		}, current_score[team_idx]);

		for (var player_id = 0;player_id < team.players.length;player_id++) {
			var is_serving = (team_idx === server.team_id) && (player_id === server.player_id);
			var player_name_container = uiu.el(players_container, 'div', {
				'style': (
					'color:' + (is_serving ? colors.serv2 : colors.fg) + ';' +
					'height:50%;width:100%;'
				),
			});
			var span = uiu.el(player_name_container, 'span', {}, team.players[player_id].name);
			_setup_autosize(span, current_score_el);
		}
	}
}

function render_top_list(s, container, event) {
	var colors = calc_colors(s.settings, event);
	var inner_container = uiu.el(
		container, 'div',
		{style: 'position:absolute;left:0;top:0;bottom:0;right:0;background:' + colors.bg});
	render_top(s, inner_container, event, colors);
	render_list(inner_container, event);
}

function render_top(s, container, event, colors) {
	if (! event.courts) {
		return;
	}

	var courts_outer_container = uiu.el(container, 'div', {
		'class': 'display_courts_container',
	});
	var courts_container = uiu.el(courts_outer_container, 'div', {
		style: 'position:absolute;left:1vw;right:1vw;top:0;bottom:0;',
	});
	var court_count = event.courts.length;
	var spacer_width = 4 * (court_count - 1);
	var court_width = ((100.0 - (court_count - 1) * spacer_width) / court_count);
	for (var court_idx = 0;court_idx < court_count;court_idx++) {
		var left = (court_width + spacer_width) * court_idx;
		var court_container = uiu.el(courts_container, 'div', {
			'class': 'display_courts_court',
			'style': (
				'position:absolute;top:0;bottom:0;left:' + left + '%;width:' + court_width + '%'),
		});

		var real_court_idx = s.settings.displaymode_reverse_order ? (court_count - 1 - court_idx) : court_idx;
		var court = event.courts[real_court_idx];
		_render_court_display(court_container, event, court, colors);
	}
}

function namestr(players) {
	if (players.length === 0) {
		return '';
	} else if (players.length === 1) {
		return players[0].name;
	} else {
		return _doubles_name(players[0]) + ' / ' + _doubles_name(players[1]);
	}
}

function namestr_short(players) {
	if (players.length === 0) {
		return '';
	} else if (players.length === 1) {
		return players[0].name;
	} else {
		return _lastname(players[0]) + ' / ' + _lastname(players[1]);
	}
}


function _match_name(setup) {
	var res = '';
	if (setup.event_name) {
		res += setup.event_name;
	}
	if (setup.match_name) {
		if (res) {
			res += ' ';
		}
		res += setup.match_name;
	}
	return res;
}

function _tournament_overview_render_players(tr, players) {
	var td = uiu.el(tr, 'td', 'd_to_team');
	uiu.el(td, 'span', {}, namestr(players));
}

function render_tournament_overview(s, container, event) {
	var max_game_count = _calc_max_games(event);
	var colors = calc_colors(s.settings, event);

	event.courts.forEach(function(court, idx) {
		var match = _match_by_court(event, court);
		var nscore = (match ? match.network_score : 0) || [];

		var tr = uiu.el(tbody, 'tr', {
			style: (
				'background:' + ((idx % 2 === 0) ? colors.bg : colors.bg3) + ';' +
				'color:' + colors.fg + ';'
			),
		});
		uiu.el(tr, 'td', 'd_to_court', court.label || compat.courtnum(court.id));
		if (match) {
			var setup = match.setup;
			uiu.el(tr, 'td', {
				'class': 'd_to_matchname',
				style: (
					'color:' + colors.fg2 + ';'
				),
			}, _match_name(setup));
			_tournament_overview_render_players(tr, setup.teams[0].players);
			_tournament_overview_render_players(tr, setup.teams[1].players);
		} else {
			uiu.el(tr, 'td', {
				colspan: 3,
			});
		}
		for (var game_idx = 0;game_idx < max_game_count;game_idx++) {
			var score_td = uiu.el(tr, 'td', {
				'class': 'd_to_score',
				style: 'border-color:' + colors.border,
			});

			var n = nscore[game_idx];
			if (match && n) {
				var gwinner = calc.game_winner(match.setup, game_idx, n[0], n[1]);
				uiu.el(score_td, 'span', {
					'class': ((gwinner === 'left') ? 'd_to_winning' : ''),
				}, n[0]);
				uiu.el(score_td, 'span', {
					'class': 't_to_vs',
				}, ':');
				uiu.el(score_td, 'span', {
					'class': ((gwinner === 'right') ? 'd_to_winning' : ''),
				}, n[1]);
			}
		}
	});
}

function _tournament_overview_dm_render_players(tr, players) {
	var td = uiu.el(tr, 'td', 'd_to_team');
	uiu.el(td, 'span', {}, namestr(players));
}

function render_tournament_overview_dm(s, container, event) {
	var max_game_count = _calc_max_games(event);
	var colors = calc_colors(s.settings, event);

	var background = uiu.el(container, 'div', {
		style: (
			'position:absolute;top:0vh;left:0vh;' +
			'height:100vh;width:100vw;' + 
			'background-color: #000000;' +
			'z-index:10;'
		),
	});

	var courts = [4, 1, 0, 2, 3];
	courts.forEach(function (id , idx) {
		var match = _match_by_court(event, event.courts[id]);
		var duration = -1;
		if (match != null) {
			
			if (match.presses_json && match.presses_json != null) {

				var presses = JSON.parse(match.presses_json);
				const foundpress = presses.find(press => press.type === "love-all");
				if (foundpress && foundpress != null) {
					var start = foundpress.timestamp;
					duration = Math.floor((Date.now() - start) / 1000/60);
				}

			}
		}
		var nscore = (match ? match.network_score : 0) || [];

		var setup = match ? match.setup : eventutils.default_setup(event.league_key);
		var max_games = calc.max_game_count(setup);
		var current_score = (nscore.length > 0) ? nscore[nscore.length - 1] : ['', ''];
		var server = match ? determine_server(match, current_score) : {};

		var court_el = uiu.el(background, 'div', {
			style: (
				'position:absolute;top:'+idx*20+'vh;left:0vh;' +
				'height:20vh;width:100vw;'
			),
		});

		var top_bar = uiu.el(court_el, 'div', {
			style: (
				'position:absolute;top:2vh;left:2vw;' +
				'height:16vh;' +
				'z-index:-1;' +
				'display: flex;' +
				'flex-direction: row;'
			),
		});
		

		var top_bar_court = uiu.el(top_bar, 'div', {
			style: (
				'position:static;' +
				'height:16vh;width:7.5vw;' +
				'display: flex;' +
				'flex-direction: column;' +
				'justify-content: space-between;'
			),
		});

		uiu.el(top_bar_court, 'div', {
			style: (
				'position:static;' +
				'height:5%;width:100%;' +
				'background-color: #ffffff;' +
				'border-top-right-radius: 1vh;'+
				'border-top-left-radius: 1vh;'
			),
		});

		var court_number = uiu.el(top_bar_court, 'div', {
			style: (
				'position:static;' +
				'height:90%;width:100%;' +
				'background-color: #ffffffbb;'  +
				'text-align: center;'
			),
		});

		uiu.el(court_number, 'div', {
			style: (
				'font-size: 17.0vh;'+
				'height: 100%;' +
    			'font-weight: bold;' +
    			'font-style: oblique;' +
				'margin-top: -2.5vh'
			),
		},id+1);

		var top_bar_match = uiu.el(top_bar, 'div', {
			style: (
				'position:static;' +
				'height:16vh;width:7.5vw;' +
				'display: flex;' +
				'flex-direction: column;' +
				'justify-content: space-between;'+
				'margin-left: 0.5vh;'
			),
		});
		uiu.el(top_bar_match, 'div', {

			style: (
				'position:static;' +
				'height:5%;width:100%;' +
				'background-color: #ffffff;' +
				'border-top-right-radius: 1vh;'+
				'border-top-left-radius: 1vh;'
			),
		});

		var match_div = uiu.el(top_bar_match, 'div', {
			style: (
				'position:static;' +
				'height:90%;width:100%;' +
				'background-color: #ffffffbb;'  +
				'text-align: center;'
			),
		});

		uiu.el(match_div, 'div', {
			style: (
				'font-size: 3.5vh;' +
				'font-weight: bold;' +
				'font-style: oblique;'
			),
		}, (match && match.setup) ? match.setup.event_name: "");

		uiu.el(match_div, 'div', {
			style: (
				'font-size: 3.5vh;' +
				'font-weight: bold;' +
				'font-style: oblique;'
			),
		}, (match && match.setup) ? match.setup.match_name : "");


		uiu.el(match_div, 'div', {
			style: (
				'font-size: 6vh;' +
				'font-weight: bold;' +
				'font-style: oblique;'
			),
		}, (duration == -1 ) ? "" : duration+"'");

		uiu.el(top_bar_court, 'div', {
			style: (
				'position:static;' +
				'height:5%;width:100%;' +
				'background-color: #ffffff;' +
				'border-bottom-right-radius: 1vh;'+
				'border-bottom-left-radius: 1vh;'
			),
		});

		uiu.el(top_bar_match, 'div', {
			style: (
				'position:static;' +
				'height:5%;width:100%;' +
				'background-color: #ffffff;' +
				'border-bottom-right-radius: 1vh;'+
				'border-bottom-left-radius: 1vh;'
			),
		});

		var top_bar_left = uiu.el(top_bar, 'div', {
			style: (
				'position:static;' +
				'height:16vh;width:64.5vw;' +
				'display: flex;' +
				'flex-direction: column;' +
				'justify-content: space-between;' +
				'margin-left: 0.5vh;'
			),
		});
				
		var border_top = uiu.el(top_bar_left, 'div', {
			style: (
				'position:static;' +
				'height:5%;width:100%;' +
				'background-color: #ffffff;' +
				'border-top-right-radius: 1vh;'+
				'border-top-left-radius: 1vh;'
			),
		});
		
		var teams = [];
		
		teams.push(uiu.el(top_bar_left, 'div', {
			style: (
				'position:static;' +
				'height:43%;width:100%;' +
				'background-color: #ffffffbb;'  +
				'display: flex;' +
				'justify-content: space-between;'
			),
		}));
		
		var border_middle = uiu.el(top_bar_left, 'div', {
			style: (
				'position:static;' +
				'height:4%;width:100%;'
			),
		});
		
		
		teams.push(uiu.el(top_bar_left, 'div', {
			style: (
				'position:static;' +
				'height:43%;width:100%;' +
				'background-color: #ffffffbb;' +
				'display: flex;' +
				'justify-content: space-between;'
			),
		}));
		
		var border_bottom = uiu.el(top_bar_left, 'div', {
			style: (
				'position:static;' +
				'height:5%;width:100%;' +
				'background-color: #ffffff;' +
				'border-bottom-left-radius: 1vh;'+
				'border-bottom-right-radius: 1vh;'
			),
		});
		
		var team_service = [];
		for (var team_idx = 0;team_idx < 2;team_idx++) {
			var team_name = uiu.el(teams[team_idx], 'div', {
				style: (
					'margin-left:1vh;' +
					'font-size:6.0vh;' + 
					'height: 100%;' +
					'align-content: center;' +
					'width: fit-content;' +
					'font-weight: bold;'
				)
			},
			match ? match.setup.teams[team_idx].players[0].name +(match.setup.teams[team_idx].players.length > 1 ? ' / ' + match.setup.teams[team_idx].players[1].name : '')  : '');
			
			let service = uiu.el(teams[team_idx], 'div', {
				style: (
					'height: 100%;' +
					'align-content: center;' +
					'width: 6.5vh;' +
					'background-repeat: no-repeat;' +
					'background-position:center;' +
					'background-size:contain;' +
					'background-image:url("icons/Ball_DM_Cloppenburg_schwarz.svg");'
				)});
		
			service.style.visibility = "hidden";
		
			team_service.push(service);
		
		}

		var sets = [];

		var team_serving = -1;

		// for (var game_idx = 0;game_idx < max_games;game_idx++) {
		for (var game_idx = 0;game_idx < 3;game_idx++) {
			if (nscore.length > game_idx) {
				for (var team_idx = 0;team_idx < 2;team_idx++) {
					var gwinner = calc.game_winner(
						match.setup, game_idx, nscore[game_idx][0], nscore[game_idx][1]);
					var is_team_serving = (
						(gwinner === 'left') ? (team_idx === 0) : (
						(gwinner === 'right') ? (team_idx === 1) : (
						(server.team_id === team_idx))));

					if(is_team_serving) {
						team_serving = team_idx;
					}
				}
			}
				
				var top_bar_set = uiu.el(top_bar, 'div', {
					style: (
						'position:static;' +
						'height:16vh;width:9vh;' +
						'display: flex;' +
						'flex-direction: column;' +
						'justify-content: space-between;' +
						'margin-left: 0.5vh;'
					),
				});

				uiu.el(top_bar_set, 'div', {
					style: (
						'position:static;' +
						'height:5%;width:100%;' +
						'background-color: #ffffff;' +
						'border-top-left-radius: 1vh;' +
						'border-top-right-radius: 1vh;'
					),
				});

				let set = [];
				set.push(uiu.el(top_bar_set, 'div', {
					style: (
						'position:static;' +
						'height:43%;width:100%;' +
						'background-color: #ffffffbb;'  +
						'display: flex;' +
						'justify-content: center;' + 
						'font-size:7vh;' +
						'align-items: center;'+
						'font-weight: bold;'
					),
				}, game_idx < nscore.length ? nscore[game_idx][0] : ''));

				uiu.el(top_bar_set, 'div', {
					style: (
						'position:static;' +
						'height:4%;width:100%;'
					),
				});

				set.push(uiu.el(top_bar_set, 'div', {
					style: (
						'position:static;' +
						'height:43%;width:100%;' +
						'background-color: #ffffffbb;'  +
						'display: flex;' +
						'justify-content: center;' + 
						'font-size:7vh;' +
						'align-items: center;'+
						'font-weight: bold;'
					),
				}, game_idx < nscore.length ? nscore[game_idx][1] : ''));

				uiu.el(top_bar_set, 'div', {
					style: (
						'position:static;' +
						'height:5%;width:100%;' +
						'background-color: #ffffff;' +
						'border-bottom-left-radius: 1vh;' +
						'border-bottom-right-radius: 1vh;'
					),
				});

				sets.push(set);
		}

		if(team_serving >= 0) {
			team_service[team_serving].style.visibility = 'visible';
		}
			
	});
}
function render_castall(s, container, event, colors) {
	if (!event.courts) {
		uiu.el(container, 'div', 'error', 'Court information missing');
		return;
	}

	var scale = s.settings.d_scale / 100;

	uiu.el(container, 'div', {
		'class': 'd_castall_bg',
		'style': ('background: ' + colors.t),
	});

	var abbrevs = extradata.abbrevs(event);
	var logo_url = extradata.logo_url(event);
	var court_count = event.courts.length;
	for (var court_idx = 0;court_idx < court_count;court_idx++) {
		var real_court_idx = s.settings.displaymode_reverse_order ? (court_count - 1 - court_idx) : court_idx;
		var court = event.courts[real_court_idx];
		var match = _match_by_court(event, court);
		var setup = match ? match.setup : eventutils.default_setup(event.league_key);
		var max_games = calc.max_game_count(setup);
		var nscore = (match ? match.network_score : 0) || [];

		var match_container = uiu.el(container, 'div', {
			'class': 'd_castall_match',
			'style': (
				((court_idx === 0) ? 'left' : 'right') + ':3%;' +
				'background:' + colors.bg + ';' +
				'width:' + ((85 + (max_games * 41) + (logo_url ? 90 : 0)) * scale) + 'px;' +
				'height:' + (60 * scale) + 'px;' +
				'border-radius:' + (6 * scale) + 'px'),
		});

		var mname_container = uiu.el(match_container, 'div', {
			'class': 'd_castall_mname',
			'style': ('margin:0 ' + (3 * scale) + 'px;font-size:' + (15 * scale) + 'px;width:' + (15 * scale) + 'px'),
		});
		var mname = match ? match.setup.match_name.split(/(?=[^.])/) : '';
		for (var i = 0;i < mname.length;i++) {
			uiu.el(mname_container, 'span', {}, mname[i] || '');
		}

		var teams_container = uiu.el(match_container, 'div', 'd_castall_teams');
		abbrevs.forEach(function(abbrev, team_id) {
			var team_block = uiu.el(teams_container, 'div', {
				'class': 'd_castall_team',
				style: (
					'height:' + (28.5 * scale) + 'px;' +
					'padding-top:' + (1 * scale) + 'px;' +
					((team_id === 1) ? 'padding-bottom:' + (1 * scale) + 'px': '')
				),
			});
			var fg_color = utils.contrast_color(colors[team_id], colors.bg, colors.fg);
			var team_name_container = uiu.el(team_block, 'div', {
				style: (
					'font-family: monospace;' +
					'background:' + colors[team_id] + ';' +
					'color:' + fg_color + ';' +
					'width:' + (45 * scale) + 'px;' +
					'height: 100%;' +
					'display: flex;' +
					'justify-content: center;' +
					'align-items: center;' +
					'font-size:' + (22 * scale) + 'px;'),
			});
			uiu.el(team_name_container, 'span', {}, abbrev);

			uiu.el(team_block, 'div', {
				style: (
					'height: 100%;' +
					'background:' + ((match && (match.network_team1_serving == (team_id === 0))) ? colors.serv : colors.recv) + ';' +	
					'margin:0 ' + (1 * scale) + 'px;' +
					'width:' + (10 * scale) + 'px;'),
			});

			for (var game_idx = 0;game_idx < max_games;game_idx++) {
				var score_container = uiu.el(team_block, 'div', {
					style: (
						'background:' + colors.bg2 + ';' +
						'color:' + colors.bg + ';' +
						'width:' + (40 * scale) + 'px;' +
						'margin-right: ' + (1 * scale) + 'px;' +
						'height: 100%;' +
						'display: flex;' +
						'justify-content: center;' +
						'align-items: center;' +
						'font-size:' + (22 * scale) + 'px;'),
				});
				uiu.el(score_container, 'span', {}, nscore[game_idx] ? nscore[game_idx][team_id] : '');
			}
		});

		if (logo_url) {
			uiu.el(match_container, 'div', {
				style: (
					'height:' + (50 * scale) + 'px;' +
					'margin:' + (5 * scale) + 'px 0;' +
					'width:' + (90 * scale) + 'px;' +
					'float: left;' +
					'background: no-repeat center/contain url("' + logo_url + '");'
				),
			});
		}
	}

	// Bottom display
	var match_score = _calc_matchscore(event.matches);
	var bottom_container = uiu.el(container, 'div', 'd_castall_bottom');
	var bottom_block = uiu.el(bottom_container, 'div', {
		'class': 'd_castall_bottom_block',
		'style': (
			'background:' + colors.bg + ';' +
			'width:' + (670 * scale) + 'px;' +
			'height:' + (55 * scale) + 'px;' + 
			'border-radius:' + (12 * scale) + 'px'),
	});
	var team_names = event.team_names || [];
	for (var team_id = 0;team_id < team_names.length;team_id++) {
		var team_block = uiu.el(bottom_block, 'div', {
			'class': 'd_castall_bottom_team' + team_id,
			'style': (
				'width:' + (262 * scale) + 'px;' +
				'font-size:' + (32 * scale) + 'px;' +
				((team_id === 0) ? 'margin-left' : 'margin-right') + ':' + (8 * scale) + 'px'
			),
		});
		var team_name_span = uiu.el(team_block, 'span', {
			'class': 'd_castall_bottom_team_name',
			'style': 'color: ' + colors.fg,
		}, team_names[team_id]);
		_setup_autosize(team_name_span);

		var bottom_fg_color = utils.contrast_color(colors[team_id], colors.bg, colors.fg);
		uiu.el(bottom_block, 'div', {
			'class': 'd_castall_score' + team_id,
			'style': (
				'height:' + (54 * scale) + 'px;' +
				'margin-bottom:' + (1 * scale) + 'px;' +
				'color:' + bottom_fg_color + ';' +
				'background: ' + colors[team_id] + ';' +
				'width:' + (65 * scale) + 'px;' +
				'font-size:' + (60 * scale) + 'px'),
		}, match_score[team_id]);
	}

	var colon_container = uiu.el(bottom_container, 'div', {
		'class': 'd_castall_bcolon',
	});
	uiu.el(colon_container, 'div', {
		'style': 'font-size:' + (50 * scale) + 'px; margin-top: -0.1em;',
	}, ':');

	if (logo_url) {
		var logo_row = uiu.el(bottom_block, 'div', {
			style: (
				'position: absolute;' +
				'left: 0;' +
				'width: 100%;' +
				'top:-' + (55 * scale) + 'px;' +
				'height:' + (55 * scale) + 'px;' +
				'display: flex;' +
				'justify-content:center;'
			),
		});
		uiu.el(logo_row, 'div', {
			style: (
				'width: 0; height: 0;' +
				'border-top:' + (53.5 * scale) + 'px solid transparent;' +
				'border-right:' + (20 * scale) + 'px solid ' + colors.bg + ';' +
				'margin-top:' + (1.5 * scale) + 'px;' +
				'margin-right:' + (-1 * scale) + 'px;'
			),
		});
		var logo_mid = uiu.el(logo_row, 'div', {
			style: (
				'background:' + colors.bg + ';' +
				'border-top-left-radius:' + (5 * scale) + 'px;' +
				'border-top-right-radius:' + (5 * scale) + 'px;' +
				'height:' + (55 * scale) + 'px;' +
				'width:' + (90 * scale) + 'px;'
			),
		});
		uiu.el(logo_mid, 'div', {
			style: (
				'height:' + (45 * scale) + 'px;' +
				'margin-top: ' + (5 * scale) + 'px;' +
				'margin-bottom: ' + (5 * scale) + 'px;' +
				'width:' + (90 * scale) + 'px;' +
				'background: no-repeat center/contain url("' + logo_url + '");'
			),
		});
		uiu.el(logo_row, 'div', {
			style: (
				'width: 0; height: 0;' +
				'border-top:' + (53.5 * scale) + 'px solid transparent;' +
				'border-left:' + (20 * scale) + 'px solid ' + colors.bg + ';' +
				'margin-top:' + (1.5 * scale) + 'px;' +
				'margin-left:' + (-1 * scale) + 'px;'
			),
		});
	}
}

function render_stream(s, container, event/*, colors*/) {
	if (!event.courts) {
		uiu.el(container, 'div', 'error', 'Court information missing');
		return;
	}

	var logo_urls = extradata.team_logos(event);
	var team_names = event.team_names || ['', ''];
	var court_count = event.courts.length;

	for (var court_idx = 0;court_idx < event.courts.length;court_idx++) {
		var real_court_idx = s.settings.displaymode_reverse_order ? (court_count - 1 - court_idx) : court_idx;
		var court = event.courts[real_court_idx];
		var match = _match_by_court(event, court);
		var setup = match ? match.setup : eventutils.default_setup(event.league_key);
		var max_games = calc.max_game_count(setup);
		var nscore = (match ? match.network_score : 0) || [];
		var current_score = (nscore.length > 0) ? nscore[nscore.length - 1] : ['', ''];
		var server = match ? determine_server(match, current_score) : {};

		var border_radius = '0.2vw';
		var table = uiu.el(container, 'table', {
			style: (
				'position: fixed;top:1vw;' + (court_idx === 0 ? 'left' : 'right') + ':1.3vw;' +
				'border-radius:' + border_radius + ';border-collapse:collapse;' +
				'vertical-align:middle;' +
				'font-size:1.4vw;color:#000;background:#ddd;'
			),
		});

		var event_logo_url = extradata.logo_url(event);
		for (var team_idx = 0;team_idx < 2;team_idx++) {
			var tr = uiu.el(table, 'tr', {
				style: (team_idx === 0) ? '' : 'border-top:0.05vw solid #fff;'});

			if ((team_idx === 0) && event_logo_url) {
				var logo_td = uiu.el(tr, 'td', {
					rowspan: '2',
				});
				uiu.el(logo_td, 'div', {
					title: team_names[team_idx],
					style: (
						'height:2.4em;width:4em;margin-left:0.2em;' +
						'background-repeat: no-repeat;' +
						'background-position:center;' +
						'background-size:contain;' +
						'background-image:url("' + event_logo_url + '");'
					),
				});
			}

			if (logo_urls) {
				var team_logo_td = uiu.el(tr, 'td');
				if (logo_urls[team_idx]) {
					uiu.el(team_logo_td, 'div', {
						style: (
							'background: url("' + logo_urls[team_idx] + '") no-repeat center center;' +
							'background-size:contain;margin-left:0.3vw;' +
							'height:1.4em;width:2em;'
						),
					});
				}
			}

			uiu.el(
				tr, 'td', {
					style: (
						'padding-right:0.5em;overflow:hidden;white-space:pre;' +
						'width:8em;max-width:8em;min-width:8em;' +
						'font-size:80%;'
					),
				}, match ? namestr_short(match.setup.teams[team_idx].players) : '');

			for (var game_idx = 0;game_idx < max_games;game_idx++) {
				var team_serving = false;
				if (game_idx < nscore.length) {
					var gwinner = calc.game_winner(
						match.setup, game_idx, nscore[game_idx][0], nscore[game_idx][1]);
					team_serving = (
						(gwinner === 'left') ? (team_idx === 0) : (
						(gwinner === 'right') ? (team_idx === 1) : (
						(server.team_id === team_idx))));
				}

				var extra_style = '';
				if (game_idx === max_games - 1) {
					if (team_idx === 0) {
						extra_style += 'border-top-right-radius:' + border_radius + ';';
					} else {
						extra_style += 'border-bottom-right-radius:' + border_radius + ';';
					}
				}

				uiu.el(tr, 'td', {
					style: (
						'width:1.2em;border-left:0.1vw solid #888;font-family:Arial Black;' +
						'padding:0 0.2em;text-align:center;background:#555;' +
						'font-size:90%;' +
						'color:' + (team_serving ? '#ee0' : '#fff') + ';' +
						extra_style),
				}, (game_idx < nscore.length) ? nscore[game_idx][team_idx] : '');
			}
		}
	}

	// TODO make all used colors configurable
}

function render_streamteam(s, container, event, colors) {
	if (!event.courts) {
		// Do not show any error, this is for streaming
		return;
	}

	var match_score = _calc_matchscore(event.matches);
	var team_names = event.team_names || ['', ''];

	var inner_container = uiu.el(container, 'div', {
		style: (
			'background:' + colors.bg + ';' +
			'color:' + colors.fg + ';' +
			'font-size:7.2vw;' +
			'height:5.8vw;' +
			'position:absolute;left:0;right:0;top:0;bottom:0;'
		),
	});

	var autosize_els = [];

	var _render_team = function(team_id) {
		var div = uiu.el(inner_container, 'div', {
			style: (
				'position:absolute;display:flex;' +
				(team_id === 0 ? 'left' : 'right') + ':0;top:0;' +
				'height:100%;width:42vw;' +
				'align-items:center;' +
				'justify-content:center;'
			),
		});
		var span = uiu.el(div, 'span', {
			style: 'white-space:pre;',
		}, team_names[team_id]);
		autosize_els.push(span);
	};

	_render_team(0);
	var middle = uiu.el(inner_container, 'div', {
		style: (
			'position:absolute;display:flex;' +
			'top:0;height:100%;left:42vw;width:16vw;'
		),
	});
	var NUMBER_CSS = (
		'display: inline-flex; width: 50%; height: 100%;' +
		'justify-content: center; align-items: center;');
	uiu.el(middle, 'span', {
		style: (
			NUMBER_CSS +
			'color:' + colors['b0'] + ';' +
			'background:' + colors['0'] + ';'
		),
	}, match_score[0]);
	var colon_container = uiu.el(middle, 'div', {
		style: (
			'position:absolute;left:0;right:0;top:0;bottom:0;' +
			'display: inline-flex; justify-content: center; align-items: center;' +
			'color:' + colors.fg
		),
	});
	uiu.el(colon_container, 'span', {}, ':');
	uiu.el(middle, 'span', {
		style: (
			NUMBER_CSS +
			'color:' + colors['b1'] + ';' +
			'background:' + colors['1'] + ';'
		),
	}, match_score[1]);
	_render_team(1);

	autosize_els.forEach(function(as_el) {
		_setup_autosize(as_el);
	});
}


function render_streamcourt(s, container, event/*, colors*/) {
	if (!event.courts) {
		uiu.el(container, 'div', 'error', 'Court information missing');
		return;
	}

	var court = event.courts.find(function(c) {
		return c.court_id == s.settings.displaymode_court_id;
	}) || event.courts[0];
	var match = _match_by_court(event, court);
	var setup = match ? match.setup : eventutils.default_setup(event.league_key);
	var max_games = calc.max_game_count(setup);
	var nscore = (match ? match.network_score : 0) || [];
	var current_score = (nscore.length > 0) ? nscore[nscore.length - 1] : ['', ''];
	var server = match ? determine_server(match, current_score) : {};
	var logo_urls = extradata.team_logos(event);

	var border_radius = '0.8vw';
	var table = uiu.el(container, 'table', {
		style: (
			'position: fixed;top:0;left:0;width:100%;height:12vw;' +
			'border-radius:' + border_radius + ';border-collapse:collapse;' +
			'vertical-align:middle;' +
			'font-size:4.7vw;color:#000;background:#ddd;'
		),
	});

	var event_logo_url = extradata.logo_url(event);
	for (var team_idx = 0;team_idx < 2;team_idx++) {
		var tr = uiu.el(table, 'tr', {
			style: (team_idx === 0) ? '' : 'border-top:0.05vw solid #fff;'});

		if ((team_idx === 0) && event_logo_url) {
			var logo_td = uiu.el(tr, 'td', {
				rowspan: '2',
				style: 'width:4em;',
			});
			uiu.el(logo_td, 'div', {
				style: (
					'height:2.4em;width:4em;margin-left:0.2em;' +
					'background-repeat: no-repeat;' +
					'background-position:center;' +
					'background-size:contain;' +
					'background-image:url("' + event_logo_url + '");'
				),
			});
		}

		if (logo_urls) {
			var team_logo_td = uiu.el(tr, 'td', {
				style: 'width: 2em;',
			});
			if (logo_urls[team_idx]) {
				uiu.el(team_logo_td, 'div', {
					style: (
						'background: url("' + logo_urls[team_idx] + '") no-repeat center center;' +
						'background-size:contain;margin-left:0.3vw;' +
						'height:1.4em;width:2em;'
					),
				});
			}
		}

		uiu.el(
			tr, 'td', {
				style: (
					'padding-right:0.5em;overflow:hidden;white-space:pre;' +
					'min-width:8em;' +
					'font-size:80%;'
				),
			}, match ? namestr_short(match.setup.teams[team_idx].players) : '');

		for (var game_idx = 0;game_idx < max_games;game_idx++) {
			var team_serving = false;
			if (game_idx < nscore.length) {
				var gwinner = calc.game_winner(
					match.setup, game_idx, nscore[game_idx][0], nscore[game_idx][1]);
				team_serving = (
					(gwinner === 'left') ? (team_idx === 0) : (
					(gwinner === 'right') ? (team_idx === 1) : (
					(server.team_id === team_idx))));
			}

			var extra_style = '';
			if (game_idx === max_games - 1) {
				if (team_idx === 0) {
					extra_style += 'border-top-right-radius:' + border_radius + ';';
				} else {
					extra_style += 'border-bottom-right-radius:' + border_radius + ';';
				}
			}

			uiu.el(tr, 'td', {
				style: (
					'width:1.2em;border-left:0.1vw solid #888;font-family:Arial Black;' +
					'padding:0 0.2em;text-align:center;background:#555;' +
					'font-size:90%;' +
					'color:' + (team_serving ? '#ee0' : '#fff') + ';' +
					extra_style),
			}, (game_idx < nscore.length) ? nscore[game_idx][team_idx] : '');
		}
	}
}


function render_streamcourt_dm(s, container, event/*, colors*/) {
	if (!event.courts) {
		uiu.el(container, 'div', 'error', 'Court information missing');
		return;
	}

	var court = event.courts.find(function(c) {
		return c.court_id == s.settings.displaymode_court_id;
	}) || event.courts[0];
	var match = _match_by_court(event, court);
	var setup = match ? match.setup : eventutils.default_setup(event.league_key);
	var max_games = calc.max_game_count(setup);
	var nscore = (match ? match.network_score : 0) || [];
	var current_score = (nscore.length > 0) ? nscore[nscore.length - 1] : ['', ''];
	var server = match ? determine_server(match, current_score) : {};
	
	
	var logo = uiu.el(container, 'div', {
		style: (
			'position:absolute;top:3vh;left:4vh;' +
			'height:10vh;width:9vh;' +
			'background-repeat: no-repeat;' +
			'background-position:center;' +
			'background-size:contain;' +
			'background-image:url("icons/Ball_DM_Cloppenburg.svg");'+
			'z-index:10;'
		),
	});
	var top_bar = uiu.el(container, 'div', {
		style: (
			'position:absolute;top:3.6vh;left:6.6vh;' +
			'height:8.8vh;' +
			'z-index:-1;' +
			'display: flex;' +
    		'flex-direction: row;'

		),
	});

	var top_bar_left = uiu.el(top_bar, 'div', {
		style: (
			'position:static;' +
			'height:8.8vh;width:fit-content;' +
			'display: flex;' +
			'flex-direction: column;' +
			'justify-content: space-between;'
		),
	});





	var border_top = uiu.el(top_bar_left, 'div', {
		style: (
			'position:static;' +
			'height:5%;width:100%;' +
			'background-color: #ffffff;' +
			'border-top-right-radius: 1vh;'
		),
	});

	var teams = [];

	teams.push(uiu.el(top_bar_left, 'div', {
		style: (
			'position:static;' +
			'height:43%;width:100%;' +
			'background-color: #ffffffbb;'  +
			'display: flex;' +
    		'justify-content: space-between;'
		),
	}));

	var border_middle = uiu.el(top_bar_left, 'div', {
		style: (
			'position:static;' +
			'height:4%;width:100%;'
		),
	});


	teams.push(uiu.el(top_bar_left, 'div', {
		style: (
			'position:static;' +
			'height:43%;width:100%;' +
			'background-color: #ffffffbb;' +
			'display: flex;' +
    		'justify-content: space-between;'
		),
	}));

	var border_bottom = uiu.el(top_bar_left, 'div', {
		style: (
			'position:static;' +
			'height:5%;width:100%;' +
			'background-color: #ffffff;' +
			'border-bottom-right-radius: 1vh;'
		),
	});

	var team_service = [];
	for (var team_idx = 0;team_idx < 2;team_idx++) {
		var team_name = uiu.el(teams[team_idx], 'div', {
			style: (
				'margin-left:6.7vh;' +
				'font-size:3vh;' + 
				'height: 100%;' +
				'align-content: center;' +
				'width: fit-content;'
			)
		},
		match ? namestr_short(match.setup.teams[team_idx].players) : '');
		
		let service = uiu.el(teams[team_idx], 'div', {
			style: (
				'height: 100%;' +
				'align-content: center;' +
				'width: 4vh;' +
				'background-repeat: no-repeat;' +
				'background-position:center;' +
				'background-size:contain;' +
				'background-image:url("icons/Ball_DM_Cloppenburg_schwarz.svg");'
			)});

		service.style.visibility = "hidden";

		team_service.push(service);

	}

	var sets = [];

	var team_serving = -1;

	for (var game_idx = 0;game_idx < max_games;game_idx++) {
		
		if (game_idx < nscore.length) {

			for (var team_idx = 0;team_idx < 2;team_idx++) {
				var gwinner = calc.game_winner(
					match.setup, game_idx, nscore[game_idx][0], nscore[game_idx][1]);
				var is_team_serving = (
					(gwinner === 'left') ? (team_idx === 0) : (
					(gwinner === 'right') ? (team_idx === 1) : (
					(server.team_id === team_idx))));

				if(is_team_serving) {
					team_serving = team_idx;
				}
			}
			
			var top_bar_set = uiu.el(top_bar, 'div', {
				style: (
					'position:static;' +
					'height:8.8vh;width:4vh;' +
					'display: flex;' +
					'flex-direction: column;' +
					'justify-content: space-between;' +
					'margin-left: 0.3vh;'
				),
			});

			uiu.el(top_bar_set, 'div', {
				style: (
					'position:static;' +
					'height:5%;width:100%;' +
					'background-color: #ffffff;' +
					'border-top-left-radius: 1vh;' +
					'border-top-right-radius: 1vh;'
				),
			});

			let set = [];
			set.push(uiu.el(top_bar_set, 'div', {
				style: (
					'position:static;' +
					'height:43%;width:100%;' +
					'background-color: #ffffffbb;'  +
					'display: flex;' +
    				'justify-content: center;' + 
					'font-size:3vh;' +
					'align-items: center;'
				),
			}, nscore[game_idx][0]));

			uiu.el(top_bar_set, 'div', {
				style: (
					'position:static;' +
					'height:4%;width:100%;'
				),
			});

			set.push(uiu.el(top_bar_set, 'div', {
				style: (
					'position:static;' +
					'height:43%;width:100%;' +
					'background-color: #ffffffbb;'  +
					'display: flex;' +
    				'justify-content: center;' + 
					'font-size:3vh;' +
					'align-items: center;'
				),
			}, nscore[game_idx][1]));

			uiu.el(top_bar_set, 'div', {
				style: (
					'position:static;' +
					'height:5%;width:100%;' +
					'background-color: #ffffff;' +
					'border-bottom-left-radius: 1vh;' +
					'border-bottom-right-radius: 1vh;'
				),
			});

			sets.push(set);
		}
	}

	if(team_serving >= 0) {
		team_service[team_serving].style.visibility = 'visible';
	}

	var logo_dm = uiu.el(container, 'div', {
		style: (
			'position:absolute;bottom:1vh;right:2vh;' +
			'height:17.008vh;width:28.346vh;' +
			'background-repeat: no-repeat;' +
			'background-position:center;' +
			'background-size:contain;' +
			'background-image:url("icons/DBM_Schriftzug_mit_73_wiess.svg");'+
			'z-index:10;'
		),
	});


	var top_bar_right = uiu.el(container, 'div', {
		style: (
			'position:absolute; top: 3.6vh;left: calc(100% - 33.2vh);' +
			'height:8.8vh;' +
			'z-index:-1;' +
			'display: flex;' +
    		'flex-direction: column;' +
			'color: #ffffff'
		),
	});

	uiu.el(top_bar_right, 'div', {
		style: (
			'position:static;' +
			'text-align: center;' +
			'height: 2.5vh;' +
			'width: 100%;' +
			'font-size: 2.1vh;' +
			'font-weight: bold;'
		),
	}, s._('Court') + ' ' + (court.label || court.num || court.court_id));

	uiu.el(top_bar_right, 'div', {
		style: (
			'position:static;' +
			'text-align: center;' +
			'height: 2.5vh;' +
			'width: 100%;' +
			'font-size: 2.1vh;' +
			'font-weight: bold;'
		),
	}, createEventAnnouncement(s, match.setup));

	uiu.el(top_bar_right, 'div', {
		style: (
			'position:static;' +
			'text-align: center;' +
			'height: 2.5vh;' +
			'width: 100%;' +
			'font-size: 2.1vh;' +
			'font-weight: bold;'
		),
	}, createRoundAnnouncement(s, match.setup));
}

function createRoundAnnouncement(s, matchSetup) {
    var round = matchSetup.match_name;
    if (round == "R64") {
        round = s._('announcements:round_64');
	} else if (round == "R32") {
		round = s._('announcements:round_32');
    } else if (round == "R16") {
        round = s._('announcements:round_16');
    } else if (round == "VF") {
        round = s._('announcements:quaterfinal');
    } else if (round == "HF") {
        round = s._('announcements:semifinal');
    } else if (round == "Finale") {
        round = s._('announcements:final');
    } else if (round.indexOf('/') !== -1) {
        var roundParts = round.split("/")
        var diff = roundParts[1] - roundParts[0];
        if (diff > 1) {
            round = s._('announcements:intermediate_round');
        } else {
            round = s._('announcements:game_for_place') + roundParts[0] + s._('announcements:and') + roundParts[1];
        }
    } else if (round.indexOf('-') !== -1) {
        round = s._('announcements:intermediate_round');
    } else {
        round = "";
    }
    return round;
}
function createEventAnnouncement(s, matchSetup) {
    var eventParts = matchSetup.event_name.replaceAll("-", " ").split(" ");
    var eventName = "";
    if (eventParts[0] == 'JE') {
        eventName = s._('announcements:boys_singles');
    } else if (eventParts[0] == 'JD') {
        eventName = s._('announcements:boys_doubles');
    } else if (eventParts[0] == 'ME') {
        eventName = s._('announcements:girls_singles');
    } else if (eventParts[0] == 'MD') {
        eventName = s._('announcements:girls_doubles')
    } else if (eventParts[0] == 'GD' || eventParts[0] == 'MX') {
        eventName = s._('announcements:mixed_doubles')
    } else if (eventParts[0] == 'HE') {
        eventName = s._('announcements:men_singles');
    } else if (eventParts[0] == 'HD') {
        eventName = s._('announcements:men_doubles');
    } else if (eventParts[0] == 'DE') {
        eventName = s._('announcements:women_singles');
    } else if (eventParts[0] == 'DD') {
        eventName = s._('announcements:women_doubles');
    }
    if (eventName == "") {
        if (eventParts[1] == 'JE') {
            eventName = s._('announcements:boys_singles');
        } else if (eventParts[1] == 'JD') {
            eventName = s._('announcements:boys_doubles');
        } else if (eventParts[1] == 'ME') {
            eventName = s._('announcements:girls_singles');
        } else if (eventParts[1] == 'MD') {
            eventName = s._('announcements:girls_doubles')
        } else if (eventParts[1] == 'GD' || eventParts[1] == 'MX') {
            eventName = s._('announcements:mixed_doubles')
        } else if (eventParts[1] == 'HE') {
            eventName = s._('announcements:men_singles');
        } else if (eventParts[1] == 'HD') {
            eventName = s._('announcements:men_doubles');
        } else if (eventParts[1] == 'DE') {
            eventName = s._('announcements:women_singles');
        } else if (eventParts[1] == 'DD') {
            eventName = s._('announcements:women_doubles');
        }
        if (eventParts[0]) {
            eventName = eventName + " " + eventParts[0];
        }
    } else {
        if (eventParts[1]) {
            eventName = eventName + " " + eventParts[1];
        }
    }
    return eventName;
}



function render_list(container, event) {
	render_html_list(container, event); // TODO switch to svg
}

function render_html_list(container, event) {
	var max_games = _calc_max_games(event);
	var match_score = _calc_matchscore(event.matches);
	var home_winning = match_score[0] > (event.matches.length / 2);
	var away_winning = match_score[1] > (event.matches.length / 2);
	if ((match_score[0] === event.matches.length / 2) && (match_score[0] === event.matches.length / 2)) {
		// draw
		home_winning = true;
		away_winning = true;
	}
	var match_list = uiu.el(container, 'table', {
		'class': 'display_list_container',
	});
	var match_list_head = uiu.el(match_list, 'tr', {
		'class': 'display_list_thead',
	});
	uiu.el(match_list_head, 'th', {
		'class': 'display_list_match_name',
	}, '');
	var team_names = event.team_names || [];
	var home_span = _list_render_team_name(match_list_head, team_names[0]);
	var away_span = _list_render_team_name(match_list_head, team_names[1]);
	var match_score_el = uiu.el(match_list_head, 'th', {
		'class': 'display_list_matchscore',
		'colspan': max_games,
	});
	uiu.el(match_score_el, 'span', {
		'class': (home_winning ? 'display_list_winning' : ''),
		'style': (home_winning ? '' : 'color: #ddd;'),
	}, match_score[0]);
	uiu.el(match_score_el, 'span', {'class': 'display_list_vs'}, ' : ');
	uiu.el(match_score_el, 'span', {
		'class': (away_winning ? 'display_list_winning' : ''),
		'style': (away_winning ? '' : 'color: #ddd;'),
	}, match_score[1]);

	// Now that we're done with initializing the first row, actually call autosizing
	_setup_autosize(home_span);
	_setup_autosize(away_span);

	event.matches.forEach(function(m) {
		var netscore = m.network_score || [];
		var mwinner = calc.match_winner(m.setup, netscore);

		var row = uiu.el(match_list, 'tr');
		uiu.el(row, 'td', {
			'class': 'display_list_match_name',
		}, m.setup.short_name || m.setup.match_name);
		var home_td = uiu.el(row, 'td', {
			'class': 'display_list_player_names' + ((mwinner === 'left') ? ' display_list_winning_players' : ''),
		});
		_list_render_player_names(home_td, m.setup.teams[0].players, (mwinner === 'left'));
		var away_td = uiu.el(row, 'td', {
			'class': 'display_list_player_names' + ((mwinner === 'right') ? ' display_list_winning_players' : ''),
		});
		_list_render_player_names(away_td, m.setup.teams[1].players, (mwinner === 'right'));

		for (var game_idx = 0;game_idx < max_games;game_idx++) {
			var score_td = uiu.el(row, 'td', {
				'class': 'display_list_game_score',
			});

			if (game_idx >= netscore.length) {
				continue;
			}
			var nscore = netscore[game_idx];
			var gwinner = calc.game_winner(m.setup, game_idx, nscore[0], nscore[1]);
			uiu.el(score_td, 'span', {
				'class': ((gwinner === 'left') ? 'display_list_winning' : ''),
				'style': ((gwinner === 'left') ? '' : 'color:#ddd;'),
			}, nscore[0]);
			uiu.el(score_td, 'span', {
				'class': 'display_list_vs',
			}, ':');
			uiu.el(score_td, 'span', {
				'class': ((gwinner === 'right') ? 'display_list_winning' : ''),
				'style': ((gwinner === 'right') ? '' : 'color:#ddd;'),
			}, nscore[1]);
		}
	});
}

function render_oncourt(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var current_score = (nscore.length > 0) ? nscore[nscore.length - 1] : ['', ''];
	var server = determine_server(match, current_score);
	var team_names = event.team_names || [];
	var setup = match.setup;
	var prev_scores = nscore.slice(0, -1);
	var autosizes = [];

	var outer_container = uiu.el(container, 'div', {
		style: (
			'background:' + colors.bg + ';' +
			'color:' + colors.fg + ';' +
			'width: 100%;height:100%;' +
			'display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;'
		),
	});
	var oncourt_container = uiu.el(outer_container, 'div', {
		style: 'position:relative;',
	});

	function _render_team(team_id) {
		var team = setup.teams[team_id];

		var pnames = _player_names(team, setup.is_doubles);
		var player_container = uiu.el(oncourt_container, 'div', {
			'style': (
				'height:30vh;' +
				(setup.is_doubles ?
					'' :
					'display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;'
				)
			),
		});
		pnames.forEach(function(pname, player_id) {
			var is_serving = (team_id === server.team_id) && (player_id === server.player_id);
			var player_name_container = uiu.el(player_container, 'div', {
				'style': (
					'height: 15vmin;font-size:12vmin;' +
					'white-space:pre;' +
					(is_serving ? 'color:' + colors.cserv2 + ';' : '')
				),
			});
			var player_name_span = uiu.el(
				player_name_container, 'span', {}, pname);
			autosizes.push({el: player_name_span, right_node: score_els[team_id]});
		});
	}

	var top_current_score = uiu.el(oncourt_container, 'div', {
		'style': (
			'position:absolute;right:0;top:0;' +
			'font-size: 32vmin;line-height: 32vmin;'
		),
	}, current_score[0]);
	var bottom_current_score = uiu.el(oncourt_container, 'div', {
		'style': (
			'position:absolute;right:0;bottom:0;' +
			'font-size: 32vmin;line-height: 32vmin;'
		),
	}, current_score[1]);
	var score_els = [top_current_score, bottom_current_score];

	_render_team(0);

	var middle_table = uiu.el(oncourt_container, 'table', {
		style: 'table-layout:fixed;width:100%;',
	});
	team_names.forEach(function(team_name, team_id) {
		var tr = uiu.el(middle_table, 'tr', {
			style: 'height:11vmin;',
		});
		var name_td = uiu.el(tr, 'td', {
			style: (
				'color:' + colors.fg3 + ';' +
				'font-size:10vmin;'
			),
		});
		var team_span = uiu.el(name_td, 'span', {}, team_name);
		autosizes.push({el: team_span});

		prev_scores.forEach(function(ps) {
			uiu.el(tr, 'td', {
				'style': (
					((ps[team_id] > ps[1 - team_id]) ? 'color:' + colors.serv2 + ';' : '') +
					'font-size:10vmin;text-align:right;width:3ch;'
				),
			}, ps[team_id]);
		});
	});

	_render_team(1);

	autosizes.forEach(function(aus) {
		_setup_autosize(aus.el, aus.right_node);
	});
}

function _gamescore_from_netscore(netscore, setup) {
	var gscores = [0, 0];
	netscore.forEach(function(gs, game_idx) {
		var winner = calc.game_winner(setup, game_idx, gs[0], gs[1]);
		if (winner == 'left') {
			gscores[0]++;
		} else if (winner == 'right') {
			gscores[1]++;
		}
	});
	return gscores;
}

function extract_netscore(match) {
	var res = utils.deep_copy(match.network_score) || [];

	if (res.length === 0) {
		return [[0, 0]];
	}

	var setup = match.setup;
	var last_game = res[res.length - 1];
	var last_winner = calc.game_winner(setup, res.length - 1, last_game[0], last_game[1]);
	if ((last_winner === 'left') || (last_winner === 'right')) {
		var mwinner = calc.match_winner(setup, res);
		if ((mwinner !== 'left') && (mwinner !== 'right')) {
			res.push([0, 0]);
		}
	}
	return res;
}

function render_andre(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);

	match.setup.teams.forEach(function(team, team_id) {
		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));
		var points = current_score[team_id];

		var player_names = team.players.map(function(player) {
			return player.name;
		});
		while (player_names.length < pcount) {
			player_names.push('');
		}

		var team_container = uiu.el(container, 'div', {
			'class': 'd_andre_team',
			style: (
				'background:' + colors.bg + ';' +
				'color:' + colors.fg + ';'
			),
		});

		if (! compat.supports_flexbox()) { // Samsung TVs at DM O35 2017
			var table = uiu.el(team_container, 'table', {
				style: 'height: 45vh; width: 100vw; min-width: 95vw;',
			});
			var tbody = uiu.el(table, 'tbody');

			var tr1 = uiu.el(tbody, 'tr');
			var tr2 = uiu.el(tbody, 'tr');
			var trs = [tr1, tr2];

			uiu.el(tr1, 'td', {
				rowspan: 2,
				style: 'font-size: 10vh; vertical-align: middle;',
			}, gscore[team_id]);

			var is_singles = (player_names.length < 2);
			player_names.forEach(function(pn, name_idx) {
				var ptd = uiu.el(trs[name_idx], 'td', {
					rowspan: (is_singles ? 2 : 1),
					style: 'vertical-align: middle; font-size: 80px;',
				});
				uiu.el(ptd, 'span', {}, pn);
			});

			uiu.el(tr1, 'td', {
				rowspan: 2,
				style: (
					'width: 50vh;' +
					'background:' + (team_serving ? colors.fg : colors.bg) + ';' +
					'color:' + (team_serving ? colors.bg : colors.fg) + ';' +
					'text-align: center;' +
					'font-size: 40vh;'
				),
			}, points);

			if (team_id === 0) {
				uiu.el(container, 'div', {
					'class': 'd_andre_mid',
					'style': (
						'color:' + colors.fg2 + ';'
					),
				}, _match_name(match.setup));
			}
			return;
		}
		uiu.el(team_container, 'div', 'd_andre_gscore', gscore[team_id]);

		var players_container = uiu.el(team_container, 'div', 'd_andre_players');
		var player_spans = player_names.map(function(pname, player_id) {
			var pel = uiu.el(players_container, 'div', {
				'class': 'd_andre_player',
				style: (
					'height:' + (is_doubles ? '50%' : '100%') + ';'
				),
			});
			if (server && server.team_id === team_id && server.player_id === player_id) {
				uiu.el(pel, 'div', 'd_shuttle');
			}
			return uiu.el(pel, 'span', {}, pname);
		});

		var score_el = uiu.el(team_container, 'div', {
			'class': 'd_andre_score',
			style: (
				'background:' + (team_serving ? colors.fg : colors.bg) + ';' +
				'color:' + (team_serving ? colors.bg : colors.fg) + ';' +
				((team_id === 0) ? 'top' : 'bottom') + ': 0;'
			),
		}, points);

		if (team_id === 0) {
			uiu.el(container, 'div', {
				'class': 'd_andre_mid',
				'style': (
					'color:' + colors.fg2 + ';'
				),
			}, _match_name(match.setup));
		}

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, score_el, function(parent_node) {
				return parent_node.offsetHeight * 0.6;
			});
		});
	});
}

function render_international(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var first_game = (nscore.length < 2);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var players = team.players.slice();
		while (players.length < pcount) {
			players.push({
				name: '',
			});
		}

		var team_container = uiu.el(container, 'div', 'd_international_team');
		var player_spans = players.map(function(player, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);
			var bg_css = 'background: ' + (is_server ? col : colors.bg) + ';';
			var style = (
				bg_css +
				'color: ' + (is_server ? colors.bg : col) + ';' +
				'height: ' + (is_doubles ? '100%' : '50%') + ';'
			);

			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '50%' : '100%') + ';' + bg_css,
				'class': 'd_international_player_container',
			});
			if (event.nation_competition) {
				var flag_container = uiu.el(player_container, 'div', {
					style: (
						'width: 14vh;' +
						'height: ' + (is_doubles ? '100%' : '50%') + ';' +
						bg_css +
						'display:flex; align-items: center; justify-content:center;'),
				});
				if (player.nationality) {
					uiu.el(flag_container, 'img', {
						style: 'display:block;height:14vh;width:14vh;',
						src: 'div/flags/' + player.nationality + '.svg',
						alt: player.nationality,
					});
				}
			}
			var pel = uiu.el(player_container, 'div', {
				style: style,
				'class': 'd_international_player',
			});
			return uiu.el(pel, 'div', {}, player.name);
		});

		var right_border;
		if (! first_game) {
			right_border = uiu.el(team_container, 'div', {
				'class': 'd_international_gscore',
				style: 'background: ' + colors.bg + '; color: ' + colors.fg + ';',
			}, gscore[team_id]);
		}

		var points = current_score[team_id];
		var points_el = uiu.el(team_container, 'div', {
			'class': 'd_international_score' + ((points >= 10) ? ' d_international_score_dd' : ''),
			style: 'background: ' + (team_serving ? col : colors.bg) + '; color: ' + (team_serving ? colors.bg : col),
		}, points);
		if (!right_border) {
			right_border = points_el;
		}

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, right_border, function(parent_node) {
				return 0.8 * parent_node.offsetHeight;
			});
		});
	});
}

function render_bwf(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var first_game = (nscore.length < 2);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var players = team.players.slice();
		while (players.length < pcount) {
			players.push({
				name: '',
			});
		}

		var team_container = uiu.el(container, 'div', {
			'class': 'd_international_team',
			'style': 'background:' + colors.bg + ';',
		});
		players.map(function(player, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);
			var bg_css = 'background: ' + (is_server ? col : colors.bg) + ';';
			var style = (
				bg_css +
				'color: ' + (is_server ? colors.bg : col) + ';' +
				'height: ' + (is_doubles ? '100%' : '50%') + ';'
			);

			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '50%' : '100%') + ';',
				'class': 'd_international_player_container',
			});
			var flag_container = uiu.el(player_container, 'div', {
				style: (
					'width: 14vh;' +
					'height: ' + (is_doubles ? '100%' : '50%') + ';' +
					bg_css +
					'display:flex; align-items: center; justify-content:center;'),
			});
			if (player.nationality) {
				uiu.el(flag_container, 'img', {
					style: 'display:block;height:14vh;width:14vh;',
					src: 'div/flags/' + player.nationality + '.svg',
					alt: player.nationality,
				});
			}
			var pel = uiu.el(player_container, 'div', {
				style: style,
				'class': 'd_bwf_player',
			});
			utils.annotate_lastname(player);
			var player_name = player.lastname.toUpperCase() + (player.firstname ? ', ' + player.firstname : '');

			return uiu.el(pel, 'div', {
				'style': 'white-space:pre;overflow-x:hidden',
			}, player_name);
		});

		if (! first_game) {
			uiu.el(team_container, 'div', {
				'class': 'd_international_gscore',
				style: 'background: ' + colors.bg + '; color: ' + colors.fg + ';',
			}, gscore[team_id]);
		}

		var points = current_score[team_id];
		uiu.el(team_container, 'div', {
			'class': 'd_international_score' + ((points >= 10) ? ' d_international_score_dd' : ''),
			style: 'background: ' + (team_serving ? col : colors.bg) + '; color: ' + (team_serving ? colors.bg : col),
		}, points);
	});
}

function render_bwfonlyplayers(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var bg_col = colors['b' + team_id] || '#000';
		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var players = team.players.slice();
		while (players.length < pcount) {
			players.push({
				name: '',
			});
		}

		var team_container = uiu.el(container, 'div', {
			'class': 'd_international_team',
			'style': 'background:' + bg_col + ';',
		});
		players.map(function(player, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);
			var bg_css = 'background: ' + (is_server ? col : bg_col) + ';';

			var player_container = uiu.el(team_container, 'div', {
				'style': (
					'height: ' + (is_doubles ? '50%' : '100%') + ';' +
					bg_css +
					'color: ' + (is_server ? bg_col : col) + ';'),
				'class': 'd_bwfonlyplayers_player_container',
			});
			var flag_container = uiu.el(player_container, 'div', {
				style: (
					'width: 18vh;' +
					'height: ' + (is_doubles ? '100%' : '50%') + ';' +
					bg_css +
					'display:flex; align-items: center; justify-content:center;'),
			});
			if (player.nationality) {
				uiu.el(flag_container, 'img', {
					style: 'display:block;height:18vh;width:18vh;',
					src: 'div/flags/' + player.nationality + '.svg',
					alt: player.nationality,
				});
			}
			utils.annotate_lastname(player);
			var player_name = player.lastname.toUpperCase() + (player.firstname ? ', ' + player.firstname : '');

			var player_name_container = uiu.el(player_container, 'div', {
				style: (
					'height: 20vh;' +
					'position:absolute; left: 21vh; right:0;' +
					'white-space:pre;overflow:hidden;' +
					'display:flex;align-items: center;'
				),
			});
			var player_name_el = uiu.el(player_name_container, 'div', {
				style: 'font-size: 150px;', // reasonable default if autosize fails
			}, player_name);
			_setup_autosize(player_name_el);
		});
	});
}

function render_greyish(s, container, event, colors) {
	var max_game_count = _calc_max_games(event);
	var match_score = _calc_matchscore(event.matches);
	var team_names = event.team_names || ['', ''];
	var logo_urls = extradata.team_logos(event);
	var namefunc = _double_doubles_namefunc(event.matches);

	var bg = uiu.el(container, 'div', {
		style: (
			'background:' + colors.bg + ';' +
			'position:fixed;left:0;top:0;bottom:0;right:0;' +
			'padding:0;'
		),
	});

	var header = uiu.el(bg, 'table', {
		style: (
			'border-collapse:collapse;' +
			'background:' + colors.bg3 + ';' +
			'width:100%;margin-bottom:3vmin;'
		),
	});
	var tr = uiu.el(header, 'tr');

	function _render_logo(team_id) {
		if (!logo_urls) return;
		var td = uiu.el(tr, 'td', {
			style: (
				'background:' + colors.bg2 + ';padding:1vh 1vw;height:15vh;width:13vw;'
			),
		});
		uiu.el(td, 'div', {
			style: (
				'background:' + colors.bg2 + ' url("' + logo_urls[team_id] + '") no-repeat center center;' +
				'background-size:contain;' +
				'height:100%; width:100%;'
			),
		});
	}
	function _render_team(team_id) {
		uiu.el(tr, 'td', {
			style: (
				'width:' + (30 + (logo_urls ? 0 : 15)) + 'vw;' +
				'text-align:center;' +
				'color:' + colors.fg + ';' +
				'font-size:4vmin;'
			),
		}, team_names[team_id]);
	}

	_render_logo(0);
	_render_team(0);
	uiu.el(tr, 'td', {
		style: (
			'text-align:center;font-size:8vmin;' +
			'background:' + colors.bg2 + ';color:' + colors.bg
		),
	}, match_score[0] + ':' + match_score[1]);
	_render_team(1);
	_render_logo(1);

	var table = uiu.el(bg, 'table', {
		'class': 'd_greyish_table',
		'style': (
			'table-layout:fixed;width:100%;border-collapse:collapse;font-size:4vmin;' +
			'color:' + colors.fg + ';'
		),
	});
	var match_count = event.matches.length;
	event.matches.forEach(function(match) {
		var setup = match.setup;
		var nscore = extract_netscore(match);
		var mwinner = calc.match_winner(setup, nscore);

		var tr = uiu.el(table, 'tr', {
			style: (
				'height:' + (76 / match_count) + 'vh;' +
				'background:' + colors.bg3 + ';' +
				'border-top:1vh solid ' + colors.bg
			),
		});
		uiu.el(tr, 'td', {
			style: (
				'text-align:center;width:2.5em;' +
				'border-right:0.5vw solid ' + colors.bg
			),
		}, setup.match_name);
		setup.teams.forEach(function(team, team_id) {
			var is_winner = ((mwinner === 'left') && (team_id === 0) || (mwinner === 'right') && (team_id === 1));
			var pnames = _player_names(team, setup.is_doubles, namefunc);
			var common_css = (
				'text-align:center;' +
				'padding-left:0.3em;' +
				(is_winner ? ('background:' + colors.bg2 + ';color:' + colors.bg) : '') + ';'
			);
			if (pnames.length === 2) {
				uiu.el(tr, 'td', {
					style: (
						'width:14vw;' +
						common_css
					),
				}, pnames[0]);
				uiu.el(tr, 'td', {
					style: (
						'width:14vw;' +
						'border-right:0.5vw solid ' + colors.bg + ';' +
						common_css
					),
				}, pnames[1]);
			} else {
				uiu.el(tr, 'td', {
					colspan: 2,
					style: (
						'width:28vw;' +
						'border-right:0.5vw solid ' + colors.bg + ';' +
						common_css
					),
				}, namestr(team.players));
			}
		});
		for (var game_idx = 0;game_idx < max_game_count;game_idx++) {
			var gscore = nscore[game_idx];
			var winner_game = gscore && ((mwinner === 'left') && (gscore[0] > gscore[1]) || (mwinner === 'right') && (gscore[1] > gscore[0]));
			uiu.el(tr, 'td', {
				'style': (
					'text-align:center;font-size:2.3vw;' +
					'width:' + (30 / max_game_count) + 'vw;' +
					(winner_game ? ('background:' + colors.bg2 + ';color:' + colors.bg) : '')
				),
			},
				gscore ? (gscore[0] + ':' + gscore[1]) : ''
			);
		}
	});
}

function render_clean(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var player_names = team.players.map(function(player) {
			return player.name;
		});
		while (player_names.length < pcount) {
			player_names.push('');
		}

		var team_container = uiu.el(container, 'div', {
			'class': 'd_clean_team',
			'style': 'background:' + colors.bg + ';',
		});
		var player_spans = player_names.map(function(pname, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);
			var style = (
				'background: ' + (is_server ? col : colors.bg) + ';' +
				'color: ' + (is_server ? colors.bg : col) + ';' +
				'height: ' + (is_doubles ? '100%' : '50%') + ';'
			);

			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '50%' : '100%') + ';',
				'class': 'd_clean_player_container',
			});
			var pel = uiu.el(player_container, 'div', {
				style: style,
				'class': 'd_clean_player',
			});
			return uiu.el(pel, 'div', {}, pname);
		});

		var right_border = uiu.el(team_container, 'div', {
			'class': 'd_clean_gscore',
			style: 'background: ' + colors.bg + '; color: ' + colors.fg + ';',
		}, gscore[team_id]);

		var points = current_score[team_id];
		uiu.el(team_container, 'div', {
			'class': 'd_clean_score' + ((points >= 10) ? ' d_clean_score_dd' : ''),
			style: 'background: ' + (team_serving ? col : colors.bg) + '; color: ' + (team_serving ? colors.bg : col),
		}, points);

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, right_border, function(parent_node) {
				return 0.8 * parent_node.offsetHeight;
			});
		});
	});
}

function render_tim(s, container, event, colors) {
	var max_game_count = _calc_max_games(event);
	var match_score = _calc_matchscore(event.matches);
	var team_names = event.team_names || ['', ''];
	var namefunc = _double_doubles_namefunc(event.matches);
	var active_match_ids = [];
	if (event.courts) {
		active_match_ids = event.courts.map(function(c) {
			return c.match_id;
		});
	}

	var table = uiu.el(container, 'table', {
		'class': 'd_tim_table',
		'style': (
			'color:' + colors.fg + ';' +
			'border-color:' + colors.fg + ';'
		),
	});
	var thead = uiu.el(table, 'thead', {
		style: (
			'background-color:' + colors.tim_blue + ';'
		),
	});
	var top_tr = uiu.el(thead, 'tr', {
		style: 'height:20vh;',
	});
	uiu.el(top_tr, 'td');
	team_names.forEach(function(team_name) {
		uiu.el(top_tr, 'td', {
			'style': (
				'font-size:5vmin;width:26vw;'
			),
		}, team_name);
	});
	uiu.el(top_tr, 'td', {
		style: (
			'color:' + colors.tim_active + ';' +
			'font-size:12vmin'
		),
		colspan: max_game_count,
	}, match_score[0] + ' : ' + match_score[1]);

	var tbody = uiu.el(table, 'tbody');
	var match_count = event.matches.length;
	event.matches.forEach(function(match, match_num) {
		var setup = match.setup;
		var is_active = utils.includes(active_match_ids, setup.match_id);
		var nscore = extract_netscore(match);
		if (!is_active && utils.deep_equal(nscore, [[0, 0]])) {
			// Do not list matches that have not yet been started
			nscore = [];
		}

		var tr = uiu.el(tbody, 'tr', {
			style: (
				'height:' + ((80 - 0.1 * match_count) / match_count) + 'vh;' +
				'background-color:' + ((match_num % 2 === 0) ? colors.bg : colors.tim_blue) + ';'
			),
		});
		uiu.el(tr, 'td', {}, setup.match_name);
		setup.teams.forEach(function(team) {
			uiu.el(
				tr, 'td', {
					style: (
						(is_active ? ('color:' + colors.tim_active) : '')
					),
				},
				team.players.map(namefunc).join(' - '));
		});
		for (var game_idx = 0;game_idx < max_game_count;game_idx++) {
			var gscore = nscore[game_idx];
			uiu.el(tr, 'td', {
				'style': (
					'min-width:3em;'
				),
			},
				gscore ? (gscore[0] + ' : ' + gscore[1]) : ''
			);
		}
	});
}

function render_teamscore(s, container, event, colors) {
	var match_score = _calc_matchscore(event.matches);
	var team_names = event.team_names || ['', ''];
	var autosize_els = [];

	var _render_team = function(team_id) {
		var div = uiu.el(container, 'div', {
			style: (
				'display:flex;' +
				'justify-content: center;' +
				'align-items: center;' +
				'height:20%;' +
				'background:' + colors.bg +
				';color:' + colors[team_id]
			),
		});
		autosize_els.push(uiu.el(div, 'span', {}, team_names[team_id]));
	};

	_render_team(0);
	var middle = uiu.el(container, 'div', {
		style: (
			'display:flex;' +
			'justify-content: center;' +
			'align-items: center;' +
			'font-size:60vh;' +
			'height:60%;' +
			'background:' + colors.bg
		),
	});
	uiu.el(middle, 'span', {
		style: 'color:' + colors[0],
	}, match_score[0]);
	uiu.el(middle, 'span', {
		style: 'color:' + colors.fg,
	}, ':');
	uiu.el(middle, 'span', {
		style: 'color:' + colors[1],
	}, match_score[1]);
	// TODO score
	// TODO logos?
	_render_team(1);

	autosize_els.forEach(function(as_el) {
		_setup_autosize(as_el, undefined, function(parent_node) {
			return parent_node.offsetHeight * 0.8;
		});
	});
}

function sleepSync(ms) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
	  // tut nichts – blockiert einfach alles
	}
  }


var timer_alternative_text = [];

function render_tournamentcourt(s, container, event, court, match, colors) {

	//sleepSync(3000); // blockiert synchron für 3 Sekunden


	var nscore = extract_netscore(match);
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var receiver = determine_receiver(match, current_score);
	var first_game = (nscore.length < 2);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	var match_meta_container = uiu.el(container, 'div', {
		style: (
			'z-index:1;' +
			'position:absolute;' +
			'right: 53vh;' +
			'top:42vh;' +
			'bottom:42vh;' +
			'display:flex;' +
			'align-items:center;' +
			'font-size:10vh;' +
			'justify-content: space-between;' +
			'width: calc(99vw - 53vh);' +
			'text-wrap: nowrap;' +
			'color:' + colors.fg
		),
	});

	var meta_fields = [];

	if (option_applies(s.settings.displaymode_style, 'show_court_number') && s.settings.d_show_court_number) {
		meta_fields.push(s._('Court') + ' ' + (court.label || court.num || court.court_id));
	}
	
	if (option_applies(s.settings.displaymode_style, 'show_competition') && s.settings.d_show_competition) {
		if (meta_fields.length)
		{
			meta_fields.push('\xa0•\xa0');
		}

		meta_fields.push(match.setup.event_name);
	}
	
	if (option_applies(s.settings.displaymode_style, 'show_round') && s.settings.d_show_round) {
		if (meta_fields.length)
		{
			meta_fields.push('\xa0•\xa0');
		}

		meta_fields.push(match.setup.match_name);
	}

	show_match_meta(_extract_timer_state(s, match), 
					match_meta_container,
					colors.fg2,
					colors.exp, 
					meta_fields);

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var bg_col = colors['b' + team_id] || '#000';

		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var team_receiving = (
			(gwinner === 'left') ? (team_id === 1) : (
			(gwinner === 'right') ? (team_id === 0) : (
			(receiver.team_id === team_id))));

		var player_names = team.players.map(function(player) {
			return _v2_display_player_name(s.settings, player, player.name);
		});
		while (player_names.length < pcount) {
			player_names.push('');
		}

		var team_container = uiu.el(container, 'div', {
			'class': 'd_tournament',
			style: (
				'color:' + col + ';' +
				'background:' + bg_col + ';'
			)});

		var team_name_container = uiu.el(team_container, 'div', {
			style: (
				((team_id === 0) ? 'position:absolute; bottom: 0;' : '') +
				'width:100%;height:20%;' +
				'font-size: 10vh;' +
				'display: flex;align-items: center;'
			),
		});

		var player_spans = player_names.map(function(pname, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);
			var is_receiver = (!match_over) && team_receiving && (receiver.player_id === player_id);
			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '40%' : '80%') + ';',
				'class': 'd_tournament_player_container',
			});
			var pel = uiu.el(player_container, 'div', {
				style: (
					'background: ' + (is_server ? col : bg_col) + ';' +
					'color: ' + (is_server ? bg_col : col) + ';' +
					'height: ' + (is_doubles ? '100%' : '100%') + ';'
				),
				'class': 'd_tournament_player',
			});
			return uiu.el(pel, 'div', (s.settings.d_show_doubles_receiving && is_doubles && is_receiver ? {style: ('text-decoration: underline;')} : {}), pname);
		});

		var right_border;
		if (! first_game) {
			right_border = uiu.el(team_container, 'div', {
				'class': 'd_tournament_gscore',
				style: 	'background: ' + bg_col + ';' + 
						'color: ' + colors.fg + ';' + 
						'height: 80%;' +
						'top: ' + (team_id ?  '10vh' : '0vh') + ';',
			}, gscore[team_id]);
		}

		var points = current_score[team_id];
		var points_el = uiu.el(team_container, 'div', {
			'class': 'd_tournament_score' + ((points >= 10) ? ' d_tournament_score_dd' : ''),
			style: 'background: ' + (team_serving ? col : bg_col) + '; color: ' + (team_serving ? bg_col : col),
		}, points);
		if (!right_border) {
			right_border = points_el;
		}

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, right_border, function(parent_node) {
				return parent_node.offsetHeight * 0.94;
			});
		});
	});
}

function render_tournamentplayers(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var receiver = determine_receiver(match, current_score);
	var first_game = (nscore.length < 2);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	var match_meta_container = uiu.el(container, 'div', {
		style: (
			'z-index:1;' +
			'position:absolute;' +
			'right: 1vw;' +
			'top:42vh;' +
			'bottom:42vh;' +
			'display:flex;' +
			'align-items:center;' +
			'font-size:10vh;' +
			'justify-content: space-between;' +
			'width: calc(98vw);' +
			'text-wrap: nowrap;' +
			'color:' + colors.fg
		),
	});

	var meta_fields = [];

	if (option_applies(s.settings.displaymode_style, 'show_court_number') && s.settings.d_show_court_number) {
		meta_fields.push(s._('Court') + ' ' + (court.label || court.num || court.court_id));
	}
	
	if (option_applies(s.settings.displaymode_style, 'show_competition') && s.settings.d_show_competition) {
		if (meta_fields.length)
		{
			meta_fields.push('\xa0•\xa0');
		}

		meta_fields.push(match.setup.event_name);
	}
	
	if (option_applies(s.settings.displaymode_style, 'show_round') && s.settings.d_show_round) {
		if (meta_fields.length)
		{
			meta_fields.push('\xa0•\xa0');
		}

		meta_fields.push(match.setup.match_name);
	}

	show_match_meta(_extract_timer_state(s, match), 
					match_meta_container,
					colors.fg2,
					colors.exp, 
					meta_fields);

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var bg_col = colors['b' + team_id] || '#000';

		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var team_receiving = (
			(gwinner === 'left') ? (team_id === 1) : (
			(gwinner === 'right') ? (team_id === 0) : (
			(receiver.team_id === team_id))));

		var player_names = team.players.map(function(player) {
			return _v2_display_player_name(s.settings, player, player.name);
		});
		while (player_names.length < pcount) {
			player_names.push('');
		}

		var team_container = uiu.el(container, 'div', {
			'class': 'd_tournament',
			style: (
				'color:' + col + ';' +
				'background:' + bg_col + ';'
			)});

		var team_name_container = uiu.el(team_container, 'div', {
			style: (
				((team_id === 0) ? 'position:absolute; bottom: 0;' : '') +
				'width:100%;height:20%;' +
				'font-size: 10vh;' +
				'display: flex;align-items: center;'
			),
		});

		var player_spans = player_names.map(function(pname, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);
			var is_receiver = (!match_over) && team_receiving && (receiver.player_id === player_id);
			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '40%' : '80%') + ';',
				'class': 'd_tournament_player_container',
			});
			var pel = uiu.el(player_container, 'div', {
				style: (
					'background: ' + (is_server ? col : bg_col) + ';' +
					'color: ' + (is_server ? bg_col : col) + ';' +
					'height: ' + (is_doubles ? '100%' : '100%') + ';'
				),
				'class': 'd_tournament_player',
			});
			return uiu.el(pel, 'div', (s.settings.d_show_doubles_receiving && is_doubles && is_receiver ? {style: ('text-decoration: underline;')} : {}), pname);
		});
		var right_border;

		right_border = uiu.el(team_container, 'div', {
			style: 	'position: absolute;' +
					'right: 1vw;',
		}, '');
		
		player_spans.forEach(function(ps) {
			_setup_autosize(ps, right_border, function(parent_node) {
				return parent_node.offsetHeight * 0.94;
			});
		});
	});
}


function render_teamcourt(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var first_game = (nscore.length < 2);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	var match_name_container = uiu.el(container, 'div', {
		style: (
			'z-index:1;' +
			'position:absolute;' +
			'right: 55vh;' +
			'top:42vh;' +
			'bottom:42vh;' +
			'display:flex;align-items:center;' +
			'font-size:10vh;' +
			'color:' + colors.fg2
		),
	});
	var timer_state = _extract_timer_state(s, match);
	
	// First Field is empty because the timer didn't overide the first field
	var meta_fields = ["",match.setup.match_name];
	if (timer_state) {
		show_match_meta(timer_state, 
						match_name_container, 
						colors.fg2,
						colors.fg2, 
						meta_fields);
	}

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var bg_col = colors['b' + team_id] || '#000';

		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var player_names = team.players.map(function(player) {
			return player.name;
		});
		while (player_names.length < pcount) {
			player_names.push('');
		}

		var team_container = uiu.el(container, 'div', {
			'class': 'd_international_team',
			style: (
				'color:' + col + ';' +
				'background:' + bg_col + ';'
			)});

		var team_name_container = uiu.el(team_container, 'div', {
			style: (
				((team_id === 0) ? 'position:absolute; bottom: 0;' : '') +
				'width:100%;height:20%;' +
				'font-size: 10vh;' +
				'display: flex;align-items: center;'
			),
		});
		var team_name_el = uiu.el(team_name_container, 'div', {}, team.name);

		var player_spans = player_names.map(function(pname, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);
			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '40%' : '80%') + ';',
				'class': 'd_international_player_container',
			});
			var pel = uiu.el(player_container, 'div', {
				style: (
					'background: ' + (is_server ? col : bg_col) + ';' +
					'color: ' + (is_server ? bg_col : col) + ';' +
					'height: ' + (is_doubles ? '100%' : '50%') + ';'
				),
				'class': 'd_international_player',
			});
			return uiu.el(pel, 'div', {}, pname);
		});

		var right_border;
		if (! first_game) {
			right_border = uiu.el(team_container, 'div', {
				'class': 'd_international_gscore',
				style: 'background: ' + bg_col + '; color: ' + colors.fg + ';',
			}, gscore[team_id]);
		}

		var points = current_score[team_id];
		var points_el = uiu.el(team_container, 'div', {
			'class': 'd_international_score' + ((points >= 10) ? ' d_international_score_dd' : ''),
			style: 'background: ' + (team_serving ? col : bg_col) + '; color: ' + (team_serving ? bg_col : col),
		}, points);
		if (!right_border) {
			right_border = points_el;
		}

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, right_border, function(parent_node) {
				return parent_node.offsetHeight * 0.65;
			});
		});
		_setup_autosize(team_name_el, right_border, function(parent_node) {
			return parent_node.offsetHeight * 0.75;
		});
	});
}


function render_stripes(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var setup = match.setup;
	var max_game_count = calc.max_game_count(setup);
	var team_names = event.team_names || ['', ''];
	var current_score = nscore[nscore.length - 1];
	var server = determine_server(match, current_score);
	var match_score = _calc_matchscore(event.matches);

	function _render_team(team_id) {
		var bg_col = colors[team_id];
		var fg_col = (utils.brightness(bg_col) > 128) ? colors.fgdark : colors.fg;

		var tr = uiu.el(table, 'tr');
		var td = uiu.el(tr, 'td', {
			style: (
				'color:' + fg_col + ';' +
				'background:' + bg_col + ';'
			),
		});
		var container = uiu.el(td, 'div', {
			style: (
				'height:10vh;width:100%;display:-webkit-flex;display:flex;' +
				'justify-content:center;align-items:center;'),
		});
		var span = uiu.el(
			container, 'span', {
				style: 'white-space:pre;',
			},
			team_names[team_id] + (setup.team_competition ? ' (' + match_score[team_id] + ')' : ''));
		_setup_autosize(span);
	}

	function _render_players(team_id) {
		var tr = uiu.el(table, 'tr');
		var td = uiu.el(tr, 'td', {});
		var player_names = _player_names(setup.teams[team_id], setup.is_doubles, _doubles_name);
		player_names.forEach(function(pname, player_id) {
			if (player_id !== 0) {
				uiu.el(td, 'span', {}, ' / ');
			}
			var is_serving = ((server.team_id === team_id) && (server.player_id === player_id));
			uiu.el(td, 'span', (is_serving ? {
				style: (
					'color:' + colors.serv + ';'
				),
			} : {}), pname);
		});
	}

	var table = uiu.el(container, 'table', {
		'class': 'd_stripes_table',
		'style': (
			'color:' + colors.fg + ';' +
			'background:' + colors.bg + ';'
		),
	});

	_render_team(0);
	_render_players(0);

	var score_tr = uiu.el(table, 'tr');
	var score_td = uiu.el(score_tr, 'td');

	var inner_table = uiu.el(score_td, 'table', {
		style: 'border-collapse:collapse;table-layout:fixed;width:100%;',
	});
	var border = 1;
	var width_str = ((100 - border * (max_game_count + 2)) / (max_game_count + 1) - 10) + 'vw';
	var border_str = border + 'vw';
	for (var team_id = 0;team_id < 2;team_id++) {
		var tr = uiu.el(inner_table, 'tr');
		if (team_id === 0) {
			var match_name_td = uiu.el(tr, 'td', {
				rowspan: 2,
				style: (
					'background:' + colors.bg4 + ';' +
					'word-wrap:break-word;' +
					'font-size:15vmin;' +
					'min-width:' + width_str + ';' +
					'max-width:' + width_str + ';' +
					'border-left:' + border_str + ' solid ' + colors.bg + ';' +
					'border-right:' + border_str + ' solid ' + colors.bg + ';'
				),
			});
			(setup.match_name || '').split(/(\.)/).forEach(function(part) {
				uiu.el(match_name_td, 'span', {
					style: 'display:inline-block;',
				}, part);
			});
		}

		for (var game_id = 0;game_id < max_game_count;game_id++) {
			var gscore = nscore[game_id];
			var cur_serve = (
				(nscore.length - 1 === game_id) ?
				((team_id === server.team_id) || (calc.match_winner(setup, nscore) === ((team_id === 0) ? 'left' : 'right'))) :
				(gscore && (gscore[team_id] > gscore[1 - team_id]))
			);
			uiu.el(tr, 'td', {
				style: (
					((team_id === 0) ? 'border-bottom' : 'border-top') + ':2vh solid ' + colors.bg + ';' +
					'background:' + colors.bg4 + ';' +
					'border-right:' + border_str + ' solid ' + colors.bg + ';' +
					'font-size:20vmin;font-weight:bold;' +
					'min-width:' + width_str + ';' +
					'max-width:' + width_str + ';' +
					(cur_serve ? 'color:' + colors.serv + ';' : '')
				),
			}, gscore ? gscore[team_id] : '');
		}
	}

	_render_players(1);
	_render_team(1);
}


function _render_court(s, container, event) {
	if (!event.courts) {
		uiu.el(container, 'div', {
			'class': 'display_error',
		}, 'Court information missing');
		return;
	}

	var cid = s.settings.displaymode_court_id;
	var court;
	for (var i = 0;i < event.courts.length;i++) {
		var c = event.courts[i];
		if (c.court_id == cid) {
			court = c;
			break;
		}
	}
	if (!court) {
		uiu.el(container, 'div', {
			'class': 'display_error',
		}, 'Court ' + JSON.stringify(cid) + ' not found');
		return;
	}

	return court;
}

function _is_unassigned_display(s) {
	return !s.settings.court_id && s.settings.devicemode === 'display';
}

function _render_unassigned_display(s, container) {
	var hostname = s.settings.hostname || window.location.hostname || '';
	var monitor_label = s.settings.monitor_label || s.settings.client_id || '';
	var card = uiu.el(container, 'div', 'display_unassigned');

	uiu.el(card, 'div', 'display_unassigned_label display_unassigned_hostname_label', 'Hostname');
	uiu.el(card, 'div', 'display_unassigned_hostname', hostname || 'Unbekannt');
	uiu.el(card, 'div', 'display_unassigned_label display_unassigned_monitor_label', 'Monitor');
	uiu.el(card, 'div', 'display_unassigned_monitor', monitor_label || '-');
}

function _v2_render_unassigned_display(s) {
	var container = uiu.qs('.displaymode_layout');
	if (!container) {
		return false;
	}
	_v2_tournamentcourt_cache = null;
	_v2_2court_cache = null;
	_v2_oncourt_cache = null;
	_v2_international_cache = null;
	_v2_bwf_cache = null;
	_v2_clean_cache = null;
	_v2_onlyscore_cache = null;
	_v2_giantscore_cache = null;
	_v2_playerstyle_cache = null;
	_v2_tournamentplayers_cache = null;
	_v2_teamcourt_cache = null;
	_v2_andre_cache = null;
	_v2_streamcourt_cache = null;
	_v2_stripes_cache = null;
	_v2_streamcourt_dm_cache = null;
	_v2_top_list_cache = null;
	_v2_teamscore_cache = null;
	_v2_streamteam_cache = null;
	_v2_stream_cache = null;
	_v2_castall_cache = null;
	_v2_tim_cache = null;
	_v2_greyish_cache = null;
	_v2_tournament_overview_cache = null;
	_v2_tournament_overview_dm_cache = null;
	_last_painted_hash = null;
	autosize.unmaintain_all(container);
	uiu.empty(container);
	_render_unassigned_display(s, container);
	return true;
}

function _player_names(team, is_doubles, doubles_func) {
	var pcount = is_doubles ? 2 : 1;
	var player_names = team.players.map(function(player) {
		return (doubles_func && is_doubles) ? doubles_func(player) : player.name;
	});
	while (player_names.length < pcount) {
		player_names.push('');
	}
	return player_names;
}

function render_onlyplayers(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var is_doubles = match.setup.is_doubles;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');
	var logo_urls = extradata.team_logos(event);

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var bg_col = colors['b' + team_id];
		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var pnames = _player_names(team, is_doubles);

		var team_container = uiu.el(container, 'div', {
			'class': 'd_half',
			style: (
				'background:' + bg_col + ';'
			),
		});

		if (logo_urls) {
			uiu.el(team_container, 'div', {
				style: (
					'width:20%;height:100%;float:left;margin-right:4vw;' +
					(logo_urls[team_id] ?
						('background-repeat: no-repeat;' +
							'background-image:url("' + logo_urls[team_id] + '");' +
							'background-position:center; background-size: contain;'
						) :
					''
					)
				),
			});
		}

		var player_spans = pnames.map(function(pname, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);
			var player_container = uiu.el(team_container, 'div', {
				'style': (
					'height: ' + (is_doubles ? '50%' : '100%') + ';' +
					'width:' + (logo_urls ? 80 : 100) + '%' +
					'position: relative;' +
					(logo_urls ? 'padding-left: 1vw;' : '') +
					'display: flex;' +
					'align-items: center;' +
					'background: ' + (is_server ? col : bg_col) + ';' +
					'color: ' + (is_server ? bg_col : col) + ';'
				),
			});
			var pel = uiu.el(player_container, 'div', {
				style: (
					'height: 100%;'
				),
				'class': 'd_onlyplayers_player',
			});
			return uiu.el(pel, 'div', {}, pname);
		});

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, null, function(parent_node) {
				return parent_node.offsetHeight * 0.7 * (is_doubles ? 1 : 0.5);
			});
		});
	});
}

function render_clubplayers(s, container, event, court, match, colors) {
	function _render_team_name(team_container, team, team_id) {
		var div = uiu.el(team_container, 'div', {
			style: (
				'background: ' + colors.bg + ';' +
				'color: ' + colors[team_id] + ';' +
				'height: 20%;' +
				'margin-left: 5%'
			),
		});
		var span = uiu.el(div, 'span', {}, team.name);
		_setup_autosize(span);
	}

	var nscore = extract_netscore(match);
	var is_doubles = match.setup.is_doubles;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var pnames = _player_names(team, is_doubles);

		var team_container = uiu.el(container, 'div', {
			'class': 'd_half',
			style: 'background:' + colors.bg + ';',
		});

		if (team_id === 1) {
			_render_team_name(team_container, team, team_id);
		}

		var player_spans = pnames.map(function(pname, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);

			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '40%' : '80%') + ';',
				'class': 'd_onlyplayers_player_container',
			});
			var pel = uiu.el(player_container, 'div', {
				style: (
					'background: ' + colors.bg + ';' +
					'color: ' + col + ';' +
					'height: 75%;'
				),
				'class': 'd_onlyplayers_player',
			});
			if (is_server) {
				uiu.el(pel, 'div', 'd_shuttle');
			}
			return uiu.el(pel, 'div', {}, pname);
		});

		if (team_id === 0) {
			_render_team_name(team_container, team, team_id);
		}

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, null, function(parent_node) {
				return parent_node.offsetHeight * (is_doubles ? 1 : 0.5);
			});
		});
	});
}

function render_clubplayerslr(s, container, event, court, match, colors) {
	function _render_team_name(team_container, team, team_id) {
		var div = uiu.el(team_container, 'div', {
			style: (
				'background: ' + colors.bg + ';' +
				'color: ' + colors[team_id] + ';' +
				'height: 20%;' +
				'margin: 0 5%;'
			),
		});
		var span = uiu.el(div, 'span', {}, team.name);
		_setup_autosize(span);
	}

	var nscore = extract_netscore(match);
	var is_doubles = match.setup.is_doubles;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var mwinner = calc.match_winner(match.setup, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var pnames = _player_names(team, is_doubles);

		var is_team0 = team_id === 0;
		var team_container = uiu.el(container, 'div', {
			'class': 'd_half',
			style: (
				'background:' + colors.bg + ';' +
				(is_team0 ? '' : 'text-align: right;')
			),
		});

		if (!is_team0) {
			_render_team_name(team_container, team, team_id);
		}

		var player_spans = pnames.map(function(pname, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);

			var player_container = uiu.el(team_container, 'div', {
				'style': (
					'height: ' + (is_doubles ? '40%' : '80%') + ';'
				),
				'class': 'd_clubplayerslr_player_container',
			});
			var pel = uiu.el(player_container, 'div', {
				style: (
					'background: ' + colors.bg + ';' +
					'color: ' + col + ';' +
					'height: 75%;' +
					(is_team0 ? '' : 'justify-content: flex-end;')
				),
				'class': 'd_onlyplayers_player',
			});
			if (is_server) {
				uiu.el(pel, 'div', is_team0 ? 'd_shuttle' : 'd_shuttle_after');
			}
			return uiu.el(pel, 'div', {}, pname);
		});

		if (is_team0) {
			_render_team_name(team_container, team, team_id);
		}

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, null, function(parent_node) {
				return parent_node.offsetHeight * (is_doubles ? 1 : 0.5);
			});
		});
	});
}


function render_onlyscore(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var max_game_count = calc.max_game_count(match.setup);

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var bg_col = colors['b' + team_id];

		var team_container = uiu.el(container, 'div', 'd_onlyscore_half');
		for (var game_idx = 0;game_idx < max_game_count;game_idx++) {
			var team_serving = false;
			var current_score = nscore[game_idx];
			if (current_score) {
				var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);
				team_serving = (
								(gwinner === 'left') ? (team_id === 0) : (
								(gwinner === 'right') ? (team_id === 1) : (
								(server.team_id === team_id))));
			}

			var score_container = uiu.el(team_container, 'div', {
				'class': 'd_score_default',
				style: (
					'width:' + (95 / max_game_count) + 'vw;' +
					'background:' + (team_serving ? col : bg_col) + ';' +
					'color:' + (team_serving ? bg_col : col) + ';' +
					'border-right:' + (5 / max_game_count) + 'vw solid ' + bg_col + ';' +
					'display: flex;' +
					'align-items: center;' +
					'justify-content: center;' +
					'font-size: ' + (max_game_count === 5 ? 23 : 30) + 'vw;' +
					'overflow: hidden;'
				),
			});

			var points_str = (current_score ? '' + current_score[team_id] : '');

			if (points_str.length < 2) {
				uiu.el(score_container, 'span', {}, points_str);
			} else {
				var margin = (max_game_count === 5) ? '0.15ch' : '0.07ch';

				// Two digits, layout manually since we're extremely tight on space
				utils.forEach(points_str, function(digit, digit_idx) {
					uiu.el(score_container, 'div', {
						style: (
							'margin-left: ' + ((digit_idx === 0) ? '' : '-') + margin + ';' +
							'margin-right: ' + ((digit_idx === 0) ? '-' : '') + margin
						),
					}, digit);
				});
			}
		}
	});
}

function render_giantscore(s, container, event, court, match, colors) {
	var nscore = extract_netscore(match);
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var bg_col = colors['b' + team_id];

		var mwinner = calc.match_winner(match.setup, nscore);
		var is_winner = ((mwinner === 'left') && (team_id === 0) || (mwinner === 'right') && (team_id === 1));
		var invert = is_winner || (server.team_id === team_id);

		var team_container = uiu.el(container, 'div', {
			style: (
				'position:absolute;width:50%;height:100%;top:0;left:' + (team_id * 50) + '%;' +
				'background:' + bg_col + ';color:' + col + ';' +
				'overflow:hidden;'
			),
		});

		// Points
		uiu.el(team_container, 'div', {
			style: ('width:100%;text-align:center;font-size:75vh;margin-top:-9vh;' + 
				(invert ? 'color:' + bg_col + ';background:' + col + ';' : '')
			),
		}, nscore[nscore.length - 1][team_id]);

		// Games
		uiu.el(team_container, 'div', {
			style: (
				'position: absolute;bottom:-1vh;left:0;right:0;text-align:center;' +
				'font-size: 30vh; background:' + bg_col + ';'
			),
		}, gscore[team_id]);
	});
}


function calc_team_colors(event, settings) {
	if (event.team_colors) {
		return event.team_colors;
	}
	if (event.team_names) {
		var res = {};
		event.team_names.forEach(function(tn, team_idx) {
			var tc = extradata.get_color(tn);
			if (tc) {
				if (tc.fg) {
					res[team_idx] = tc.fg;
				}
				if (tc.bg) {
					res['b' + team_idx] = tc.bg;
				}
			}
		});
		return res;
	}
	return {
		'0': settings.d_c0,
		'b0': settings.d_cb0,
		'1': settings.d_c1,
		'b1': settings.d_cb1,
	};
}

function calc_colors(cur_settings, event, match) {
	var res = {};
	ALL_COLORS.forEach(function(k) {
		var ek = 'd_' + k;
		res[k.substr(1)] = cur_settings[ek] || settings.default_settings[ek];
	});
	if (cur_settings.d_team_colors) {
		var tc = calc_team_colors(event, cur_settings);
		utils.obj_update(res, tc);
	}

	if (match && match.setup && match.setup.override_colors) {
		utils.obj_update(res, match.setup.override_colors);
	}

	return res;
}

function _extract_timer_state(s, match) {
	if (!option_applies(s.settings.displaymode_style, 'show_pause')) {
		return; // No timer required
	}

	if (!s.settings.d_show_pause) {
		return; // Disabled now
	}

	var presses = eventutils.get_presses(match);
	var rs = calc.remote_state(s, match.setup, presses);
	return rs;
}

var active_timers = [];

function show_match_meta(timer_state, parent, default_color, exigent_color, match_meta) {
	if(!match_meta){
		match_meta = [""];
	}

	let timer_alternative_text = [];
	var resize_listener_installed = false;

	var create_text_element = function(parent, element, color) {
		let fontSize = '13vh';
		timer_alternative_text.push([uiu.el(parent, 'div', {style: ('font-size:' + fontSize + '; color:' + color +'; white-space:nowrap; flex:0 0 auto;')}, element),  fontSize, {}]);
	};

	var measure_visual_text_height = function(el, text, font_size_px) {
		if (typeof document === 'undefined') {
			return font_size_px;
		}
		var canvas = measure_visual_text_height.canvas || (measure_visual_text_height.canvas = document.createElement('canvas'));
		var ctx = canvas.getContext && canvas.getContext('2d');
		if (!ctx) {
			return font_size_px;
		}
		var style = window.getComputedStyle(el, null);
		ctx.font = [
			style.fontStyle || 'normal',
			style.fontVariant || 'normal',
			style.fontWeight || 'normal',
			font_size_px + 'px',
			style.fontFamily || 'sans-serif'
		].join(' ');
		var metrics = ctx.measureText(text || '0');
		var visual_height = (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0);
		return visual_height || font_size_px;
	};

	var visual_font_size_for_height = function(el, target_height_px) {
		var probe_size = 100;
		var probe_height = measure_visual_text_height(el, el.textContent || '0', probe_size);
		if (!probe_height) {
			return target_height_px + 'px';
		}
		return (probe_size * target_height_px / probe_height) + 'px';
	};

	var resolve_font_size = function(el, origFontSize, opts, parent_height) {
		if (opts && opts.visual_height) {
			return visual_font_size_for_height(el, parent_height * opts.visual_height);
		}
		return origFontSize;
	};

	var auto_size_alternative_strings = function(parrent_el) {
		if (!parrent_el || (typeof parrent_el.isConnected !== 'undefined' && !parrent_el.isConnected)) {
			return;
		}
		var parrent_width = parrent_el.clientWidth || parrent_el.offsetWidth || parrent_el.getBoundingClientRect().width;
		if (!parrent_width) {
			return;
		}
		var parrent_height = parrent_el.clientHeight || parrent_el.offsetHeight || parrent_el.getBoundingClientRect().height;
		if (!parrent_height) {
			return;
		}
		var available_width = Math.max(1, parrent_width * 0.96);
		var available_height = Math.max(1, parrent_height);
		var child_width = 0;
		var child_height = 0;
		timer_alternative_text.forEach(function(item) {
			let [el, origFontSize, opts] = item;
			if (!el || (typeof el.isConnected !== 'undefined' && !el.isConnected)) {
				return;
			}
			el.style.fontSize = resolve_font_size(el, origFontSize, opts, parrent_height);
			child_width += Math.max(el.scrollWidth || 0, el.offsetWidth || 0, el.getBoundingClientRect().width || 0);
			if (opts && opts.visual_height) {
				var current_style = window.getComputedStyle(el, null).getPropertyValue('font-size') || '0px';
				var current_size = parseFloat(current_style);
				child_height = Math.max(child_height, measure_visual_text_height(el, el.textContent || '0', current_size));
			} else {
				child_height = Math.max(child_height, el.scrollHeight || 0, el.offsetHeight || 0, el.getBoundingClientRect().height || 0);
			}
		});

		var scale = Math.min(
			1,
			child_width ? (available_width / child_width) : 1,
			child_height ? (available_height / child_height) : 1
		);
		if(scale < 1) {
			timer_alternative_text.forEach(function(item) {

				let [el, origFontSize, opts] = item;
				var baseFontSize = resolve_font_size(el, origFontSize, opts, parrent_height);
				var match = baseFontSize.match(/^(\d*\.?\d+)\s*([a-zA-Z%]+)$/);
				var numeric_value = match[1] ? parseFloat(match[1]) : 10;
				var unit = match[2] ? match[2] : 'vh';

				el.style.fontSize = numeric_value * scale + unit;
			});
		}
	}

	var schedule_auto_size = function() {
		auto_size_alternative_strings(parent);
		if (typeof window !== 'undefined' && window.requestAnimationFrame) {
			window.requestAnimationFrame(function() {
				auto_size_alternative_strings(parent);
			});
		}
		setTimeout(function() {
			auto_size_alternative_strings(parent);
		}, 0);
		setTimeout(function() {
			auto_size_alternative_strings(parent);
		}, 100);
		if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
			document.fonts.ready.then(function() {
				auto_size_alternative_strings(parent);
			});
		}
		if (!resize_listener_installed && typeof window !== 'undefined') {
			resize_listener_installed = true;
			window.addEventListener('resize', function() {
				auto_size_alternative_strings(parent);
			} , true);
		}
	};

	if(timer_state) {
		var tv = timer.calc(timer_state);
	}

	if (!tv || !tv.visible) {
		match_meta.forEach(function(element){create_text_element(parent, element, default_color);});
		schedule_auto_size();
		return;
	}

	create_text_element(parent, match_meta[0], default_color);

	let timerFontSize = '19vh';
	var el = uiu.el(parent, 'div', {style: ('font-size:' + timerFontSize + '; line-height:1; color:' + default_color +'; white-space:nowrap; flex:0 0 auto;')}, '\xa0'+tv.str);
	timer_alternative_text.push([el, timerFontSize, {visual_height: 0.95}]);
	var tobj = {};
	active_timers.push(tobj);

	var update = function() {
		var tv = timer.calc(timer_state);
		var visible = tv.visible;
		uiu.text(el, '\xa0'+tv.str);

		if((tv.exigent || tv.ms < 0) && exigent_color) {
			//uiu.attr(el, exigent_color);
			el.style.color = exigent_color;
		}
		
		if (visible && tv.next) {
			tobj.timeout = setTimeout(update, tv.next);
		} else {
			tobj.timeout = null;
		}
		
		if (!visible) {
			timer_alternative_text.forEach(function(item) {
				let [element, origFontSize] = item;
				uiu.remove(element);
			})
			timer_alternative_text = [];
			match_meta.forEach(function(element){create_text_element(parent, element, default_color);});
		}
		schedule_auto_size();
	};
	update();
}

function abort_timers() {
	active_timers.forEach(function(tobj) {
		if (tobj.timeout) {
			clearTimeout(tobj.timeout);
		}
	});
}

function render_2court(s, container, event, colors) {
	if (!event.courts || !event.courts.length) {
		uiu.el(container, 'div', {
			'class': 'display_error',
		}, 'Court information missing');
		return;
	}

	for (var team_idx = 0;team_idx < 2;team_idx++) {
		uiu.el(container, 'div', {
			'style': (
				'position:absolute;width:100%;height:50%;' +
				'background:' + colors['b' + team_idx] + ';' +
				'top:' + (team_idx * 50) + '%;'
			),
		});
	}

	uiu.el(container, 'div', {
		'class': 'd_2court_divider',
		'style': 'background: ' + colors.bg2,
	});
	var team_names = event.team_names || [];
	team_names.forEach(function(team_name, team_idx) {
		var teamname_container = uiu.el(container, 'div', {
			'class': 'd_2court_teamname' + team_idx,
			style: 'background: ' + colors['b' + team_idx] + '; color: ' + colors[team_idx] + ';',
		});
		var teamname_span = uiu.el(teamname_container, 'span', {}, team_name);
		_setup_autosize(teamname_span);
	});

	var startcourt_idx = 0;
	event.courts.forEach(function(c, cnum) {
		if (c.court_id == s.settings.displaymode_court_id) {
			startcourt_idx = cnum;
		}
	});

	var direction = (s.settings.displaymode_reverse_order ? -1 : 1);
	for (var court_idx = 0;court_idx < 2;court_idx++) {
		var court_container = uiu.el(container, 'div', 'd_2court_side' + court_idx);

		var real_court_idx = (startcourt_idx + court_idx * direction + event.courts.length) % event.courts.length;
		var court = event.courts[real_court_idx];
		var match = _match_by_court(event, court);

		if (!match) {
			// TODO: test and improve handling when no match is on court
			continue;
		}
		var nscore = extract_netscore(match);
		var gscore = _gamescore_from_netscore(nscore, match.setup);
		var current_score = nscore[nscore.length - 1] || [];
		var server = determine_server(match, current_score);
		var gwinner = calc.game_winner(match.setup, nscore.length - 1, current_score[0], current_score[1]);

		match.setup.teams.forEach(function(team, team_id) {
			var team_container = uiu.el(court_container, 'div', 'd_2court_team' + team_id);

			var col = colors[team_id];
			var bg_col = colors['b' + team_id];
			var team_serving = (
				(gwinner === 'left') ? (team_id === 0) : (
				(gwinner === 'right') ? (team_id === 1) : (
				(server.team_id === team_id))));

			var points = (current_score[team_id] === undefined) ? '' : ('' + current_score[team_id]);
			var score_el = uiu.el(team_container, 'div', {
				'class': 'd_2court_score',
				style: 'background: ' + (team_serving ? col : bg_col) + '; color: ' + (team_serving ? bg_col : col),
			});
			if (points.length < 2) {
				uiu.text(score_el, points);
			} else {
				// Two digits, layout manually since we're extremely tight on space
				utils.forEach(points, function(digit, digit_idx) {
					uiu.el(score_el, 'div', 'd_2court_score_digit' + digit_idx, digit);
				});
			}

			uiu.el(team_container, 'div', {
				'class': 'd_2court_gscore',
				style: 'background: ' + bg_col + '; color: ' + col + ';',
			}, gscore[team_id]);
		});

		var match_name = (
			match.setup.team_competition ?
			match.setup.match_name :
			(match.setup.event_name || '').replace(/(?:\s*-)?\s*Qualification/, 'Q'));
		var d_2court_info_container = uiu.el(court_container, 'div', 'd_2court_info');
		
		var meta_container = uiu.el(d_2court_info_container, 'div', {
			style: 'color:' + colors.fg + '; width:100%; display:flex; flex-wrap: nowrap; justify-content: space-evenly;' ,
		});

		var meta_fields = ['', match_name, ''];

		var timer_state = _extract_timer_state(s, match);
		show_match_meta(timer_state, 
						meta_container, 
						colors.fg,
						colors.fg,
						meta_fields);
	}
}

function on_color_select(e) {
	var el = e.target;
	var new_settings = {};
	new_settings['d_' + el.getAttribute('data-name')] = el.value;
	settings.change_all(state, new_settings);
}

var _last_painted_hash = null;
var _last_settings_hash = null;
var _last_err;
var _v2_tournamentcourt_cache = null;
var _v2_2court_cache = null;
var _v2_oncourt_cache = null;
var _v2_international_cache = null;
var _v2_bwf_cache = null;
var _v2_clean_cache = null;
var _v2_onlyscore_cache = null;
var _v2_giantscore_cache = null;
var _v2_playerstyle_cache = null;
var _v2_tournamentplayers_cache = null;
var _v2_teamcourt_cache = null;
var _v2_andre_cache = null;
var _v2_streamcourt_cache = null;
var _v2_stripes_cache = null;
var _v2_streamcourt_dm_cache = null;
var _v2_top_list_cache = null;
var _v2_teamscore_cache = null;
var _v2_streamteam_cache = null;
var _v2_stream_cache = null;
var _v2_castall_cache = null;
var _v2_tim_cache = null;
var _v2_greyish_cache = null;
var _v2_tournament_overview_cache = null;
var _v2_tournament_overview_dm_cache = null;

function _v2_2court_side_for_team(team, team_idx) {
	return team && team.side ? team.side : (team_idx === 0 ? 'left' : 'right');
}

function _v2_2court_score_for_team(score, team, team_idx) {
	return _v2_score_for_team(score, team, team_idx);
}

function _v2_team_side(team, team_idx) {
	return team && team.side ? team.side : (team_idx === 0 ? 'left' : 'right');
}

function _v2_score_for_team(score, team, team_idx) {
	var side = _v2_team_side(team, team_idx);
	return Number(score && score[side] != null ? score[side] : 0);
}

function _v2_multi_ordered_court_states(s, dto) {
	var court_states = (dto && dto.court_states ? dto.court_states.slice() : []);
	if (s && s.settings && s.settings.displaymode_reverse_order) {
		court_states.reverse();
	}
	return court_states;
}

function _v2_parse_court_number_list(value) {
	return String(value || '').split(/[,\s;]+/).map(function(part) {
		return Number(part.trim());
	}).filter(function(num) {
		return Number.isFinite(num);
	});
}

function _v2_tournament_overview_dm_ordered_court_states(s, dto) {
	var court_states = dto && dto.court_states ? dto.court_states.slice() : [];
	court_states = court_states.filter(function(court_state) {
		var court = court_state && court_state.court ? court_state.court : {};
		return court.is_active !== false || !!(court_state && court_state.match);
	});
	var configured_nums = _v2_parse_court_number_list(
		(s && s.settings ? s.settings.d_tournament_overview_courts : '') ||
		'6,5,4,3,2'
	);
	if (configured_nums.length) {
		var by_num = {};
		court_states.forEach(function(court_state) {
			var num = Number(court_state && court_state.court ? court_state.court.num : null);
			if (Number.isFinite(num)) {
				by_num[num] = court_state;
			}
		});
		var configured_states = configured_nums.map(function(num) {
			return by_num[num];
		}).filter(Boolean).slice(0, configured_nums.length);
		if (configured_states.length) {
			return configured_states;
		}
	}
	court_states.sort(function(a, b) {
		var an = Number(a && a.court ? a.court.num : null);
		var bn = Number(b && b.court ? b.court.num : null);
		if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) {
			return bn - an;
		}
		return String(b && b.court ? b.court.id || '' : '').localeCompare(String(a && a.court ? a.court.id || '' : ''));
	});
	return court_states.slice(0, 5);
}

function _v2_tournament_overview_dm_container_key(s, dto, colors) {
	return _v2_join_key([
		s.settings.displaymode_style || '',
		s.settings.d_tournament_overview_courts || '',
		s.settings.displaymode_reverse_order ? '1' : '0',
		colors.bg,
		colors.bg2,
		colors.bg3,
		colors.fg,
		colors.fg2,
		colors.border,
	]);
}

function _v2_tournament_overview_dm_row_structure_key(s, court_state) {
	var match = court_state && court_state.match ? court_state.match : null;
	var teams = court_state && court_state.teams ? court_state.teams : [];
	var court = court_state && court_state.court ? court_state.court : {};
	return _v2_join_key([
		court.id || '',
		court.num == null ? '' : String(court.num),
		court.label || '',
		match ? match.id || '' : '',
		match ? match.event_name || '' : '',
		match ? match.round_name || '' : '',
		court_state && Number.isFinite(court_state.match_duration_min) ? String(court_state.match_duration_min) : '',
		teams.map(function(team) {
			return _v2_multi_team_label(team, s.settings);
		}).join('/'),
	]);
}

function _v2_tournament_overview_dm_row_metrics(total_rows) {
	var rows = Math.max(1, Number(total_rows) || 5);
	var use_finals_layout = rows <= 3;
	var row_block_height = 100 / rows;
	var scale = (!use_finals_layout && rows > 5) ? 5 / rows : 1;
	var row_height = use_finals_layout ? 30 : (16 * scale);
	var row_gap = Math.max(0, (100 - (rows * row_height)) / (rows + 1));
	return {
		row_block_height: row_block_height,
		top_padding: 0,
		row_gap: row_gap,
		row_height: row_height,
		cap_pct: use_finals_layout ? 3 : 5,
		team_pct: use_finals_layout ? 46 : 43,
		middle_pct: use_finals_layout ? 2 : 4,
		font_big: use_finals_layout ? 18.5 : (row_height * 1.0625),
		score_font: use_finals_layout ? 10 : (row_height * 0.4375),
		team_font: use_finals_layout ? 6 : (row_height * 0.375),
			meta_font: use_finals_layout ? 5.2 : (row_height * 0.21875),
		duration_font: use_finals_layout ? 6 : (row_height * 0.375),
	};
}

function _v2_multi_colors(s, dto) {
	var team_names = [];
	var first_match = (dto && dto.court_states ? dto.court_states : []).find(function(court_state) {
		return court_state && court_state.match && court_state.teams && court_state.teams.length >= 2;
	});
	if (first_match) {
		team_names = first_match.teams.map(function(team) {
			return team && team.name ? team.name : '';
		});
	}
	return calc_colors(s.settings, {team_names: team_names}, null);
}

function _v2_multi_match_name(match) {
	if (!match) {
		return '';
	}
	return [match.event_name || '', match.round_name || ''].filter(Boolean).join(' ');
}

function _v2_multi_team_players(team) {
	if (!team) {
		return [];
	}
	if (team.player_details && team.player_details.length) {
		return team.player_details;
	}
	return (team.players || []).map(function(player) {
		return typeof player === 'string' ? {name: player} : player;
	});
}

function _v2_multi_team_label(team, settings) {
	var players = _v2_multi_team_players(team);
	if (!players.length) {
		return team && team.name ? team.name : '';
	}
	return namestr(players.map(function(player) {
		return {
			name: _v2_display_player_name(settings, player, player.name || ''),
			firstname: player.firstname,
			lastname: player.lastname,
		};
	}));
}

function _v2_2court_match_name(court_state) {
	var match = court_state && court_state.match ? court_state.match : null;
	if (!match) {
		return '';
	}
	var event_name = (match.event_name || '').replace(/(?:\s*-)?\s*Qualification/, 'Q');
	var round_name = match.round_name || '';
	return [event_name, round_name].filter(Boolean).join(' ');
}

function _v2_2court_visible_match_name(court_state, settings) {
	var match = court_state && court_state.match ? court_state.match : null;
	if (!match) {
		return '';
	}
	var fields = [];
	if (settings.d_show_competition !== false && match.event_name) {
		fields.push(match.event_name.replace(/(?:\s*-)?\s*Qualification/, 'Q'));
	}
	if (settings.d_show_round !== false && match.round_name) {
		fields.push(match.round_name);
	}
	return fields.join(' ');
}

function _v2_display_player_name(settings, player, fallback) {
	if (!player) {
		return fallback || '';
	}
	if (typeof player === 'string') {
		return player;
	}
	if (!option_applies(settings.displaymode_style, 'show_middle_name')) {
		return player.name || fallback || '';
	}
	if (player.firstname && player.lastname) {
		var first_names = player.firstname.split(/\s+/).filter(Boolean);
		if (!settings.d_show_middle_name) {
			first_names = first_names.slice(0, 1);
		}
		if (settings.d_abbreviate_first_name) {
			first_names = first_names.map(function(first_name) {
				return first_name.replace(/[a-zäöüß]+/g, '.');
			});
		}
		return (first_names.length ? first_names.join(' ') + ' ' : '') + player.lastname;
	}
	return player.name || fallback || [player.firstname, player.lastname].filter(Boolean).join(' ');
}

function _v2_display_player_labels(team, settings) {
	if (!team) {
		return [];
	}
	if (team.player_details && team.player_details.length) {
		return team.player_details.map(function(player, player_idx) {
			var fallback = team.players && team.players[player_idx] ? team.players[player_idx] : '';
			return _v2_display_player_name(settings, player, fallback);
		}).filter(Boolean);
	}
	if (team.players && team.players.length) {
		return team.players.map(function(player) {
			return _v2_display_player_name(settings, player, player);
		}).filter(Boolean);
	}
	return team.name ? [team.name] : [];
}

function _v2_2court_team_label(team, settings) {
	if (!team) {
		return '';
	}
	if (team.player_details && team.player_details.length) {
		return team.player_details.map(function(player, player_idx) {
			var fallback = team.players && team.players[player_idx] ? team.players[player_idx] : '';
			return _v2_display_player_name(settings, player, fallback);
		}).filter(Boolean).join(' / ');
	}
	if (team.players && team.players.length) {
		return team.players.map(function(player) {
			return _v2_display_player_name(settings, player, player);
		}).filter(Boolean).join(' / ');
	}
	return team.name || '';
}

function _v2_2court_team_player_labels(team, settings) {
	return _v2_display_player_labels(team, settings);
}

function _v2_oncourt_colors(s, dto) {
	return calc_colors(s.settings, {
		team_names: (dto.teams || []).map(function(team) {
			return team && team.name ? team.name : '';
		}),
	}, null);
}

function _v2_international_colors(s, dto) {
	return calc_colors(s.settings, {
		nation_competition: !!(dto.match && dto.match.nation_competition),
		team_names: (dto.teams || []).map(function(team) {
			return team && team.name ? team.name : '';
		}),
	}, null);
}

function _v2_international_game_score(dto) {
	var sets_won = dto && dto.score && dto.score.sets_won ? dto.score.sets_won : {};
	return [
		Number(sets_won.left || 0),
		Number(sets_won.right || 0),
	];
}

function _v2_international_match_winner_side(dto) {
	var teams = dto && dto.teams ? dto.teams : [];
	var winner_side = null;
	teams.forEach(function(team, team_idx) {
		if (team && team.is_winner) {
			winner_side = _v2_team_side(team, team_idx);
		}
	});
	return winner_side;
}

function _v2_international_team_serving(dto, team_idx) {
	var team = dto && dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var team_side = _v2_team_side(team, team_idx);
	var score = dto && dto.score ? dto.score : {};
	if (score.current_set_finished && score.current_set_winner_side) {
		return team_side === score.current_set_winner_side;
	}
	var server = dto && dto.service ? dto.service.server : null;
	return !!server && (
		(typeof server.team_index === 'number' && server.team_index === team_idx) ||
		(server.side && server.side === team_side)
	);
}

function _v2_international_player_serving(dto, team_idx, player_idx) {
	var winner_side = _v2_international_match_winner_side(dto);
	if (winner_side) {
		return false;
	}
	if (!_v2_international_team_serving(dto, team_idx)) {
		return false;
	}
	var server = dto && dto.service ? dto.service.server : null;
	if (!server || server.player_index == null) {
		return player_idx === 0;
	}
	return server.player_index === player_idx;
}

function _v2_international_score_class(points) {
	return 'd_international_score' + ((Number(points) >= 10) ? ' d_international_score_dd' : '');
}

function _v2_single_score_colors(s, dto) {
	return calc_colors(s.settings, {
		team_names: (dto.teams || []).map(function(team) {
			return team && team.name ? team.name : '';
		}),
	}, null);
}

function _v2_score_sets_for_display(score) {
	var sets = (score && score.finished_sets ? score.finished_sets.slice() : []);
	if (score && score.current_set) {
		sets.push(score.current_set);
	}
	if (sets.length === 0) {
		sets.push({left: 0, right: 0});
	}
	return sets;
}

function _v2_sets_won_for_score(dto) {
	var result = {left: 0, right: 0};
	var score = dto && dto.score ? dto.score : {};
	(score.finished_sets || []).forEach(function(set_score) {
		var left = Number(set_score && set_score.left || 0);
		var right = Number(set_score && set_score.right || 0);
		if (left > right) {
			result.left += 1;
		} else if (right > left) {
			result.right += 1;
		}
	});
	if (score.current_set_finished && score.current_set_winner_side) {
		result[score.current_set_winner_side] += 1;
	}
	return result;
}

function _v2_team_is_serving_or_set_winner(dto, team_idx) {
	var team = dto && dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var side = _v2_team_side(team, team_idx);
	var score = dto && dto.score ? dto.score : {};
	if (score.current_set_finished && score.current_set_winner_side) {
		return side === score.current_set_winner_side;
	}
	var server = dto && dto.service ? dto.service.server : null;
	return !!server && (
		(typeof server.team_index === 'number' && server.team_index === team_idx) ||
		(server.side && server.side === side)
	);
}

function _v2_player_is_serving(dto, team_idx, player_idx) {
	if (!_v2_team_is_serving_or_set_winner(dto, team_idx)) {
		return false;
	}
	if (dto && dto.score && dto.score.current_set_finished) {
		return false;
	}
	var server = dto && dto.service ? dto.service.server : null;
	if (!server || server.player_index == null) {
		return player_idx === 0;
	}
	return server.player_index === player_idx;
}

function _v2_score_digit_nodes(parent, value, max_game_count) {
	uiu.empty(parent);
	var points_str = value == null ? '' : String(value);
	if (points_str.length < 2) {
		uiu.el(parent, 'span', {}, points_str);
		return;
	}
	var margin = (max_game_count === 5) ? '0.15ch' : '0.07ch';
	utils.forEach(points_str, function(digit, digit_idx) {
		uiu.el(parent, 'div', {
			style: (
				'margin-left: ' + ((digit_idx === 0) ? '' : '-') + margin + ';' +
				'margin-right: ' + ((digit_idx === 0) ? '-' : '') + margin
			),
		}, digit);
	});
}

function _v2_simple_score_structure_key(s, dto, style) {
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	var finished_sets = dto && dto.score && dto.score.finished_sets ? dto.score.finished_sets : [];
	return _v2_join_key([
		style,
		s.settings.d_team_colors ? 'tc' : '',
		s.settings.d_show_team_name === false ? 'tn0' : 'tn1',
		s.settings.d_show_middle_name ? 'm1' : 'm0',
		s.settings.d_abbreviate_first_name ? 'a1' : 'a0',
		match ? match.id : '',
		match && match.best_of ? match.best_of : '',
		match ? (match.is_doubles ? 'D' : 'S') : '',
		finished_sets.length,
		teams.map(function(team) {
			return [
				team && team.name ? team.name : '',
				_v2_display_player_labels(team, s.settings).join('/'),
			].join(':');
		}).join('|'),
	]);
}

function _v2_clean_apply_team(cache, dto, team_idx) {
	var team = dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var score = dto.score || {};
	var colors = cache.colors;
	var col = colors[team_idx];
	var bg_col = colors.bg;
	var points = _v2_score_for_team(score.current_set, team, team_idx);
	var sets_won = _v2_sets_won_for_score(dto);
	var team_serving = _v2_team_is_serving_or_set_winner(dto, team_idx);

	_v2_set_text(cache.gscore_el, _v2_score_for_team(sets_won, team, team_idx));
	_v2_set_text(cache.score_el, points);
	_v2_set_class(cache.score_el, 'd_clean_score' + ((Number(points) >= 10) ? ' d_clean_score_dd' : ''));
	_v2_set_style(cache.score_el, 'background', team_serving ? col : bg_col);
	_v2_set_style(cache.score_el, 'color', team_serving ? bg_col : col);
	cache.player_els.forEach(function(player_el, player_idx) {
		var is_server = _v2_player_is_serving(dto, team_idx, player_idx);
		_v2_set_style(player_el, 'background', is_server ? col : bg_col);
		_v2_set_style(player_el, 'color', is_server ? bg_col : col);
	});
}

function _v2_clean_patch(s, dto) {
	if (!_v2_clean_cache || !_v2_clean_cache.container || !dto || !dto.match) {
		return render_v2_clean_display_state(s, dto);
	}
	var structure_key = _v2_simple_score_structure_key(s, dto, 'clean');
	if (_v2_clean_cache.structure_key !== structure_key) {
		return render_v2_clean_display_state(s, dto);
	}
	[0, 1].forEach(function(team_idx) {
		var team_cache = _v2_clean_cache.teams[team_idx];
		if (team_cache) {
			_v2_clean_apply_team(team_cache, dto, team_idx);
		}
	});
	return true;
}

function render_v2_clean_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'clean' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_clean_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container('clean');
	if (!container) {
		return false;
	}
	var colors = _v2_single_score_colors(s, dto);
	var teams = dto.teams || [];
	var is_doubles = !!(dto.match && dto.match.is_doubles);
	var pcount = is_doubles ? 2 : 1;
	_v2_clean_cache = {
		container: container,
		structure_key: _v2_simple_score_structure_key(s, dto, 'clean'),
		teams: [],
	};
	teams.slice(0, 2).forEach(function(team, team_idx) {
		var team_cache = {
			colors: colors,
			player_els: [],
			gscore_el: null,
			score_el: null,
		};
		_v2_clean_cache.teams[team_idx] = team_cache;
		var team_container = uiu.el(container, 'div', {
			'class': 'd_clean_team',
			'style': 'background:' + colors.bg + ';',
		});
		var player_labels = _v2_display_player_labels(team, s.settings);
		while (player_labels.length < pcount) {
			player_labels.push('');
		}
		var player_spans = player_labels.slice(0, pcount).map(function(pname, player_idx) {
			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '50%' : '100%') + ';',
				'class': 'd_clean_player_container',
			});
			var pel = uiu.el(player_container, 'div', {
				style: 'height:' + (is_doubles ? '100%' : '50%') + ';',
				'class': 'd_clean_player',
			});
			team_cache.player_els[player_idx] = pel;
			return uiu.el(pel, 'div', {}, pname);
		});
		team_cache.gscore_el = uiu.el(team_container, 'div', {
			'class': 'd_clean_gscore',
			style: 'background: ' + colors.bg + '; color: ' + colors.fg + ';',
		}, '');
		team_cache.score_el = uiu.el(team_container, 'div', {
			'class': 'd_clean_score',
		}, '');
		_v2_clean_apply_team(team_cache, dto, team_idx);
		player_spans.forEach(function(ps) {
			_setup_autosize(ps, team_cache.gscore_el, function(parent_node) {
				return 0.8 * parent_node.offsetHeight;
			});
		});
	});
	return true;
}

function _v2_onlyscore_apply_team(cache, dto, team_idx) {
	var team = dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var team_side = _v2_team_side(team, team_idx);
	var sets = _v2_score_sets_for_display(dto.score);
	var colors = cache.colors;
	var col = colors[team_idx];
	var bg_col = colors['b' + team_idx];
	cache.score_els.forEach(function(score_el, game_idx) {
		var set_score = sets[game_idx];
		var points = set_score ? _v2_score_for_team(set_score, team, team_idx) : '';
		var is_current = game_idx === (sets.length - 1);
		var highlighted = false;
		if (set_score) {
			if (is_current) {
				highlighted = _v2_team_is_serving_or_set_winner(dto, team_idx);
			} else {
				var left = Number(set_score.left || 0);
				var right = Number(set_score.right || 0);
				highlighted = (team_side === 'left' && left > right) || (team_side === 'right' && right > left);
			}
		}
		_v2_set_style(score_el, 'background', highlighted ? col : bg_col);
		_v2_set_style(score_el, 'color', highlighted ? bg_col : col);
		_v2_score_digit_nodes(score_el, points, cache.max_game_count);
	});
}

function _v2_onlyscore_patch(s, dto) {
	if (!_v2_onlyscore_cache || !_v2_onlyscore_cache.container || !dto || !dto.match) {
		return render_v2_onlyscore_display_state(s, dto);
	}
	var structure_key = _v2_simple_score_structure_key(s, dto, 'onlyscore');
	if (_v2_onlyscore_cache.structure_key !== structure_key) {
		return render_v2_onlyscore_display_state(s, dto);
	}
	[0, 1].forEach(function(team_idx) {
		var team_cache = _v2_onlyscore_cache.teams[team_idx];
		if (team_cache) {
			_v2_onlyscore_apply_team(team_cache, dto, team_idx);
		}
	});
	return true;
}

function render_v2_onlyscore_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'onlyscore' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_onlyscore_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container('onlyscore');
	if (!container) {
		return false;
	}
	var colors = _v2_single_score_colors(s, dto);
	var score_sets = _v2_score_sets_for_display(dto.score);
	var max_game_count = Math.max(Number(dto.match.best_of || 0) || 3, score_sets.length);
	_v2_onlyscore_cache = {
		container: container,
		structure_key: _v2_simple_score_structure_key(s, dto, 'onlyscore'),
		teams: [],
	};
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var team_cache = {
			colors: colors,
			max_game_count: max_game_count,
			score_els: [],
		};
		_v2_onlyscore_cache.teams[team_idx] = team_cache;
		var team_container = uiu.el(container, 'div', 'd_onlyscore_half');
		for (var game_idx = 0;game_idx < max_game_count;game_idx++) {
			team_cache.score_els[game_idx] = uiu.el(team_container, 'div', {
				'class': 'd_score_default',
				style: (
					'width:' + (95 / max_game_count) + 'vw;' +
					'border-right:' + (5 / max_game_count) + 'vw solid ' + colors['b' + team_idx] + ';' +
					'display: flex;' +
					'align-items: center;' +
					'justify-content: center;' +
					'font-size: ' + (max_game_count === 5 ? 23 : 30) + 'vw;' +
					'overflow: hidden;'
				),
			});
		}
		_v2_onlyscore_apply_team(team_cache, dto, team_idx);
	});
	return true;
}

function _v2_giantscore_apply_team(cache, dto, team_idx) {
	var team = dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var colors = cache.colors;
	var col = colors[team_idx];
	var bg_col = colors['b' + team_idx];
	var points = _v2_score_for_team(dto.score && dto.score.current_set, team, team_idx);
	var sets_won = _v2_sets_won_for_score(dto);
	var winner_side = _v2_international_match_winner_side(dto);
	var side = _v2_team_side(team, team_idx);
	var invert = (winner_side && winner_side === side) || _v2_team_is_serving_or_set_winner(dto, team_idx);
	_v2_set_text(cache.points_el, points);
	_v2_set_text(cache.gscore_el, _v2_score_for_team(sets_won, team, team_idx));
	_v2_set_style(cache.points_el, 'color', invert ? bg_col : col);
	_v2_set_style(cache.points_el, 'background', invert ? col : '');
}

function _v2_giantscore_patch(s, dto) {
	if (!_v2_giantscore_cache || !_v2_giantscore_cache.container || !dto || !dto.match) {
		return render_v2_giantscore_display_state(s, dto);
	}
	var structure_key = _v2_simple_score_structure_key(s, dto, 'giantscore');
	if (_v2_giantscore_cache.structure_key !== structure_key) {
		return render_v2_giantscore_display_state(s, dto);
	}
	[0, 1].forEach(function(team_idx) {
		var team_cache = _v2_giantscore_cache.teams[team_idx];
		if (team_cache) {
			_v2_giantscore_apply_team(team_cache, dto, team_idx);
		}
	});
	return true;
}

function render_v2_giantscore_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'giantscore' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_giantscore_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container('giantscore');
	if (!container) {
		return false;
	}
	var colors = _v2_single_score_colors(s, dto);
	_v2_giantscore_cache = {
		container: container,
		structure_key: _v2_simple_score_structure_key(s, dto, 'giantscore'),
		teams: [],
	};
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var col = colors[team_idx];
		var bg_col = colors['b' + team_idx];
		var team_container = uiu.el(container, 'div', {
			style: (
				'position:absolute;width:50%;height:100%;top:0;left:' + (team_idx * 50) + '%;' +
				'background:' + bg_col + ';color:' + col + ';' +
				'overflow:hidden;'
			),
		});
		var points_el = uiu.el(team_container, 'div', {
			style: 'width:100%;text-align:center;font-size:75vh;margin-top:-9vh;',
		}, '');
		var gscore_el = uiu.el(team_container, 'div', {
			style: (
				'position: absolute;bottom:-1vh;left:0;right:0;text-align:center;' +
				'font-size: 30vh; background:' + bg_col + ';'
			),
		}, '');
		var team_cache = {
			colors: colors,
			points_el: points_el,
			gscore_el: gscore_el,
		};
		_v2_giantscore_cache.teams[team_idx] = team_cache;
		_v2_giantscore_apply_team(team_cache, dto, team_idx);
	});
	return true;
}

function _v2_bwf_player_name(player, fallback) {
	if (!player) {
		return fallback || '';
	}
	if (typeof player === 'string') {
		return player;
	}
	var first_name = player.firstname || '';
	var last_name = player.lastname || '';
	if (!last_name && player.name) {
		var parts = String(player.name).split(/\s+/).filter(Boolean);
		last_name = parts.pop() || '';
		first_name = first_name || parts.join(' ');
	}
	if (last_name) {
		return last_name.toUpperCase() + (first_name ? ', ' + first_name : '');
	}
	return player.name || fallback || '';
}

function _v2_playerstyle_styles() {
	return ['onlyplayers', 'clubplayers', 'clubplayerslr', 'bwfonlyplayers'];
}

function _v2_is_playerstyle(style) {
	return utils.includes(_v2_playerstyle_styles(), style);
}

function _v2_playerstyle_labels(team, settings, style) {
	if (style !== 'bwfonlyplayers') {
		return _v2_display_player_labels(team, settings);
	}
	if (!team) {
		return [];
	}
	if (team.player_details && team.player_details.length) {
		return team.player_details.map(function(player, player_idx) {
			var fallback = team.players && team.players[player_idx] ? team.players[player_idx] : '';
			return _v2_bwf_player_name(player, fallback);
		}).filter(Boolean);
	}
	return (team.players || []).map(function(player) {
		return _v2_bwf_player_name(player, player);
	}).filter(Boolean);
}

function _v2_playerstyle_details(team, pcount) {
	var details = team && team.player_details ? team.player_details.slice(0, pcount) : [];
	while (details.length < pcount) {
		details.push(null);
	}
	return details;
}

function _v2_playerstyle_structure_key(s, dto) {
	var style = s.settings.displaymode_style || '';
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	var is_doubles = !!(match && match.is_doubles);
	return _v2_join_key([
		style,
		s.settings.d_team_colors ? 'tc' : '',
		match ? match.id : '',
		is_doubles ? 'D' : 'S',
		teams.map(function(team) {
			return [
				team && team.name ? team.name : '',
				_v2_playerstyle_labels(team, s.settings, style).join('/'),
				(team && team.player_details ? team.player_details.map(function(player) {
					return player && player.nationality ? player.nationality : '';
				}).join('/') : ''),
			].join(':');
		}).join('|'),
	]);
}

function _v2_playerstyle_apply_team(cache, dto, team_idx) {
	var team = dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var style = cache.style;
	var colors = cache.colors;
	var col = colors[team_idx];
	var bg_col = (style === 'clubplayers' || style === 'clubplayerslr') ? colors.bg : (colors['b' + team_idx] || colors.bg);
	cache.player_caches.forEach(function(player_cache, player_idx) {
		var is_server = _v2_player_is_serving(dto, team_idx, player_idx);
		if (style === 'clubplayers' || style === 'clubplayerslr') {
			if (player_cache.shuttle_el) {
				_v2_set_style(player_cache.shuttle_el, 'display', is_server ? '' : 'none');
			}
			return;
		}
		_v2_set_style(player_cache.container_el, 'background', is_server ? col : bg_col);
		_v2_set_style(player_cache.container_el, 'color', is_server ? bg_col : col);
		if (player_cache.flag_el) {
			_v2_set_style(player_cache.flag_el, 'background', is_server ? col : bg_col);
		}
	});
}

function _v2_playerstyle_patch(s, dto) {
	if (!_v2_playerstyle_cache || !_v2_playerstyle_cache.container || !dto || !dto.match) {
		return render_v2_playerstyle_display_state(s, dto);
	}
	var structure_key = _v2_playerstyle_structure_key(s, dto);
	if (_v2_playerstyle_cache.structure_key !== structure_key) {
		return render_v2_playerstyle_display_state(s, dto);
	}
	[0, 1].forEach(function(team_idx) {
		var team_cache = _v2_playerstyle_cache.teams[team_idx];
		if (team_cache) {
			_v2_playerstyle_apply_team(team_cache, dto, team_idx);
		}
	});
	return true;
}

function _v2_render_playerstyle_team_name(team_container, team, team_idx, colors, lr) {
	var div = uiu.el(team_container, 'div', {
		style: (
			'background: ' + colors.bg + ';' +
			'color: ' + colors[team_idx] + ';' +
			'height: 20%;' +
			(lr ? 'margin: 0 5%;' : 'margin-left: 5%;')
		),
	});
	var span = uiu.el(div, 'span', {}, team && team.name ? team.name : '');
	_setup_autosize(span);
}

function render_v2_playerstyle_display_state(s, dto) {
	var style = s && s.settings ? s.settings.displaymode_style : '';
	if (!_v2_is_playerstyle(style) || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_playerstyle_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container(style);
	if (!container) {
		return false;
	}
	var colors = _v2_single_score_colors(s, dto);
	var is_doubles = !!(dto.match && dto.match.is_doubles);
	var pcount = is_doubles ? 2 : 1;
	_v2_playerstyle_cache = {
		container: container,
		structure_key: _v2_playerstyle_structure_key(s, dto),
		teams: [],
	};
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var col = colors[team_idx];
		var bg_col = colors['b' + team_idx] || colors.bg;
		var team_cache = {
			style: style,
			colors: colors,
			player_caches: [],
		};
		_v2_playerstyle_cache.teams[team_idx] = team_cache;
		var is_team0 = team_idx === 0;
		var team_container = uiu.el(container, 'div', {
			'class': (style === 'bwfonlyplayers') ? 'd_international_team' : 'd_half',
			style: (
				'background:' + ((style === 'onlyplayers' || style === 'bwfonlyplayers') ? bg_col : colors.bg) + ';' +
				(style === 'clubplayerslr' && !is_team0 ? 'text-align: right;' : '')
			),
		});

		if (style === 'clubplayers' && team_idx === 1) {
			_v2_render_playerstyle_team_name(team_container, team, team_idx, colors, false);
		}
		if (style === 'clubplayerslr' && !is_team0) {
			_v2_render_playerstyle_team_name(team_container, team, team_idx, colors, true);
		}

		var labels = _v2_playerstyle_labels(team, s.settings, style);
		while (labels.length < pcount) {
			labels.push('');
		}
		var details = _v2_playerstyle_details(team, pcount);
		var player_spans = labels.slice(0, pcount).map(function(pname, player_idx) {
			var player_cache = {
				container_el: null,
				flag_el: null,
				shuttle_el: null,
			};
			team_cache.player_caches[player_idx] = player_cache;
			if (style === 'bwfonlyplayers') {
				var player_container = uiu.el(team_container, 'div', {
					'style': (
						'height: ' + (is_doubles ? '50%' : '100%') + ';' +
						'color: ' + col + ';'
					),
					'class': 'd_bwfonlyplayers_player_container',
				});
				player_cache.container_el = player_container;
				var flag_container = uiu.el(player_container, 'div', {
					style: (
						'width: 18vh;' +
						'height: ' + (is_doubles ? '100%' : '50%') + ';' +
						'display:flex; align-items: center; justify-content:center;'
					),
				});
				player_cache.flag_el = flag_container;
				var player = details[player_idx];
				if (player && player.nationality) {
					uiu.el(flag_container, 'img', {
						style: 'display:block;height:18vh;width:18vh;',
						src: 'div/flags/' + player.nationality + '.svg',
						alt: player.nationality,
					});
				}
				var name_container = uiu.el(player_container, 'div', {
					style: (
						'height: 20vh;' +
						'position:absolute; left: 21vh; right:0;' +
						'white-space:pre;overflow:hidden;' +
						'display:flex;align-items: center;'
					),
				});
				var name_el = uiu.el(name_container, 'div', {
					style: 'font-size: 150px;',
				}, pname);
				_setup_autosize(name_el);
				return name_el;
			}

			var logo_width = 100;
			var player_container_style = '';
			var player_container_class = '';
			var player_inner_style = '';
			var shuttle_class = null;
			if (style === 'onlyplayers') {
				player_container_style = (
					'height: ' + (is_doubles ? '50%' : '100%') + ';' +
					'width:' + logo_width + '%;' +
					'position: relative;' +
					'display: flex;' +
					'align-items: center;'
				);
				player_inner_style = 'height:100%;';
			} else if (style === 'clubplayers') {
				player_container_style = 'height: ' + (is_doubles ? '40%' : '80%') + ';';
				player_container_class = 'd_onlyplayers_player_container';
				player_inner_style = (
					'background: ' + colors.bg + ';' +
					'color: ' + col + ';' +
					'height: 75%;'
				);
				shuttle_class = 'd_shuttle';
			} else {
				player_container_style = 'height: ' + (is_doubles ? '40%' : '80%') + ';';
				player_container_class = 'd_clubplayerslr_player_container';
				player_inner_style = (
					'background: ' + colors.bg + ';' +
					'color: ' + col + ';' +
					'height: 75%;' +
					(is_team0 ? '' : 'justify-content: flex-end;')
				);
				shuttle_class = is_team0 ? 'd_shuttle' : 'd_shuttle_after';
			}
			var player_container_attrs = {style: player_container_style};
			if (player_container_class) {
				player_container_attrs['class'] = player_container_class;
			}
			var player_container = uiu.el(team_container, 'div', player_container_attrs);
			player_cache.container_el = player_container;
			var pel = uiu.el(player_container, 'div', {
				style: player_inner_style,
				'class': 'd_onlyplayers_player',
			});
			if (shuttle_class) {
				player_cache.shuttle_el = uiu.el(pel, 'div', {
					'class': shuttle_class,
					style: 'display:none;',
				});
			}
			return uiu.el(pel, 'div', {}, pname);
		});

		if (style === 'clubplayers' && team_idx === 0) {
			_v2_render_playerstyle_team_name(team_container, team, team_idx, colors, false);
		}
		if (style === 'clubplayerslr' && is_team0) {
			_v2_render_playerstyle_team_name(team_container, team, team_idx, colors, true);
		}
		_v2_playerstyle_apply_team(team_cache, dto, team_idx);
		player_spans.forEach(function(ps) {
			_setup_autosize(ps, null, function(parent_node) {
				if (style === 'onlyplayers') {
					return parent_node.offsetHeight * 0.7 * (is_doubles ? 1 : 0.5);
				}
				return parent_node.offsetHeight * (is_doubles ? 1 : 0.5);
			});
		});
	});
	return true;
}

function _v2_bwf_structure_key(s, dto) {
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	var finished_sets = dto && dto.score && dto.score.finished_sets ? dto.score.finished_sets : [];
	return _v2_join_key([
		s.settings.displaymode_style || '',
		match ? match.id : '',
		match ? (match.is_doubles ? 'D' : 'S') : 'idle',
		finished_sets.map(function(set_score) {
			return [
				set_score && set_score.left != null ? set_score.left : '',
				set_score && set_score.right != null ? set_score.right : '',
			].join(':');
		}).join('/'),
		teams.map(function(team) {
			return (team && team.player_details ? team.player_details.map(function(player, player_idx) {
				var fallback = team.players && team.players[player_idx] ? team.players[player_idx] : '';
				return [
					_v2_bwf_player_name(player, fallback),
					player && player.nationality ? player.nationality : '',
				].join(':');
			}).join('/') : '');
		}).join('|'),
	]);
}

function _v2_international_structure_key(s, dto) {
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	var finished_sets = dto && dto.score && dto.score.finished_sets ? dto.score.finished_sets : [];
	return _v2_join_key([
		s.settings.displaymode_style || '',
		s.settings.d_show_middle_name ? '1' : '0',
		s.settings.d_abbreviate_first_name ? '1' : '0',
		match ? match.id : '',
		match ? (match.is_doubles ? 'D' : 'S') : 'idle',
		match && match.nation_competition ? 'N' : 'M',
		finished_sets.map(function(set_score) {
			return [
				set_score && set_score.left != null ? set_score.left : '',
				set_score && set_score.right != null ? set_score.right : '',
			].join(':');
		}).join('/'),
		teams.map(function(team) {
			return [
				team && team.name ? team.name : '',
				_v2_display_player_labels(team, s.settings).join('/'),
				(team && team.player_details ? team.player_details.map(function(player) {
					return player && player.nationality ? player.nationality : '';
				}).join('/') : ''),
			].join(':');
		}).join('|'),
	]);
}

function _v2_international_apply_team_style(cache, dto, team_idx) {
	var team = dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var points = _v2_score_for_team(dto.score && dto.score.current_set, team, team_idx);
	var color = cache.colors[team_idx];
	var team_serving = _v2_international_team_serving(dto, team_idx);
	cache.score_value = points;
	cache.score_el.className = _v2_international_score_class(points);
	uiu.text(cache.score_el, points);
	cache.score_el.style.background = team_serving ? color : cache.colors.bg;
	cache.score_el.style.color = team_serving ? cache.colors.bg : color;
	cache.player_els.forEach(function(player_el, player_idx) {
		var is_server = _v2_international_player_serving(dto, team_idx, player_idx);
		player_el.style.background = is_server ? color : cache.colors.bg;
		player_el.style.color = is_server ? cache.colors.bg : color;
	});
	cache.player_containers.forEach(function(player_container, player_idx) {
		var is_server = _v2_international_player_serving(dto, team_idx, player_idx);
		player_container.style.background = is_server ? color : cache.colors.bg;
	});
}

function _v2_international_patch(s, dto) {
	if (!_v2_international_cache || !_v2_international_cache.container || !dto || !dto.match) {
		return render_v2_international_display_state(s, dto);
	}
	var structure_key = _v2_international_structure_key(s, dto);
	if (_v2_international_cache.structure_key !== structure_key) {
		return render_v2_international_display_state(s, dto);
	}
	[0, 1].forEach(function(team_idx) {
		var team_cache = _v2_international_cache.teams[team_idx];
		if (team_cache) {
			_v2_international_apply_team_style(team_cache, dto, team_idx);
		}
	});
	return true;
}

function _v2_bwf_apply_team_style(cache, dto, team_idx) {
	var team = dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var points = _v2_score_for_team(dto.score && dto.score.current_set, team, team_idx);
	var color = cache.colors[team_idx];
	var team_serving = _v2_international_team_serving(dto, team_idx);
	cache.score_value = points;
	cache.score_el.className = _v2_international_score_class(points);
	uiu.text(cache.score_el, points);
	cache.score_el.style.background = team_serving ? color : cache.colors.bg;
	cache.score_el.style.color = team_serving ? cache.colors.bg : color;
	cache.player_els.forEach(function(player_el, player_idx) {
		var is_server = _v2_international_player_serving(dto, team_idx, player_idx);
		player_el.style.background = is_server ? color : cache.colors.bg;
		player_el.style.color = is_server ? cache.colors.bg : color;
	});
	cache.flag_els.forEach(function(flag_el, player_idx) {
		var is_server = _v2_international_player_serving(dto, team_idx, player_idx);
		flag_el.style.background = is_server ? color : cache.colors.bg;
	});
}

function _v2_bwf_patch(s, dto) {
	if (!_v2_bwf_cache || !_v2_bwf_cache.container || !dto || !dto.match) {
		return render_v2_bwf_display_state(s, dto);
	}
	var structure_key = _v2_bwf_structure_key(s, dto);
	if (_v2_bwf_cache.structure_key !== structure_key) {
		return render_v2_bwf_display_state(s, dto);
	}
	[0, 1].forEach(function(team_idx) {
		var team_cache = _v2_bwf_cache.teams[team_idx];
		if (team_cache) {
			_v2_bwf_apply_team_style(team_cache, dto, team_idx);
		}
	});
	return true;
}

function render_v2_international_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'international' || !dto) {
		return false;
	}
	if (!dto.court || !dto.court.id || _is_unassigned_display(s)) {
		var unassigned_container = uiu.qs('.displaymode_layout');
		if (!unassigned_container) {
			return false;
		}
		_v2_international_cache = null;
		_last_painted_hash = null;
		autosize.unmaintain_all(unassigned_container);
		uiu.empty(unassigned_container);
		_render_unassigned_display(s, unassigned_container);
		return true;
	}
	if (!dto.match) {
		_v2_international_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = uiu.qs('.displaymode_layout');
	if (!container) {
		return false;
	}
	_v2_tournamentcourt_cache = null;
	_v2_2court_cache = null;
	_v2_oncourt_cache = null;
	_v2_international_cache = null;
	_v2_bwf_cache = null;
	autosize.unmaintain_all(container);
	uiu.empty(container);
	ALL_STYLES.forEach(function(astyle) {
		((astyle === 'international') ? uiu.addClass : uiu.removeClass)(container, 'd_layout_' + astyle);
	});
	var colors = _v2_international_colors(s, dto);
	var teams = dto.teams || [];
	var score = dto.score || {};
	var finished_sets = score.finished_sets || [];
	var first_game = finished_sets.length < 1;
	var gscore = _v2_international_game_score(dto);
	var is_doubles = !!dto.match.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var nation_competition = !!dto.match.nation_competition;
	_v2_international_cache = {
		container: container,
		structure_key: _v2_international_structure_key(s, dto),
		colors: colors,
		teams: [],
	};

	teams.forEach(function(team, team_idx) {
		var color = colors[team_idx];
		var team_cache = {
			colors: colors,
			score_el: null,
			score_value: null,
			player_els: [],
			player_containers: [],
		};
		_v2_international_cache.teams[team_idx] = team_cache;
		var team_serving = _v2_international_team_serving(dto, team_idx);
		var players = [];
		var player_labels = _v2_display_player_labels(team, s.settings);
		var player_details = team && team.player_details ? team.player_details : [];
		for (var player_idx = 0;player_idx < pcount;player_idx++) {
			players.push({
				label: player_labels[player_idx] || '',
				nationality: player_details[player_idx] && player_details[player_idx].nationality
					? player_details[player_idx].nationality
					: '',
			});
		}

		var team_container = uiu.el(container, 'div', 'd_international_team');
		var player_spans = players.map(function(player, player_idx) {
			var is_server = _v2_international_player_serving(dto, team_idx, player_idx);
			var bg_css = 'background: ' + (is_server ? color : colors.bg) + ';';
			var style = (
				bg_css +
				'color: ' + (is_server ? colors.bg : color) + ';' +
				'height: ' + (is_doubles ? '100%' : '50%') + ';'
			);
			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '50%' : '100%') + ';' + bg_css,
				'class': 'd_international_player_container',
			});
			team_cache.player_containers[player_idx] = player_container;
			if (nation_competition) {
				var flag_container = uiu.el(player_container, 'div', {
					style: (
						'width: 14vh;' +
						'height: ' + (is_doubles ? '100%' : '50%') + ';' +
						bg_css +
						'display:flex; align-items: center; justify-content:center;'
					),
				});
				if (player.nationality) {
					uiu.el(flag_container, 'img', {
						style: 'display:block;height:14vh;width:14vh;',
						src: 'div/flags/' + player.nationality + '.svg',
						alt: player.nationality,
					});
				}
			}
			var player_el = uiu.el(player_container, 'div', {
				style: style,
				'class': 'd_international_player',
			});
			team_cache.player_els[player_idx] = player_el;
			return uiu.el(player_el, 'div', {}, player.label);
		});

		var right_border;
		if (!first_game) {
			right_border = uiu.el(team_container, 'div', {
				'class': 'd_international_gscore',
				style: 'background: ' + colors.bg + '; color: ' + colors.fg + ';',
			}, gscore[team_idx]);
		}

		var points = _v2_score_for_team(score.current_set, team, team_idx);
		var points_el = uiu.el(team_container, 'div', {
			'class': _v2_international_score_class(points),
			style: 'background: ' + (team_serving ? color : colors.bg) + '; color: ' + (team_serving ? colors.bg : color),
		}, points);
		team_cache.score_el = points_el;
		team_cache.score_value = points;
		if (!right_border) {
			right_border = points_el;
		}

		player_spans.forEach(function(player_span) {
			_setup_autosize(player_span, right_border, function(parent_node) {
				return 0.8 * parent_node.offsetHeight;
			});
		});
	});
	return true;
}

function render_v2_bwf_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'bwf' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_bwf_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = uiu.qs('.displaymode_layout');
	if (!container) {
		return false;
	}
	_v2_tournamentcourt_cache = null;
	_v2_2court_cache = null;
	_v2_oncourt_cache = null;
	_v2_international_cache = null;
	_v2_bwf_cache = null;
	autosize.unmaintain_all(container);
	uiu.empty(container);
	ALL_STYLES.forEach(function(astyle) {
		((astyle === 'bwf') ? uiu.addClass : uiu.removeClass)(container, 'd_layout_' + astyle);
	});
	var colors = _v2_international_colors(s, dto);
	var teams = dto.teams || [];
	var score = dto.score || {};
	var finished_sets = score.finished_sets || [];
	var first_game = finished_sets.length < 1;
	var gscore = _v2_international_game_score(dto);
	var is_doubles = !!dto.match.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	_v2_bwf_cache = {
		container: container,
		structure_key: _v2_bwf_structure_key(s, dto),
		colors: colors,
		teams: [],
	};

	teams.forEach(function(team, team_idx) {
		var color = colors[team_idx];
		var team_serving = _v2_international_team_serving(dto, team_idx);
		var team_cache = {
			colors: colors,
			score_el: null,
			score_value: null,
			player_els: [],
			flag_els: [],
		};
		_v2_bwf_cache.teams[team_idx] = team_cache;
		var players = [];
		var player_details = team && team.player_details ? team.player_details : [];
		for (var player_idx = 0;player_idx < pcount;player_idx++) {
			var player_detail = player_details[player_idx] || null;
			var fallback = team && team.players && team.players[player_idx] ? team.players[player_idx] : '';
			players.push({
				label: _v2_bwf_player_name(player_detail, fallback),
				nationality: player_detail && player_detail.nationality ? player_detail.nationality : '',
			});
		}

		var team_container = uiu.el(container, 'div', {
			'class': 'd_international_team',
			'style': 'background:' + colors.bg + ';',
		});
		players.forEach(function(player, player_idx) {
			var is_server = _v2_international_player_serving(dto, team_idx, player_idx);
			var bg_css = 'background: ' + (is_server ? color : colors.bg) + ';';
			var style = (
				bg_css +
				'color: ' + (is_server ? colors.bg : color) + ';' +
				'height: ' + (is_doubles ? '100%' : '50%') + ';'
			);
			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '50%' : '100%') + ';',
				'class': 'd_international_player_container',
			});
			var flag_container = uiu.el(player_container, 'div', {
				style: (
					'width: 14vh;' +
					'height: ' + (is_doubles ? '100%' : '50%') + ';' +
					bg_css +
					'display:flex; align-items: center; justify-content:center;'
				),
			});
			team_cache.flag_els[player_idx] = flag_container;
			if (player.nationality) {
				uiu.el(flag_container, 'img', {
					style: 'display:block;height:14vh;width:14vh;',
					src: 'div/flags/' + player.nationality + '.svg',
					alt: player.nationality,
				});
			}
			var player_el = uiu.el(player_container, 'div', {
				style: style,
				'class': 'd_bwf_player',
			});
			team_cache.player_els[player_idx] = player_el;
			uiu.el(player_el, 'div', {
				'style': 'white-space:pre;overflow-x:hidden',
			}, player.label);
		});

		if (!first_game) {
			uiu.el(team_container, 'div', {
				'class': 'd_international_gscore',
				style: 'background: ' + colors.bg + '; color: ' + colors.fg + ';',
			}, gscore[team_idx]);
		}

		var points = _v2_score_for_team(score.current_set, team, team_idx);
		var points_el = uiu.el(team_container, 'div', {
			'class': _v2_international_score_class(points),
			style: 'background: ' + (team_serving ? color : colors.bg) + '; color: ' + (team_serving ? colors.bg : color),
		}, points);
		team_cache.score_el = points_el;
		team_cache.score_value = points;
	});
	return true;
}

function _v2_oncourt_structure_key(s, dto) {
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	var finished_sets = dto && dto.score && dto.score.finished_sets ? dto.score.finished_sets : [];
	return _v2_join_key([
		s.settings.displaymode_style || '',
		s.settings.d_show_middle_name ? '1' : '0',
		s.settings.d_abbreviate_first_name ? '1' : '0',
		match ? match.id : '',
		match ? (match.is_doubles ? 'D' : 'S') : 'idle',
		match && match.team_competition ? 'TC' : 'M',
		finished_sets.map(function(set_score) {
			return [
				set_score && set_score.left != null ? set_score.left : '',
				set_score && set_score.right != null ? set_score.right : '',
			].join(':');
		}).join('/'),
		teams.map(function(team) {
			return [
				team && team.name ? team.name : '',
				_v2_display_player_labels(team, s.settings).join('/'),
			].join(':');
		}).join('|'),
	]);
}

function _v2_oncourt_server_matches(dto, team_idx, player_idx) {
	if (!dto || !dto.service || !dto.service.server) {
		return false;
	}
	var server = dto.service.server;
	var team = dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var team_matches = (
		(typeof server.team_index === 'number' && server.team_index === team_idx) ||
		(team && server.side && server.side === team.side)
	);
	if (!team_matches) {
		return false;
	}
	if (server.player_index == null) {
		return player_idx === 0;
	}
	return server.player_index === player_idx;
}

function _v2_oncourt_patch(s, dto) {
	if (!_v2_oncourt_cache || !_v2_oncourt_cache.container || !dto || !dto.match) {
		return render_v2_oncourt_display_state(s, dto);
	}
	var structure_key = _v2_oncourt_structure_key(s, dto);
	if (_v2_oncourt_cache.structure_key !== structure_key) {
		return render_v2_oncourt_display_state(s, dto);
	}
	var teams = dto.teams || [];
	var current_set = dto.score && dto.score.current_set ? dto.score.current_set : {};
	teams.forEach(function(team, team_idx) {
		var team_cache = _v2_oncourt_cache.teams[team_idx];
		if (!team_cache) {
			return;
		}
		var next_score = _v2_score_for_team(current_set, team, team_idx);
		if (team_cache.score_value !== next_score) {
			uiu.text(team_cache.score_el, next_score);
			team_cache.score_value = next_score;
		}
		(team_cache.player_els || []).forEach(function(player_el, player_idx) {
			player_el.style.color = _v2_oncourt_server_matches(dto, team_idx, player_idx)
				? _v2_oncourt_cache.colors.cserv2
				: '';
		});
	});
	return true;
}

function render_v2_oncourt_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'oncourt' || !dto) {
		return false;
	}
	if (!dto.court || !dto.court.id || !dto.match) {
		_v2_oncourt_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = uiu.qs('.displaymode_layout');
	if (!container) {
		return false;
	}
	_v2_tournamentcourt_cache = null;
	_v2_2court_cache = null;
	_v2_international_cache = null;
	_v2_bwf_cache = null;
	autosize.unmaintain_all(container);
	uiu.empty(container);
	ALL_STYLES.forEach(function(astyle) {
		((astyle === 'oncourt') ? uiu.addClass : uiu.removeClass)(container, 'd_layout_' + astyle);
	});
	var colors = _v2_oncourt_colors(s, dto);
	var current_set = dto.score && dto.score.current_set ? dto.score.current_set : {};
	var finished_sets = dto.score && dto.score.finished_sets ? dto.score.finished_sets : [];
	var teams = dto.teams || [];
	var outer_container = uiu.el(container, 'div', {
		style: (
			'background:' + colors.bg + ';' +
			'color:' + colors.fg + ';' +
			'width: 100%;height:100%;' +
			'display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;'
		),
	});
	var oncourt_container = uiu.el(outer_container, 'div', {
		style: 'position:relative;width:100%;',
	});
	_v2_oncourt_cache = {
		container: container,
		structure_key: _v2_oncourt_structure_key(s, dto),
		colors: colors,
		teams: [],
	};
	var score_els = [];
	[0, 1].forEach(function(team_idx) {
		var score_value = _v2_score_for_team(current_set, teams[team_idx], team_idx);
		var score_el = uiu.el(oncourt_container, 'div', {
			'style': (
				'position:absolute;right:0;' +
				(team_idx === 0 ? 'top:0;' : 'bottom:0;') +
				'font-size: 32vmin;line-height: 32vmin;'
			),
		}, score_value);
		score_els[team_idx] = score_el;
		_v2_oncourt_cache.teams[team_idx] = {
			score_el: score_el,
			score_value: score_value,
			player_els: [],
		};
	});

	function _render_team(team_idx) {
		var team = teams[team_idx] || {};
		var player_labels = _v2_display_player_labels(team, s.settings);
		if (!dto.match.is_doubles && player_labels.length > 1) {
			player_labels = player_labels.slice(0, 1);
		}
		var player_container = uiu.el(oncourt_container, 'div', {
			'style': (
				'height:30vh;' +
				(dto.match.is_doubles ?
					'' :
					'display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;'
				)
			),
		});
		player_labels.forEach(function(player_label, player_idx) {
			var is_serving = _v2_oncourt_server_matches(dto, team_idx, player_idx);
			var player_name_container = uiu.el(player_container, 'div', {
				'style': (
					'height: 15vmin;font-size:12vmin;' +
					'white-space:pre;' +
					(is_serving ? 'color:' + colors.cserv2 + ';' : '')
				),
			});
			var player_name_span = uiu.el(player_name_container, 'span', {}, player_label);
			_v2_oncourt_cache.teams[team_idx].player_els[player_idx] = player_name_container;
			_setup_autosize(player_name_span, score_els[team_idx]);
		});
	}

	_render_team(0);

	if (dto.match.team_competition || finished_sets.length) {
		var middle_table = uiu.el(oncourt_container, 'table', {
			style: 'table-layout:fixed;width:100%;',
		});
		teams.forEach(function(team, team_idx) {
			var team_name = dto.match.team_competition && team && team.name ? team.name : '';
			var tr = uiu.el(middle_table, 'tr', {
				style: 'height:11vmin;',
			});
			var name_td = uiu.el(tr, 'td', {
				style: (
					'color:' + colors.fg3 + ';' +
					'font-size:10vmin;'
				),
			});
			var team_span = uiu.el(name_td, 'span', {}, team_name);
			_setup_autosize(team_span);
			finished_sets.forEach(function(set_score) {
				var own_score = _v2_score_for_team(set_score, team, team_idx);
				var other_score = _v2_score_for_team(set_score, teams[1 - team_idx], 1 - team_idx);
				uiu.el(tr, 'td', {
					'style': (
						((own_score > other_score) ? 'color:' + colors.serv2 + ';' : '') +
						'font-size:10vmin;text-align:right;width:3ch;'
					),
				}, own_score);
			});
		});
	}

	_render_team(1);
	return true;
}

function _v2_2court_player_serving(court_state, team, team_idx, player_idx) {
	if (!court_state || (court_state.score && court_state.score.current_set_finished)) {
		return false;
	}
	var server = court_state.service && court_state.service.server ? court_state.service.server : null;
	if (!server) {
		return false;
	}
	var team_matches = (
		(typeof server.team_index === 'number' && server.team_index === team_idx) ||
		(team && server.side && server.side === team.side)
	);
	if (!team_matches) {
		return false;
	}
	if (server.player_index == null) {
		return player_idx === 0;
	}
	return server.player_index === player_idx;
}

function _v2_2court_player_receiving(court_state, team, team_idx, player_idx) {
	if (!court_state || !(court_state.match && court_state.match.is_doubles) || (court_state.score && court_state.score.current_set_finished)) {
		return false;
	}
	var receiver = court_state.service && court_state.service.receiver ? court_state.service.receiver : null;
	if (!receiver) {
		return false;
	}
	var team_matches = (
		(typeof receiver.team_index === 'number' && receiver.team_index === team_idx) ||
		(team && receiver.side && receiver.side === team.side)
	);
	if (!team_matches) {
		return false;
	}
	if (receiver.player_index == null) {
		return player_idx === 0;
	}
	return receiver.player_index === player_idx;
}

function _v2_2court_match_players(court_state, settings) {
	return (court_state && court_state.teams ? court_state.teams : [])
		.map(function(team) {
			return _v2_2court_team_label(team, settings);
		})
		.filter(Boolean)
		.join(' v ');
}

function _v2_2court_active_timer_state(settings, court_state) {
	if (!settings || !settings.d_show_pause || !court_state || !court_state.timers || !court_state.timers.active_timer) {
		return null;
	}
	var timer_state = {
		timer: court_state.timers.active_timer,
		settings: settings,
	};
	var timer_value = timer.calc(timer_state);
	if (!timer_value || !timer_value.visible) {
		return null;
	}
	return timer_state;
}

function _v2_2court_render_timer_middle(parent, court_state, colors, settings, s) {
	var timer_state = _v2_2court_active_timer_state(settings, court_state);
	if (!timer_state) {
		return false;
	}
	var court_label = s._('Court') + ' ' + (court_state.court && court_state.court.label ? court_state.court.label : '');
	var meta_container = uiu.el(parent, 'div', {
		'class': 'd_2court_middle_meta d_2court_timer_meta',
		style: 'color:' + colors.fg + ';',
	});
	var court_el = uiu.el(meta_container, 'div', {
		'class': 'd_2court_middle_court',
	}, court_label);
	autosize.maintain(court_el, function(el) {
		var parent_node = el.parentNode;
		return {
			width: Math.max(10, parent_node.clientWidth * 0.95),
			height: Math.max(10, parent_node.clientHeight / 1.1),
		};
	});

	var timer_value = timer.calc(timer_state);
	var timer_warning = timer_value.exigent || timer_value.ms < 0;
	var timer_el = uiu.el(parent, 'div', {
		'class': 'd_2court_timer_value',
		style: 'color:' + (timer_warning ? colors.exp : colors.fg) + ';',
	}, timer_value.str);
	var tobj = {};
	active_timers.push(tobj);
	var update_timer = function() {
		var next_value = timer.calc(timer_state);
		if (!next_value || !next_value.visible) {
			tobj.timeout = null;
			return;
		}
		uiu.text(timer_el, next_value.str);
		timer_el.style.color = (next_value.exigent || next_value.ms < 0) ? colors.exp : colors.fg;
		if (next_value.next) {
			tobj.timeout = setTimeout(update_timer, next_value.next);
		} else {
			tobj.timeout = null;
		}
	};
	update_timer();
	autosize.maintain(timer_el, function(el) {
		var parent_node = el.parentNode;
		return {
			width: Math.max(10, parent_node.clientWidth * 0.9),
			height: Math.max(10, parent_node.clientHeight * 0.34),
		};
	});
	return true;
}

function _v2_2court_render_middle_team(parent, court_state, team, team_idx, colors, settings, side_cache) {
	var labels = settings.d_show_players === false ? [] : _v2_2court_team_player_labels(team, settings);
	var team_container = uiu.el(parent, 'div', {
		'class': 'd_2court_middle_team d_2court_middle_team' + team_idx,
		style: (
			'background:' + colors['b' + team_idx] + ';' +
			'color:' + colors[team_idx] + ';' +
			'text-align:center;' +
			(labels.length <= 1 ? 'font-size:1.65em;' : '')
		),
	});
	var player_rows = [];
	labels.forEach(function(label, label_idx) {
		var is_serving_player = _v2_2court_player_serving(court_state, team, team_idx, label_idx);
		var is_receiving_player = settings.d_show_doubles_receiving && _v2_2court_player_receiving(court_state, team, team_idx, label_idx);
		var row_el = uiu.el(team_container, 'div', (
			'd_2court_middle_player_row ' +
			(labels.length <= 1 ? 'd_2court_middle_player_row_single' : 'd_2court_middle_player_row' + label_idx) +
			(is_serving_player ? ' d_2court_middle_player_row_serving' : '')
		));
		if (is_serving_player) {
			row_el.style.background = colors[team_idx];
		}
		var label_el = uiu.el(row_el, 'div', 'd_2court_middle_player', label);
		if (is_serving_player) {
			label_el.style.color = colors['b' + team_idx];
		}
		if (is_receiving_player) {
			label_el.style.textDecoration = 'underline';
		}
		player_rows[label_idx] = {
			row_el: row_el,
			label_el: label_el,
		};
		autosize.maintain(label_el, function(el) {
			var parent_node = el.parentNode;
			var computed_style = window.getComputedStyle(parent_node, null);
			var horizontal_padding = parseFloat(computed_style.paddingLeft || 0) + parseFloat(computed_style.paddingRight || 0);
			var vertical_padding = parseFloat(computed_style.paddingTop || 0) + parseFloat(computed_style.paddingBottom || 0);
			return {
				width: Math.max(10, (parent_node.clientWidth - horizontal_padding) * 0.95),
				height: Math.max(10, (parent_node.clientHeight - vertical_padding) / 1.1),
			};
		});
	});
	if (side_cache && side_cache.teams && side_cache.teams[team_idx]) {
		side_cache.teams[team_idx].player_rows = player_rows;
	}
}

function _v2_2court_render_middle(court_container, court_state, court_idx, colors, settings, s, side_cache) {
	var has_timer = !!_v2_2court_active_timer_state(settings, court_state);
	var info_container = uiu.el(court_container, 'div', {
		'class': (
			'd_2court_info' +
			(settings.d_show_players === false ? ' d_2court_info_no_players' : '') +
			(has_timer ? ' d_2court_info_timer' : '')
		),
		style: (
			'line-height:1.05;' +
			'text-wrap:normal;' +
			'box-sizing:border-box;' +
			'width:auto;' +
			'z-index:10002;' +
			(court_idx === 0 ? 'left:calc(44vh + 0.4vw);right:0.4vw;' : 'left:0.4vw;right:calc(44vh + 0.4vw);')
		),
	});
	if (_v2_2court_render_timer_middle(info_container, court_state, colors, settings, s)) {
		return;
	}
	var teams = court_state.teams || [];
	_v2_2court_render_middle_team(info_container, court_state, teams[0], 0, colors, settings, side_cache);
	var meta_container = uiu.el(info_container, 'div', {
		'class': 'd_2court_middle_meta',
		style: 'color:' + colors.fg + ';',
	});
	var meta_lines = [];
	if (settings.d_show_court_number !== false) {
		meta_lines.push({
			'class': 'd_2court_middle_court',
			text: s._('Court') + ' ' + (court_state.court && court_state.court.label ? court_state.court.label : ''),
		});
	}
	var visible_match_name = _v2_2court_visible_match_name(court_state, settings);
	if (visible_match_name) {
		meta_lines.push({
			'class': 'd_2court_middle_match',
			text: visible_match_name,
		});
	}
	meta_lines.forEach(function(meta_line) {
		var meta_el = uiu.el(meta_container, 'div', meta_line['class'], meta_line.text);
		autosize.maintain(meta_el, function(el) {
			var parent_node = el.parentNode;
			var computed_style = window.getComputedStyle(parent_node, null);
			var horizontal_padding = parseFloat(computed_style.paddingLeft || 0) + parseFloat(computed_style.paddingRight || 0);
			var line_count = Math.max(1, meta_lines.length);
			return {
				width: Math.max(10, (parent_node.clientWidth - horizontal_padding) * 0.95),
				height: Math.max(10, parent_node.clientHeight / line_count / 1.1),
			};
		});
	});
	_v2_2court_render_middle_team(info_container, court_state, teams[1], 1, colors, settings, side_cache);
}

function _v2_2court_render_score_digits(parent, points) {
	points = (points == null) ? '' : String(points);
	if (points.length < 2) {
		uiu.text(parent, points);
		return;
	}
	utils.forEach(points, function(digit, digit_idx) {
		uiu.el(parent, 'div', 'd_2court_score_digit' + digit_idx, digit);
	});
}

function _v2_2court_render_idle_side(s, parent, dto, court_state) {
	var tournament = dto && dto.tournament ? dto.tournament : {};
	var court = court_state && court_state.court ? court_state.court : {};
	var fg = tournament.logo_foreground_color || '#aaaaaa';
	var bg = tournament.logo_background_color || '#000000';
	var idle_el = uiu.el(parent, 'div', {
		'class': 'd_2court_idle',
		style: (
			'color:' + fg + ';' +
			'background:' + bg + ';'
		),
	});
	if (tournament.logo_url) {
		uiu.el(idle_el, 'img', {
			src: tournament.logo_url,
			style: 'max-height: 54vh; max-width: 42vw; height:54vh;',
			alt: tournament.name || '',
		});
	} else if (tournament.name) {
		uiu.el(idle_el, 'div', {
			style: 'font-size:11vmin;text-align:center;',
		}, tournament.name);
	}
	uiu.el(idle_el, 'div', {
		style: 'font-size:13vmin;text-align:center;',
	}, s._('Court') + ' ' + (court.label || court.num || court.id || ''));
}

function _v2_2court_ordered_court_states(s, dto) {
	var court_states = (dto.court_states || []).slice(0, 2);
	if (s.settings.displaymode_reverse_order) {
		court_states.reverse();
	}
	return court_states;
}

function _v2_2court_colors(s, court_states) {
	var first_live_state = court_states.find(function(court_state) {
		return !!(court_state && court_state.match);
	}) || court_states[0] || {};
	return calc_colors(s.settings, {
		team_names: (first_live_state.teams || []).map(function(team) {
			return team && team.name ? team.name : '';
		}),
	}, null);
}

function _v2_2court_layout_key(s, colors) {
	return _v2_join_key([
		s.settings.displaymode_style || '',
		s.settings.displaymode_reverse_order ? '1' : '0',
		s.settings.d_show_pause ? '1' : '0',
		s.settings.d_show_court_number !== false ? '1' : '0',
		s.settings.d_show_competition !== false ? '1' : '0',
		s.settings.d_show_round !== false ? '1' : '0',
		s.settings.d_show_players !== false ? '1' : '0',
		s.settings.d_show_middle_name ? '1' : '0',
		s.settings.d_abbreviate_first_name ? '1' : '0',
		s.settings.d_show_doubles_receiving ? '1' : '0',
		colors[0] || '',
		colors[1] || '',
		colors.b0 || '',
		colors.b1 || '',
		colors.bg2 || '',
		colors.fg || '',
		colors.exp || '',
	]);
}

function _v2_2court_side_structure_key(s, court_state) {
	var match = court_state && court_state.match ? court_state.match : null;
	var court = court_state && court_state.court ? court_state.court : {};
	var timer_visible = !!_v2_2court_active_timer_state(s.settings, court_state);
	return _v2_join_key([
		court.id || '',
		court.label || '',
		match ? match.id : '',
		match ? (match.is_doubles ? 'D' : 'S') : 'idle',
		timer_visible ? 'timer' : 'normal',
		(court_state && court_state.teams ? court_state.teams : []).map(function(team) {
			return _v2_2court_team_player_labels(team, s.settings).join('/');
		}).join('|'),
		_v2_2court_visible_match_name(court_state, s.settings),
	]);
}

function _v2_2court_set_score_digits(parent, points) {
	autosize.unmaintain_all(parent);
	uiu.empty(parent);
	_v2_2court_render_score_digits(parent, points);
}

function _v2_2court_patch_team(side_cache, court_state, team, team_idx, colors, settings) {
	var team_cache = side_cache && side_cache.teams ? side_cache.teams[team_idx] : null;
	if (!team_cache) {
		return;
	}
	var current_set = court_state.score && court_state.score.current_set ? court_state.score.current_set : {};
	var sets_won = court_state.score && court_state.score.sets_won ? court_state.score.sets_won : {};
	var winner_side = court_state.score && court_state.score.current_set_finished ? court_state.score.current_set_winner_side : null;
	var server_team_index = court_state.service && court_state.service.server ? court_state.service.server.team_index : null;
	var team_side = _v2_2court_side_for_team(team, team_idx);
	var col = colors[team_idx];
	var bg_col = colors['b' + team_idx];
	var team_serving = winner_side ? (winner_side === team_side) : (server_team_index === team_idx);
	var next_score = _v2_2court_score_for_team(current_set, team, team_idx);
	var next_gscore = _v2_2court_score_for_team(sets_won, team, team_idx);
	if (team_cache.score_value !== next_score) {
		_v2_2court_set_score_digits(team_cache.score_el, next_score);
		team_cache.score_value = next_score;
	}
	if (team_cache.gscore_value !== next_gscore) {
		uiu.text(team_cache.gscore_el, next_gscore);
		team_cache.gscore_value = next_gscore;
	}
	team_cache.score_el.style.background = team_serving ? col : bg_col;
	team_cache.score_el.style.color = team_serving ? bg_col : col;
	(team_cache.player_rows || []).forEach(function(player_cache, player_idx) {
		if (!player_cache) {
			return;
		}
		var is_serving_player = _v2_2court_player_serving(court_state, team, team_idx, player_idx);
		var is_receiving_player = settings.d_show_doubles_receiving && _v2_2court_player_receiving(court_state, team, team_idx, player_idx);
		uiu.setClass(player_cache.row_el, 'd_2court_middle_player_row_serving', is_serving_player);
		player_cache.row_el.style.background = is_serving_player ? col : '';
		player_cache.label_el.style.color = is_serving_player ? bg_col : '';
		player_cache.label_el.style.textDecoration = is_receiving_player ? 'underline' : '';
	});
}

function render_v2_2court_score_update(s, dto) {
	if (!_v2_2court_cache || !_v2_2court_cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_2court_display_state(s, dto);
	}
	var court_states = _v2_2court_ordered_court_states(s, dto);
	var colors = _v2_2court_colors(s, court_states);
	var layout_key = _v2_2court_layout_key(s, colors);
	if (_v2_2court_cache.layout_key !== layout_key || _v2_2court_cache.sides.length !== court_states.length) {
		return render_v2_2court_display_state(s, dto);
	}
	var changed_court_id = dto.v2_changed_court_id || null;
	for (var court_idx = 0; court_idx < court_states.length; court_idx++) {
		var court_state = court_states[court_idx];
		if (!_v2_court_state_matches_changed_court(court_state, changed_court_id)) {
			continue;
		}
		var side_cache = _v2_2court_cache.sides[court_idx];
		if (!side_cache) {
			_v2_2court_render_side(s, dto, court_state, court_idx, colors);
			continue;
		}
		var side_key = _v2_2court_side_structure_key(s, court_state);
		if (side_cache.key !== side_key) {
			if (side_cache.has_timer || _v2_2court_active_timer_state(s.settings, court_state)) {
				return render_v2_2court_display_state(s, dto);
			}
			_v2_2court_render_side(s, dto, court_state, court_idx, colors, side_cache.container);
			continue;
		}
		if (!court_state || !court_state.match) {
			continue;
		}
		(court_state.teams || []).forEach(function(team, team_idx) {
			_v2_2court_patch_team(side_cache, court_state, team, team_idx, _v2_2court_cache.colors, s.settings);
		});
	}
	return true;
}

function _v2_2court_render_side(s, dto, court_state, court_idx, colors, existing_container) {
	var court_container = existing_container || uiu.el(_v2_2court_cache.container, 'div', 'd_2court_side' + court_idx);
	autosize.unmaintain_all(court_container);
	uiu.empty(court_container);
	var match = court_state && court_state.match ? court_state.match : null;
	var side_cache = {
		container: court_container,
		key: _v2_2court_side_structure_key(s, court_state),
		has_timer: !!_v2_2court_active_timer_state(s.settings, court_state),
		teams: [],
	};
	_v2_2court_cache.sides[court_idx] = side_cache;
	if (!match) {
		_v2_2court_render_idle_side(s, court_container, dto, court_state);
		return side_cache;
	}
	var teams = court_state.teams || [];
	var current_set = court_state.score && court_state.score.current_set ? court_state.score.current_set : {};
	var sets_won = court_state.score && court_state.score.sets_won ? court_state.score.sets_won : {};
	var winner_side = court_state.score && court_state.score.current_set_finished ? court_state.score.current_set_winner_side : null;
	var server_team_index = court_state.service && court_state.service.server ? court_state.service.server.team_index : null;
	teams.forEach(function(team, team_idx) {
		var team_container = uiu.el(court_container, 'div', 'd_2court_team' + team_idx);
		var team_side = _v2_2court_side_for_team(team, team_idx);
		var col = colors[team_idx];
		var bg_col = colors['b' + team_idx];
		var team_serving = winner_side ? (winner_side === team_side) : (server_team_index === team_idx);
		var score_el = uiu.el(team_container, 'div', {
			'class': 'd_2court_score',
			style: 'background: ' + (team_serving ? col : bg_col) + '; color: ' + (team_serving ? bg_col : col),
		});
		var score_value = _v2_2court_score_for_team(current_set, team, team_idx);
		_v2_2court_render_score_digits(score_el, score_value);
		var gscore_value = _v2_2court_score_for_team(sets_won, team, team_idx);
		var gscore_el = uiu.el(team_container, 'div', {
			'class': 'd_2court_gscore',
			style: 'background: ' + bg_col + '; color: ' + col + ';',
		}, gscore_value);
		side_cache.teams[team_idx] = {
			score_el: score_el,
			score_value: score_value,
			gscore_el: gscore_el,
			gscore_value: gscore_value,
			player_rows: [],
		};
	});
	_v2_2court_render_middle(court_container, court_state, court_idx, colors, s.settings, s, side_cache);
	return side_cache;
}

function render_v2_2court_display_state(s, dto) {
	if (!s || !s.settings || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = uiu.qs('.displaymode_layout');
	if (!container) {
		return false;
	}
	var court_states = _v2_2court_ordered_court_states(s, dto);
	_v2_oncourt_cache = null;
	_v2_international_cache = null;
	_v2_bwf_cache = null;
	abort_timers();
	autosize.unmaintain_all(container);
	uiu.empty(container);
	ALL_STYLES.forEach(function(astyle) {
		((astyle === '2court') ? uiu.addClass : uiu.removeClass)(container, 'd_layout_' + astyle);
	});
	var colors = _v2_2court_colors(s, court_states);
	_v2_2court_cache = {
		container: container,
		layout_key: _v2_2court_layout_key(s, colors),
		colors: colors,
		sides: [],
	};
	for (var team_idx = 0;team_idx < 2;team_idx++) {
		uiu.el(container, 'div', {
			style: (
				'position:absolute;width:100%;height:50%;' +
				'background:' + colors['b' + team_idx] + ';' +
				'top:' + (team_idx * 50) + '%;'
			),
		});
	}
	uiu.el(container, 'div', {
		'class': 'd_2court_divider',
		style: 'background: ' + colors.bg2,
	});
	court_states.forEach(function(court_state, court_idx) {
		_v2_2court_render_side(s, dto, court_state, court_idx, colors);
	});
	return true;
}

function _v2_tournamentcourt_colors(s, dto) {
	return calc_colors(s.settings, {
		team_names: (dto.teams || []).map(function(team) {
			return team && team.name ? team.name : '';
		}),
	}, null);
}

function _v2_set_text(el, value) {
	value = (value == null) ? '' : String(value);
	if (el && el.textContent !== value) {
		el.textContent = value;
	}
}

function _v2_set_style(el, prop, value) {
	if (el && el.style[prop] !== value) {
		el.style[prop] = value;
	}
}

function _v2_set_class(el, value) {
	if (el && el.className !== value) {
		el.className = value;
	}
}

function _v2_key_part(value) {
	return value == null ? '' : String(value);
}

function _v2_join_key(parts) {
	return parts.map(_v2_key_part).join('\x1f');
}

function _v2_tournamentcourt_side_score(score, side) {
	var current_set = score && score.current_set ? score.current_set : null;
	if (!current_set) {
		return 0;
	}
	return Number(current_set[side] || 0);
}

function _v2_tournamentcourt_sets_won(score, side) {
	return Number(score && score.sets_won ? (score.sets_won[side] || 0) : 0);
}

function _v2_tournamentcourt_set_winner_side(score) {
	return score && score.current_set_finished ? score.current_set_winner_side : null;
}

function _v2_tournamentcourt_visible_set_count(score, match_finished) {
	var finished_count = score && score.finished_sets ? score.finished_sets.length : 0;
	if (score && score.current_set) {
		return finished_count + 1;
	}
	return match_finished ? Math.max(1, finished_count) : finished_count + 1;
}

function _v2_tournamentcourt_team_serving(dto, team) {
	return !!(dto.service && dto.service.server && team && dto.service.server.side === team.side);
}

function _v2_tournamentcourt_player_serving(dto, team, player_id) {
	return !!(
		dto.service &&
		dto.service.server &&
		team &&
		dto.service.server.side === team.side &&
		dto.service.server.player_index === player_id
	);
}

function _v2_tournamentcourt_player_receiving(dto, team, player_id) {
	return !!(
		dto.service &&
		dto.service.receiver &&
		team &&
		dto.service.receiver.side === team.side &&
		dto.service.receiver.player_index === player_id
	);
}

function _v2_tournamentcourt_meta_fields(s, dto) {
	var fields = [];
	if (option_applies(s.settings.displaymode_style, 'show_court_number') && s.settings.d_show_court_number) {
		fields.push(s._('Court') + ' ' + (dto.court && (dto.court.label || dto.court.num || dto.court.id) || ''));
	}
	if (option_applies(s.settings.displaymode_style, 'show_competition') && s.settings.d_show_competition) {
		fields.push(dto.match && dto.match.event_name ? dto.match.event_name : '');
	}
	if (option_applies(s.settings.displaymode_style, 'show_round') && s.settings.d_show_round) {
		fields.push(dto.match && dto.match.round_name ? dto.match.round_name : '');
	}
	return fields.filter(Boolean);
}

function _v2_tournamentcourt_render_meta(cache, s, dto, colors) {
	var fields = _v2_tournamentcourt_meta_fields(s, dto);
	var timer = dto.timers && dto.timers.active_timer ? dto.timers.active_timer : null;
	var meta_key = _v2_join_key([
		fields.join('\x1e'),
		timer ? timer.start : '',
		timer ? timer.duration : '',
		timer ? timer.exigent : '',
		timer ? timer.upwards : '',
		timer ? timer.restart : '',
		colors.fg2,
		colors.exp,
	]);
	if (cache.last_meta_key === meta_key) {
		return;
	}
	cache.last_meta_key = meta_key;
	uiu.empty(cache.meta_el);
	cache.timer_state = null;
	if (dto.timers && dto.timers.active_timer) {
		cache.timer_state = {
			timer: dto.timers.active_timer,
			settings: s.settings,
		};
	}
	show_match_meta(
		cache.timer_state,
		cache.meta_el,
		colors.fg2,
		colors.exp,
		fields.reduce(function(result, field, idx) {
			if (idx > 0) {
				result.push('\u00a0\u2022\u00a0');
			}
			result.push(field);
			return result;
		}, [])
	);
}

function _v2_tournamentcourt_render_team(cache, s, dto, team_id, colors) {
	var team = (dto.teams || [])[team_id] || {};
	var is_doubles = !!(dto.match && dto.match.is_doubles);
	var pcount = is_doubles ? 2 : 1;
	var col = colors[team_id];
	var bg_col = colors['b' + team_id] || '#000';
	var team_cache = cache.teams[team_id];
	var score = dto.score || {};
	var team_serving = _v2_tournamentcourt_team_serving(dto, team);
	var set_winner_side = _v2_tournamentcourt_set_winner_side(score);
	var team_won_visible_set = !!(set_winner_side && team.side === set_winner_side);
	var points = _v2_tournamentcourt_side_score(score, team.side);
	var first_game = cache.first_game;
	var player_states = team_cache.player_els.map(function(player_cache, player_id) {
		var is_server = (!cache.match_finished) && _v2_tournamentcourt_player_serving(dto, team, player_id);
		var is_receiver = (!cache.match_finished) && _v2_tournamentcourt_player_receiving(dto, team, player_id);
		var player_detail = team.player_details && team.player_details[player_id] ? team.player_details[player_id] : null;
		var fallback = (team.players && team.players[player_id]) || '';
		return {
			name: _v2_display_player_name(s.settings, player_detail || fallback, fallback),
			server: is_server,
			receiver: is_receiver,
		};
	});
	var sets_won = _v2_tournamentcourt_sets_won(score, team.side);
	var team_key_parts = [
		col,
		bg_col,
		points,
		points >= 10 ? 1 : 0,
		sets_won,
		team_serving ? 1 : 0,
		team_won_visible_set ? 1 : 0,
		first_game ? 1 : 0,
		cache.match_finished ? 1 : 0,
		s.settings.d_show_doubles_receiving ? 1 : 0,
	];
	player_states.forEach(function(player_state) {
		team_key_parts.push(player_state.name);
		team_key_parts.push(player_state.server ? 1 : 0);
		team_key_parts.push(player_state.receiver ? 1 : 0);
	});
	var team_key = _v2_join_key(team_key_parts);
	if (team_cache.last_key === team_key) {
		return;
	}
	team_cache.last_key = team_key;

	_v2_set_style(team_cache.container, 'color', col);
	_v2_set_style(team_cache.container, 'background', bg_col);
	_v2_set_text(team_cache.score_el, points);
	_v2_set_class(team_cache.score_el, 'd_tournament_score' + ((points >= 10) ? ' d_tournament_score_dd' : ''));
	_v2_set_style(team_cache.score_el, 'background', (team_serving || team_won_visible_set) ? col : bg_col);
	_v2_set_style(team_cache.score_el, 'color', (team_serving || team_won_visible_set) ? bg_col : col);
	_v2_set_text(team_cache.gscore_el, sets_won);
	_v2_set_style(team_cache.gscore_el, 'background', bg_col);
	_v2_set_style(team_cache.gscore_el, 'color', colors.fg);
	_v2_set_style(team_cache.gscore_el, 'display', first_game ? 'none' : 'flex');

	team_cache.player_els.forEach(function(player_cache, player_id) {
		var player_state = player_states[player_id] || {};
		_v2_set_text(player_cache.text_el, player_state.name);
		_v2_set_style(player_cache.box_el, 'background', player_state.server ? col : bg_col);
		_v2_set_style(player_cache.box_el, 'color', player_state.server ? bg_col : col);
		_v2_set_style(player_cache.text_el, 'textDecoration', (
			s.settings.d_show_doubles_receiving && is_doubles && player_state.receiver
				? 'underline'
				: ''
		));
	});
}

function _v2_tournamentcourt_patch(s, dto) {
	if (!_v2_tournamentcourt_cache || !_v2_tournamentcourt_cache.dto_match_id || !dto || !dto.match || _v2_tournamentcourt_cache.dto_match_id !== dto.match.id) {
		return false;
	}
	var colors = _v2_tournamentcourt_cache.colors || _v2_tournamentcourt_colors(s, dto);
	_v2_tournamentcourt_cache.match_finished = (dto.teams || []).some(function(team) {
		return !!(team && team.is_winner);
	});
	_v2_tournamentcourt_cache.first_game = _v2_tournamentcourt_visible_set_count(dto.score || {}, _v2_tournamentcourt_cache.match_finished) < 2;
	_v2_tournamentcourt_render_meta(_v2_tournamentcourt_cache, s, dto, colors);
	_v2_tournamentcourt_render_team(_v2_tournamentcourt_cache, s, dto, 0, colors);
	_v2_tournamentcourt_render_team(_v2_tournamentcourt_cache, s, dto, 1, colors);
	return true;
}

function _v2_tournamentcourt_render_nomatch(s, dto) {
	var container = uiu.qs('.displaymode_layout');
	if (!container) {
		return false;
	}
	var tournament = dto && dto.tournament ? dto.tournament : {};
	var court = dto && dto.court ? dto.court : {};
	var fg = tournament.logo_foreground_color || '#aaaaaa';
	var bg = tournament.logo_background_color || '#000000';
	var idle_key = _v2_join_key([
		tournament.name || '',
		tournament.logo_url || '',
		bg,
		fg,
		court.label || court.num || court.id || '',
	]);
	if (_v2_tournamentcourt_cache && _v2_tournamentcourt_cache.idle_key === idle_key) {
		return true;
	}
	_v2_tournamentcourt_cache = { idle_key: idle_key };
	_last_painted_hash = null;
	autosize.unmaintain_all(container);
	uiu.empty(container);
	var nomatch_el = uiu.el(container, 'div', {
		'class': 'd_nomatch',
		style: (
			'color:' + fg + ';' +
			'background:' + bg + ';'
		),
	});
	if (tournament.logo_url) {
		uiu.el(nomatch_el, 'img', {
			src: tournament.logo_url,
			style: 'max-height: 70vh; max-width: 90vw; height:70vh;',
			alt: tournament.name || '',
		});
	} else if (tournament.name) {
		uiu.el(nomatch_el, 'div', {
			style: 'font-size:16vmin;text-align:center;',
		}, tournament.name);
	}
	uiu.el(nomatch_el, 'div', {
		style: 'font-size:22vmin;',
	}, s._('Court') + ' ' + (court.label || court.num || court.id || ''));
	return true;
}

function render_v2_tournamentcourt_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'tournamentcourt' || !dto) {
		return false;
	}
	_v2_oncourt_cache = null;
	_v2_2court_cache = null;
	_v2_international_cache = null;
	_v2_bwf_cache = null;
	if (!dto.court || !dto.court.id || _is_unassigned_display(s)) {
		var unassigned_container = uiu.qs('.displaymode_layout');
		if (!unassigned_container) {
			return false;
		}
		_v2_tournamentcourt_cache = null;
		_last_painted_hash = null;
		autosize.unmaintain_all(unassigned_container);
		uiu.empty(unassigned_container);
		_render_unassigned_display(s, unassigned_container);
		return true;
	}
	if (!dto.match) {
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = uiu.qs('.displaymode_layout');
	if (!container) {
		return false;
	}
	autosize.unmaintain_all(container);
	uiu.empty(container);
	var colors = _v2_tournamentcourt_colors(s, dto);
	var cache = {
		dto_match_id: dto.match.id,
		colors: colors,
		last_meta_key: null,
		match_finished: false,
		teams: [],
	};
	_v2_tournamentcourt_cache = cache;

	cache.meta_el = uiu.el(container, 'div', {
		style: (
			'z-index:1;' +
			'position:absolute;' +
			'right: 53vh;' +
			'top:40vh;' +
			'bottom:40vh;' +
			'display:flex;' +
			'align-items:center;' +
			'font-size:10vh;' +
			'justify-content: space-between;' +
			'width: calc(99vw - 53vh);' +
			'white-space:nowrap;' +
			'overflow:visible;'
		),
	});

	(dto.teams || []).slice(0, 2).forEach(function(team, team_id) {
		var is_doubles = !!(dto.match && dto.match.is_doubles);
		var player_count = is_doubles ? 2 : 1;
		var col = colors[team_id];
		var bg_col = colors['b' + team_id] || '#000';
		var team_container = uiu.el(container, 'div', {
			'class': 'd_tournament',
			style: (
				'color:' + col + ';' +
				'background:' + bg_col + ';'
			),
		});
		uiu.el(team_container, 'div', {
			style: (
				((team_id === 0) ? 'position:absolute; bottom: 0;' : '') +
				'width:100%;height:20%;' +
				'font-size: 10vh;' +
				'display: flex;align-items: center;'
			),
		});
		var player_els = [];
		for (var player_id = 0; player_id < player_count; player_id++) {
			var player_container = uiu.el(team_container, 'div', {
				'class': 'd_tournament_player_container',
				style: (
					'height:' + (is_doubles ? '40%' : '80%') + ';' +
					'position:relative;width:100%;max-width:100%;overflow-x:hidden;' +
					'display:flex;align-items:center;'
				),
			});
			var box_el = uiu.el(player_container, 'div', {
				'class': 'd_tournament_player',
				style: 'height:100%;',
			});
			var text_el = uiu.el(box_el, 'div', {}, '');
			player_els.push({
				box_el: box_el,
				text_el: text_el,
			});
		}
		var gscore_el = uiu.el(team_container, 'div', {
			'class': 'd_tournament_gscore',
			style: 'height:80%;top:' + (team_id ? '10vh' : '0vh') + ';',
		}, '');
		var score_el = uiu.el(team_container, 'div', {
			'class': 'd_tournament_score',
		}, '');
		cache.teams[team_id] = {
			container: team_container,
			player_els: player_els,
			gscore_el: gscore_el,
			score_el: score_el,
		};
	});

	_v2_tournamentcourt_patch(s, dto);
	cache.teams.forEach(function(team_cache) {
		team_cache.player_els.forEach(function(player_cache) {
			_setup_autosize(player_cache.text_el, cache.first_game ? team_cache.score_el : team_cache.gscore_el, function(parent_node) {
				return parent_node.offsetHeight * 0.94;
			});
		});
	});
	return true;
}

function render_v2_tournamentcourt_score_update(s, dto) {
	if (_v2_tournamentcourt_cache && dto && dto.score) {
		var match_finished = (dto.teams || []).some(function(team) {
			return !!(team && team.is_winner);
		});
		var next_first_game = _v2_tournamentcourt_visible_set_count(dto.score, match_finished) < 2;
		if (_v2_tournamentcourt_cache.first_game !== next_first_game) {
			return render_v2_tournamentcourt_display_state(s, dto);
		}
	}
	return _v2_tournamentcourt_patch(s, dto);
}

function _v2_tournamentplayers_render_team(cache, s, dto, team_id, colors) {
	var team = (dto.teams || [])[team_id] || {};
	var is_doubles = !!(dto.match && dto.match.is_doubles);
	var col = colors[team_id];
	var bg_col = colors['b' + team_id] || '#000';
	var team_cache = cache.teams[team_id];
	var player_states = team_cache.player_els.map(function(player_cache, player_id) {
		var player_detail = team.player_details && team.player_details[player_id] ? team.player_details[player_id] : null;
		var fallback = (team.players && team.players[player_id]) || '';
		return {
			name: _v2_display_player_name(s.settings, player_detail || fallback, fallback),
			server: _v2_tournamentcourt_player_serving(dto, team, player_id),
			receiver: _v2_tournamentcourt_player_receiving(dto, team, player_id),
		};
	});
	var team_key_parts = [
		col,
		bg_col,
		s.settings.d_show_doubles_receiving ? 1 : 0,
	];
	player_states.forEach(function(player_state) {
		team_key_parts.push(player_state.name);
		team_key_parts.push(player_state.server ? 1 : 0);
		team_key_parts.push(player_state.receiver ? 1 : 0);
	});
	var team_key = _v2_join_key(team_key_parts);
	if (team_cache.last_key === team_key) {
		return;
	}
	team_cache.last_key = team_key;
	_v2_set_style(team_cache.container, 'color', col);
	_v2_set_style(team_cache.container, 'background', bg_col);
	team_cache.player_els.forEach(function(player_cache, player_id) {
		var player_state = player_states[player_id] || {};
		_v2_set_text(player_cache.text_el, player_state.name);
		_v2_set_style(player_cache.box_el, 'background', player_state.server ? col : bg_col);
		_v2_set_style(player_cache.box_el, 'color', player_state.server ? bg_col : col);
		_v2_set_style(player_cache.text_el, 'textDecoration', (
			s.settings.d_show_doubles_receiving && is_doubles && player_state.receiver
				? 'underline'
				: ''
		));
	});
}

function _v2_tournamentplayers_patch(s, dto) {
	if (!_v2_tournamentplayers_cache || !_v2_tournamentplayers_cache.dto_match_id || !dto || !dto.match || _v2_tournamentplayers_cache.dto_match_id !== dto.match.id) {
		return false;
	}
	var colors = _v2_tournamentplayers_cache.colors || _v2_tournamentcourt_colors(s, dto);
	_v2_tournamentcourt_render_meta(_v2_tournamentplayers_cache, s, dto, colors);
	_v2_tournamentplayers_render_team(_v2_tournamentplayers_cache, s, dto, 0, colors);
	_v2_tournamentplayers_render_team(_v2_tournamentplayers_cache, s, dto, 1, colors);
	return true;
}

function render_v2_tournamentplayers_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'tournamentplayers' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_tournamentplayers_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container('tournamentplayers');
	if (!container) {
		return false;
	}
	var colors = _v2_tournamentcourt_colors(s, dto);
	var cache = {
		dto_match_id: dto.match.id,
		colors: colors,
		last_meta_key: null,
		teams: [],
	};
	_v2_tournamentplayers_cache = cache;
	cache.meta_el = uiu.el(container, 'div', {
		style: (
			'z-index:1;' +
			'position:absolute;' +
			'right: 1vw;' +
			'top:42vh;' +
			'bottom:42vh;' +
			'display:flex;' +
			'align-items:center;' +
			'font-size:10vh;' +
			'justify-content: space-between;' +
			'width: calc(98vw);' +
			'text-wrap: nowrap;'
		),
	});
	(dto.teams || []).slice(0, 2).forEach(function(team, team_id) {
		var is_doubles = !!(dto.match && dto.match.is_doubles);
		var player_count = is_doubles ? 2 : 1;
		var col = colors[team_id];
		var bg_col = colors['b' + team_id] || '#000';
		var team_container = uiu.el(container, 'div', {
			'class': 'd_tournament',
			style: (
				'color:' + col + ';' +
				'background:' + bg_col + ';'
			),
		});
		uiu.el(team_container, 'div', {
			style: (
				((team_id === 0) ? 'position:absolute; bottom: 0;' : '') +
				'width:100%;height:20%;' +
				'font-size: 10vh;' +
				'display: flex;align-items: center;'
			),
		});
		var player_els = [];
		for (var player_id = 0; player_id < player_count; player_id++) {
			var player_container = uiu.el(team_container, 'div', {
				'class': 'd_tournament_player_container',
				style: 'height:' + (is_doubles ? '40%' : '80%') + ';',
			});
			var box_el = uiu.el(player_container, 'div', {
				'class': 'd_tournament_player',
				style: 'height:100%;',
			});
			var text_el = uiu.el(box_el, 'div', {}, '');
			player_els.push({
				box_el: box_el,
				text_el: text_el,
			});
		}
		cache.teams[team_id] = {
			container: team_container,
			player_els: player_els,
		};
	});
	_v2_tournamentplayers_patch(s, dto);
	cache.teams.forEach(function(team_cache) {
		var right_border = uiu.el(team_cache.container, 'div', {
			style: 'position:absolute;right:1vw;',
		}, '');
		team_cache.player_els.forEach(function(player_cache) {
			_setup_autosize(player_cache.text_el, right_border, function(parent_node) {
				return parent_node.offsetHeight * 0.94;
			});
		});
	});
	return true;
}

function _v2_teamcourt_structure_key(s, dto) {
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	return _v2_join_key([
		'teamcourt',
		s.settings.d_team_colors ? 'tc' : '',
		match ? match.id : '',
		match ? (match.is_doubles ? 'D' : 'S') : '',
		teams.map(function(team) {
			return [
				team && team.name ? team.name : '',
				_v2_display_player_labels(team, s.settings).join('/'),
			].join(':');
		}).join('|'),
	]);
}

function _v2_teamcourt_render_meta(cache, s, dto, colors) {
	var timer_state = dto.timers && dto.timers.active_timer ? {
		timer: dto.timers.active_timer,
		settings: s.settings,
	} : null;
	var meta_key = _v2_join_key([
		timer_state ? timer_state.timer.start : '',
		timer_state ? timer_state.timer.duration : '',
		timer_state ? timer_state.timer.exigent : '',
		timer_state ? timer_state.timer.upwards : '',
		timer_state ? timer_state.timer.restart : '',
		dto.match && dto.match.round_name ? dto.match.round_name : '',
		colors.fg2,
	]);
	if (cache.last_meta_key === meta_key) {
		return;
	}
	cache.last_meta_key = meta_key;
	uiu.empty(cache.meta_el);
	show_match_meta(
		timer_state,
		cache.meta_el,
		colors.fg2,
		colors.fg2,
		['', dto.match && dto.match.round_name ? dto.match.round_name : '']
	);
}

function _v2_teamcourt_apply_team(cache, dto, team_idx) {
	var team = dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var team_cache = cache.teams[team_idx];
	var colors = cache.colors;
	var col = colors[team_idx];
	var bg_col = colors['b' + team_idx] || '#000';
	var points = _v2_score_for_team(dto.score && dto.score.current_set, team, team_idx);
	var sets_won = _v2_sets_won_for_score(dto);
	var first_game = _v2_score_sets_for_display(dto.score).length < 2 && !(dto.score && dto.score.current_set_finished);
	var team_serving = _v2_team_is_serving_or_set_winner(dto, team_idx);
	_v2_set_style(team_cache.container, 'color', col);
	_v2_set_style(team_cache.container, 'background', bg_col);
	_v2_set_text(team_cache.team_name_el, team && team.name ? team.name : '');
	_v2_set_text(team_cache.score_el, points);
	_v2_set_class(team_cache.score_el, _v2_international_score_class(points));
	_v2_set_style(team_cache.score_el, 'background', team_serving ? col : bg_col);
	_v2_set_style(team_cache.score_el, 'color', team_serving ? bg_col : col);
	_v2_set_text(team_cache.gscore_el, _v2_score_for_team(sets_won, team, team_idx));
	_v2_set_style(team_cache.gscore_el, 'background', bg_col);
	_v2_set_style(team_cache.gscore_el, 'color', colors.fg);
	_v2_set_style(team_cache.gscore_el, 'display', first_game ? 'none' : 'flex');
	team_cache.gscore_visible = !first_game;
	team_cache.player_els.forEach(function(player_cache, player_idx) {
		var is_server = _v2_player_is_serving(dto, team_idx, player_idx);
		var label = _v2_display_player_labels(team, cache.settings)[player_idx] || '';
		_v2_set_text(player_cache.text_el, label);
		_v2_set_style(player_cache.box_el, 'background', is_server ? col : bg_col);
		_v2_set_style(player_cache.box_el, 'color', is_server ? bg_col : col);
	});
}

function _v2_teamcourt_setup_autosize(el, team_cache, determine_height) {
	autosize.maintain(el, function() {
		var parent_node = el.parentNode;
		var w = parent_node.offsetWidth;
		var right_node = team_cache.gscore_visible ? team_cache.gscore_el : team_cache.score_el;
		if (right_node) {
			var prect = parent_node.getBoundingClientRect();
			var rrect = right_node.getBoundingClientRect();
			w = Math.max(10, Math.min(w, rrect.left - prect.left - 20));
		}
		return {
			width: w,
			height: determine_height(parent_node),
		};
	});
}

function _v2_teamcourt_patch(s, dto) {
	if (!_v2_teamcourt_cache || !_v2_teamcourt_cache.container || !dto || !dto.match) {
		return render_v2_teamcourt_display_state(s, dto);
	}
	var structure_key = _v2_teamcourt_structure_key(s, dto);
	if (_v2_teamcourt_cache.structure_key !== structure_key) {
		return render_v2_teamcourt_display_state(s, dto);
	}
	var colors = _v2_teamcourt_cache.colors;
	_v2_teamcourt_render_meta(_v2_teamcourt_cache, s, dto, colors);
	[0, 1].forEach(function(team_idx) {
		if (_v2_teamcourt_cache.teams[team_idx]) {
			_v2_teamcourt_apply_team(_v2_teamcourt_cache, dto, team_idx);
		}
	});
	return true;
}

function render_v2_teamcourt_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'teamcourt' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_teamcourt_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container('teamcourt');
	if (!container) {
		return false;
	}
	var colors = _v2_single_score_colors(s, dto);
	var is_doubles = !!(dto.match && dto.match.is_doubles);
	var pcount = is_doubles ? 2 : 1;
	_v2_teamcourt_cache = {
		container: container,
		structure_key: _v2_teamcourt_structure_key(s, dto),
		colors: colors,
		settings: s.settings,
		last_meta_key: null,
		teams: [],
	};
	_v2_teamcourt_cache.meta_el = uiu.el(container, 'div', {
		style: (
			'z-index:1;' +
			'position:absolute;' +
			'right: 55vh;' +
			'top:42vh;' +
			'bottom:42vh;' +
			'display:flex;align-items:center;' +
			'font-size:10vh;' +
			'color:' + colors.fg2
		),
	});
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var col = colors[team_idx];
		var bg_col = colors['b' + team_idx] || '#000';
		var team_container = uiu.el(container, 'div', {
			'class': 'd_international_team',
			style: (
				'color:' + col + ';' +
				'background:' + bg_col + ';'
			),
		});
		var team_name_container = uiu.el(team_container, 'div', {
			style: (
				((team_idx === 0) ? 'position:absolute; bottom: 0;' : '') +
				'width:100%;height:20%;' +
				'font-size: 10vh;' +
				'display: flex;align-items: center;'
			),
		});
		var team_name_el = uiu.el(team_name_container, 'div', {}, '');
		var player_els = [];
		for (var player_idx = 0; player_idx < pcount; player_idx++) {
			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '40%' : '80%') + ';',
				'class': 'd_international_player_container',
			});
			var box_el = uiu.el(player_container, 'div', {
				style: 'height: ' + (is_doubles ? '100%' : '50%') + ';',
				'class': 'd_international_player',
			});
			var label = _v2_display_player_labels(team, s.settings)[player_idx] || '';
			var text_el = uiu.el(box_el, 'div', {}, label);
			player_els.push({
				box_el: box_el,
				text_el: text_el,
			});
		}
		var gscore_el = uiu.el(team_container, 'div', {
			'class': 'd_international_gscore',
		}, '');
		var score_el = uiu.el(team_container, 'div', {
			'class': 'd_international_score',
		}, '');
		_v2_teamcourt_cache.teams[team_idx] = {
			container: team_container,
			team_name_el: team_name_el,
			player_els: player_els,
			gscore_el: gscore_el,
			score_el: score_el,
			gscore_visible: false,
		};
	});
	_v2_teamcourt_patch(s, dto);
	_v2_teamcourt_cache.teams.forEach(function(team_cache) {
		team_cache.player_els.forEach(function(player_cache) {
			_v2_teamcourt_setup_autosize(player_cache.text_el, team_cache, function(parent_node) {
				return parent_node.offsetHeight * 0.65;
			});
		});
		_v2_teamcourt_setup_autosize(team_cache.team_name_el, team_cache, function(parent_node) {
			return parent_node.offsetHeight * 0.75;
		});
	});
	return true;
}

function _v2_andre_structure_key(s, dto) {
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	return _v2_join_key([
		'andre',
		match ? match.id : '',
		match ? (match.is_doubles ? 'D' : 'S') : '',
		match ? match.event_name : '',
		match ? match.round_name : '',
		teams.map(function(team) {
			return _v2_display_player_labels(team, s.settings).join('/');
		}).join('|'),
	]);
}

function _v2_andre_match_name(dto) {
	var match = dto && dto.match ? dto.match : {};
	return [match.event_name || '', match.round_name || ''].filter(Boolean).join(' ');
}

function _v2_andre_apply_team(cache, dto, team_idx) {
	var team = dto.teams && dto.teams[team_idx] ? dto.teams[team_idx] : null;
	var team_cache = cache.teams[team_idx];
	var points = _v2_score_for_team(dto.score && dto.score.current_set, team, team_idx);
	var sets_won = _v2_score_for_team(_v2_sets_won_for_score(dto), team, team_idx);
	var team_serving = _v2_team_is_serving_or_set_winner(dto, team_idx);
	_v2_set_text(team_cache.gscore_el, sets_won);
	_v2_set_text(team_cache.score_el, points);
	_v2_set_style(team_cache.score_el, 'background', team_serving ? cache.colors.fg : cache.colors.bg);
	_v2_set_style(team_cache.score_el, 'color', team_serving ? cache.colors.bg : cache.colors.fg);
	team_cache.player_els.forEach(function(player_cache, player_idx) {
		var label = _v2_display_player_labels(team, cache.settings)[player_idx] || '';
		_v2_set_text(player_cache.text_el, label);
		if (player_cache.shuttle_el) {
			_v2_set_style(player_cache.shuttle_el, 'display', _v2_player_is_serving(dto, team_idx, player_idx) ? '' : 'none');
		}
	});
}

function _v2_andre_patch(s, dto) {
	if (!_v2_andre_cache || !_v2_andre_cache.container || !dto || !dto.match) {
		return render_v2_andre_display_state(s, dto);
	}
	var structure_key = _v2_andre_structure_key(s, dto);
	if (_v2_andre_cache.structure_key !== structure_key) {
		return render_v2_andre_display_state(s, dto);
	}
	[0, 1].forEach(function(team_idx) {
		if (_v2_andre_cache.teams[team_idx]) {
			_v2_andre_apply_team(_v2_andre_cache, dto, team_idx);
		}
	});
	_v2_set_text(_v2_andre_cache.mid_el, _v2_andre_match_name(dto));
	return true;
}

function render_v2_andre_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'andre' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_andre_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container('andre');
	if (!container) {
		return false;
	}
	var colors = _v2_single_score_colors(s, dto);
	var is_doubles = !!(dto.match && dto.match.is_doubles);
	var pcount = is_doubles ? 2 : 1;
	_v2_andre_cache = {
		container: container,
		structure_key: _v2_andre_structure_key(s, dto),
		colors: colors,
		settings: s.settings,
		teams: [],
		mid_el: null,
	};
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var team_container = uiu.el(container, 'div', {
			'class': 'd_andre_team',
			style: (
				'background:' + colors.bg + ';' +
				'color:' + colors.fg + ';'
			),
		});
		var gscore_el = uiu.el(team_container, 'div', 'd_andre_gscore', '');
		var players_container = uiu.el(team_container, 'div', 'd_andre_players');
		var player_els = [];
		for (var player_idx = 0; player_idx < pcount; player_idx++) {
			var player_el = uiu.el(players_container, 'div', {
				'class': 'd_andre_player',
				style: 'height:' + (is_doubles ? '50%' : '100%') + ';',
			});
			var shuttle_el = uiu.el(player_el, 'div', {
				'class': 'd_shuttle',
				style: 'display:none;',
			});
			var text_el = uiu.el(player_el, 'span', {}, '');
			player_els.push({
				shuttle_el: shuttle_el,
				text_el: text_el,
			});
		}
		var score_el = uiu.el(team_container, 'div', {
			'class': 'd_andre_score',
			style: (team_idx === 0 ? 'top' : 'bottom') + ': 0;',
		}, '');
		_v2_andre_cache.teams[team_idx] = {
			gscore_el: gscore_el,
			score_el: score_el,
			player_els: player_els,
		};
		if (team_idx === 0) {
			_v2_andre_cache.mid_el = uiu.el(container, 'div', {
				'class': 'd_andre_mid',
				'style': 'color:' + colors.fg2 + ';',
			}, _v2_andre_match_name(dto));
		}
	});
	_v2_andre_patch(s, dto);
	_v2_andre_cache.teams.forEach(function(team_cache) {
		team_cache.player_els.forEach(function(player_cache) {
			_setup_autosize(player_cache.text_el, team_cache.score_el, function(parent_node) {
				return parent_node.offsetHeight * 0.6;
			});
		});
	});
	return true;
}

function _v2_streamcourt_structure_key(s, dto) {
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	return _v2_join_key([
		'streamcourt',
		match ? match.id : '',
		match ? (match.is_doubles ? 'D' : 'S') : '',
		match ? (match.best_of || '') : '',
		dto && dto.tournament ? (dto.tournament.logo_url || '') : '',
		teams.map(function(team) {
			return _v2_display_player_labels(team, s.settings).join('/');
		}).join('|'),
	]);
}

function _v2_streamcourt_set_highlight(dto, set_score, set_idx, team, team_idx, sets) {
	if (!set_score) {
		return false;
	}
	if (set_idx === sets.length - 1) {
		return _v2_team_is_serving_or_set_winner(dto, team_idx);
	}
	var left = Number(set_score.left || 0);
	var right = Number(set_score.right || 0);
	var side = _v2_team_side(team, team_idx);
	return (side === 'left' && left > right) || (side === 'right' && right > left);
}

function _v2_streamcourt_patch(s, dto) {
	if (!_v2_streamcourt_cache || !_v2_streamcourt_cache.container || !dto || !dto.match) {
		return render_v2_streamcourt_display_state(s, dto);
	}
	var structure_key = _v2_streamcourt_structure_key(s, dto);
	if (_v2_streamcourt_cache.structure_key !== structure_key) {
		return render_v2_streamcourt_display_state(s, dto);
	}
	var sets = _v2_score_sets_for_display(dto.score);
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var team_cache = _v2_streamcourt_cache.teams[team_idx];
		if (!team_cache) {
			return;
		}
		_v2_set_text(team_cache.name_el, _v2_display_player_labels(team, s.settings).join(' / '));
		team_cache.score_els.forEach(function(score_el, set_idx) {
			var set_score = sets[set_idx];
			var points = set_score ? _v2_score_for_team(set_score, team, team_idx) : '';
			var highlighted = _v2_streamcourt_set_highlight(dto, set_score, set_idx, team, team_idx, sets);
			_v2_set_text(score_el, points);
			_v2_set_style(score_el, 'color', highlighted ? '#ee0' : '#fff');
		});
	});
	return true;
}

function render_v2_streamcourt_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'streamcourt' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_streamcourt_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container('streamcourt');
	if (!container) {
		return false;
	}
	var max_games = Math.max(Number(dto.match.best_of || 0) || 3, _v2_score_sets_for_display(dto.score).length);
	var border_radius = '0.8vw';
	var table = uiu.el(container, 'table', {
		style: (
			'position: fixed;top:0;left:0;width:100%;height:12vw;' +
			'border-radius:' + border_radius + ';border-collapse:collapse;' +
			'vertical-align:middle;' +
			'font-size:4.7vw;color:#000;background:#ddd;'
		),
	});
	_v2_streamcourt_cache = {
		container: container,
		structure_key: _v2_streamcourt_structure_key(s, dto),
		teams: [],
	};
	var event_logo_url = dto.tournament && dto.tournament.logo_url ? dto.tournament.logo_url : '';
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var tr = uiu.el(table, 'tr', {
			style: (team_idx === 0) ? '' : 'border-top:0.05vw solid #fff;',
		});
		if ((team_idx === 0) && event_logo_url) {
			var logo_td = uiu.el(tr, 'td', {
				rowspan: '2',
				style: 'width:4em;',
			});
			uiu.el(logo_td, 'div', {
				style: (
					'height:2.4em;width:4em;margin-left:0.2em;' +
					'background-repeat: no-repeat;' +
					'background-position:center;' +
					'background-size:contain;' +
					'background-image:url("' + event_logo_url + '");'
				),
			});
		}
		var name_el = uiu.el(tr, 'td', {
			style: (
				'padding-right:0.5em;overflow:hidden;white-space:pre;' +
				'min-width:8em;' +
				'font-size:80%;'
			),
		}, '');
		var score_els = [];
		for (var set_idx = 0; set_idx < max_games; set_idx++) {
			var extra_style = '';
			if (set_idx === max_games - 1) {
				extra_style += team_idx === 0
					? 'border-top-right-radius:' + border_radius + ';'
					: 'border-bottom-right-radius:' + border_radius + ';';
			}
			score_els[set_idx] = uiu.el(tr, 'td', {
				style: (
					'width:1.2em;border-left:0.1vw solid #888;font-family:Arial Black;' +
					'padding:0 0.2em;text-align:center;background:#555;' +
					'font-size:90%;' +
					extra_style
				),
			}, '');
		}
		_v2_streamcourt_cache.teams[team_idx] = {
			name_el: name_el,
			score_els: score_els,
		};
	});
	_v2_streamcourt_patch(s, dto);
	return true;
}

function _v2_stripes_match_score(dto) {
	var match_score = [0, 0];
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		if (team && team.is_winner) {
			match_score[team_idx] = 1;
		}
	});
	return match_score;
}

function _v2_stripes_structure_key(s, dto) {
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	return _v2_join_key([
		'stripes',
		s.settings.d_team_colors ? 'tc' : '',
		s.settings.d_show_team_name === false ? 'tn0' : 'tn1',
		s.settings.d_show_middle_name ? 'm1' : 'm0',
		s.settings.d_abbreviate_first_name ? 'a1' : 'a0',
		match ? match.id : '',
		match && match.best_of ? match.best_of : '',
		match ? (match.is_doubles ? 'D' : 'S') : '',
		match && match.team_competition ? 'TC' : 'M',
		match && match.round_name ? match.round_name : '',
		teams.map(function(team) {
			return [
				team && team.name ? team.name : '',
				_v2_display_player_labels(team, s.settings).join('/'),
			].join(':');
		}).join('|'),
	]);
}

function _v2_stripes_set_highlight(dto, set_score, set_idx, team, team_idx, sets) {
	if (!set_score) {
		return false;
	}
	if (set_idx === sets.length - 1) {
		return _v2_team_is_serving_or_set_winner(dto, team_idx);
	}
	var side = _v2_team_side(team, team_idx);
	var left = Number(set_score.left || 0);
	var right = Number(set_score.right || 0);
	return (side === 'left' && left > right) || (side === 'right' && right > left);
}

function _v2_stripes_fit_text_no_grow(el, text) {
	if (!el || typeof window === 'undefined') {
		return;
	}
	var parent_node = el.parentNode;
	if (!parent_node) {
		return;
	}
	if (!el._v2_stripes_base_font_size) {
		el._v2_stripes_base_font_size = window.getComputedStyle(el, null).getPropertyValue('font-size');
	}
	var base_font_size = el._v2_stripes_base_font_size;
	var base_match = /^([0-9.,]+)(\s*px)$/.exec(base_font_size || '');
	if (!base_match) {
		return;
	}
	var available_width = Math.max(10, parent_node.offsetWidth - 20);
	var available_height = Math.max(10, parent_node.offsetHeight);
	var key = [text || '', available_width, available_height, base_font_size].join('|');
	if (el._v2_stripes_fit_key === key) {
		return;
	}
	el._v2_stripes_fit_key = key;
	el.style.fontSize = base_font_size;
	var current_width = Math.max(1, el.offsetWidth);
	var current_height = Math.max(1, el.offsetHeight);
	var base_size = parseFloat(base_match[1].replace(',', '.'));
	var new_size = Math.min(
		base_size,
		Math.floor(base_size / Math.max(current_width / available_width, current_height / available_height))
	);
	el.style.fontSize = Math.max(1, new_size) + base_match[2];
}

function _v2_stripes_patch(s, dto) {
	if (!_v2_stripes_cache || !_v2_stripes_cache.container || !dto || !dto.match) {
		return render_v2_stripes_display_state(s, dto);
	}
	var structure_key = _v2_stripes_structure_key(s, dto);
	if (_v2_stripes_cache.structure_key !== structure_key) {
		return render_v2_stripes_display_state(s, dto);
	}
	var colors = _v2_stripes_cache.colors;
	var sets = _v2_score_sets_for_display(dto.score);
	var match_score = _v2_stripes_match_score(dto);
	var stable_preview_names = !!(dto.display && dto.display.preview);
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var team_cache = _v2_stripes_cache.teams[team_idx];
		if (!team_cache) {
			return;
		}
		var show_team_name = s.settings.d_show_team_name !== false;
		var team_name = show_team_name && team && team.name ? team.name : '';
		if (show_team_name && dto.match.team_competition) {
			team_name += ' (' + match_score[team_idx] + ')';
		}
		_v2_set_text(team_cache.team_name_el, team_name);
		_v2_stripes_fit_text_no_grow(team_cache.team_name_el, team_name);
		(team_cache.player_els || []).forEach(function(player_el, player_idx) {
			_v2_set_style(
				player_el,
				'color',
				(!stable_preview_names && _v2_player_is_serving(dto, team_idx, player_idx)) ? colors.serv : ''
			);
		});
		(team_cache.score_els || []).forEach(function(score_el, set_idx) {
			var set_score = sets[set_idx];
			var text = set_score ? _v2_score_for_team(set_score, team, team_idx) : '';
			_v2_set_text(score_el, text);
			_v2_set_style(
				score_el,
				'color',
				_v2_stripes_set_highlight(dto, set_score, set_idx, team, team_idx, sets) ? colors.serv : ''
			);
		});
	});
	return true;
}

function render_v2_stripes_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'stripes' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_stripes_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container('stripes');
	if (!container) {
		return false;
	}
	var colors = _v2_single_score_colors(s, dto);
	var teams = dto.teams || [];
	var sets = _v2_score_sets_for_display(dto.score);
	var match_score = _v2_stripes_match_score(dto);
	var max_game_count = Math.max(Number(dto.match.best_of || 0) || 3, sets.length);
	var match_name = dto.match.round_name || '';
	var border = 1;
	var width_str = ((100 - border * (max_game_count + 2)) / (max_game_count + 1) - 10) + 'vw';
	var border_str = border + 'vw';
	var table = uiu.el(container, 'table', {
		'class': 'd_stripes_table',
		'style': (
			'color:' + colors.fg + ';' +
			'background:' + colors.bg + ';'
		),
	});
	_v2_stripes_cache = {
		container: container,
		structure_key: _v2_stripes_structure_key(s, dto),
		colors: colors,
		teams: [],
	};

	function _render_team_header(team_idx) {
		var team = teams[team_idx] || {};
		var show_team_name = s.settings.d_show_team_name !== false;
		var team_name = show_team_name && team.name ? team.name : '';
		if (show_team_name && dto.match.team_competition) {
			team_name += ' (' + match_score[team_idx] + ')';
		}
		var bg_col = colors[team_idx];
		var fg_col = (utils.brightness(bg_col) > 128) ? colors.fgdark : colors.fg;
		var tr = uiu.el(table, 'tr');
		var td = uiu.el(tr, 'td', {
			style: 'color:' + fg_col + ';background:' + bg_col + ';',
		});
		var div = uiu.el(td, 'div', {
			style: (
				'height:10vh;width:100%;display:-webkit-flex;display:flex;' +
				'justify-content:center;align-items:center;'
			),
		});
		var span = uiu.el(div, 'span', {
			style: 'white-space:pre;',
		}, team_name);
		_v2_stripes_cache.teams[team_idx] = _v2_stripes_cache.teams[team_idx] || {};
		_v2_stripes_cache.teams[team_idx].team_row = tr;
		_v2_stripes_cache.teams[team_idx].team_name_el = span;
		_v2_stripes_fit_text_no_grow(span, team_name);
	}

	function _render_players(team_idx) {
		var team = teams[team_idx] || {};
		var labels = _v2_display_player_labels(team, s.settings);
		var tr = uiu.el(table, 'tr');
		var td = uiu.el(tr, 'td', {
			style: 'overflow:hidden;',
		});
		var line = uiu.el(td, 'span', {
			style: 'display:inline-block;white-space:pre;',
		});
		_v2_stripes_cache.teams[team_idx] = _v2_stripes_cache.teams[team_idx] || {};
		_v2_stripes_cache.teams[team_idx].player_els = [];
		labels.forEach(function(player_label, player_idx) {
			if (player_idx !== 0) {
				uiu.el(line, 'span', {}, ' / ');
			}
			_v2_stripes_cache.teams[team_idx].player_els[player_idx] = uiu.el(line, 'span', {}, player_label);
		});
		_v2_stripes_fit_text_no_grow(line, labels.join(' / '));
	}

	_render_team_header(0);
	_render_players(0);

	var score_tr = uiu.el(table, 'tr');
	var score_td = uiu.el(score_tr, 'td');
	var inner_table = uiu.el(score_td, 'table', {
		style: 'border-collapse:collapse;table-layout:fixed;width:100%;',
	});
	for (var team_idx = 0; team_idx < 2; team_idx++) {
		var tr = uiu.el(inner_table, 'tr');
		if (team_idx === 0) {
			var match_name_td = uiu.el(tr, 'td', {
				rowspan: 2,
				style: (
					'background:' + colors.bg4 + ';' +
					'word-wrap:break-word;' +
					'font-size:15vmin;' +
					'min-width:' + width_str + ';' +
					'max-width:' + width_str + ';' +
					'border-left:' + border_str + ' solid ' + colors.bg + ';' +
					'border-right:' + border_str + ' solid ' + colors.bg + ';'
				),
			});
			match_name.split(/(\.)/).forEach(function(part) {
				uiu.el(match_name_td, 'span', {
					style: 'display:inline-block;',
				}, part);
			});
		}
		_v2_stripes_cache.teams[team_idx] = _v2_stripes_cache.teams[team_idx] || {};
		_v2_stripes_cache.teams[team_idx].score_els = [];
		for (var set_idx = 0; set_idx < max_game_count; set_idx++) {
			_v2_stripes_cache.teams[team_idx].score_els[set_idx] = uiu.el(tr, 'td', {
				style: (
					((team_idx === 0) ? 'border-bottom' : 'border-top') + ':2vh solid ' + colors.bg + ';' +
					'background:' + colors.bg4 + ';' +
					'border-right:' + border_str + ' solid ' + colors.bg + ';' +
					'font-size:20vmin;font-weight:bold;' +
					'min-width:' + width_str + ';' +
					'max-width:' + width_str + ';'
				),
			}, '');
		}
	}

	_render_players(1);
	_render_team_header(1);
	_v2_stripes_patch(s, dto);
	return true;
}

function _v2_streamcourt_dm_player_name(team) {
	if (!team) {
		return '';
	}
	var players = [];
	if (team.player_details && team.player_details.length) {
		players = team.player_details;
	} else if (team.players && team.players.length) {
		players = team.players.map(function(player) {
			return typeof player === 'string' ? {name: player} : player;
		});
	}
	return namestr_short(players);
}

function _v2_streamcourt_dm_structure_key(s, dto) {
	var match = dto && dto.match ? dto.match : null;
	var teams = dto && dto.teams ? dto.teams : [];
	var sets = _v2_score_sets_for_display(dto && dto.score);
	return _v2_join_key([
		'streamcourt_dm',
		match ? match.id : '',
		match ? match.event_name : '',
		match ? match.round_name : '',
		match ? match.best_of : '',
		dto && dto.court ? (dto.court.label || dto.court.num || dto.court.id || '') : '',
		sets.length,
		teams.map(function(team) {
			return _v2_streamcourt_dm_player_name(team);
		}).join('|'),
	]);
}

function _v2_streamcourt_dm_patch(s, dto) {
	if (!_v2_streamcourt_dm_cache || !_v2_streamcourt_dm_cache.container || !dto || !dto.match) {
		return render_v2_streamcourt_dm_display_state(s, dto);
	}
	var structure_key = _v2_streamcourt_dm_structure_key(s, dto);
	if (_v2_streamcourt_dm_cache.structure_key !== structure_key) {
		return render_v2_streamcourt_dm_display_state(s, dto);
	}
	var sets = _v2_score_sets_for_display(dto.score);
	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var team_cache = _v2_streamcourt_dm_cache.teams[team_idx];
		if (!team_cache) {
			return;
		}
		_v2_set_text(team_cache.name_el, _v2_streamcourt_dm_player_name(team));
		_v2_set_style(
			team_cache.service_el,
			'visibility',
			_v2_team_is_serving_or_set_winner(dto, team_idx) ? 'visible' : 'hidden'
		);
		(team_cache.score_els || []).forEach(function(score_el, set_idx) {
			var set_score = sets[set_idx];
			_v2_set_text(score_el, set_score ? _v2_score_for_team(set_score, team, team_idx) : '');
		});
	});
	return true;
}

function render_v2_streamcourt_dm_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'streamcourt_dm' || !dto) {
		return false;
	}
	if (!dto.match) {
		_v2_streamcourt_dm_cache = null;
		return _v2_tournamentcourt_render_nomatch(s, dto);
	}
	var container = _v2_prepare_full_render_container('streamcourt_dm');
	if (!container) {
		return false;
	}
	var sets = _v2_score_sets_for_display(dto.score);
	var max_games = Math.max(Number(dto.match.best_of || 0) || 3, sets.length);
	var court = dto.court || {};
	var setup_for_announcements = {
		event_name: dto.match.event_name || '',
		match_name: dto.match.round_name || '',
	};
	_v2_streamcourt_dm_cache = {
		container: container,
		structure_key: _v2_streamcourt_dm_structure_key(s, dto),
		teams: [],
	};

	uiu.el(container, 'div', {
		style: (
			'position:absolute;top:3vh;left:4vh;' +
			'height:10vh;width:9vh;' +
			'background-repeat:no-repeat;background-position:center;background-size:contain;' +
			'background-image:url("icons/Ball_DM_Cloppenburg.svg");z-index:10;'
		),
	});
	var top_bar = uiu.el(container, 'div', {
		style: (
			'position:absolute;top:3.6vh;left:6.6vh;height:8.8vh;z-index:-1;' +
			'display:flex;flex-direction:row;'
		),
	});
	var top_bar_left = uiu.el(top_bar, 'div', {
		style: (
			'position:static;height:8.8vh;width:fit-content;' +
			'display:flex;flex-direction:column;justify-content:space-between;'
		),
	});
	uiu.el(top_bar_left, 'div', {
		style: 'position:static;height:5%;width:100%;background-color:#ffffff;border-top-right-radius:1vh;',
	});
	var team_rows = [];
	[0, 1].forEach(function(team_idx) {
		if (team_idx === 1) {
			uiu.el(top_bar_left, 'div', {
				style: 'position:static;height:4%;width:100%;',
			});
		}
		team_rows[team_idx] = uiu.el(top_bar_left, 'div', {
			style: (
				'position:static;height:43%;width:100%;background-color:#ffffffbb;' +
				'display:flex;justify-content:space-between;'
			),
		});
	});
	uiu.el(top_bar_left, 'div', {
		style: 'position:static;height:5%;width:100%;background-color:#ffffff;border-bottom-right-radius:1vh;',
	});

	(dto.teams || []).slice(0, 2).forEach(function(team, team_idx) {
		var name_el = uiu.el(team_rows[team_idx], 'div', {
			style: (
				'margin-left:6.7vh;font-size:3vh;height:100%;align-content:center;' +
				'width:fit-content;white-space:pre;'
			),
		}, '');
		var service_el = uiu.el(team_rows[team_idx], 'div', {
			style: (
				'height:100%;align-content:center;width:4vh;background-repeat:no-repeat;' +
				'background-position:center;background-size:contain;' +
				'background-image:url("icons/Ball_DM_Cloppenburg_schwarz.svg");visibility:hidden;'
			),
		});
		_v2_streamcourt_dm_cache.teams[team_idx] = {
			name_el: name_el,
			service_el: service_el,
			score_els: [],
		};
	});

	for (var set_idx = 0; set_idx < max_games; set_idx++) {
		var top_bar_set = uiu.el(top_bar, 'div', {
			style: (
				'position:static;height:8.8vh;width:4vh;display:flex;flex-direction:column;' +
				'justify-content:space-between;margin-left:0.3vh;'
			),
		});
		uiu.el(top_bar_set, 'div', {
			style: (
				'position:static;height:5%;width:100%;background-color:#ffffff;' +
				'border-top-left-radius:1vh;border-top-right-radius:1vh;'
			),
		});
		[0, 1].forEach(function(team_idx) {
			if (team_idx === 1) {
				uiu.el(top_bar_set, 'div', {
					style: 'position:static;height:4%;width:100%;',
				});
			}
			_v2_streamcourt_dm_cache.teams[team_idx].score_els[set_idx] = uiu.el(top_bar_set, 'div', {
				style: (
					'position:static;height:43%;width:100%;background-color:#ffffffbb;' +
					'display:flex;justify-content:center;font-size:3vh;align-items:center;'
				),
			}, '');
		});
		uiu.el(top_bar_set, 'div', {
			style: (
				'position:static;height:5%;width:100%;background-color:#ffffff;' +
				'border-bottom-left-radius:1vh;border-bottom-right-radius:1vh;'
			),
		});
	}

	uiu.el(container, 'div', {
		style: (
			'position:absolute;bottom:1vh;right:2vh;height:17.008vh;width:28.346vh;' +
			'background-repeat:no-repeat;background-position:center;background-size:contain;' +
			'background-image:url("icons/DBM_Schriftzug_mit_73_wiess.svg");z-index:10;'
		),
	});
	var top_bar_right = uiu.el(container, 'div', {
		style: (
			'position:absolute;top:3.6vh;left:calc(100% - 33.2vh);height:8.8vh;' +
			'z-index:-1;display:flex;flex-direction:column;color:#ffffff;'
		),
	});
	[
		s._('Court') + ' ' + (court.label || court.num || court.id || ''),
		createEventAnnouncement(s, setup_for_announcements),
		createRoundAnnouncement(s, setup_for_announcements),
	].forEach(function(text) {
		uiu.el(top_bar_right, 'div', {
			style: (
				'position:static;text-align:center;height:2.5vh;width:100%;' +
				'font-size:2.1vh;font-weight:bold;'
			),
		}, text);
	});
	_v2_streamcourt_dm_patch(s, dto);
	return true;
}

function _v2_top_list_structure_key(s, dto) {
	var court_states = dto && dto.court_states ? dto.court_states : [];
	return _v2_join_key([
		'top+list',
		s.settings.displaymode_reverse_order ? 'r1' : 'r0',
		s.settings.d_show_middle_name ? 'm1' : 'm0',
		s.settings.d_abbreviate_first_name ? 'a1' : 'a0',
		court_states.map(function(court_state) {
			var match = court_state.match || {};
			var teams = court_state.teams || [];
			var finished_sets = court_state.score && court_state.score.finished_sets ? court_state.score.finished_sets : [];
			return [
				court_state.court ? court_state.court.id : '',
				match.id || '',
				match.is_doubles ? 'D' : 'S',
				finished_sets.length,
				teams.map(function(team) {
					return _v2_multi_team_label(team, s.settings);
				}).join('/'),
			].join(':');
		}).join('|'),
	]);
}

function _v2_court_state_matches_changed_court(court_state, changed_court_id) {
	if (!changed_court_id) {
		return true;
	}
	return !!(
		court_state &&
		court_state.court &&
		court_state.court.id === changed_court_id
	);
}

function _v2_top_list_patch_court(court_cache, court_state, colors, settings) {
	var teams = court_state.teams || [];
	var sets = _v2_score_sets_for_display(court_state.score);
	var current_set = court_state.score && court_state.score.current_set ? court_state.score.current_set : {};
	[0, 1].forEach(function(team_idx) {
		var team = teams[team_idx] || {};
		var team_cache = court_cache.teams[team_idx];
		if (!team_cache) {
			return;
		}
		_v2_set_text(team_cache.name_el, team.name || '');
		_v2_set_text(team_cache.current_score_el, _v2_score_for_team(current_set, team, team_idx));
		team_cache.prev_score_els.forEach(function(score_el, set_idx) {
			var set_score = sets[set_idx];
			var is_current = set_idx === sets.length - 1;
			if (!set_score || is_current) {
				_v2_set_text(score_el, '');
				return;
			}
			var own = _v2_score_for_team(set_score, team, team_idx);
			var other = _v2_score_for_team(set_score, teams[1 - team_idx], 1 - team_idx);
			_v2_set_text(score_el, own);
			_v2_set_style(score_el, 'color', own > other ? colors.serv2 : colors.recv);
		});
		team_cache.player_els.forEach(function(player_el, player_idx) {
			_v2_set_style(
				player_el,
				'color',
				_v2_player_is_serving(court_state, team_idx, player_idx) ? colors.serv2 : colors.fg
			);
		});
	});
}

function _v2_top_list_render_court(container, court_state, colors, settings) {
	var teams = court_state.teams || [];
	var sets = _v2_score_sets_for_display(court_state.score);
	var finished_sets = sets.slice(0, -1);
	var current_set = court_state.score && court_state.score.current_set ? court_state.score.current_set : {};
	var court_cache = {teams: []};
	for (var i = 0; i < 2; i++) {
		var is_top = i === 0;
		var top_key = is_top ? 'top' : 'bottom';
		var bottom_key = is_top ? 'bottom' : 'top';
		var team_idx = is_top ? 0 : 1;
		var team = teams[team_idx] || {};
		var team_container = uiu.el(container, 'div', {
			style: (
				'position:absolute;left:0;height:50%;top:' + (i * 50) + '%;width:100%;' +
				'white-space:pre;'
			),
		});
		var team_name_container = uiu.el(team_container, 'div', {
			style: (
				'position:absolute;' + bottom_key + ':0;height:4vh;width:100%;' +
				'color:' + colors.fg3 + ';display:flex;align-items:center;'
			),
		});
		var team_name_el = uiu.el(team_name_container, 'span', {}, team.name || '');
		var prev_score_container = uiu.el(team_name_container, 'div', {
			style: 'position:absolute;right:0;height:100%;display:flex;align-items:center;',
		});
		var prev_score_els = [];
		finished_sets.forEach(function(set_score, set_idx) {
			var own = _v2_score_for_team(set_score, team, team_idx);
			var other = _v2_score_for_team(set_score, teams[1 - team_idx], 1 - team_idx);
			prev_score_els[set_idx] = uiu.el(prev_score_container, 'div', {
				'style': (
					'display:inline-block;margin:0 0.4em;min-width:1.2em;text-align:right;' +
					'font-size:3vh;color:' + (own > other ? colors.serv2 : colors.recv)
				),
			}, own);
		});
		_setup_autosize(team_name_el, prev_score_container);
		var players_container = uiu.el(team_container, 'div', {
			style: (
				'position:absolute;' + top_key + ':0;height:12vh;width:100%;' +
				'display:flex;flex-direction:column;justify-content:center;'
			),
		});
		var current_score_el = uiu.el(players_container, 'div', {
			style: (
				'line-height:12vh;font-size:12vh;position:absolute;right:0;' + top_key + ':0;' +
				'color:' + colors.fg
			),
		}, _v2_score_for_team(current_set, team, team_idx));
		var player_els = [];
		var player_labels = _v2_display_player_labels(team, settings);
		player_labels.forEach(function(player_label, player_idx) {
			var player_name_container = uiu.el(players_container, 'div', {
				'style': (
					'color:' + (_v2_player_is_serving(court_state, team_idx, player_idx) ? colors.serv2 : colors.fg) + ';' +
					'height:50%;width:100%;'
				),
			});
			var span = uiu.el(player_name_container, 'span', {}, player_label);
			player_els[player_idx] = player_name_container;
			_setup_autosize(span, current_score_el);
		});
		court_cache.teams[team_idx] = {
			name_el: team_name_el,
			current_score_el: current_score_el,
			prev_score_els: prev_score_els,
			player_els: player_els,
		};
	}
	return court_cache;
}

function _v2_top_list_render_list(container, dto, colors, settings) {
	var court_states = _v2_multi_ordered_court_states(s, dto);
	var max_games = court_states.reduce(function(max, court_state) {
		return Math.max(max, Math.max(Number(court_state.match && court_state.match.best_of || 0) || 3, _v2_score_sets_for_display(court_state.score).length));
	}, 3);
	var match_list = uiu.el(container, 'table', {'class': 'display_list_container'});
	var head = uiu.el(match_list, 'tr', {'class': 'display_list_thead'});
	uiu.el(head, 'th', {'class': 'display_list_match_name'}, '');
	_list_render_team_name(head, '');
	_list_render_team_name(head, '');
	uiu.el(head, 'th', {'class': 'display_list_matchscore', colspan: max_games}, '');
	court_states.forEach(function(court_state) {
		if (!court_state.match) {
			return;
		}
		var row = uiu.el(match_list, 'tr');
		uiu.el(row, 'td', {'class': 'display_list_match_name'}, court_state.match.round_name || _v2_multi_match_name(court_state.match));
		[0, 1].forEach(function(team_idx) {
			var team = court_state.teams && court_state.teams[team_idx] ? court_state.teams[team_idx] : {};
			var team_side = _v2_team_side(team, team_idx);
			var winning = court_state.winner_side === team_side || (team && team.is_winner);
			var td = uiu.el(row, 'td', {
				'class': 'display_list_player_names' + (winning ? ' display_list_winning_players' : ''),
			});
			_list_render_player_names(td, _v2_multi_team_players(team), winning);
		});
		var sets = _v2_score_sets_for_display(court_state.score);
		for (var set_idx = 0; set_idx < max_games; set_idx++) {
			var score_td = uiu.el(row, 'td', {'class': 'display_list_game_score'});
			var set_score = sets[set_idx];
			if (!set_score) {
				continue;
			}
			var left = Number(set_score.left || 0);
			var right = Number(set_score.right || 0);
			uiu.el(score_td, 'span', {
				'class': left > right ? 'display_list_winning' : '',
				'style': left > right ? '' : 'color:#ddd;',
			}, left);
			uiu.el(score_td, 'span', {'class': 'display_list_vs'}, ':');
			uiu.el(score_td, 'span', {
				'class': right > left ? 'display_list_winning' : '',
				'style': right > left ? '' : 'color:#ddd;',
			}, right);
		}
	});
}

function render_v2_top_list_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'top+list' || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = _v2_prepare_full_render_container('top+list');
	if (!container) {
		return false;
	}
	var colors = _v2_multi_colors(s, dto);
	var inner_container = uiu.el(container, 'div', {
		style: 'position:absolute;left:0;top:0;bottom:0;right:0;background:' + colors.bg,
	});
	var courts_outer_container = uiu.el(inner_container, 'div', {'class': 'display_courts_container'});
	var courts_container = uiu.el(courts_outer_container, 'div', {
		style: 'position:absolute;left:1vw;right:1vw;top:0;bottom:0;',
	});
	var court_states = _v2_multi_ordered_court_states(s, dto);
	var court_count = court_states.length || 1;
	var spacer_width = 4 * (court_count - 1);
	var court_width = ((100.0 - (court_count - 1) * spacer_width) / court_count);
	_v2_top_list_cache = {
		container: container,
		structure_key: _v2_top_list_structure_key(s, dto),
		courts: [],
		colors: colors,
	};
	court_states.forEach(function(court_state, court_idx) {
		var left = (court_width + spacer_width) * court_idx;
		var court_container = uiu.el(courts_container, 'div', {
			'class': 'display_courts_court',
			'style': 'position:absolute;top:0;bottom:0;left:' + left + '%;width:' + court_width + '%',
		});
		_v2_top_list_cache.courts[court_idx] = _v2_top_list_render_court(court_container, court_state, colors, s.settings);
	});
	_v2_top_list_render_list(inner_container, dto, colors, s.settings);
	return true;
}

function render_v2_top_list_score_update(s, dto) {
	if (!_v2_top_list_cache || !_v2_top_list_cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_top_list_display_state(s, dto);
	}
	var structure_key = _v2_top_list_structure_key(s, dto);
	if (_v2_top_list_cache.structure_key !== structure_key) {
		return render_v2_top_list_display_state(s, dto);
	}
	var court_states = _v2_multi_ordered_court_states(s, dto);
	var changed_court_id = dto.v2_changed_court_id || null;
	court_states.forEach(function(court_state, court_idx) {
		if (!_v2_court_state_matches_changed_court(court_state, changed_court_id)) {
			return;
		}
		var court_cache = _v2_top_list_cache.courts[court_idx];
		if (court_cache) {
			_v2_top_list_patch_court(court_cache, court_state, _v2_top_list_cache.colors, s.settings);
		}
	});
	return true;
}

function _v2_multi_match_score(dto) {
	var result = [0, 0];
	(dto.court_states || []).forEach(function(court_state) {
		(court_state.teams || []).slice(0, 2).forEach(function(team, team_idx) {
			if (team && team.is_winner) {
				result[team_idx] += 1;
			}
		});
	});
	return result;
}

function _v2_multi_max_games(dto) {
	return (dto.court_states || []).reduce(function(max_games, court_state) {
		return Math.max(max_games, Math.max(Number(court_state.match && court_state.match.best_of || 0) || 3, _v2_score_sets_for_display(court_state.score).length));
	}, 3);
}

function _v2_multi_team_names(dto) {
	var first_match = (dto.court_states || []).find(function(court_state) {
		return court_state && court_state.match && court_state.teams && court_state.teams.length >= 2;
	});
	if (!first_match) {
		return ['', ''];
	}
	return [0, 1].map(function(team_idx) {
		var team = first_match.teams[team_idx] || {};
		return team.name || '';
	});
}

function _v2_multi_team_score_structure_key(s, dto, colors) {
	var team_names = _v2_multi_team_names(dto);
	return _v2_join_key([
		s.settings.displaymode_style || '',
		team_names[0],
		team_names[1],
		colors.bg,
		colors.fg,
		colors[0],
		colors[1],
		colors.b0,
		colors.b1,
	]);
}

function _v2_patch_multi_match_score(cache, dto) {
	var match_score = _v2_multi_match_score(dto);
	[0, 1].forEach(function(team_idx) {
		if (cache && cache.score_els && cache.score_els[team_idx]) {
			_v2_set_text(cache.score_els[team_idx], match_score[team_idx]);
		}
	});
	return true;
}

function render_v2_teamscore_score_update(s, dto) {
	if (!_v2_teamscore_cache || !_v2_teamscore_cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_teamscore_display_state(s, dto);
	}
	var colors = _v2_multi_colors(s, dto);
	var structure_key = _v2_multi_team_score_structure_key(s, dto, colors);
	if (_v2_teamscore_cache.structure_key !== structure_key) {
		return render_v2_teamscore_display_state(s, dto);
	}
	return _v2_patch_multi_match_score(_v2_teamscore_cache, dto);
}

function render_v2_teamscore_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'teamscore' || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = _v2_prepare_full_render_container('teamscore');
	if (!container) {
		return false;
	}
	var colors = _v2_multi_colors(s, dto);
	var match_score = _v2_multi_match_score(dto);
	var team_names = _v2_multi_team_names(dto);
	var autosize_els = [];
	_v2_teamscore_cache = {
		container: container,
		structure_key: _v2_multi_team_score_structure_key(s, dto, colors),
		score_els: [],
	};
	[0, 1].forEach(function(team_idx) {
		if (team_idx === 1) {
			return;
		}
		var div = uiu.el(container, 'div', {
			style: (
				'display:flex;justify-content:center;align-items:center;height:20%;' +
				'background:' + colors.bg + ';color:' + colors[team_idx]
			),
		});
		autosize_els.push(uiu.el(div, 'span', {}, team_names[team_idx]));
	});
	var middle = uiu.el(container, 'div', {
		style: (
			'display:flex;justify-content:center;align-items:center;font-size:60vh;' +
		'height:60%;background:' + colors.bg
		),
	});
	_v2_teamscore_cache.score_els[0] = uiu.el(middle, 'span', {style: 'color:' + colors[0]}, match_score[0]);
	uiu.el(middle, 'span', {style: 'color:' + colors.fg}, ':');
	_v2_teamscore_cache.score_els[1] = uiu.el(middle, 'span', {style: 'color:' + colors[1]}, match_score[1]);
	var bottom = uiu.el(container, 'div', {
		style: (
			'display:flex;justify-content:center;align-items:center;height:20%;' +
			'background:' + colors.bg + ';color:' + colors[1]
		),
	});
	autosize_els.push(uiu.el(bottom, 'span', {}, team_names[1]));
	autosize_els.forEach(function(as_el) {
		_setup_autosize(as_el, undefined, function(parent_node) {
			return parent_node.offsetHeight * 0.8;
		});
	});
	return true;
}

function _v2_multi_table_structure_key(s, dto, colors, style) {
	return _v2_join_key([
		style || s.settings.displaymode_style || '',
		s.settings.displaymode_reverse_order ? '1' : '0',
		s.settings.d_tournament_overview_courts || '',
		s.settings.d_show_middle_name ? '1' : '0',
		s.settings.d_abbreviate_first_name ? '1' : '0',
		_v2_multi_max_games(dto),
		colors.bg,
		colors.bg2,
		colors.bg3,
		colors.fg,
		colors.fg2,
		colors.border,
		colors.tim_blue,
		colors.tim_active,
		_v2_multi_team_names(dto).join('/'),
		_v2_multi_ordered_court_states(s, dto).map(function(court_state) {
			var match = court_state && court_state.match ? court_state.match : null;
			return [
				court_state && court_state.court ? (court_state.court.id || '') : '',
				match ? match.id : '',
				match ? (match.round_name || '') : '',
				match ? _v2_multi_match_name(match) : '',
				(court_state && court_state.teams ? court_state.teams : []).map(function(team) {
					return _v2_multi_team_label(team, s.settings);
				}).join('/'),
			].join(':');
		}).join('|'),
	]);
}

function render_v2_tim_score_update(s, dto) {
	if (!_v2_tim_cache || !_v2_tim_cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_tim_display_state(s, dto);
	}
	var colors = _v2_multi_colors(s, dto);
	var structure_key = _v2_multi_table_structure_key(s, dto, colors, 'tim');
	if (_v2_tim_cache.structure_key !== structure_key) {
		return render_v2_tim_display_state(s, dto);
	}
	var changed_court_id = dto.v2_changed_court_id || null;
	_v2_set_text(_v2_tim_cache.match_score_el, _v2_multi_match_score(dto).join(' : '));
	_v2_multi_ordered_court_states(s, dto).filter(function(court_state) {
		return !!(court_state && court_state.match);
	}).forEach(function(court_state, row_idx) {
		if (!_v2_court_state_matches_changed_court(court_state, changed_court_id)) {
			return;
		}
		var row_cache = _v2_tim_cache.rows[row_idx];
		if (!row_cache) {
			return;
		}
		var sets = _v2_score_sets_for_display(court_state.score);
		(row_cache.score_els || []).forEach(function(score_el, set_idx) {
			var set_score = sets[set_idx];
			_v2_set_text(score_el, set_score ? (set_score.left + ' : ' + set_score.right) : '');
		});
	});
	return true;
}

function render_v2_tim_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'tim' || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = _v2_prepare_full_render_container('tim');
	if (!container) {
		return false;
	}
	var colors = _v2_multi_colors(s, dto);
	var max_game_count = _v2_multi_max_games(dto);
	var match_score = _v2_multi_match_score(dto);
	var team_names = _v2_multi_team_names(dto);
	var court_states = _v2_multi_ordered_court_states(s, dto);
	var active_match_ids = court_states.filter(function(court_state) {
		return court_state && court_state.match;
	}).map(function(court_state) {
		return court_state.match.id;
	});
	var table = uiu.el(container, 'table', {
		'class': 'd_tim_table',
		'style': 'color:' + colors.fg + ';border-color:' + colors.fg + ';',
	});
	_v2_tim_cache = {
		container: container,
		structure_key: _v2_multi_table_structure_key(s, dto, colors, 'tim'),
		match_score_el: null,
		rows: [],
	};
	var thead = uiu.el(table, 'thead', {style: 'background-color:' + colors.tim_blue + ';'});
	var top_tr = uiu.el(thead, 'tr', {style: 'height:20vh;'});
	uiu.el(top_tr, 'td');
	team_names.forEach(function(team_name) {
		uiu.el(top_tr, 'td', {'style': 'font-size:5vmin;width:26vw;'}, team_name);
	});
	_v2_tim_cache.match_score_el = uiu.el(top_tr, 'td', {
		style: 'color:' + colors.tim_active + ';font-size:12vmin',
		colspan: max_game_count,
	}, match_score[0] + ' : ' + match_score[1]);
	var tbody = uiu.el(table, 'tbody');
	var match_count = Math.max(1, court_states.filter(function(court_state) {
		return !!court_state.match;
	}).length);
	court_states.forEach(function(court_state, match_num) {
		if (!court_state.match) {
			return;
		}
		var match = court_state.match;
		var is_active = utils.includes(active_match_ids, match.id);
		var sets = _v2_score_sets_for_display(court_state.score);
		var row_cache = {score_els: []};
		_v2_tim_cache.rows.push(row_cache);
		var tr = uiu.el(tbody, 'tr', {
			style: (
				'height:' + ((80 - 0.1 * match_count) / match_count) + 'vh;' +
				'background-color:' + ((match_num % 2 === 0) ? colors.bg : colors.tim_blue) + ';'
			),
		});
		uiu.el(tr, 'td', {}, match.round_name || _v2_multi_match_name(match));
		(court_state.teams || []).slice(0, 2).forEach(function(team) {
			uiu.el(tr, 'td', {
				style: is_active ? ('color:' + colors.tim_active) : '',
			}, _v2_multi_team_players(team).map(function(player) {
				return _lastname(player);
			}).join(' - '));
		});
		for (var set_idx = 0; set_idx < max_game_count; set_idx++) {
			var set_score = sets[set_idx];
			row_cache.score_els[set_idx] = uiu.el(tr, 'td', {'style': 'min-width:3em;'}, set_score ? (set_score.left + ' : ' + set_score.right) : '');
		}
	});
	return true;
}

function render_v2_greyish_score_update(s, dto) {
	if (!_v2_greyish_cache || !_v2_greyish_cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_greyish_display_state(s, dto);
	}
	var colors = _v2_multi_colors(s, dto);
	var structure_key = _v2_multi_table_structure_key(s, dto, colors, 'greyish');
	if (_v2_greyish_cache.structure_key !== structure_key) {
		return render_v2_greyish_display_state(s, dto);
	}
	var changed_court_id = dto.v2_changed_court_id || null;
	_v2_set_text(_v2_greyish_cache.match_score_el, _v2_multi_match_score(dto).join(':'));
	_v2_multi_ordered_court_states(s, dto).filter(function(court_state) {
		return !!(court_state && court_state.match);
	}).forEach(function(court_state, row_idx) {
		if (!_v2_court_state_matches_changed_court(court_state, changed_court_id)) {
			return;
		}
		var row_cache = _v2_greyish_cache.rows[row_idx];
		if (!row_cache) {
			return;
		}
		var teams = court_state.teams || [];
		var sets = _v2_score_sets_for_display(court_state.score);
		(row_cache.team_cells || []).forEach(function(team_cells, team_idx) {
			var is_winner = !!(teams[team_idx] && teams[team_idx].is_winner);
			(team_cells || []).forEach(function(cell) {
				_v2_set_style(cell, 'background', is_winner ? colors.bg2 : '');
				_v2_set_style(cell, 'color', is_winner ? colors.bg : '');
			});
		});
		(row_cache.score_els || []).forEach(function(score_el, set_idx) {
			var set_score = sets[set_idx];
			var winner_game = set_score && (
				(teams[0] && teams[0].is_winner && Number(set_score.left || 0) > Number(set_score.right || 0)) ||
				(teams[1] && teams[1].is_winner && Number(set_score.right || 0) > Number(set_score.left || 0))
			);
			_v2_set_text(score_el, set_score ? (set_score.left + ':' + set_score.right) : '');
			_v2_set_style(score_el, 'background', winner_game ? colors.bg2 : '');
			_v2_set_style(score_el, 'color', winner_game ? colors.bg : '');
		});
	});
	return true;
}

function render_v2_greyish_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'greyish' || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = _v2_prepare_full_render_container('greyish');
	if (!container) {
		return false;
	}
	var colors = _v2_multi_colors(s, dto);
	var max_game_count = _v2_multi_max_games(dto);
	var match_score = _v2_multi_match_score(dto);
	var team_names = _v2_multi_team_names(dto);
	var court_states = _v2_multi_ordered_court_states(s, dto).filter(function(court_state) {
		return !!court_state.match;
	});
	_v2_greyish_cache = {
		container: container,
		structure_key: _v2_multi_table_structure_key(s, dto, colors, 'greyish'),
		match_score_el: null,
		rows: [],
	};
	var bg = uiu.el(container, 'div', {
		style: (
			'background:' + colors.bg + ';position:fixed;left:0;top:0;bottom:0;right:0;padding:0;'
		),
	});
	var header = uiu.el(bg, 'table', {
		style: (
			'border-collapse:collapse;background:' + colors.bg3 + ';width:100%;margin-bottom:3vmin;'
		),
	});
	var htr = uiu.el(header, 'tr');
	[0, 1].forEach(function(team_idx) {
		if (team_idx === 1) {
			return;
		}
		uiu.el(htr, 'td', {
			style: 'width:45vw;text-align:center;color:' + colors.fg + ';font-size:4vmin;',
		}, team_names[team_idx]);
	});
	_v2_greyish_cache.match_score_el = uiu.el(htr, 'td', {
		style: 'text-align:center;font-size:8vmin;background:' + colors.bg2 + ';color:' + colors.bg,
	}, match_score[0] + ':' + match_score[1]);
	uiu.el(htr, 'td', {
		style: 'width:45vw;text-align:center;color:' + colors.fg + ';font-size:4vmin;',
	}, team_names[1]);
	var table = uiu.el(bg, 'table', {
		'class': 'd_greyish_table',
		'style': 'table-layout:fixed;width:100%;border-collapse:collapse;font-size:4vmin;color:' + colors.fg + ';',
	});
	var match_count = Math.max(1, court_states.length);
	court_states.forEach(function(court_state) {
		var match = court_state.match;
		var teams = court_state.teams || [];
		var sets = _v2_score_sets_for_display(court_state.score);
		var row_cache = {
			team_cells: [[], []],
			score_els: [],
		};
		_v2_greyish_cache.rows.push(row_cache);
		var tr = uiu.el(table, 'tr', {
			style: (
				'height:' + (76 / match_count) + 'vh;background:' + colors.bg3 + ';' +
				'border-top:1vh solid ' + colors.bg
			),
		});
		uiu.el(tr, 'td', {
			style: 'text-align:center;width:2.5em;border-right:0.5vw solid ' + colors.bg,
		}, match.round_name || '');
		teams.slice(0, 2).forEach(function(team, team_idx) {
			var is_winner = !!(team && team.is_winner);
			var labels = _v2_display_player_labels(team, s.settings);
			var common_css = (
				'text-align:center;padding-left:0.3em;' +
				(is_winner ? ('background:' + colors.bg2 + ';color:' + colors.bg) : '')
			);
			if (labels.length === 2) {
				row_cache.team_cells[team_idx].push(uiu.el(tr, 'td', {style: 'width:14vw;' + common_css}, labels[0]));
				row_cache.team_cells[team_idx].push(uiu.el(tr, 'td', {style: 'width:14vw;border-right:0.5vw solid ' + colors.bg + ';' + common_css}, labels[1]));
			} else {
				row_cache.team_cells[team_idx].push(uiu.el(tr, 'td', {
					colspan: 2,
					style: 'width:28vw;border-right:0.5vw solid ' + colors.bg + ';' + common_css,
				}, labels[0] || ''));
			}
		});
		for (var set_idx = 0; set_idx < max_game_count; set_idx++) {
			var set_score = sets[set_idx];
			var winner_game = set_score && (
				(teams[0] && teams[0].is_winner && Number(set_score.left || 0) > Number(set_score.right || 0)) ||
				(teams[1] && teams[1].is_winner && Number(set_score.right || 0) > Number(set_score.left || 0))
			);
			var score_cell = uiu.el(tr, 'td', {
				'style': (
					'text-align:center;font-size:2.3vw;width:' + (30 / max_game_count) + 'vw;' +
					(winner_game ? ('background:' + colors.bg2 + ';color:' + colors.bg) : '')
				),
			}, set_score ? (set_score.left + ':' + set_score.right) : '');
			row_cache.score_els[set_idx] = score_cell;
		}
	});
	return true;
}

function _v2_stream_score_strip(container, court_state, options) {
	options = options || {};
	var match = court_state.match || null;
	var teams = court_state.teams || [];
	var sets = _v2_score_sets_for_display(court_state.score);
	var max_games = Math.max(Number(match && match.best_of || 0) || 3, sets.length);
	var border_radius = options.border_radius || '0.2vw';
	var cache = {
		court_id: court_state.court && court_state.court.id ? court_state.court.id : '',
		match_id: match && match.id ? match.id : '',
		teams: [],
	};
	var table = uiu.el(container, 'table', {
		style: (
			(options.style_prefix || '') +
			'border-radius:' + border_radius + ';border-collapse:collapse;' +
			'vertical-align:middle;color:#000;background:#ddd;' +
			(options.table_style || '')
		),
	});
	for (var team_idx = 0; team_idx < 2; team_idx++) {
		var team = teams[team_idx] || {};
		var team_cache = {
			name_el: null,
			score_els: [],
		};
		cache.teams[team_idx] = team_cache;
		var tr = uiu.el(table, 'tr', {
			style: (team_idx === 0) ? '' : 'border-top:0.05vw solid #fff;',
		});
		team_cache.name_el = uiu.el(tr, 'td', {
			style: (
				'padding-right:0.5em;overflow:hidden;white-space:pre;' +
				(options.name_width || 'width:8em;max-width:8em;min-width:8em;') +
				'font-size:80%;'
			),
		}, _v2_streamcourt_dm_player_name(team));
		for (var set_idx = 0; set_idx < max_games; set_idx++) {
			var set_score = sets[set_idx];
			var highlighted = _v2_stripes_set_highlight(court_state, set_score, set_idx, team, team_idx, sets);
			var extra_style = '';
			if (set_idx === max_games - 1) {
				extra_style += team_idx === 0
					? 'border-top-right-radius:' + border_radius + ';'
					: 'border-bottom-right-radius:' + border_radius + ';';
			}
			team_cache.score_els[set_idx] = uiu.el(tr, 'td', {
				style: (
					'width:1.2em;border-left:0.1vw solid #888;font-family:Arial Black;' +
					'padding:0 0.2em;text-align:center;background:#555;font-size:90%;' +
					'color:' + (highlighted ? '#ee0' : '#fff') + ';' + extra_style
				),
			}, set_score ? _v2_score_for_team(set_score, team, team_idx) : '');
		}
	}
	return cache;
}

function _v2_stream_structure_key(s, dto) {
	return _v2_join_key([
		s.settings.displaymode_style || '',
		s.settings.displaymode_reverse_order ? '1' : '0',
		_v2_multi_ordered_court_states(s, dto).map(function(court_state) {
			var match = court_state && court_state.match ? court_state.match : null;
			return [
				court_state && court_state.court ? (court_state.court.id || '') : '',
				match ? match.id : '',
				Math.max(Number(match && match.best_of || 0) || 3, _v2_score_sets_for_display(court_state && court_state.score).length),
				(court_state && court_state.teams ? court_state.teams : []).map(function(team) {
					return _v2_streamcourt_dm_player_name(team);
				}).join('/'),
			].join(':');
		}).join('|'),
	]);
}

function _v2_stream_patch_strip(strip_cache, court_state) {
	if (!strip_cache || !court_state) {
		return;
	}
	var teams = court_state.teams || [];
	var sets = _v2_score_sets_for_display(court_state.score);
	[0, 1].forEach(function(team_idx) {
		var team = teams[team_idx] || {};
		var team_cache = strip_cache.teams && strip_cache.teams[team_idx] ? strip_cache.teams[team_idx] : null;
		if (!team_cache) {
			return;
		}
		_v2_set_text(team_cache.name_el, _v2_streamcourt_dm_player_name(team));
		(team_cache.score_els || []).forEach(function(score_el, set_idx) {
			var set_score = sets[set_idx];
			var highlighted = _v2_stripes_set_highlight(court_state, set_score, set_idx, team, team_idx, sets);
			_v2_set_text(score_el, set_score ? _v2_score_for_team(set_score, team, team_idx) : '');
			_v2_set_style(score_el, 'color', highlighted ? '#ee0' : '#fff');
		});
	});
}

function render_v2_stream_score_update(s, dto) {
	if (!_v2_stream_cache || !_v2_stream_cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_stream_display_state(s, dto);
	}
	var structure_key = _v2_stream_structure_key(s, dto);
	if (_v2_stream_cache.structure_key !== structure_key) {
		return render_v2_stream_display_state(s, dto);
	}
	var changed_court_id = dto.v2_changed_court_id || null;
	_v2_multi_ordered_court_states(s, dto).forEach(function(court_state, court_idx) {
		if (!_v2_court_state_matches_changed_court(court_state, changed_court_id)) {
			return;
		}
		_v2_stream_patch_strip(_v2_stream_cache.courts[court_idx], court_state);
	});
	return true;
}

function render_v2_stream_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'stream' || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = _v2_prepare_full_render_container('stream');
	if (!container) {
		return false;
	}
	var court_states = _v2_multi_ordered_court_states(s, dto);
	_v2_stream_cache = {
		container: container,
		structure_key: _v2_stream_structure_key(s, dto),
		courts: [],
	};
	court_states.forEach(function(court_state, court_idx) {
		_v2_stream_cache.courts[court_idx] = _v2_stream_score_strip(container, court_state, {
			style_prefix: 'position:fixed;top:1vw;' + (court_idx === 0 ? 'left' : 'right') + ':1.3vw;',
			table_style: 'font-size:1.4vw;',
			border_radius: '0.2vw',
		});
	});
	return true;
}

function render_v2_streamteam_score_update(s, dto) {
	if (!_v2_streamteam_cache || !_v2_streamteam_cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_streamteam_display_state(s, dto);
	}
	var colors = _v2_multi_colors(s, dto);
	var structure_key = _v2_multi_team_score_structure_key(s, dto, colors);
	if (_v2_streamteam_cache.structure_key !== structure_key) {
		return render_v2_streamteam_display_state(s, dto);
	}
	return _v2_patch_multi_match_score(_v2_streamteam_cache, dto);
}

function render_v2_streamteam_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'streamteam' || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = _v2_prepare_full_render_container('streamteam');
	if (!container) {
		return false;
	}
	var colors = _v2_multi_colors(s, dto);
	var match_score = _v2_multi_match_score(dto);
	var team_names = _v2_multi_team_names(dto);
	_v2_streamteam_cache = {
		container: container,
		structure_key: _v2_multi_team_score_structure_key(s, dto, colors),
		score_els: [],
	};
	var inner_container = uiu.el(container, 'div', {
		style: (
			'background:' + colors.bg + ';color:' + colors.fg + ';font-size:7.2vw;height:5.8vw;' +
			'position:absolute;left:0;right:0;top:0;bottom:0;'
		),
	});
	var autosize_els = [];
	function _render_team(team_idx) {
		var div = uiu.el(inner_container, 'div', {
			style: (
				'position:absolute;display:flex;' + (team_idx === 0 ? 'left' : 'right') + ':0;top:0;' +
				'height:100%;width:42vw;align-items:center;justify-content:center;'
			),
		});
		autosize_els.push(uiu.el(div, 'span', {style: 'white-space:pre;'}, team_names[team_idx]));
	}
	_render_team(0);
	var middle = uiu.el(inner_container, 'div', {
		style: 'position:absolute;display:flex;top:0;height:100%;left:42vw;width:16vw;',
	});
	var number_css = 'display:inline-flex;width:50%;height:100%;justify-content:center;align-items:center;';
	_v2_streamteam_cache.score_els[0] = uiu.el(middle, 'span', {
		style: number_css + 'color:' + colors.b0 + ';background:' + colors[0] + ';',
	}, match_score[0]);
	var colon_container = uiu.el(middle, 'div', {
		style: (
			'position:absolute;left:0;right:0;top:0;bottom:0;' +
			'display:inline-flex;justify-content:center;align-items:center;color:' + colors.fg
		),
	});
	uiu.el(colon_container, 'span', {}, ':');
	_v2_streamteam_cache.score_els[1] = uiu.el(middle, 'span', {
		style: number_css + 'color:' + colors.b1 + ';background:' + colors[1] + ';',
	}, match_score[1]);
	_render_team(1);
	autosize_els.forEach(function(as_el) {
		_setup_autosize(as_el);
	});
	return true;
}

function _v2_castall_structure_key(s, dto, colors) {
	return _v2_join_key([
		s.settings.displaymode_style || '',
		s.settings.displaymode_reverse_order ? '1' : '0',
		String(s.settings.d_scale || ''),
		colors.bg,
		colors.bg2,
		colors.fg,
		colors[0],
		colors[1],
		colors.serv,
		colors.recv,
		_v2_multi_team_names(dto).join('/'),
		_v2_multi_ordered_court_states(s, dto).map(function(court_state) {
			var match = court_state && court_state.match ? court_state.match : null;
			return [
				court_state && court_state.court ? (court_state.court.id || '') : '',
				match ? match.id : '',
				match ? (match.round_name || '') : '',
				Math.max(Number(match && match.best_of || 0) || 3, _v2_score_sets_for_display(court_state && court_state.score).length),
				(court_state && court_state.teams ? court_state.teams : []).map(function(team) {
					return team && team.name ? team.name : '';
				}).join('/'),
			].join(':');
		}).join('|'),
	]);
}

function _v2_castall_patch_match(match_cache, court_state, colors) {
	if (!match_cache || !court_state) {
		return;
	}
	var teams = court_state.teams || [];
	var sets = _v2_score_sets_for_display(court_state.score);
	[0, 1].forEach(function(team_idx) {
		var team_cache = match_cache.teams && match_cache.teams[team_idx] ? match_cache.teams[team_idx] : null;
		if (!team_cache) {
			return;
		}
		_v2_set_style(team_cache.service_el, 'background', _v2_team_is_serving_or_set_winner(court_state, team_idx) ? colors.serv : colors.recv);
		(team_cache.score_els || []).forEach(function(score_el, set_idx) {
			var set_score = sets[set_idx];
			_v2_set_text(score_el, set_score ? _v2_score_for_team(set_score, teams[team_idx], team_idx) : '');
		});
	});
}

function render_v2_castall_score_update(s, dto) {
	if (!_v2_castall_cache || !_v2_castall_cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_castall_display_state(s, dto);
	}
	var colors = _v2_multi_colors(s, dto);
	var structure_key = _v2_castall_structure_key(s, dto, colors);
	if (_v2_castall_cache.structure_key !== structure_key) {
		return render_v2_castall_display_state(s, dto);
	}
	var changed_court_id = dto.v2_changed_court_id || null;
	_v2_multi_ordered_court_states(s, dto).forEach(function(court_state, court_idx) {
		if (!_v2_court_state_matches_changed_court(court_state, changed_court_id)) {
			return;
		}
		_v2_castall_patch_match(_v2_castall_cache.matches[court_idx], court_state, colors);
	});
	_v2_patch_multi_match_score(_v2_castall_cache, dto);
	return true;
}

function render_v2_castall_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'castall' || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = _v2_prepare_full_render_container('castall');
	if (!container) {
		return false;
	}
	var colors = _v2_multi_colors(s, dto);
	var scale = s.settings.d_scale / 100;
	uiu.el(container, 'div', {'class': 'd_castall_bg', 'style': 'background:' + colors.t});
	var court_states = _v2_multi_ordered_court_states(s, dto);
	_v2_castall_cache = {
		container: container,
		structure_key: _v2_castall_structure_key(s, dto, colors),
		matches: [],
		score_els: [],
	};
	court_states.forEach(function(court_state, court_idx) {
		var max_games = Math.max(Number(court_state.match && court_state.match.best_of || 0) || 3, _v2_score_sets_for_display(court_state.score).length);
		var match_cache = {teams: []};
		_v2_castall_cache.matches[court_idx] = match_cache;
		var match_container = uiu.el(container, 'div', {
			'class': 'd_castall_match',
			'style': (
				((court_idx === 0) ? 'left' : 'right') + ':3%;background:' + colors.bg + ';' +
				'width:' + ((85 + (max_games * 41)) * scale) + 'px;' +
				'height:' + (60 * scale) + 'px;border-radius:' + (6 * scale) + 'px'
			),
		});
		var mname_container = uiu.el(match_container, 'div', {
			'class': 'd_castall_mname',
			'style': 'margin:0 ' + (3 * scale) + 'px;font-size:' + (15 * scale) + 'px;width:' + (15 * scale) + 'px',
		});
		(court_state.match && court_state.match.round_name ? court_state.match.round_name : '').split(/(?=[^.])/).forEach(function(part) {
			uiu.el(mname_container, 'span', {}, part || '');
		});
		var teams_container = uiu.el(match_container, 'div', 'd_castall_teams');
		(court_state.teams || []).slice(0, 2).forEach(function(team, team_idx) {
			var team_cache = {
				service_el: null,
				score_els: [],
			};
			match_cache.teams[team_idx] = team_cache;
			var team_block = uiu.el(teams_container, 'div', {
				'class': 'd_castall_team',
				style: (
					'height:' + (28.5 * scale) + 'px;padding-top:' + (1 * scale) + 'px;' +
					((team_idx === 1) ? 'padding-bottom:' + (1 * scale) + 'px' : '')
				),
			});
			var fg_color = utils.contrast_color(colors[team_idx], colors.bg, colors.fg);
			var abbrev = (team && team.name ? team.name : String(team_idx + 1)).slice(0, 3);
			var team_name_container = uiu.el(team_block, 'div', {
				style: (
					'font-family:monospace;background:' + colors[team_idx] + ';color:' + fg_color + ';' +
					'width:' + (45 * scale) + 'px;height:100%;display:flex;justify-content:center;' +
					'align-items:center;font-size:' + (22 * scale) + 'px;'
				),
			});
			uiu.el(team_name_container, 'span', {}, abbrev);
			team_cache.service_el = uiu.el(team_block, 'div', {
				style: (
					'height:100%;background:' + (_v2_team_is_serving_or_set_winner(court_state, team_idx) ? colors.serv : colors.recv) + ';' +
					'margin:0 ' + (1 * scale) + 'px;width:' + (10 * scale) + 'px;'
				),
			});
			var sets = _v2_score_sets_for_display(court_state.score);
			for (var set_idx = 0; set_idx < max_games; set_idx++) {
				var set_score = sets[set_idx];
				var score_container = uiu.el(team_block, 'div', {
					style: (
						'background:' + colors.bg2 + ';color:' + colors.bg + ';width:' + (40 * scale) + 'px;' +
						'margin-right:' + (1 * scale) + 'px;height:100%;display:flex;justify-content:center;' +
						'align-items:center;font-size:' + (22 * scale) + 'px;'
					),
				});
				team_cache.score_els[set_idx] = uiu.el(score_container, 'span', {}, set_score ? _v2_score_for_team(set_score, team, team_idx) : '');
			}
		});
	});
	var match_score = _v2_multi_match_score(dto);
	var team_names = _v2_multi_team_names(dto);
	var bottom_container = uiu.el(container, 'div', 'd_castall_bottom');
	var bottom_block = uiu.el(bottom_container, 'div', {
		'class': 'd_castall_bottom_block',
		'style': 'background:' + colors.bg + ';width:' + (670 * scale) + 'px;height:' + (55 * scale) + 'px;border-radius:' + (12 * scale) + 'px',
	});
	[0, 1].forEach(function(team_idx) {
		var team_block = uiu.el(bottom_block, 'div', {
			'class': 'd_castall_bottom_team' + team_idx,
			'style': (
				'width:' + (262 * scale) + 'px;font-size:' + (32 * scale) + 'px;' +
				((team_idx === 0) ? 'margin-left' : 'margin-right') + ':' + (8 * scale) + 'px'
			),
		});
		_setup_autosize(uiu.el(team_block, 'span', {
			'class': 'd_castall_bottom_team_name',
			'style': 'color:' + colors.fg,
		}, team_names[team_idx]));
		var bottom_fg_color = utils.contrast_color(colors[team_idx], colors.bg, colors.fg);
		_v2_castall_cache.score_els[team_idx] = uiu.el(bottom_block, 'div', {
			'class': 'd_castall_score' + team_idx,
			'style': (
				'height:' + (54 * scale) + 'px;margin-bottom:' + (1 * scale) + 'px;color:' + bottom_fg_color + ';' +
				'background:' + colors[team_idx] + ';width:' + (65 * scale) + 'px;font-size:' + (60 * scale) + 'px'
			),
		}, match_score[team_idx]);
	});
	var colon_container = uiu.el(bottom_container, 'div', {'class': 'd_castall_bcolon'});
	uiu.el(colon_container, 'div', {'style': 'font-size:' + (50 * scale) + 'px;margin-top:-0.1em;'}, ':');
	return true;
}

function render_v2_tournament_overview_score_update(s, dto) {
	if (!_v2_tournament_overview_cache || !_v2_tournament_overview_cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_tournament_overview_display_state(s, dto);
	}
	var colors = _v2_multi_colors(s, dto);
	var structure_key = _v2_multi_table_structure_key(s, dto, colors, 'tournament_overview');
	if (_v2_tournament_overview_cache.structure_key !== structure_key) {
		return render_v2_tournament_overview_display_state(s, dto);
	}
	var changed_court_id = dto.v2_changed_court_id || null;
	_v2_multi_ordered_court_states(s, dto).forEach(function(court_state, row_idx) {
		if (!_v2_court_state_matches_changed_court(court_state, changed_court_id)) {
			return;
		}
		var row_cache = _v2_tournament_overview_cache.rows[row_idx];
		if (!row_cache) {
			return;
		}
		var sets = _v2_score_sets_for_display(court_state.score);
		(row_cache.score_cells || []).forEach(function(score_cell, set_idx) {
			var set_score = sets[set_idx];
			uiu.empty(score_cell);
			if (court_state.match && set_score) {
				var left = Number(set_score.left || 0);
				var right = Number(set_score.right || 0);
				uiu.el(score_cell, 'span', {'class': left > right ? 'd_to_winning' : ''}, left);
				uiu.el(score_cell, 'span', {'class': 'd_to_vs'}, ':');
				uiu.el(score_cell, 'span', {'class': right > left ? 'd_to_winning' : ''}, right);
			}
		});
	});
	return true;
}

function render_v2_tournament_overview_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'tournament_overview' || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = _v2_prepare_full_render_container('tournament_overview');
	if (!container) {
		return false;
	}
	var colors = _v2_multi_colors(s, dto);
	var court_states = _v2_multi_ordered_court_states(s, dto);
	var max_game_count = _v2_multi_max_games(dto);
	_v2_tournament_overview_cache = {
		container: container,
		structure_key: _v2_multi_table_structure_key(s, dto, colors, 'tournament_overview'),
		rows: [],
	};
	var table = uiu.el(container, 'table', {
		'class': 'd_to_table',
		'style': 'background:' + colors.bg + ';color:' + colors.fg + ';',
	});
	court_states.forEach(function(court_state, idx) {
		var match = court_state.match;
		var teams = court_state.teams || [];
		var sets = _v2_score_sets_for_display(court_state.score);
		var row_cache = {score_cells: []};
		_v2_tournament_overview_cache.rows[idx] = row_cache;
		var tr = uiu.el(table, 'tr', {
			style: 'background:' + ((idx % 2 === 0) ? colors.bg : colors.bg3) + ';color:' + colors.fg + ';',
		});
		uiu.el(tr, 'td', 'd_to_court', court_state.court ? (court_state.court.label || court_state.court.num || court_state.court.id) : '');
		if (match) {
			uiu.el(tr, 'td', {
				'class': 'd_to_matchname',
				style: 'color:' + colors.fg2 + ';',
			}, _v2_multi_match_name(match));
			[0, 1].forEach(function(team_idx) {
				var td = uiu.el(tr, 'td', 'd_to_team');
				uiu.el(td, 'span', {}, _v2_multi_team_label(teams[team_idx], s.settings));
			});
		} else {
			uiu.el(tr, 'td', {colspan: 3});
		}
		for (var set_idx = 0; set_idx < max_game_count; set_idx++) {
			var score_td = uiu.el(tr, 'td', {
				'class': 'd_to_score',
				style: 'border-color:' + colors.border,
			});
			row_cache.score_cells[set_idx] = score_td;
			var set_score = sets[set_idx];
			if (match && set_score) {
				var left = Number(set_score.left || 0);
				var right = Number(set_score.right || 0);
				uiu.el(score_td, 'span', {'class': left > right ? 'd_to_winning' : ''}, left);
				uiu.el(score_td, 'span', {'class': 'd_to_vs'}, ':');
				uiu.el(score_td, 'span', {'class': right > left ? 'd_to_winning' : ''}, right);
			}
		}
	});
	return true;
}

function _v2_tournament_overview_dm_render_row(s, parent, court_state, idx, total_rows) {
	var match = court_state && court_state.match ? court_state.match : null;
	var teams = court_state && court_state.teams ? court_state.teams : [];
	var sets = _v2_score_sets_for_display(court_state && court_state.score);
	var court = court_state && court_state.court ? court_state.court : {};
	var row_cache = {
		el: null,
		row_structure_key: _v2_tournament_overview_dm_row_structure_key(s, court_state),
		service_els: [],
		score_els: [[], []],
	};
	var metrics = _v2_tournament_overview_dm_row_metrics(total_rows);
	var use_finals_layout = Math.max(1, Number(total_rows) || 0) <= 3;
	var row_height = metrics.row_height;
	var row_block_height = metrics.row_block_height;
	var top = metrics.row_gap + (idx * (row_height + metrics.row_gap));
	var court_el = uiu.el(parent, 'div', {
		style: 'position:absolute;top:' + top + 'vh;left:0;height:' + row_height + 'vh;width:100vw;overflow:hidden;',
	});
	row_cache.el = court_el;
	var top_bar = uiu.el(court_el, 'div', {
		style: (
			'position:absolute;top:' + metrics.top_padding + 'vh;left:2vw;height:' + row_height + 'vh;width:96vw;' +
			'display:flex;flex-direction:row;'
		),
	});
	var court_box_width = use_finals_layout ? '17vw' : '7.5vw';
	var meta_box_width = use_finals_layout ? '15vw' : '10vw';
	var score_width = use_finals_layout ? '8vw' : '9vh';
	var font_big = metrics.font_big + 'vh';
	var score_font = metrics.score_font + 'vh';
	var team_font = metrics.team_font + 'vh';
	var meta_font = metrics.meta_font + 'vh';
	var duration_font = metrics.duration_font + 'vh';
	var cap_height = metrics.cap_pct + '%';
	var content_height = (100 - (metrics.cap_pct * 2)) + '%';
	var team_height = metrics.team_pct + '%';
	var middle_height = metrics.middle_pct + '%';
	var cap_radius_top = 'border-top-right-radius:1vh;border-top-left-radius:1vh;';
	var cap_radius_bottom = 'border-bottom-right-radius:1vh;border-bottom-left-radius:1vh;';
		function setup_btp_text_autosize(el, right_node, height_ratio) {
			autosize.maintain(el, function() {
				var parent_node = el.parentNode;
				var w = parent_node.offsetWidth;
			if (right_node) {
				var prect = parent_node.getBoundingClientRect();
				var rrect = right_node.getBoundingClientRect();
				w = Math.max(10, Math.min(w, rrect.left - prect.left - 20));
			}
			var h = Math.max(10, parent_node.offsetHeight * (height_ratio || 0.9));
			return {
				width: el.offsetWidth > 0 ? Math.min(w, el.offsetWidth) : w,
				height: el.offsetHeight > 0 ? Math.min(h, el.offsetHeight) : h,
				};
			});
		}
		function render_team_name_lines(row, team) {
			var team_name = uiu.el(row, 'div', {
				style: (
					'order:1;margin-left:1vh;height:100%;flex:1 1 auto;min-width:0;overflow:hidden;' +
					'display:flex;justify-content:center;flex-direction:column;'
				),
			});
			var players = _v2_multi_team_players(team);
			if (!players.length) {
				players = [{name: team && team.name ? team.name : ''}];
			}
			if (!use_finals_layout) {
				var label = players.map(function(player) {
					return _doubles_name({
						name: _v2_display_player_name(s.settings, player, player.name || ''),
						firstname: player.firstname,
						lastname: player.lastname,
					});
				}).join(' / ');
				setup_btp_text_autosize(uiu.el(team_name, 'div', {
					style: (
						'font-size:' + team_font + ';font-weight:bold;display:inline-block;width:max-content;' +
						'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
					),
				}, label), null);
				return;
			}
			var line_height = (100 / Math.max(1, players.length)) + '%';
			players.forEach(function(player) {
				var line = uiu.el(team_name, 'div', {
					style: 'height:' + line_height + ';display:flex;align-items:center;min-width:0;overflow:hidden;',
				});
				setup_btp_text_autosize(uiu.el(line, 'div', {
					style: (
						'font-size:' + team_font + ';font-weight:bold;display:inline-block;width:max-content;' +
						'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
					),
				}, _v2_display_player_name(s.settings, player, player.name || '')), null);
			});
		}
		function frame_column(parent_el, width, margin_left) {
			var col = uiu.el(parent_el, 'div', {
				style: (
					'position:static;height:' + row_height + 'vh;flex:0 0 ' + width + ';min-width:0;' +
				'display:flex;flex-direction:column;justify-content:space-between;' +
				(margin_left ? 'margin-left:0.5vh;' : '')
			),
		});
		uiu.el(col, 'div', {
			style: 'position:static;height:' + cap_height + ';width:100%;background:#fff;' + cap_radius_top,
		});
		return col;
	}
	function finish_frame_column(col) {
		uiu.el(col, 'div', {
			style: 'position:static;height:' + cap_height + ';width:100%;background:#fff;' + cap_radius_bottom,
		});
	}
	var court_col = frame_column(top_bar, court_box_width, false);
		var court_box = uiu.el(court_col, 'div', {
			style: (
				'position:static;height:' + content_height + ';width:100%;background:#ffffffbb;text-align:center;' +
				'font-weight:bold;font-style:oblique;overflow:hidden;' +
				(use_finals_layout ? 'display:flex;flex-direction:column;justify-content:center;' : '')
			),
		});
	uiu.el(court_box, 'div', {
		style: (
			'font-size:' + font_big + ';font-weight:bold;font-style:oblique;' +
			(use_finals_layout
				? 'margin:-2.5vh;'
				: ('height:100%;margin-top:' + (-0.15625 * row_height) + 'vh;'))
		),
	}, court.num || court.label || '');
	if (use_finals_layout && match) {
		setup_btp_text_autosize(uiu.el(court_box, 'div', {
			style: (
					'font-size:' + meta_font + ';font-weight:bold;font-style:oblique;' +
					'line-height:1.05;max-width:100%;overflow:hidden;'
				),
					}, [match.event_name || '', match.round_name || ''].filter(Boolean).join(' - ')), null, 0.26);
				if (court_state && Number.isFinite(court_state.match_duration_min)) {
					setup_btp_text_autosize(uiu.el(court_box, 'div', {
						style: (
							'font-size:' + duration_font + ';font-weight:bold;font-style:oblique;' +
							'line-height:1.05;max-width:100%;overflow:hidden;'
						),
					}, court_state.match_duration_min + "'"), null, 0.22);
				}
		}
	finish_frame_column(court_col);
	if (!use_finals_layout) {
		var meta_col = frame_column(top_bar, meta_box_width, true);
			var meta_box = uiu.el(meta_col, 'div', {
				style: (
					'position:static;height:' + content_height + ';width:100%;background:#ffffffbb;text-align:center;' +
					'font-weight:bold;font-style:oblique;overflow:hidden;display:flex;flex-direction:column;justify-content:center;'
				),
			});
			if (match) {
				setup_btp_text_autosize(uiu.el(meta_box, 'div', {
					style: 'font-size:' + meta_font + ';font-weight:bold;font-style:oblique;line-height:1.05;max-width:100%;overflow:hidden;',
				}, match.event_name || ''), null, 0.28);
				setup_btp_text_autosize(uiu.el(meta_box, 'div', {
					style: 'font-size:' + meta_font + ';font-weight:bold;font-style:oblique;line-height:1.05;max-width:100%;overflow:hidden;',
					}, match.round_name || ''), null, 0.28);
					if (court_state && Number.isFinite(court_state.match_duration_min)) {
						setup_btp_text_autosize(uiu.el(meta_box, 'div', {
							style: 'font-size:' + duration_font + ';font-weight:bold;font-style:oblique;line-height:1.05;max-width:100%;overflow:hidden;',
						}, court_state.match_duration_min + "'"), null, 0.34);
					}
			}
		finish_frame_column(meta_col);
	}
	var team_box = uiu.el(top_bar, 'div', {
		style: (
			'position:static;height:' + row_height + 'vh;' + (use_finals_layout ? 'width:55vw;flex:0 0 55vw;' : 'flex:1 1 auto;') + 'min-width:0;' +
			'display:flex;flex-direction:column;justify-content:space-between;margin-left:0.5vh;'
		),
	});
	uiu.el(team_box, 'div', {
		style: 'position:static;height:' + cap_height + ';width:100%;background:#fff;' + cap_radius_top,
	});
		[0, 1].forEach(function(team_idx) {
			var row = uiu.el(team_box, 'div', {
				style: (
					'position:static;height:' + team_height + ';width:100%;background:#ffffffbb;' +
					'display:flex;justify-content:space-between;font-size:' + team_font + ';font-weight:bold;min-width:0;overflow:hidden;'
			),
		});
		row_cache.service_els[team_idx] = uiu.el(row, 'div', {
			style: (
				'height:100%;align-content:center;width:6.5vh;flex:0 0 6.5vh;order:2;background-repeat:no-repeat;' +
				'background-position:center;background-size:contain;' +
				'background-image:url("icons/Ball_DM_Cloppenburg_schwarz.svg");' +
				'visibility:' + (_v2_team_is_serving_or_set_winner(court_state, team_idx) ? 'visible' : 'hidden') + ';'
				),
			});
			render_team_name_lines(row, teams[team_idx]);
			if (team_idx === 0) {
				uiu.el(team_box, 'div', {style: 'position:static;height:' + middle_height + ';width:100%;'});
			}
	});
	uiu.el(team_box, 'div', {
		style: 'position:static;height:' + cap_height + ';width:100%;background:#fff;' + cap_radius_bottom,
	});
	for (var set_idx = 0; set_idx < 3; set_idx++) {
		var top_bar_set = frame_column(top_bar, score_width, true);
		[0, 1].forEach(function(team_idx) {
			var set_score = sets[set_idx];
				row_cache.score_els[team_idx][set_idx] = uiu.el(top_bar_set, 'div', {
					style: (
						'position:static;height:' + team_height + ';width:100%;background:#ffffffbb;display:flex;' +
						'justify-content:center;align-items:center;font-size:' + score_font + ';font-weight:bold;'
					),
				}, (match && set_score) ? _v2_score_for_team(set_score, teams[team_idx], team_idx) : '');
			if (team_idx === 0) {
				uiu.el(top_bar_set, 'div', {style: 'position:static;height:' + middle_height + ';width:100%;'});
			}
		});
		finish_frame_column(top_bar_set);
	}
	return row_cache;
}

function _v2_tournament_overview_dm_patch(cache, s, dto) {
	if (!cache || !cache.container || !dto || dto.type !== 'display_multi_state') {
		return render_v2_tournament_overview_dm_display_state(s, dto);
	}
	var colors = _v2_multi_colors(s, dto);
	var structure_key = _v2_tournament_overview_dm_container_key(s, dto, colors);
	var rows = _v2_tournament_overview_dm_ordered_court_states(s, dto);
	if (cache.structure_key !== structure_key || !cache.background || cache.rows.length !== rows.length) {
		return render_v2_tournament_overview_dm_display_state(s, dto);
	}
	var changed_court_id = dto.v2_changed_court_id || null;
	rows.forEach(function(court_state, row_idx) {
		if (!_v2_court_state_matches_changed_court(court_state, changed_court_id)) {
			return;
		}
		var row_cache = cache.rows[row_idx];
		if (!row_cache) {
			return;
		}
		var row_structure_key = _v2_tournament_overview_dm_row_structure_key(s, court_state);
		if (row_cache.row_structure_key !== row_structure_key) {
			var next_row_cache = _v2_tournament_overview_dm_render_row(s, cache.background, court_state, row_idx, rows.length);
			if (row_cache.el && row_cache.el.parentNode) {
				row_cache.el.parentNode.insertBefore(next_row_cache.el, row_cache.el);
				uiu.remove(row_cache.el);
			}
			cache.rows[row_idx] = next_row_cache;
			return;
		}
		var teams = court_state.teams || [];
		var sets = _v2_score_sets_for_display(court_state.score);
		(row_cache.service_els || []).forEach(function(service_el, team_idx) {
			_v2_set_style(service_el, 'visibility', _v2_team_is_serving_or_set_winner(court_state, team_idx) ? 'visible' : 'hidden');
		});
			(row_cache.score_els || []).forEach(function(team_scores, team_idx) {
				(team_scores || []).forEach(function(score_el, set_idx) {
					var set_score = sets[set_idx];
					_v2_set_text(score_el, (court_state.match && set_score) ? _v2_score_for_team(set_score, teams[team_idx], team_idx) : '');
				});
			});
	});
	return true;
}

function render_v2_tournament_overview_dm_display_state(s, dto) {
	if (!s || !s.settings || s.settings.displaymode_style !== 'tournament_overview_dm' || !dto || dto.type !== 'display_multi_state') {
		return false;
	}
	var container = _v2_prepare_full_render_container('tournament_overview_dm');
	if (!container) {
		return false;
	}
	var background = uiu.el(container, 'div', {
		style: 'position:absolute;top:0;left:0;height:100vh;width:100vw;background-color:#000;z-index:10;',
	});
	_v2_tournament_overview_dm_cache = {
		container: container,
		background: background,
		structure_key: _v2_tournament_overview_dm_container_key(s, dto, _v2_multi_colors(s, dto)),
		rows: [],
	};
	_v2_tournament_overview_dm_ordered_court_states(s, dto).forEach(function(court_state, idx, rows) {
		_v2_tournament_overview_dm_cache.rows[idx] = _v2_tournament_overview_dm_render_row(s, background, court_state, idx, rows.length);
	});
	return true;
}

function _v2_clear_native_caches() {
	_v2_tournamentcourt_cache = null;
	_v2_2court_cache = null;
	_v2_oncourt_cache = null;
	_v2_international_cache = null;
	_v2_bwf_cache = null;
	_v2_clean_cache = null;
	_v2_onlyscore_cache = null;
	_v2_giantscore_cache = null;
	_v2_playerstyle_cache = null;
	_v2_tournamentplayers_cache = null;
	_v2_teamcourt_cache = null;
	_v2_andre_cache = null;
	_v2_streamcourt_cache = null;
	_v2_stripes_cache = null;
	_v2_streamcourt_dm_cache = null;
	_v2_top_list_cache = null;
	_v2_teamscore_cache = null;
	_v2_streamteam_cache = null;
	_v2_stream_cache = null;
	_v2_castall_cache = null;
	_v2_tim_cache = null;
	_v2_greyish_cache = null;
	_v2_tournament_overview_cache = null;
	_v2_tournament_overview_dm_cache = null;
}

function _v2_prepare_full_render_container(style) {
	var container = uiu.qs('.displaymode_layout');
	if (!container) {
		return null;
	}
	_v2_clear_native_caches();
	_last_painted_hash = null;
	abort_timers();
	autosize.unmaintain_all(container);
	uiu.empty(container);
	ALL_STYLES.forEach(function(astyle) {
		((astyle === style) ? uiu.addClass : uiu.removeClass)(container, 'd_layout_' + astyle);
	});
	return container;
}

function render_v2_display_state(s, dto) {
	if (!s || !s.settings || !dto) {
		return false;
	}
	if (_is_unassigned_display(s) && dto.type !== 'display_multi_state') {
		return _v2_render_unassigned_display(s);
	}
	if (s.settings.displaymode_style === 'tournamentcourt') {
		return render_v2_tournamentcourt_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'oncourt') {
		return render_v2_oncourt_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'international') {
		return render_v2_international_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'bwf') {
		return render_v2_bwf_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'clean') {
		return render_v2_clean_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'onlyscore') {
		return render_v2_onlyscore_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'giantscore') {
		return render_v2_giantscore_display_state(s, dto);
	}
	if (_v2_is_playerstyle(s.settings.displaymode_style)) {
		return render_v2_playerstyle_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'tournamentplayers') {
		return render_v2_tournamentplayers_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'teamcourt') {
		return render_v2_teamcourt_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'andre') {
		return render_v2_andre_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'streamcourt') {
		return render_v2_streamcourt_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'stripes') {
		return render_v2_stripes_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'streamcourt_dm') {
		return render_v2_streamcourt_dm_display_state(s, dto);
	}
	if (s.settings.displaymode_style === '2court' && dto.type === 'display_multi_state') {
		return render_v2_2court_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'top+list' && dto.type === 'display_multi_state') {
		return render_v2_top_list_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'teamscore' && dto.type === 'display_multi_state') {
		return render_v2_teamscore_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'tim' && dto.type === 'display_multi_state') {
		return render_v2_tim_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'greyish' && dto.type === 'display_multi_state') {
		return render_v2_greyish_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'stream' && dto.type === 'display_multi_state') {
		return render_v2_stream_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'streamteam' && dto.type === 'display_multi_state') {
		return render_v2_streamteam_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'castall' && dto.type === 'display_multi_state') {
		return render_v2_castall_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'tournament_overview' && dto.type === 'display_multi_state') {
		return render_v2_tournament_overview_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'tournament_overview_dm' && dto.type === 'display_multi_state') {
		return _v2_tournament_overview_dm_patch(_v2_tournament_overview_dm_cache, s, dto);
	}
	if (dto.type === 'court_picker_state') {
		return false;
	}
	return false;
}

function render_v2_display_score_update(s, dto) {
	if (!s || !s.settings || !dto) {
		return false;
	}
	if (s.settings.displaymode_style === 'tournamentcourt') {
		return render_v2_tournamentcourt_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'oncourt') {
		return _v2_oncourt_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'international') {
		return _v2_international_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'bwf') {
		return _v2_bwf_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'clean') {
		return _v2_clean_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'onlyscore') {
		return _v2_onlyscore_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'giantscore') {
		return _v2_giantscore_patch(s, dto);
	}
	if (_v2_is_playerstyle(s.settings.displaymode_style)) {
		return _v2_playerstyle_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'tournamentplayers') {
		return _v2_tournamentplayers_patch(s, dto) || render_v2_tournamentplayers_display_state(s, dto);
	}
	if (s.settings.displaymode_style === 'teamcourt') {
		return _v2_teamcourt_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'andre') {
		return _v2_andre_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'streamcourt') {
		return _v2_streamcourt_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'stripes') {
		return _v2_stripes_patch(s, dto);
	}
	if (s.settings.displaymode_style === 'streamcourt_dm') {
		return _v2_streamcourt_dm_patch(s, dto);
	}
	if (s.settings.displaymode_style === '2court' && dto.type === 'display_multi_state') {
		return render_v2_2court_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'top+list' && dto.type === 'display_multi_state') {
		return render_v2_top_list_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'teamscore' && dto.type === 'display_multi_state') {
		return render_v2_teamscore_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'tim' && dto.type === 'display_multi_state') {
		return render_v2_tim_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'greyish' && dto.type === 'display_multi_state') {
		return render_v2_greyish_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'stream' && dto.type === 'display_multi_state') {
		return render_v2_stream_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'streamteam' && dto.type === 'display_multi_state') {
		return render_v2_streamteam_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'castall' && dto.type === 'display_multi_state') {
		return render_v2_castall_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'tournament_overview' && dto.type === 'display_multi_state') {
		return render_v2_tournament_overview_score_update(s, dto);
	}
	if (s.settings.displaymode_style === 'tournament_overview_dm' && dto.type === 'display_multi_state') {
		return _v2_tournament_overview_dm_patch(_v2_tournament_overview_dm_cache, s, dto);
	}
	return false;
}

function update(err, s, event) {
	_last_err = err;
	_v2_tournamentcourt_cache = null;
	_v2_2court_cache = null;
	_v2_oncourt_cache = null;
	_v2_international_cache = null;
	_v2_bwf_cache = null;
	_v2_clean_cache = null;
	_v2_onlyscore_cache = null;
	_v2_giantscore_cache = null;
	_v2_playerstyle_cache = null;
	_v2_tournamentplayers_cache = null;
	_v2_teamcourt_cache = null;
	_v2_andre_cache = null;
	_v2_streamcourt_cache = null;
	_v2_stripes_cache = null;
	_v2_streamcourt_dm_cache = null;
	_v2_top_list_cache = null;
	var container = uiu.qs('.displaymode_layout');
	uiu.remove_qsa('.display_loading,.display_error', container);

	var style = s.settings.displaymode_style;
	if (err && (err.errtype === 'loading')) {
		uiu.el(container, 'div', 'display_loading');
		return;
	}

	if (err) {
		uiu.el(container, 'div', {
			'class': 'display_error',
		}, err.msg);
		return;
	}

	if (!event.courts) {
		uiu.el(container, 'div', 'display_error', s._('displaymode:no courts'));
	}

	// Also update general state
	network.update_event(s, event);
	console.log('[bup] displaymode update', {
		ts: Date.now(),
		court_id: s && s.settings ? s.settings.court_id : null,
		err: err ? (err.msg || err.errtype || String(err)) : null,
		match_states: event && event.matches ? event.matches.map(function(match) {
			return {
				match_id: match && match.setup ? match.setup.match_id : null,
				state: match && match.setup ? match.setup.state : null,
				now_on_court: match && match.setup ? match.setup.now_on_court : null,
				called_timestamp: match && match.setup ? match.setup.called_timestamp : null,
				end_ts: match ? match.end_ts : null,
			};
		}) : [],
	});

	// If nothing has changed we can skip painting
	var cur_event_hash = hash(s.settings, event);
	if (utils.deep_equal(cur_event_hash, _last_painted_hash)) {
		return;
	}

	var ads_container = uiu.qs('.d_ads');
	var changed_courts = (
		!_last_painted_hash || !utils.deep_equal(cur_event_hash.courts, _last_painted_hash.courts));
	_last_painted_hash = cur_event_hash;

	var new_settings_hash = utils.hash_new(_last_settings_hash, s.settings);
	if (new_settings_hash) {
		_last_settings_hash = new_settings_hash;
		dads.d_onconfchange();
	}

	var court_select = uiu.qs('[name="displaymode_court_id"]');
	uiu.visible_qs('.settings_display_court_id', option_applies(style, 'court_id'));
	uiu.visible_qs('.settings_display_reverse_order', option_applies(style, 'reverse_order'));
	uiu.visible_qs('.settings_d_show_pause', option_applies(style, 'show_pause'));
	uiu.visible_qs('.settings_d_show_court_number', option_applies(style, 'show_court_number'));
	uiu.visible_qs('.settings_d_show_competition', option_applies(style, 'show_competition'));
	uiu.visible_qs('.settings_d_show_round', option_applies(style, 'show_round'));
	uiu.visible_qs('.settings_d_show_players', option_applies(style, 'show_players'));
	uiu.visible_qs('.settings_d_show_team_name', option_applies(style, 'show_team_name'));
	uiu.visible_qs('.settings_d_show_middle_name', option_applies(style, 'show_middle_name'));
	uiu.visible_qs('.settings_d_abbreviate_first_name', option_applies(style, 'abbreviate_first_name'));
	uiu.visible_qs('.settings_d_show_doubles_receiving', option_applies(style, 'show_doubles_receiving'));
	uiu.visible_qs('.settings_d_scale', option_applies(style, 'scale'));
	uiu.visible_qs('.settings_d_team_colors', option_applies(style, 'team_colors'));

	if (event.courts && changed_courts) {
		uiu.empty(court_select);
		var empty_attrs = { value: '' };
		if (!s.settings.displaymode_court_id) {
			empty_attrs.selected = 'selected';
		}
		uiu.el(court_select, 'option', empty_attrs, '--');
		event.courts.forEach(function(c) {
			var attrs = {
				value: c.court_id,
			};
			if (s.settings.displaymode_court_id == c.court_id) {
				attrs['selected'] = 'selected';
			}
			uiu.el(court_select, 'option', attrs, c.label || c.description || c.court_id);
		});
	}

	var used_colors = active_colors(s, style);
	uiu.visible_qs('.settings_d_colors', (used_colors.length > 0) || option_applies(style, 'team_colors'));
	var color_inputs = uiu.qs('.settings_d_colors_inputs');
	var ui_colors_state_json = color_inputs.getAttribute('data-json');
	var ui_colors_state = ui_colors_state_json ? JSON.parse(ui_colors_state_json) : '<no info>';
	if (!utils.deep_equal(ui_colors_state, used_colors)) {
		uiu.empty(color_inputs);
		used_colors.forEach(function(uc) {
			var color_input = uiu.el(color_inputs, 'input', {
				type: 'color',
				'data-name': uc, // Not name to prevent it being found by general attaching of event handlers
				title: uc,
				value: s.settings['d_' + uc],
			});
			color_input.addEventListener('change', on_style_change);
		});
		color_inputs.setAttribute('data-json', JSON.stringify(used_colors));
	}

	// Redraw everything
	abort_timers();
	autosize.unmaintain_all(container);
	uiu.empty(container);

	ALL_STYLES.forEach(function(astyle) {
		((astyle === style) ? uiu.addClass : uiu.removeClass)(container, 'd_layout_' + astyle);
	});

	if (_is_unassigned_display(s) && !(event && event.v2_multi_state)) {
		dads.d_onmatchchange(s, ads_container, false);
		_render_unassigned_display(s, container);
		return;
	}

	if (! event.courts) {
		return;
	}

	var xfunc = {
		andre: render_andre,
		bwf: render_bwf,
		bwfonlyplayers: render_bwfonlyplayers,
		clean: render_clean,
		clubplayers: render_clubplayers,
		clubplayerslr: render_clubplayerslr,
		giantscore: render_giantscore,
		international: render_international,
		oncourt: render_oncourt,
		onlyplayers: render_onlyplayers,
		onlyscore: render_onlyscore,
		stripes: render_stripes,
		teamcourt: render_teamcourt,
		tournamentcourt: render_tournamentcourt,
		tournamentplayers: render_tournamentplayers,
	}[style];
	if (xfunc) {
		var court = _render_court(s, container, event);
		if (!court) {
			dads.d_onmatchchange(s, ads_container, false);
			return;
		}

		var match = _match_by_court(event, court);
		var colors = calc_colors(s.settings, event, match);

		dads.d_onmatchchange(s, ads_container, match);

		if (!match || (event.courtspot_version && (!match.setup.teams || !match.setup.teams[0].players.length))) {
			var nomatch_el = uiu.el(container, 'div', {
				'class': 'd_nomatch',
				style: (
					'color:' + (event.tournament_logo_foreground_color || colors.fg2) + ';' +
					'background:' + (event.tournament_logo_background_color || '#000') + ';'
				),
			});

			/*
			// background for colors
			for (var team_id = 0;team_id < 2;team_id++) {
				uiu.el(nomatch_el, 'div', {
					style: (
						'background:' + colors['b' + team_id] + ';z-index:-1;' +
						'position:absolute;width:100%;height:50%;top:' + (team_id * 50) + '%;'
					),
				});
			}
			*/

			var _render_team_name = function(team_id) {
				uiu.el(nomatch_el, 'div', {
					style: (
						'font-size:16vmin;text-align:center;' +
						'color:' + colors[team_id] + ';' +
						'margin-' + ((team_id === 0) ? 'bottom' : 'top') + ':8vmin;'
					),
				}, event.team_names[team_id]);
			};

			var is_team = event.team_competition;
			if (is_team) {
				_render_team_name(0);
			} else if (event.tournament_logo_url) {
				uiu.el(nomatch_el, 'img', {
					src: event.tournament_logo_url,
					style: 'max-height: 70vh; max-width: 90vw; height:70vh;',
					alt: (event.tournament_name || ''),
				});
		
			} else {
				var tname = event.tournament_name;
				if (tname) {
					uiu.el(nomatch_el, 'div', {
						style: (
							'font-size:16vmin;text-align:center;'
						),
					}, tname);
				}
			}
			uiu.el(nomatch_el, 'div', {
				style: (
					'font-size:22vmin;'
				),
			}, s._('Court') + ' ' + (court.label || court.num || court.court_id));
			if (is_team) {
				_render_team_name(1);
			}
			return;
		}

		xfunc(s, container, event, court, match, colors);
		return;
	}

	dads.d_onmatchchange(s, ads_container, false);

	var ofunc = {
		'2court': render_2court,
		castall: render_castall,
		greyish: render_greyish,
		tournament_overview: render_tournament_overview,
		tournament_overview_dm: render_tournament_overview_dm,
		tim: render_tim,
		teamscore: render_teamscore,
		stream: render_stream,
		streamcourt: render_streamcourt,
		streamcourt_dm: render_streamcourt_dm,
		streamteam: render_streamteam,
	}[style];
	if (ofunc) {
		var o_colors = calc_colors(s.settings, event);
		ofunc(s, container, event, o_colors);
		return;
	}

	// Default: top+list
	render_top_list(s, container, event);
}
function on_style_change(s) {
	if (s.ui && s.ui.displaymode_visible) {
		update(_last_err, s, s.event);
	}

	ALL_COLORS.forEach(function(col_name) {
		var input = document.querySelector('.settings_d_colors_inputs [data-name="' + col_name + '"]');
		var col = s.settings['d_' + col_name];
		if (input && (input.value !== col)) {
			input.value = col;
		}
	});
	network.reload_match_information();
}

var _cancel_updates = null;
function show(params) {
	if (state.ui.displaymode_visible) {
		return;
	}

	state.ui.displaymode_visible = true;
	refmode_referee_ui.hide();
	render.hide();
	settings.hide(true, true);
	settings.on_mode_change(state);
	if (params && params.show_settings) {
		settings.show_displaymode();
	}

	control.set_current(state);
	uiu.show_qs('.displaymode_layout');
	dads.d_onconfchange();
	uiu.addClass_qs('.settings_layout', 'settings_layout_displaymode');

	update({
		errtype: 'loading',
	}, state);

	_cancel_updates = network.subscribe(state, update, function(s) {
		return s.settings.displaymode_update_interval;
	});
}

function hide() {
	if (! state.ui.displaymode_visible) {
		return;
	}

	settings.hide_displaymode();
	if (_cancel_updates) {
		_cancel_updates();
	}

	var container = uiu.qs('.displaymode_layout');
	autosize.unmaintain_all(container);
	uiu.empty(container);
	uiu.hide(container);
	dads.d_hide(uiu.qs('.d_ads'));
	_last_painted_hash = null;

	uiu.removeClass_qs('.settings_layout', 'settings_layout_displaymode');
	state.ui.displaymode_visible = false;
	settings.on_mode_change(state);
}

function advance_style(s, direction) {
	if (!state.ui.displaymode_visible) {
		return;
	}
	var idx = ALL_STYLES.indexOf(s.settings.displaymode_style) + direction;
	var len = ALL_STYLES.length;
	if (idx >= len) {
		idx -= len;
	}
	if (idx < 0) {
		idx += len;
	}
	s.settings.displaymode_style = ALL_STYLES[idx];
	settings.update(s);
	on_style_change(s);
	settings.store(s);
}

function ui_init(s, hash_query) {
	if (hash_query.dm_style) {
		s.settings.displaymode_style = hash_query.dm_style;
		settings.update(s);
	}
	if (hash_query.show_pause) {
		settings.change(s, 'd_show_pause', (hash_query.show_pause === 'true'));
	}
	if (hash_query.show_court_number) {
		settings.change(s, 'd_show_court_number', (hash_query.show_court_number === 'true'));
	}
	if (hash_query.show_competition) {
		settings.change(s, 'd_show_competition', (hash_query.show_competition === 'true'));
	}
	if (hash_query.show_round) {
		settings.change(s, 'd_show_round', (hash_query.show_round === 'true'));
	}
	if (hash_query.show_players) {
		settings.change(s, 'd_show_players', (hash_query.show_players === 'true'));
	}
	if (hash_query.show_team_name) {
		settings.change(s, 'd_show_team_name', (hash_query.show_team_name === 'true'));
	}
	if (hash_query.show_middle_name) {
		settings.change(s, 'd_show_middle_name', (hash_query.show_middle_name === 'true'));
	}
	if (hash_query.abbreviate_first_name) {
		settings.change(s, 'd_abbreviate_first_name', (hash_query.abbreviate_first_name === 'true'));
	}
	if (hash_query.show_doubles_receiving) {
		settings.change(s, 'd_show_doubles_receiving', (hash_query.show_doubles_receiving === 'true'));
	}
	if (hash_query.team_colors) {
		settings.change(s, 'd_team_colors', (hash_query.team_colors === 'true'));
	}
	ALL_COLORS.forEach(function(col_name) {
		var k = 'd_' + col_name;
		var v = hash_query[k];
		if (!v) return;
		var m = /^#?([0-9a-fA-F]{3,6})$/.exec(v);
		if (m) {
			settings.change(s, k, '#' + m[1]);
		}
	});

	var cur_style = s.settings.displaymode_style;
	uiu.qsEach('select[name="displaymode_style"]', function(select) {
		ALL_STYLES.forEach(function(style_id) {
			var i18n_id = 'displaymode|' + style_id;
			var attrs = {
				'data-i18n': i18n_id,
				value: style_id,
			};
			if (style_id === cur_style) {
				attrs.selected = 'selected';
			}
			uiu.el(select, 'option', attrs, s._(i18n_id));
		});
	});

	Mousetrap.bind('left', function() {
		advance_style(s, -1);
	});
	Mousetrap.bind('right', function() {
		advance_style(s, 1);
	});

	if ((hash_query.neversettings === undefined) && !(s && s.settings && s.settings.neversettings)) {
		click.qs('.displaymode_layout', function() {
			settings.show_displaymode();
		});
		click.qs('.d_ads', function() {
			settings.show_displaymode();
		});
	}
	click.qs('.settings_mode_display', function() {
		show();
	});
	click.qs('.d_hide_settings', function() {
		settings.hide_displaymode();
	});

	var d_container = uiu.qs('.displaymode_layout');
	d_container.addEventListener('mousemove', show_cursor);
	var ads_container = uiu.qs('.d_ads');
	ads_container.addEventListener('mousemove', show_cursor);
}

function active_colors(s, style_id) {
	var res = [];
	ALL_COLORS.forEach(function(col) {
		if (option_applies(style_id, col) &&
				!(s.settings.d_team_colors && utils.includes(['c0', 'cb0', 'c1', 'cb1'], col))) {
			res.push(col);
		}
	});
	return res;
}

function option_applies(style_id, option_name) {
	var BY_STYLE = {
		'2court': ['court_id', 'team_colors', 'c0', 'cb0', 'c1', 'cb1', 'cfg', 'cexp', 'reverse_order', 'show_pause', 'show_court_number', 'show_competition', 'show_round', 'show_players', 'show_middle_name', 'abbreviate_first_name', 'show_doubles_receiving'],
		'top+list': ['reverse_order', 'cbg', 'cserv2', 'crecv', 'cfg', 'cfg3'],
		andre: ['court_id', 'cfg', 'cbg', 'cfg2'],
		bwf: ['court_id', 'team_colors', 'c0', 'c1', 'cfg', 'cbg'],
		castall: ['court_id', 'team_colors', 'c0', 'c1', 'cfg', 'cbg', 'cbg2', 'ct', 'cserv', 'crecv', 'reverse_order', 'scale'],
		clubplayers: ['court_id', 'team_colors', 'c0', 'c1', 'cbg'],
		giantscore: ['court_id', 'team_colors', 'c0', 'cb0', 'c1', 'cb1'],
		clubplayerslr: ['court_id', 'team_colors', 'c0', 'c1', 'cbg'],
		greyish: ['cbg', 'cbg2', 'cbg3', 'cfg'],
		international: ['court_id', 'team_colors', 'c0', 'c1', 'cfg', 'cbg'],
		clean: ['court_id', 'team_colors', 'c0', 'c1', 'cfg', 'cbg'],
		oncourt: ['court_id', 'cfg', 'cfg3', 'cbg', 'cserv2'],
		bwfonlyplayers: ['court_id', 'c0', 'c1', 'cb0', 'cb1'],
		onlyplayers: ['court_id', 'team_colors', 'c0', 'cb0', 'c1', 'cb1'],
		onlyscore: ['court_id', 'team_colors', 'c0', 'cb0', 'c1', 'cb1'],
		stream: ['court_id', 'reverse_order'],
		streamcourt: ['court_id'],
		streamcourt_dm: ['court_id'],
		streamteam: ['team_colors', 'c0', 'cb0', 'c1', 'cb1', 'cfg', 'cbg'],
		teamcourt: ['court_id', 'team_colors', 'c0', 'cb0', 'c1', 'cb1', 'cfg', 'cfg2', 'show_pause'],
		tournamentcourt: ['court_id', 'team_colors', 'c0', 'cb0', 'c1', 'cb1', 'cfg', 'cfg2', 'cexp', 'show_pause', 'show_court_number', 'show_competition', 'show_round', 'show_middle_name', 'abbreviate_first_name', 'show_doubles_receiving'],
		tournamentplayers: ['court_id', 'team_colors', 'c0', 'cb0', 'c1', 'cb1', 'cfg', 'cfg2', 'cexp', 'show_pause', 'show_court_number', 'show_competition', 'show_round', 'show_middle_name', 'abbreviate_first_name', 'show_doubles_receiving'],
		teamscore: ['team_colors', 'c0', 'c1', 'cfg', 'cbg'],
		tim: ['cbg', 'cfg', 'ctim_blue', 'ctim_active'],
		tournament_overview: ['cfg', 'cbg', 'cbg3', 'cborder', 'cfg2'],
		tournament_overview_dm: ['cfg', 'cbg', 'cbg3', 'cborder', 'cfg2', 'tournament_overview_courts'],
		stripes: ['court_id', 'cbg', 'team_colors', 'c0', 'c1', 'cfg', 'cfgdark', 'cbg4', 'cserv', 'show_team_name', 'show_middle_name', 'abbreviate_first_name'],
		umpire: ['fullscreen_ask', 'shuttle_counter', 'show_announcements', 'negative_timers', 'editmode_doubleclick', 'click_mode', 'button_block_timeout', 'network_timeout', 'network_update_interval', 'style'],
	};
	var bs = BY_STYLE[style_id];
	if (bs) {
		return utils.includes(bs, option_name);
	}
}

return {
	show: show,
	hide: hide,
	ui_init: ui_init,
	on_style_change: on_style_change,
	option_applies: option_applies,
	ALL_STYLES: ALL_STYLES,
	MULTI_COURT_STYLES: MULTI_COURT_STYLES,
	FIELDLESS_MULTI_COURT_STYLES: FIELDLESS_MULTI_COURT_STYLES,
	ALL_COLORS: ALL_COLORS,
	calc_team_colors: calc_team_colors,
	// Testing only
	calc_colors: calc_colors,
	determine_server: determine_server,
	extract_netscore: extract_netscore,
	render_v2_display_state: render_v2_display_state,
	render_v2_display_score_update: render_v2_display_score_update,
	render_v2_tournamentcourt_display_state: render_v2_tournamentcourt_display_state,
	render_v2_tournamentcourt_score_update: render_v2_tournamentcourt_score_update,
	render_castall: render_castall,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var autosize = require('./autosize');
	var calc = require('./calc');
	var click = require('./click');
	var control = require('./control');
	var compat = require('./compat');
	var dads = null; // break cycle, should be require('./dads');
	var eventutils = require('./eventutils');
	var extradata = require('./extradata');
	var network = require('./network');
	var render = require('./render');
	var refmode_referee_ui = null; // break cycle, should be require('./refmode_referee_ui');
	var settings = require('./settings');
	var timer = require('./timer');
	var uiu = require('./uiu');
	var utils = require('./utils');

	module.exports = displaymode;
}
/*/@DEV*/
