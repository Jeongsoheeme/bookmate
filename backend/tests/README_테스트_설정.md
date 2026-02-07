# 테스트 데이터베이스 설정 가이드

## 현재 동작 방식

기본적으로 테스트는 **실제 데이터베이스**에 연결합니다 (`settings.DATABASE_URL` 사용).

## 테스트 전용 데이터베이스 사용하기 (권장)

### 방법 1: 환경 변수로 테스트 DB 지정

```bash
# .env 파일에 추가하거나 환경 변수로 설정
export TEST_DATABASE_URL="postgresql://admin:bookmate123@localhost:5432/bookmate_test"

# 테스트 실행
pytest tests/test_seat_concurrency.py -v -s
```

### 방법 2: 테스트 전용 데이터베이스 생성

```bash
# PostgreSQL에 테스트용 데이터베이스 생성
psql -U admin -d postgres -c "CREATE DATABASE bookmate_test;"

# 또는 Docker 컨테이너에서
docker exec -it bookmate_db psql -U admin -d postgres -c "CREATE DATABASE bookmate_test;"
```

그리고 `.env` 파일에 추가:

```env
TEST_DATABASE_URL=postgresql://admin:bookmate123@localhost:5432/bookmate_test
```

## 테스트 데이터 정리

테스트는 자동으로 생성한 데이터를 정리하지만, 실패 시 수동으로 정리해야 할 수 있습니다:

```sql
-- 테스트 데이터 삭제
DELETE FROM bookings WHERE user_id IN (
    SELECT id FROM users WHERE email LIKE 'test_user_%@example.com'
);
DELETE FROM tickets WHERE event_id IN (
    SELECT id FROM events WHERE title LIKE 'Test Event%'
);
DELETE FROM users WHERE email LIKE 'test_user_%@example.com';
DELETE FROM events WHERE title LIKE 'Test Event%';
DELETE FROM venues WHERE name = 'Test Venue';
```

## 옵션 비교

### 실제 데이터베이스 사용 (기본)
- ✅ 실제 환경과 동일한 조건으로 테스트
- ✅ PostgreSQL 특성 (트랜잭션, 락 등) 정확히 테스트
- ⚠️ 실제 데이터에 영향을 줄 수 있음
- ⚠️ 테스트 데이터 정리 필요

### 테스트 전용 데이터베이스 사용
- ✅ 실제 데이터와 분리
- ✅ 테스트 실패해도 안전
- ✅ 테스트 데이터 자유롭게 생성/삭제
- ⚠️ 별도 데이터베이스 관리 필요

## 추천 설정

**개발 환경:**
- 테스트 전용 데이터베이스 사용 (`TEST_DATABASE_URL` 설정)

**CI/CD 환경:**
- 테스트 전용 데이터베이스 사용 (자동 생성/삭제)

**로컬 빠른 테스트:**
- 실제 데이터베이스 사용 (기본 동작)
