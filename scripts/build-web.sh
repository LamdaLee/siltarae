#!/usr/bin/env bash
# 실타래 실습실을 일반 웹사이트(Vercel 등)용으로 묶는다.
# prototype/index.html은 Claude 아티팩트 형식(html/head 태그 없음)이라 문서 틀만 씌운다.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
{
  printf '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<meta name="description" content="엉킨 고민을 꺼내고 나누고 정의해서 자동화까지, 문제 정의 실습실">\n'
  printf '</head>\n<body>\n'
  cat prototype/index.html
  printf '\n</body>\n</html>\n'
} > dist/index.html
echo "dist/index.html 생성 ($(wc -c < dist/index.html) bytes)"
