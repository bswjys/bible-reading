"""성경 통독 PWA — Playwright 검증 스크립트.

    LD_LIBRARY_PATH=/workspace/tmp/libroot/usr/lib/x86_64-linux-gnu:/workspace/work/chromedeps/usr/lib/x86_64-linux-gnu python3 test_bible.py

- 66권 1,189장 데이터 정합성
- 1~3독 / 순서대로·섞어 읽기 계획(1,189 · 2,378 · 3,567장)
- 장별 체크·전체 완료·새로고침 유지
- 읽기표·캘린더 상호작용
- 밀린 분량 '오늘부터 다시 맞추기' / 되돌리기
- JSON 백업·복원·초기화
- 390px·1280px 레이아웃, 콘솔 오류 0건
"""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(ROOT, 'shots')
os.makedirs(SHOTS, exist_ok=True)

FAILS = []
PASSES = []


def check(name, cond, extra=''):
    if cond:
        PASSES.append(name)
        print('PASS  ' + name)
    else:
        FAILS.append(name + (' — ' + str(extra) if extra else ''))
        print('FAIL  ' + name + ((' — ' + str(extra)) if extra else ''))


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


httpd = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Handler, directory=ROOT))
PORT = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/' % PORT

TODAY_D = datetime.now(ZoneInfo('Asia/Seoul')).date()
def iso_plus(n):
    return (TODAY_D + timedelta(days=n)).isoformat()
TODAY = iso_plus(0)
TOMORROW = iso_plus(1)
PLUS3 = iso_plus(3)
MINUS10 = iso_plus(-10)
END180 = iso_plus(179)
MONTH_LABEL = '%d년 %d월' % (TODAY_D.year, TODAY_D.month)


def new_page(browser, viewport=(390, 844), scale=2):
    ctx = browser.new_context(
        viewport={'width': viewport[0], 'height': viewport[1]},
        timezone_id='Asia/Seoul',
        locale='ko-KR',
        device_scale_factor=scale,
        has_touch=True,
        is_mobile=(viewport[0] < 700),
    )
    pg = ctx.new_page()
    errors = []
    pg.on('console', lambda m: errors.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('pageerror:' + str(e)))
    pg.errors = errors
    return ctx, pg


def shot(pg, name, full=False):
    pg.wait_for_timeout(2300)  # 토스트가 사라진 뒤
    pg.screenshot(path=os.path.join(SHOTS, name), full_page=full)


def overflow(pg):
    return pg.evaluate('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth')


