#!/usr/bin/env python3
"""Проверка questions.txt: пустые варианты, неверный номер ответа, дубли."""
import sys
path = sys.argv[1] if len(sys.argv) > 1 else "questions.txt"
errors, seen, count = [], {}, 0
for no, raw in enumerate(open(path, encoding="utf-8-sig"), 1):
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    p = [s.strip() for s in line.split("|")]
    if p[-1].startswith("~"):
        p.pop()
    if len(p) < 4:
        errors.append(f"строка {no}: нужно минимум вопрос, 2 варианта и номер ответа"); continue
    opts = p[1:-1]
    if any(not o for o in opts):
        errors.append(f"строка {no}: пустой вариант ответа")
    if not p[-1].isdigit() or not 1 <= int(p[-1]) <= len(opts):
        errors.append(f"строка {no}: номер ответа '{p[-1]}' вне диапазона 1..{len(opts)}")
    if len(set(o.lower() for o in opts)) != len(opts):
        errors.append(f"строка {no}: повторяющиеся варианты")
    k = p[0].lower()
    if k in seen:
        errors.append(f"строка {no}: дубль вопроса из строки {seen[k]}")
    seen[k] = no; count += 1
print(f"Проверено вопросов: {count}")
for e in errors: print("ОШИБКА", e)
sys.exit(1 if errors else 0)
