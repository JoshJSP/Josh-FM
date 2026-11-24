"""Tekent alle MAIRFM-iconen en de iOS-splash uit mair-logo.svg (ook het logo in de app).

Het SVG bestaat alleen uit rect, circle en een rechte lijn, dus die tekenen we zelf
met Pillow (4x supersampling) in plaats van een SVG-renderer toe te voegen.
PNG-iconen zijn vierkant zonder afgeronde hoeken: iOS en Android ronden zelf af,
en Apple weigert een AppIcon met alfakanaal.

Gebruik:  python scripts/make-icons.py
"""
import re
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

SRC = 'mair-logo.svg'
SS = 4  # supersampling
BG = (0x07, 0x07, 0x07)  # web-app achtergrond, voor de splash


def color(hex_, opacity=1.0):
    h = hex_.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (round(255 * opacity),)


def render(size, rounded, swap=None):
    root = ET.parse(SRC).getroot()
    k = size * SS / float(root.get('viewBox').split()[2])
    img = Image.new('RGBA', (size * SS,) * 2, (0, 0, 0, 0))

    def walk(node, fill):
        for el in node:
            tag = el.tag.split('}')[1]
            f = el.get('fill', fill)
            sc = el.get('stroke')
            if swap:
                f, sc = swap.get(f, f), swap.get(sc, sc)
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            d = ImageDraw.Draw(layer)
            n = lambda a: float(el.get(a, 0)) * k
            op = float(el.get('opacity', 1))
            if tag == 'g':
                walk(el, el.get('fill', fill))
                continue
            if tag == 'rect':
                box = [n('x'), n('y'), n('x') + n('width'), n('y') + n('height')]
                r = n('rx') if (rounded or el.get('width') != root.get('viewBox').split()[2]) else 0
                d.rounded_rectangle(box, radius=r, fill=color(f, op))
            elif tag == 'circle':
                cx, cy, r = n('cx'), n('cy'), n('r')
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color(f, op))
            elif tag == 'path':
                x1, y1, w = map(float, re.match(r'M(\S+) (\S+)h(\S+)', el.get('d')).groups())
                sw = float(el.get('stroke-width')) * k
                c = color(sc, op)
                d.line([x1 * k, y1 * k, (x1 + w) * k, y1 * k], fill=c, width=round(sw))
                for x in (x1, x1 + w):  # stroke-linecap round
                    d.ellipse([x * k - sw / 2, y1 * k - sw / 2, x * k + sw / 2, y1 * k + sw / 2], fill=c)
            else:
                continue
            img.alpha_composite(layer)

    walk(root, '#000000')
    return img.resize((size, size), Image.LANCZOS)


def save_rgb(img, path):
    flat = Image.new('RGB', img.size, BG)
    flat.paste(img, mask=img)
    flat.save(path, optimize=True)
    print('geschreven', path, img.size)


for size, path in [(180, 'apple-touch-icon.png'), (192, 'mair-icon-192.png'), (512, 'mair-icon-512.png'),
                   (1024, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')]:
    save_rgb(render(size, rounded=False), path)

# Splash (keuzes van Josh, 2026-11-24): oranje scherm, donkere tegel met oranje
# balken, daaronder MAIRFM dik in zwart. Tegel is 60% van de zichtbare breedte.
from PIL import ImageFont
ORANJE, ZWART = '#ff633e', '#171816'
FONT = 'C:/Windows/Fonts/seguibl.ttf'  # Segoe UI Black, alleen nodig om de PNG's te maken


def splash(w, h, visible_w=None):
    tile_size = round((visible_w or w) * 0.6)
    img = Image.new('RGBA', (w, h), color(ORANJE))
    tile = render(tile_size, rounded=True, swap={ORANJE: ZWART, ZWART: ORANJE})
    font = ImageFont.truetype(FONT, round(tile_size * 0.2))
    d = ImageDraw.Draw(img)
    track = -round(tile_size * 0.006)  # letters iets dichter op elkaar
    widths = [d.textlength(ch, font=font) for ch in 'MAIRFM']
    text_w = sum(widths) + track * 5
    asc, desc = font.getmetrics()
    gap = round(tile_size * 0.1)
    top = (h - (tile_size + gap + asc)) // 2
    img.alpha_composite(tile, ((w - tile_size) // 2, top))
    x = (w - text_w) / 2
    for ch, cw in zip('MAIRFM', widths):
        d.text((x, top + tile_size + gap), ch, font=font, fill=color(ZWART))
        x += cw + track
    return img


# iOS-app: de storyboard toont hem aspectFill, op een iPhone is ~1260 van de 2732 px breed zichtbaar.
ios = splash(2732, 2732, visible_w=1260)
for name in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
    save_rgb(ios, 'ios/App/App/Assets.xcassets/Splash.imageset/' + name)

# Web-app op het beginscherm: iOS wil per toestel een exacte maat (apple-touch-startup-image).
# (css-breedte, css-hoogte, pixelratio); de link-tags in index.html moeten hiermee overeenkomen.
IPHONES = [(440, 956, 3), (420, 912, 3), (402, 874, 3), (430, 932, 3), (393, 852, 3), (428, 926, 3),
           (390, 844, 3), (375, 812, 3), (360, 780, 3), (414, 896, 2), (375, 667, 2)]
import os
os.makedirs('splash', exist_ok=True)
for cw, ch, r in IPHONES:
    save_rgb(splash(cw * r, ch * r), f'splash/splash-{cw * r}x{ch * r}.png')
print(''.join(f'<link rel="apple-touch-startup-image" media="(device-width:{cw}px) and (device-height:{ch}px) and '
              f'(-webkit-device-pixel-ratio:{r}) and (orientation:portrait)" href="splash/splash-{cw * r}x{ch * r}.png">'
              for cw, ch, r in IPHONES))
