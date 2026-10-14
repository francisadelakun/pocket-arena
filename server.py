"""
Pocket Arena — Local High-Performance Tactical Game Server (server.py)
Provides zero-dependency static file serving + fast local room relay API over HTTP.
Works seamlessly across PC, Laptops, and Mobile phones over Hotspot / Wi-Fi.
"""

import http.server
import socketserver
import json
import urllib.parse
import os
import sys
import time

PORT = int(os.environ.get('PORT', 8000))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Active Game Rooms in memory
# Key: 4-character room code (e.g. 'T9QF')
ROOMS = {}

PLAYER_COLORS = ['#00F0FF', '#FF2A6D', '#FFDF00', '#05D9E8']

class ArenaRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Suppress spammy polling logs, only log important actions
        if '/api/room/sync' not in self.path and '/api/room/input' not in self.path:
            super().log_message(format, *args)

    def end_headers(self):
        # Enable CORS for cross-device mobile hotspot access & disable caching
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, status_code, data):
        payload = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def parse_body(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length <= 0:
                return {}
            raw = self.rfile.read(length).decode('utf-8')
            return json.loads(raw)
        except Exception:
            return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # API: Room Status (Lobby polling)
        if path == '/api/room/status':
            code = query.get('code', [''])[0].upper().strip()
            if not code or code not in ROOMS:
                return self.send_json(404, {'ok': False, 'error': f'Room [{code}] not found.'})
            r = ROOMS[code]
            return self.send_json(200, {
                'ok': True,
                'meta': r['meta'],
                'players': r['players'],
                'events': r['events'][-10:]
            })

        # API: Game Sync (High-frequency gameplay sync)
        if path == '/api/room/sync':
            code = query.get('code', [''])[0].upper().strip()
            player_id = query.get('playerId', [''])[0]
            if not code or code not in ROOMS:
                return self.send_json(404, {'ok': False, 'error': f'Room [{code}] not found.'})
            r = ROOMS[code]
            is_host = (r['meta'].get('hostId') == player_id)

            resp = {
                'ok': True,
                'meta': r['meta'],
                'players': r['players'],
                'world': r.get('world'),
                'events': r['events'][-10:]
            }
            if is_host:
                resp['inputs'] = r.get('inputs', {})
            return self.send_json(200, resp)

        # Fallback to standard static file server (index.html, game.js, etc.)
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        # API: Create Room
        if path == '/api/room/create':
            code = body.get('code', '').upper().strip()
            player = body.get('player', {})
            if not code:
                return self.send_json(400, {'ok': False, 'error': 'Missing room code.'})

            player_id = player.get('id', 'p_host')
            player_data = {
                'id': player_id,
                'name': player.get('name', 'Leader'),
                'avatar': player.get('avatar', '🪖'),
                'color': PLAYER_COLORS[0],
                'vaultIndex': 0,
                'keysCarried': 0,
                'depositedKeys': 0,
                'joinedAt': int(time.time() * 1000),
                'alive': True,
                'hp': 100,
                'shield': 50,
                'weapon': 'pistol',
                'ammo': -1,
                'reserveAmmo': -1,
                'kills': 0,
                'deaths': 0,
                'shotsFired': 0,
                'shotsHit': 0,
                'damageTaken': 0,
                'lastSeen': int(time.time() * 1000)
            }

            ROOMS[code] = {
                'code': code,
                'meta': {
                    'hostId': player_id,
                    'state': 'lobby',
                    'startedAt': int(time.time() * 1000),
                    'createdAt': int(time.time() * 1000)
                },
                'players': {
                    player_id: player_data
                },
                'inputs': {},
                'world': None,
                'events': [{
                    'type': 'taunt',
                    'text': f'👑 Room [{code}] created! Squad briefing initiated.',
                    'ts': int(time.time() * 1000)
                }],
                'created_at': time.time()
            }

            print(f"[Server] 👑 Room [{code}] created by {player_data['name']} ({player_id})")
            return self.send_json(200, {
                'ok': True,
                'code': code,
                'slotIndex': 0,
                'meta': ROOMS[code]['meta'],
                'players': ROOMS[code]['players']
            })

        # API: Join Room
        if path == '/api/room/join':
            code = body.get('code', '').upper().strip()
            player = body.get('player', {})
            if not code or code not in ROOMS:
                return self.send_json(404, {'ok': False, 'error': f'Room [{code}] does not exist.'})

            r = ROOMS[code]
            player_id = player.get('id', '')
            existing_players = r['players']
            is_rejoining = player_id in existing_players

            if not is_rejoining and len(existing_players) >= 4:
                return self.send_json(403, {'ok': False, 'error': f'Room [{code}] is full (4/4 operatives).'})

            if not is_rejoining and r['meta'].get('state') != 'lobby':
                return self.send_json(403, {'ok': False, 'error': f'Room [{code}] is already in battle!'})

            slot_index = list(existing_players.keys()).index(player_id) if is_rejoining else len(existing_players)
            assigned_color = PLAYER_COLORS[slot_index % len(PLAYER_COLORS)]

            player_data = {
                'id': player_id,
                'name': player.get('name', f'Operative {slot_index + 1}'),
                'avatar': player.get('avatar', '🪖'),
                'color': assigned_color,
                'vaultIndex': slot_index % 4,
                'keysCarried': 0,
                'depositedKeys': 0,
                'joinedAt': int(time.time() * 1000),
                'alive': True,
                'hp': 100,
                'shield': 50,
                'weapon': 'pistol',
                'ammo': -1,
                'reserveAmmo': -1,
                'kills': 0,
                'deaths': 0,
                'shotsFired': 0,
                'shotsHit': 0,
                'damageTaken': 0,
                'lastSeen': int(time.time() * 1000)
            }

            r['players'][player_id] = player_data
            r['events'].append({
                'type': 'taunt',
                'text': f"🎯 {player_data['name']} joined the squad! ({len(r['players'])}/4)",
                'ts': int(time.time() * 1000)
            })

            print(f"[Server] 🎯 {player_data['name']} ({player_id}) joined room [{code}] ({len(r['players'])}/4)")

            return self.send_json(200, {
                'ok': True,
                'code': code,
                'slotIndex': slot_index,
                'meta': r['meta'],
                'players': r['players']
            })

        # API: Client Input Stream
        if path == '/api/room/input':
            code = body.get('code', '').upper().strip()
            player_id = body.get('playerId', '')
            inp = body.get('input', {})
            if code in ROOMS:
                ROOMS[code]['inputs'][player_id] = inp
            return self.send_json(200, {'ok': True})

        # API: Host World State Snapshot
        if path == '/api/room/world':
            code = body.get('code', '').upper().strip()
            world = body.get('world')
            if code in ROOMS:
                ROOMS[code]['world'] = world
            return self.send_json(200, {'ok': True})

        # API: Set Room State (countdown, playing, ended)
        if path == '/api/room/state':
            code = body.get('code', '').upper().strip()
            state = body.get('state', 'lobby')
            extra = body.get('extraMeta', {})
            if code in ROOMS:
                ROOMS[code]['meta']['state'] = state
                ROOMS[code]['meta'].update(extra)
            return self.send_json(200, {'ok': True, 'meta': ROOMS[code]['meta']})

        # API: Add Dummy Bot (Host action)
        if path == '/api/room/add_bot':
            code = body.get('code', '').upper().strip()
            if code in ROOMS:
                r = ROOMS[code]
                if len(r['players']) < 4:
                    bot_count = len([k for k in r['players'] if k.startswith('bot_')])
                    bot_id = f"bot_{bot_count + 1}"
                    bot_names = ['Delta-Bot', 'Viper-Bot', 'Ghost-Bot', 'Havoc-Bot']
                    slot_index = len(r['players'])
                    bot_data = {
                        'id': bot_id,
                        'name': bot_names[bot_count % len(bot_names)],
                        'avatar': '🤖',
                        'color': PLAYER_COLORS[slot_index % len(PLAYER_COLORS)],
                        'vaultIndex': slot_index % 4,
                        'keysCarried': 0,
                        'depositedKeys': 0,
                        'joinedAt': int(time.time() * 1000),
                        'alive': True,
                        'hp': 100,
                        'shield': 50,
                        'weapon': 'pistol',
                        'ammo': -1,
                        'reserveAmmo': -1,
                        'kills': 0,
                        'deaths': 0,
                        'shotsFired': 0,
                        'shotsHit': 0,
                        'damageTaken': 0,
                        'isBot': True,
                        'lastSeen': int(time.time() * 1000)
                    }
                    r['players'][bot_id] = bot_data
                    r['events'].append({
                        'type': 'taunt',
                        'text': f"🤖 {bot_data['name']} entered the combat zone!",
                        'ts': int(time.time() * 1000)
                    })
                    return self.send_json(200, {'ok': True, 'players': r['players']})
            return self.send_json(400, {'ok': False, 'error': 'Could not add bot.'})

        # API: Broadcast Event
        if path == '/api/room/event':
            code = body.get('code', '').upper().strip()
            event = body.get('event', {})
            if code in ROOMS:
                ROOMS[code]['events'].append(event)
            return self.send_json(200, {'ok': True})

        # API: Leave Room
        if path == '/api/room/leave':
            code = body.get('code', '').upper().strip()
            player_id = body.get('playerId', '')
            if code in ROOMS:
                if player_id in ROOMS[code]['players']:
                    del ROOMS[code]['players'][player_id]
                if len(ROOMS[code]['players']) == 0:
                    del ROOMS[code]
            return self.send_json(200, {'ok': True})

        return self.send_json(404, {'ok': False, 'error': 'Endpoint not found.'})

class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    server_address = ('0.0.0.0', PORT)
    with ThreadingTCPServer(server_address, ArenaRequestHandler) as httpd:
        print(f"=====================================================")
        print(f"⚔️ POCKET ARENA SERVER RUNNING ON PORT {PORT}")
        print(f"👉 Local PC:        http://localhost:{PORT}/")
        print(f"👉 Mobile Hotspot:  http://10.135.161.61:{PORT}/")
        print(f"=====================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.server_close()
