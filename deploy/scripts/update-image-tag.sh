#!/bin/bash
# =============================================================
# update-image-tag.sh
# CI 파이프라인에서 Docker 이미지 빌드 후 호출하여
# values.yaml의 이미지 태그를 새로운 git SHA로 업데이트합니다.
#
# 사용법: ./update-image-tag.sh <service> <new-tag>
# 예시:   ./update-image-tag.sh backend abc123f
#         ./update-image-tag.sh frontend abc123f
#         ./update-image-tag.sh admin-frontend abc123f
# =============================================================

set -euo pipefail

SERVICE="${1:-}"
NEW_TAG="${2:-}"

if [ -z "$SERVICE" ] || [ -z "$NEW_TAG" ]; then
  echo "사용법: $0 <service> <new-tag>"
  echo "  service: backend | frontend | admin-frontend"
  echo "  new-tag: Docker 이미지 태그 (예: git SHA)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

case "$SERVICE" in
  backend)
    VALUES_FILE="$DEPLOY_DIR/helm/backend/values.yaml"
    # backend.tag 업데이트
    sed -i.bak "s/^  tag: .*/  tag: ${NEW_TAG}/" "$VALUES_FILE"
    ;;
  frontend)
    VALUES_FILE="$DEPLOY_DIR/helm/frontend/values.yaml"
    # frontend.tag 업데이트 (첫 번째 tag: 만 변경)
    sed -i.bak "/^frontend:/,/^[a-zA-Z]/{s/^  tag: .*/  tag: ${NEW_TAG}/;}" "$VALUES_FILE"
    ;;
  admin-frontend)
    VALUES_FILE="$DEPLOY_DIR/helm/frontend/values.yaml"
    # adminFrontend.tag 업데이트
    sed -i.bak "/^adminFrontend:/,/^[a-zA-Z]/{s/^  tag: .*/  tag: ${NEW_TAG}/;}" "$VALUES_FILE"
    ;;
  *)
    echo "오류: 알 수 없는 서비스 '$SERVICE'"
    echo "사용 가능한 서비스: backend, frontend, admin-frontend"
    exit 1
    ;;
esac

# 백업 파일 정리
rm -f "${VALUES_FILE}.bak"

echo "✅ ${SERVICE} 이미지 태그가 '${NEW_TAG}'(으)로 업데이트되었습니다."
echo "   파일: ${VALUES_FILE}"
