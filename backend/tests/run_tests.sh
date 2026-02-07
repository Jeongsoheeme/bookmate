#!/bin/bash
# 테스트 실행 스크립트
# 이 스크립트를 사용하면 가상환경을 자동으로 활성화하고 테스트를 실행합니다

cd "$(dirname "$0")/.." || exit 1

# 가상환경 활성화
source venv/bin/activate

# pytest 실행
pytest tests/test_seat_concurrency.py -v -s "$@"
