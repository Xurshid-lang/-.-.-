// Google Apps Script: принимает результат, проверяет данные и пишет строку в таблицу.
// Развернуть: Расширения → Apps Script → Развертывание → Веб-приложение (доступ: все).
const SHEET_NAME = 'Результаты';
function doPost(e) {
  try {
    const r = JSON.parse(e.postData.contents);
    const name = String(r.name || '').trim().slice(0, 60);
    const group = String(r.group || '').trim().slice(0, 30);
    const ok = Number(r.ok), total = Number(r.total);
    if (!name || !(total > 0 && total <= 100) || !(ok >= 0 && ok <= total)) return out('bad data');
    const lock = LockService.getScriptLock(); lock.waitLock(5000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) sh.appendRow(['Время','Имя','Группа','Верно','Неверно','Всего','%','Сдал','Время теста','Номера ошибок']);
    // защита от спама: не чаще раза в 20 секунд на одно имя
    const last = sh.getLastRow() > 1 ? sh.getRange(Math.max(2, sh.getLastRow() - 20), 1, Math.min(20, sh.getLastRow() - 1), 2).getValues() : [];
    if (last.some(x => x[1] === name && new Date() - new Date(x[0]) < 20000)) { lock.releaseLock(); return out('too fast'); }
    sh.appendRow([new Date(), name, group, ok, total - ok, total, Math.round(ok / total * 100), r.passed ? 'да' : 'нет', r.time, (r.wrongIdx || []).join(',')]);
    lock.releaseLock();
    return out('ok');
  } catch (err) { return out('error'); }
}
function out(s) { return ContentService.createTextOutput(s); }
