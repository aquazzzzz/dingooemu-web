"""LAN-only signaling. Media remains peer-to-peer; only trusted identities persist."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import threading
import time


class SignalingError(Exception):
    pass


class LanSignaling:
    def __init__(self, state_file):
        self.path = Path(state_file)
        self.changed = threading.Condition()
        self.revision = 0
        self.codes = {}
        self.calls = {}
        self.seen = {}
        self.attempts = {}
        self.hosts = {}
        if self.path.exists():
            data = json.loads(self.path.read_text())
            if data.get('version') != 1:
                raise ValueError('Unsupported LAN pairing state')
            self.hosts = data['hosts']

    @staticmethod
    def key(token):
        if not isinstance(token, str) or len(token) != 64:
            raise SignalingError('unauthorized')
        return hashlib.sha256(token.encode()).hexdigest()

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix('.tmp')
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as out:
            json.dump({'version': 1, 'hosts': self.hosts}, out)
        os.replace(temp, self.path)

    def notify(self):
        self.revision += 1
        self.changed.notify_all()

    def identity(self, token):
        key = self.key(token)
        if key in self.hosts:
            return key, None
        for host, data in self.hosts.items():
            for device in data['devices']:
                if device['key'] == key:
                    return host, device
        raise SignalingError('unauthorized')

    def expire(self):
        now = time.monotonic()
        self.codes = {c: v for c, v in self.codes.items() if v[1] > now}
        self.attempts = {ip: v for ip, v in self.attempts.items() if v[1] > now}
        for host, call in list(self.calls.items()):
            if now - call['updated'] > (65 if call['state'] == 'connected' else 300):
                del self.calls[host]
                self.notify()

    def snapshot(self, host, device):
        call = self.calls.get(host)
        result = {'kind': 'receiver' if device else 'host', 'revision': self.revision}
        if device:
            result['approved'] = device['approved']
            result['device'] = device['id']
            if call and call['device'] == device['id']:
                result['call'] = {k: v for k, v in call.items() if k != 'updated'}
        else:
            result['devices'] = [{k: d[k] for k in ['id', 'approved']} for d in self.hosts[host]['devices']]
            result['code'] = next((c for c, v in self.codes.items() if v[0] == host), None)
            if call:
                result['call'] = {k: v for k, v in call.items() if k != 'updated'}
        return result

    def request(self, body, address='local'):
        if not isinstance(body, dict):
            raise SignalingError('invalid_request')
        with self.changed:
            self.expire()
            op = body.get('op')
            if op == 'register':
                if len(self.hosts) >= 16:
                    raise SignalingError('capacity')
                token = secrets.token_hex(32)
                self.hosts[self.key(token)] = {'devices': []}
                self.save()
                self.notify()
                return {'token': token}
            if op == 'pair':
                now = time.monotonic()
                count, until = self.attempts.get(address, (0, now + 60))
                if count >= 10 or (address not in self.attempts and len(self.attempts) >= 1024):
                    raise SignalingError('rate_limited')
                self.attempts[address] = (count + 1, until)
                code = body.get('code')
                if not isinstance(code, str) or code not in self.codes:
                    raise SignalingError('invalid_code')
                host = self.codes[code][0]
                if len(self.hosts[host]['devices']) >= 8:
                    raise SignalingError('capacity')
                token = secrets.token_hex(32)
                self.hosts[host]['devices'].append({'id': secrets.token_hex(8), 'key': self.key(token), 'approved': False})
                del self.codes[code]  # One invitation, one device; host approval follows.
                self.save()
                self.notify()
                return {'token': token}
            host, device = self.identity(body.get('token'))
            self.seen[host if device is None else device['key']] = time.monotonic()
            if op == 'poll':
                cursor = body.get('revision', -1)
                wait = body.get('wait', 0)
                if not isinstance(wait, (int, float)) or not 0 <= wait <= 20:
                    raise SignalingError('invalid_request')
                if cursor == self.revision and wait:
                    self.changed.wait(timeout=wait)
                    # Approval/revocation can occur while this lock is released.
                    host, device = self.identity(body.get('token'))
                    self.expire()
                call = self.calls.get(host)
                if call and call['state'] == 'connected' and device is None:
                    call['updated'] = time.monotonic()
                return self.snapshot(host, device)
            if op == 'invite' and device is None:
                self.codes = {c: v for c, v in self.codes.items() if v[0] != host}
                while True:
                    code = f'{secrets.randbelow(1000000):06d}'
                    if code not in self.codes:
                        break
                self.codes[code] = (host, time.monotonic() + 600)
            elif op in ('approve', 'revoke') and device is None:
                target = next((d for d in self.hosts[host]['devices'] if d['id'] == body.get('device')), None)
                if target is None:
                    raise SignalingError('invalid_request')
                if op == 'approve':
                    target['approved'] = True
                else:
                    self.hosts[host]['devices'].remove(target)
                    if self.calls.get(host, {}).get('device') == target['id']:
                        self.calls.pop(host, None)
                self.save()
            elif op == 'forget':
                if device:
                    self.hosts[host]['devices'].remove(device)
                    if self.calls.get(host, {}).get('device') == device['id']:
                        self.calls.pop(host, None)
                else:
                    del self.hosts[host]
                    self.calls.pop(host, None)
                    self.codes = {c: v for c, v in self.codes.items() if v[0] != host}
                self.save()
                self.notify()
                return {'forgotten': True}
            elif op == 'connect' and device and device['approved']:
                if time.monotonic() - self.seen.get(host, -100) > 40:
                    raise SignalingError('host_offline')
                if host in self.calls:
                    raise SignalingError('host_busy')
                self.calls[host] = {'id': secrets.token_hex(16), 'device': device['id'], 'state': 'requested', 'updated': time.monotonic()}
            elif op in ('offer', 'answer', 'finish', 'cancel'):
                call = self.calls.get(host)
                if not call or call['id'] != body.get('session'):
                    raise SignalingError('stale_session')
                if device and (not device['approved'] or device['id'] != call['device']):
                    raise SignalingError('unauthorized')
                if op == 'cancel':
                    del self.calls[host]
                elif op == 'finish' and device is None and call['state'] == 'answered':
                    call['state'] = 'connected'
                    call.pop('offer', None)
                    call.pop('answer', None)
                elif ((op == 'offer' and device is None and call['state'] == 'requested') or
                      (op == 'answer' and device and call['state'] == 'offered')):
                    text = body.get('text')
                    if not isinstance(text, str) or len(text) > 64000:
                        raise SignalingError('invalid_request')
                    try:
                        pairing = json.loads(text)
                    except ValueError:
                        raise SignalingError('invalid_request') from None
                    if not isinstance(pairing, dict) or pairing.get('app') != 'dingoo-stream' or pairing.get('version') != 1 or pairing.get('session') != call['id'] or pairing.get('type') != op or not isinstance(pairing.get('sdp'), str) or len(pairing['sdp']) > 60000:
                        raise SignalingError('invalid_request')
                    call[op] = text
                    call['state'] = 'offered' if op == 'offer' else 'answered'
                else:
                    raise SignalingError('invalid_request')
                if host in self.calls:
                    call['updated'] = time.monotonic()
            else:
                raise SignalingError('unauthorized')
            self.notify()
            return self.snapshot(host, device)
