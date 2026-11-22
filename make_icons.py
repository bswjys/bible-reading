"""성경 통독 앱 아이콘 생성기.

토스 블루 그라데이션(#3182F6 → #1B64DA) 위에
흰 성경책과 파란 십자가를 얹은 아이콘. 1024에서 그린 뒤 줄여서
아이폰 홈 화면(180px, 60pt)에서도 십자가와 책이 또렷하게 보이도록 잡았다.

icon-512-maskable.png 는 안드로이드가 원형으로 잘라도 내용이 잘리지 않도록
같은 그림을 80% 크기로 줄여 놓은 판이다.

    python3 make_icons.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W = 1024
C1 = (49, 130, 246)     # #3182F6
C2 = (27, 100, 218)     # #1B64DA
BLUE = (27, 100, 218)
WHITE = (255, 255, 255)
MASKABLE_SCALE = 0.80

FONT_FALLBACKS = [
    "/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf",
    "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
]


def font_path():
    for p in FONT_FALLBACKS:
        if os.path.exists(p):
            return p
    raise SystemExit("한글 폰트를 찾지 못했습니다")


def gradient(size):
    small = 160
    g = Image.new("RGB", (small, small))
    px = g.load()
    for y in range(small):
        for x in range(small):
            t = (x + y) / (2 * (small - 1))
            px[x, y] = tuple(round(C1[i] + (C2[i] - C1[i]) * t) for i in range(3))
    return g.resize((size, size), Image.BICUBIC)


def draw_book(layer, scale=1.0):
    """가운데(512,512) 기준으로 책과 십자가를 scale 배로 그린다."""
    d = ImageDraw.Draw(layer)

    def sx(v):
        return W / 2 + (v - W / 2) * scale

    def sy(v):
        return W / 2 + (v - W / 2) * scale

    # 책 그림자
    d.rounded_rectangle(
        [sx(300), sy(226), sx(724), sy(826)],
        radius=52 * scale, fill=(12, 52, 120, 55)
    )
    # 흰 표지
    d.rounded_rectangle(
        [sx(294), sy(206), sx(718), sy(806)],
        radius=52 * scale, fill=WHITE
    )
    # 왼쪽 책등
    d.rounded_rectangle(
        [sx(294), sy(206), sx(342), sy(806)],
        radius=52 * scale, fill=(232, 243, 255)
    )
    d.rectangle([sx(320), sy(230), sx(342), sy(782)], fill=(232, 243, 255))
    # 오른쪽 페이지 결
    for i, a in enumerate((90, 65, 40)):
        x = 730 + i * 9
        d.rounded_rectangle(
            [sx(x), sy(268 + i * 10), sx(x + 4), sy(742 - i * 10)],
            radius=2 * scale, fill=(255, 255, 255, a)
        )
    # 십자가 (세로 · 가로)
    d.rounded_rectangle(
        [sx(484), sy(330), sx(540), sy(620)],
        radius=24 * scale, fill=BLUE
    )
    d.rounded_rectangle(
        [sx(410), sy(404), sx(614), sy(460)],
        radius=24 * scale, fill=BLUE
    )
    # 책 아래 밑줄 (통독 느낌)
    d.rounded_rectangle(
        [sx(400), sy(690), sx(612), sy(706)],
        radius=8 * scale, fill=(214, 233, 255)
    )


def compose(scale=1.0):
    base = gradient(W).convert("RGBA")

    # 왼쪽 위 은은한 빛
    glow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-260, -320, 560, 420], fill=(255, 255, 255, 34))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    base = Image.alpha_composite(base, glow)

    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    draw_book(layer, scale)
    return Image.alpha_composite(base, layer).convert("RGB")


def main():
    img = compose(1.0)
    img.save("icon-1024.png")
    for s in (512, 192, 180):
        img.resize((s, s), Image.LANCZOS).save("icon-%d.png" % s)

    compose(MASKABLE_SCALE).resize((512, 512), Image.LANCZOS).save("icon-512-maskable.png")
    make_preview(img)
    print("ok")


def make_preview(img):
    """아이콘 크기별 미리보기 시트 (icon_preview.png)."""
    pw, ph = 1200, 560
    sheet = Image.new("RGB", (pw, ph), (242, 244, 246))
    d = ImageDraw.Draw(sheet)
    fp = font_path()
    f_title = ImageFont.truetype(fp, 34)
    f_label = ImageFont.truetype(fp, 20)

    def rounded(im, radius):
        mask = Image.new("L", im.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0], im.size[1]], radius=radius, fill=255)
        out = im.convert("RGBA")
        out.putalpha(mask)
        return out

    big = rounded(img.resize((300, 300), Image.LANCZOS), 66)
    sheet.paste(big, (48, 52), big)
    d.text((48, 380), "1024 · 512", font=f_label, fill=(107, 118, 132))

    tile = rounded(img.resize((150, 150), Image.LANCZOS), 34)
    sheet.paste(tile, (420, 60), tile)
    d.text((420, 232), "180 (홈 화면)", font=f_label, fill=(107, 118, 132))

    t192 = rounded(img.resize((96, 96), Image.LANCZOS), 22)
    sheet.paste(t192, (630, 60), t192)
    d.text((630, 180), "192", font=f_label, fill=(107, 118, 132))

    t60 = rounded(img.resize((60, 60), Image.LANCZOS), 14)
    sheet.paste(t60, (800, 60), t60)
    d.text((800, 140), "60pt", font=f_label, fill=(107, 118, 132))

    # 홈 화면 타일 느낌
    d.rounded_rectangle([960, 60, 960 + 150, 60 + 150], radius=34, fill=(255, 255, 255))
    t126 = rounded(img.resize((126, 126), Image.LANCZOS), 29)
    sheet.paste(t126, (972, 72), t126)

    d.text((420, 330), "성경 통독", font=f_title, fill=(25, 31, 40))
    d.text((420, 382), "1년 1~3독 · 장별 체크 · 갓피플 성경", font=f_label, fill=(107, 118, 132))
    d.text((420, 420), "#3182F6 → #1B64DA · 흰 성경 + 파란 십자가", font=f_label, fill=(176, 184, 193))
    sheet.save("icon_preview.png")


if __name__ == "__main__":
    main()
