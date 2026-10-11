#!/usr/bin/env python3
"""Pack the selected upstream XMB, sound and Neo RetroPad assets for the web."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile


def web_retropad(content):
    """Keep upstream skins/layout switching, with only the Dingoo controls."""
    text = content.decode()
    removed = {'l', 'l2', 'l3', 'r', 'r2', 'r3', 'select', 'start'}
    output = []
    counts = {}
    for line in text.splitlines():
        match = re.match(r'overlay(\d+)_desc(\d+)(\w*)\s*=\s*(.*)', line)
        if match:
            page, old, suffix, value = match.groups()
            if not suffix:
                buttons = value.strip('"').split(',')[0].split('|')
                keep = not any(button in removed for button in buttons)
                if keep:
                    new = counts.get(page, 0)
                    counts[page] = new + 1
                    if int(page) >= 4 and buttons[0] not in ('overlay_next', 'toggle_fast_forward'):
                        fields = value.strip('"').split(',')
                        fields[2] = f'{float(fields[2]) + 0.12:.8f}'
                        value = '"' + ','.join(fields) + '"'
            if keep:
                output.append(f'overlay{page}_desc{new}{suffix} = {value}')
        elif not re.match(r'#?overlay\d+_desc\d+', line):
            output.append(line)
    text = '\n'.join(output)
    text = re.sub(r'overlay(\d+)_descs = \d+',
                  lambda m: f'overlay{m[1]}_descs = {counts[m[1]]}', text)
    # Screen coordinates, independent of the overlay's automatic image scaling.
    # Hidden and analog portrait pages use the same game area when switching.
    for page in range(4, 8):
        # Auto-scaling must anchor controls to the lower edge on tall phones,
        # rather than shrinking their layout back towards the screen centre.
        text = text.replace(f'overlay{page}_block_y_separation = true',
                            f'overlay{page}_block_y_separation = false')
        text += f'\noverlay{page}_auto_y_separation = true\n'
        text += f'\noverlay{page}_viewport = "0,0,1,0.48"\n'
    return ('# Website adaptation: no shoulder/Select/Start buttons; upper portrait game area.\n'
            + text + '\n').encode()


root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('bundle', type=Path, help='bundle.zip or directory of bundle.zip.* parts')
args = parser.parse_args()
parts = sorted(args.bundle.glob('bundle.zip.*')) if args.bundle.is_dir() else [args.bundle]
archive = zipfile.ZipFile(io.BytesIO(b''.join(part.read_bytes() for part in parts)))
prefixes = ('bundle/assets/xmb/monochrome/png/', 'bundle/assets/sounds/',
            'bundle/overlays/gamepads/neo-retropad/img/default/')
preset = 'bundle/overlays/gamepads/neo-retropad/neo-retropad.cfg'
data = bytearray()
entries = []
for name in sorted(archive.namelist()):
    if name.endswith('/') or not (name == preset or name in ('bundle/assets/COPYING','bundle/overlays/COPYING') or name.startswith(prefixes)):
        continue
    content = archive.read(name)
    if name == preset:
        content = web_retropad(content)
    entries.append([name, len(data), len(content)])
    data.extend(content)
destination = root / 'web/public/runtime/frontend'
destination.mkdir(parents=True, exist_ok=True)
(destination / 'assets.bin').write_bytes(data)
(destination / 'assets.json').write_text(json.dumps({
    'sha256': hashlib.sha256(data).hexdigest(), 'files': entries,
}, separators=(',', ':')) + '\n')
print(f'Packed {len(entries)} files, {len(data)} bytes')
