"""Small LAN-only STUN Binding service (RFC 8489); never relays media."""
import ipaddress
import socket
import struct
import threading
import time
import zlib

COOKIE = 0x2112A442


def binding_reply(packet, address):
    if not 20 <= len(packet) <= 1200:
        return None
    kind, length, cookie = struct.unpack('!HHI', packet[:8])
    if kind != 1 or cookie != COOKIE or length % 4 or len(packet) != 20 + length:
        return None
    ip = ipaddress.ip_address(address[0])
    if ip.version != 4 or not (ip.is_private or ip.is_loopback) or ip.is_unspecified:
        return None
    offset = 20
    while offset < len(packet):
        if offset + 4 > len(packet):
            return None
        attribute, size = struct.unpack('!HH', packet[offset:offset + 4])
        offset += 4 + ((size + 3) // 4) * 4
        if offset > len(packet) or attribute < 0x8000:
            # No credentials, ICE checks or unknown required attributes.
            return None
    mapped = struct.pack('!HHBBHI', 0x0020, 8, 0, 1,
                         address[1] ^ (COOKIE >> 16), int(ip) ^ COOKIE)
    response = struct.pack('!HHI', 0x0101, len(mapped) + 8, COOKIE) + packet[8:20] + mapped
    return response + struct.pack('!HHI', 0x8028, 4, zlib.crc32(response) ^ 0x5354554E)


def lan_address(local):
    """Use the HTTP socket's interface; localhost needs the default LAN route."""
    if local not in ('127.0.0.1', '0.0.0.0'):
        return local
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            # connect selects an interface but sends no packet.
            probe.connect(('192.0.2.1', 9))
            address = probe.getsockname()[0]
            if ipaddress.ip_address(address).is_private:
                return address
    except OSError:
        pass
    return '127.0.0.1'


class LanStun:
    def __init__(self, host, port):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            self.socket.bind((host, port))
        except OSError:
            self.socket.close()
            raise
        self.port = self.socket.getsockname()[1]
        self.host = self.socket.getsockname()[0]
        self.socket.settimeout(.5)
        self.stopped = threading.Event()
        self.thread = threading.Thread(target=self.serve, daemon=True)
        self.thread.start()

    def serve(self):
        limits = {}
        while not self.stopped.is_set():
            try:
                packet, address = self.socket.recvfrom(1201)
                now = time.monotonic()
                limits = {key: value for key, value in limits.items() if value[1] > now}
                count, until = limits.get(address[0], (0, now + 5))
                if count >= 100 or (address[0] not in limits and len(limits) >= 1024):
                    continue
                limits[address[0]] = (count + 1, until)
                reply = binding_reply(packet, address)
                if reply:
                    self.socket.sendto(reply, address)
            except socket.timeout:
                continue
            except (OSError, ValueError):
                if self.stopped.is_set():
                    return

    def close(self):
        self.stopped.set()
        self.socket.close()
        self.thread.join(timeout=1)