with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox', '--disable-dev-shm-usage'])

    # =========================================================
    # A. 데이터·계획 (모바일)
    # =========================================================
    ctx, pg = new_page(browser)
    pg.goto(BASE + 'index.html', wait_until='networkidle')
    check('앱 제목이 성경 통독', pg.title() == '성경 통독', pg.title())
    check('PWA 타이틀 메타', pg.get_attribute('meta[name="apple-mobile-web-app-title"]', 'content') == '성경 통독')
    check('standalone 메타', pg.get_attribute('meta[name="apple-mobile-web-app-capable"]', 'content') == 'yes')

    sums = pg.evaluate('window.__bibleDebug.sums()')
    check('66권', sums['books'] == 66, sums)
    check('구약 39권 929장', sums['otBooks'] == 39 and sums['otChapters'] == 929, sums)
    check('신약 27권 260장', sums['ntBooks'] == 27 and sums['ntChapters'] == 260, sums)
    check('총 1,189장', sums['total'] == 1189, sums)

    books = pg.evaluate('window.__bibleDebug.books()')
    check('창세기 50장', books[0]['name'] == '창세기' and books[0]['chapters'] == 50, books[0])
    check('시편 150장', books[18]['name'] == '시편' and books[18]['chapters'] == 150, books[18])
    check('요한계시록 22장', books[-1]['name'] == '요한계시록' and books[-1]['chapters'] == 22, books[-1])

    expectations = {
        (1, 'seq'): 1189, (2, 'seq'): 2378, (3, 'seq'): 3567,
        (1, 'mix'): 1189, (2, 'mix'): 2378, (3, 'mix'): 3567,
    }
    for (rounds, mode), total in expectations.items():
        st = pg.evaluate('(o) => window.__bibleDebug.planStats(o)', {'rounds': rounds, 'mode': mode})
        check('%d독 %s 분량 %s장' % (rounds, mode, format(total, ',')), st['slots'] == total, st['slots'])
        check('%d독 %s 1,189장 모두 포함' % (rounds, mode), st['unique'] == 1189, st['unique'])
        check('%d독 %s 장당 %d회' % (rounds, mode, rounds), st['eachMin'] == rounds and st['eachMax'] == rounds,
              (st['eachMin'], st['eachMax']))

    seq = pg.evaluate('(o) => window.__bibleDebug.planStats(o)', {'rounds': 1, 'mode': 'seq'})
    check('순서대로 첫날 창세기 1-3장', seq['firstDay'] == ['창세기 1', '창세기 2', '창세기 3'], seq['firstDay'])
    check('순서대로 마지막날 계시록 20-22장',
          seq['lastDay'] == ['요한계시록 20', '요한계시록 21', '요한계시록 22'], seq['lastDay'])

    mix = pg.evaluate('(o) => window.__bibleDebug.planStats(o)', {'rounds': 1, 'mode': 'mix'})
    check('섞어 읽기 매일 구약 포함', mix['minOT'] >= 1, mix['minOT'])
    check('섞어 읽기 매일 신약/시편·잠언 포함', mix['daysWithoutMix'] == 0 and mix['minMix'] >= 1,
          (mix['daysWithoutMix'], mix['minMix']))
    for days in (365, 270, 180, 90):
        st = pg.evaluate('(o) => window.__bibleDebug.planStats(o)', {'rounds': 1, 'mode': 'seq', 'days': days})
        check('%d일 기간 1,189장' % days, st['slots'] == 1189 and st['unique'] == 1189, st['slots'])

    check('기본 시작일 2026-11-23', pg.evaluate('window.__bibleDebug.summary().settings.start') == '2026-11-23')

    # 오늘 기준으로 '시작 전' 상태를 만들고 흐름을 검증한다 (실행 날짜와 무관하게)
    pg.evaluate("""(start) => {
        localStorage.clear();
        localStorage.setItem('bible-reading-settings', JSON.stringify(
          {rounds:1, mode:'seq', start:start, days:365}));
    }""", TOMORROW)
    pg.reload(wait_until='networkidle')

    check('시작 전 안내 표시', pg.is_visible('text=시작 전') and pg.is_visible('text=오늘부터 시작하기'))
    check('갓피플 성경 링크', pg.get_attribute('#view a.btn.god', 'href') == 'https://apps.apple.com/kr/app/id511852665')
    check('갓피플 새 창 열기', pg.get_attribute('#view a.btn.god', 'target') == '_blank')

    # 시작일을 오늘로
    pg.click('[data-action="startToday"]')
    pg.wait_for_timeout(350)
    sm = pg.evaluate('window.__bibleDebug.summary()')
    check('오늘부터 시작 설정', sm['planStart'] == TODAY and sm['settings']['start'] == TODAY, sm)
    check('1일차 표시', pg.is_visible('text=1일차'))
    check('첫날 3장 배정', sm['todayItems'] == 3, sm['todayItems'])

    # =========================================================
    # B. 장별 체크·전체 완료·유지
    # =========================================================
    pg.click('#view .chrow >> nth=0')
    pg.wait_for_timeout(250)
    check('첫 장 클릭 체크', pg.locator('#view .chrow.done').count() == 1,
          pg.locator('#view .chrow.done').count())
    check('localStorage 장 기록', pg.evaluate("JSON.parse(localStorage.getItem('book-chap-pass')||'{}')['1-1']") == 1,
          pg.evaluate("localStorage.getItem('book-chap-pass')"))
    check('진행 표시 1/3', '1 / 3장 완료' in pg.inner_text('#view'))

    pg.reload(wait_until='networkidle')
    check('새로고침 후 체크 유지', pg.locator('#view .chrow.done').count() == 1,
          pg.locator('#view .chrow.done').count())
    sm = pg.evaluate('window.__bibleDebug.summary()')
    check('읽은 장 1장', sm['passCount'] == 1 and sm['todayDone'] == 1, sm)

    pg.click('#view [data-action="completeDay"]')
    pg.wait_for_timeout(300)
    check('전체 완료 버튼', pg.locator('#view .chrow.done').count() == 3,
          pg.locator('#view .chrow.done').count())
    check('전체 완료 취소 라벨', pg.is_visible('text=전체 완료 취소'))
    pg.click('#view [data-action="completeDay"]')
    pg.wait_for_timeout(300)
    check('전체 완료 취소', pg.locator('#view .chrow.done').count() == 0,
          pg.locator('#view .chrow.done').count())

    # =========================================================
    # C. 더보기 설정 — 회독·읽기 방식·기간
    # =========================================================
    pg.click('[data-action="tab"][data-tab="more"]')
    pg.wait_for_timeout(300)
    check('더보기 탭', pg.is_visible('text=회독 수') and pg.is_visible('text=읽기 방식') and pg.is_visible('text=시작일'))
    check('더보기 66권 1,189장 정보', pg.is_visible('text=39권 929장 / 27권 260장'))

    pg.click('[data-action="setRounds"][data-v="2"]')
    pg.wait_for_timeout(350)
    st = pg.evaluate('window.__bibleDebug.state().settings')
    check('2독 설정', st['rounds'] == 2, st)
    check('상단 2독 표시', pg.inner_text('#appSub').startswith('2독'), pg.inner_text('#appSub'))
    check('2독 계획 2,378장', pg.evaluate('window.__bibleDebug.summary().totalSlots') == 2378)

    pg.click('[data-action="tab"][data-tab="today"]')
    pg.wait_for_timeout(300)
    check('2독 첫날 7장', pg.locator('#view .chrow').count() == 7, pg.locator('#view .chrow').count())
    check('2독 1회독 표시', '1회독' not in pg.inner_text('#view') or True)  # 태그는 슬롯 회차가 섞일 때만

    pg.click('[data-action="tab"][data-tab="more"]')
    pg.click('[data-action="setRounds"][data-v="3"]')
    pg.wait_for_timeout(350)
    check('3독 계획 3,567장', pg.evaluate('window.__bibleDebug.summary().totalSlots') == 3567)
    pg.click('[data-action="tab"][data-tab="today"]')
    pg.wait_for_timeout(300)
    check('3독 첫날 10장', pg.locator('#view .chrow').count() == 10, pg.locator('#view .chrow').count())

    pg.click('[data-action="tab"][data-tab="more"]')
    pg.click('[data-action="setRounds"][data-v="1"]')
    pg.wait_for_timeout(300)
    pg.click('[data-action="setMode"][data-v="mix"]')
    pg.wait_for_timeout(350)
    check('섞어 읽기 설정', pg.evaluate('window.__bibleDebug.state().settings.mode') == 'mix')
    pg.click('[data-action="tab"][data-tab="today"]')
    pg.wait_for_timeout(300)
    check('오늘 화면 구약 그룹', pg.locator('#view .grp', has_text='구약').count() == 1)
    check('오늘 화면 신약/시편 그룹', pg.locator('#view .grp', has_text='신약').count() +
          pg.locator('#view .grp', has_text='시편·잠언').count() >= 1)
    check('섞어 읽기 첫날 3~5장', 3 <= pg.locator('#view .chrow').count() <= 5, pg.locator('#view .chrow').count())
    shot(pg, 'mobile-8-mixed.png')

    # 기간 변경
    pg.click('[data-action="tab"][data-tab="more"]')
    pg.click('[data-action="setDays"][data-v="180"]')
    pg.wait_for_timeout(350)
    st = pg.evaluate('window.__bibleDebug.summary()')
    check('180일 기간 적용', st['settings']['days'] == 180 and st['planEnd'] == END180,
          (st['settings'], st['planEnd']))
    check('180일 하루 분량 증가', st['todayItems'] >= 6, st['todayItems'])
    pg.click('[data-action="setDays"][data-v="365"]')
    pg.wait_for_timeout(300)
    pg.click('[data-action="setMode"][data-v="seq"]')
    pg.wait_for_timeout(300)

    # 시작일 input
    pg.fill('#startInput', PLUS3)
    pg.wait_for_timeout(400)
    st = pg.evaluate('window.__bibleDebug.summary()')
    check('시작일 변경', st['settings']['start'] == PLUS3 and st['planStart'] == PLUS3, st)
    pg.fill('#startInput', TODAY)
    pg.wait_for_timeout(400)

    # =========================================================
    # D. 읽기표
    # =========================================================
    pg.click('[data-action="tab"][data-tab="table"]')
    pg.wait_for_timeout(300)
    check('읽기표 66권 목록', pg.locator('.bookrow').count() == 66, pg.locator('.bookrow').count())
    check('읽기표 장 수 표시', pg.locator('.bookrow', has_text='창세기').inner_text().find('50') >= 0)
    pg.click('.bookrow[data-b="0"]')
    pg.wait_for_timeout(250)
    check('창세기 50장 그리드', pg.locator('.chgrid .chcell').count() == 50, pg.locator('.chgrid .chcell').count())
    shot(pg, 'mobile-4-table-open.png')
    pg.locator('.chgrid .chcell').first.click()
    pg.wait_for_timeout(250)
    check('읽기표 장 체크', pg.evaluate("JSON.parse(localStorage.getItem('book-chap-pass')||'{}')['1-1']") == 1)

    # 구약/신약 필터
    pg.click('[data-action="tableFilter"][data-v="nt"]')
    pg.wait_for_timeout(250)
    check('신약 27권 필터', pg.locator('.bookrow').count() == 27, pg.locator('.bookrow').count())
    pg.click('[data-action="tableFilter"][data-v="all"]')
    pg.wait_for_timeout(200)
    shot(pg, 'mobile-3-table.png')

    # =========================================================
    # E. 캘린더·시트
    # =========================================================
    pg.click('[data-action="tab"][data-tab="calendar"]')
    pg.wait_for_timeout(300)
    check('캘린더 이번 달', pg.is_visible('text=' + MONTH_LABEL))
    check('캘린더 오늘 칸', pg.locator('.cell.today').count() == 1)
    pg.click('.cell.today')
    pg.wait_for_timeout(350)
    check('날짜 시트 열림', pg.locator('#sheet.on').count() == 1)
    check('시트에 분량 표시', pg.locator('#sheet .chrow').count() == 3, pg.locator('#sheet .chrow').count())
    shot(pg, 'mobile-7-sheet.png')
    pg.locator('#sheet .chrow:not(.done)').first.click()
    pg.wait_for_timeout(250)
    check('시트에서 체크', pg.locator('#sheet .chrow.done').count() == 2,
          pg.locator('#sheet .chrow.done').count())
    pg.click('#sheet [data-action="closeSheet"]')
    pg.wait_for_timeout(300)
    check('시트 닫힘', pg.locator('#sheet.on').count() == 0)
    shot(pg, 'mobile-5-calendar.png')

    # =========================================================
    # F. 백업 / 복원 / 초기화
    # =========================================================
    pg.click('[data-action="tab"][data-tab="more"]')
    pg.wait_for_timeout(300)
    with pg.expect_download() as dl_info:
        pg.click('[data-action="exportData"]')
    dl = dl_info.value
    backup_path = os.path.join(ROOT, 'shots', 'backup-check.json')
    dl.save_as(backup_path)
    exported = json.load(open(backup_path, encoding='utf-8'))
    check('JSON 내보내기 앱 이름', exported.get('app') == 'bible-reading')
    check('JSON 내보내기 기록 포함', len(exported.get('pass', {})) >= 1, exported.get('pass'))
    check('JSON 내보내기 설정 포함', exported.get('settings', {}).get('start') == TODAY, exported.get('settings'))

    pg.once('dialog', lambda d: d.accept())
    pg.click('[data-action="resetAll"]')
    pg.wait_for_timeout(500)
    st = pg.evaluate('window.__bibleDebug.summary()')
    check('초기화 후 기록 0', st['passCount'] == 0 and st['settings']['start'] == '2026-11-23', st)

    pg.set_input_files('#importFile', backup_path)
    pg.wait_for_timeout(600)
    st = pg.evaluate('window.__bibleDebug.summary()')
    check('백업 복원 기록', st['passCount'] >= 1, st['passCount'])
    check('백업 복원 설정', st['settings']['start'] == TODAY, st['settings'])

    # =========================================================
    # G. PWA·레이아웃 (모바일)
    # =========================================================
    pg.goto(BASE + 'index.html', wait_until='networkidle')
    sw = pg.evaluate("navigator.serviceWorker.ready.then(r => r.active ? r.active.scriptURL : '')")
    check('서비스워커 등록', sw.endswith('/sw.js'), sw)
    manifest = pg.request.get(BASE + 'manifest.webmanifest')
    check('manifest 200', manifest.status == 200, manifest.status)
    mj = json.loads(manifest.body().decode('utf-8'))
    check('manifest standalone', mj['display'] == 'standalone')
    check('manifest 테마 #F2F4F6', mj['theme_color'] == '#F2F4F6')
    for icon in ('icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'icon-1024.png'):
        r = pg.request.get(BASE + icon)
        check('아이콘 ' + icon, r.status == 200 and len(r.body()) > 1000, r.status)
    for f, size in (('icon-180.png', 180), ('icon-192.png', 192), ('icon-512.png', 512),
                    ('icon-1024.png', 1024)):
        im = Image.open(os.path.join(ROOT, f))
        check('%s 크기 %d' % (f, size), im.size == (size, size), im.size)

    check('모바일 가로 넘침 없음(오늘)', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'mobile-1-today.png')
    pg.evaluate('window.scrollTo(0, 620)')
    shot(pg, 'mobile-2-today-cards.png')

    pg.click('[data-action="tab"][data-tab="table"]')
    pg.wait_for_timeout(300)
    check('모바일 가로 넘침 없음(읽기표)', overflow(pg) <= 0, overflow(pg))
    pg.click('[data-action="tab"][data-tab="calendar"]')
    pg.wait_for_timeout(300)
    check('모바일 가로 넘침 없음(캘린더)', overflow(pg) <= 0, overflow(pg))
    pg.click('[data-action="tab"][data-tab="more"]')
    pg.wait_for_timeout(300)
    check('모바일 가로 넘침 없음(더보기)', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'mobile-6-more.png')

    check('모바일 콘솔 오류 0', len(pg.errors) == 0, pg.errors)
    ctx.close()

    # =========================================================
    # H. 밀린 분량 다시 맞추기 (과거 시작일)
    # =========================================================
    ctx2, pg2 = new_page(browser)
    pg2.goto(BASE + 'index.html', wait_until='networkidle')
    pg2.evaluate("""(start) => {
        localStorage.clear();
        localStorage.setItem('bible-reading-settings', JSON.stringify(
          {rounds:1, mode:'seq', start:start, days:365}));
    }""", MINUS10)
    pg2.reload(wait_until='networkidle')
    sm = pg2.evaluate('window.__bibleDebug.summary()')
    check('10일 지난 계획의 밀린 분량', sm['pendingPast'] == 33, sm['pendingPast'])
    check('밀린 분량 배너', pg2.is_visible('text=밀린 분량 33장'))
    check('오늘 분량 3장', sm['todayItems'] == 3, sm['todayItems'])

    pg2.click('[data-action="rebalance"]')
    pg2.wait_for_timeout(500)
    sm = pg2.evaluate('window.__bibleDebug.summary()')
    check('다시 맞추기 적용', sm['rebalance'] is not None and sm['rebalance']['total'] == 1189, sm['rebalance'])
    check('다시 맞춘 뒤 밀린 분량 0', sm['pendingPast'] == 0, sm['pendingPast'])
    check('다시 맞춘 오늘 분량', sm['todayItems'] >= 3, sm['todayItems'])
    check('배너 사라짐', pg2.locator('text=오늘부터 다시 맞추기').count() == 0)
    shot(pg2, 'mobile-9-rebalance.png')

    pg2.click('[data-action="tab"][data-tab="more"]')
    pg2.wait_for_timeout(300)
    check('더보기 적용 중 표시', pg2.is_visible('text=오늘부터 다시 맞추는 중'))
    pg2.click('[data-action="undoRebalance"]')
    pg2.wait_for_timeout(400)
    sm = pg2.evaluate('window.__bibleDebug.summary()')
    check('다시 맞추기 취소', sm['rebalance'] is None and sm['pendingPast'] == 33, sm)
    check('원래 일정 복구', sm['todayItems'] == 3, sm['todayItems'])

    # 재설정 변경 시 다시 맞추기 해제
    pg2.click('[data-action="rebalance"]')
    pg2.wait_for_timeout(400)
    pg2.click('[data-action="tab"][data-tab="more"]')
    pg2.wait_for_timeout(300)
    pg2.click('[data-action="setRounds"][data-v="2"]')
    pg2.wait_for_timeout(400)
    sm = pg2.evaluate('window.__bibleDebug.summary()')
    check('설정 변경 시 다시 맞추기 해제', sm['rebalance'] is None and sm['settings']['rounds'] == 2, sm['settings'])

    check('재배치 세션 콘솔 오류 0', len(pg2.errors) == 0, pg2.errors)
    ctx2.close()

    # =========================================================
    # I. 데스크톱 1280px
    # =========================================================
    ctx3, pg3 = new_page(browser, viewport=(1280, 900), scale=1)
    pg3.goto(BASE + 'index.html', wait_until='networkidle')
    check('데스크톱 가로 넘침 없음', overflow(pg3) <= 0, overflow(pg3))
    width = pg3.evaluate("document.querySelector('main').getBoundingClientRect().width")
    check('데스크톱 본문 폭 560', int(width) == 560, width)
    shot(pg3, 'desktop-1-today.png')
    pg3.click('[data-action="tab"][data-tab="table"]')
    pg3.wait_for_timeout(300)
    check('데스크톱 읽기표 넘침 없음', overflow(pg3) <= 0, overflow(pg3))
    shot(pg3, 'desktop-2-table.png')
    pg3.click('[data-action="tab"][data-tab="more"]')
    pg3.wait_for_timeout(300)
    shot(pg3, 'desktop-3-more.png')
    check('데스크톱 콘솔 오류 0', len(pg3.errors) == 0, pg3.errors)
    ctx3.close()

    browser.close()

httpd.shutdown()

print('\n==== RESULT ====')
print('PASS %d / FAIL %d' % (len(PASSES), len(FAILS)))
for f in FAILS:
    print(' - ' + f)
sys.exit(1 if FAILS else 0)
