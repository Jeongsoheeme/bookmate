"""
간단한 Redis 락 테스트 (데이터베이스 연결 없이)

이 테스트는 Redis만 사용하여 락 기능이 제대로 작동하는지 확인합니다.
데이터베이스 연결이 필요 없으므로 더 빠르게 실행할 수 있습니다.
"""
import pytest
from app.services.redis_service import redis_service
import time


def test_redis_connection():
    """Redis 연결 테스트"""
    try:
        result = redis_service.ping()
        assert result == True, "Redis에 연결할 수 없습니다"
        print("✅ Redis 연결 성공!")
    except Exception as e:
        pytest.skip(f"Redis 연결 실패: {e}")


def test_lock_acquire_and_release():
    """락 획득 및 해제 테스트"""
    # Redis 연결 확인
    if not redis_service.ping():
        pytest.skip("Redis에 연결할 수 없습니다")
    
    ticket_id = 99999  # 테스트용 티켓 ID
    user_id = 1
    
    # 기존 락 해제 (테스트를 위해)
    redis_service.unlock_seat(ticket_id)
    
    # 1. 락 획득
    result1 = redis_service.try_lock_seat(ticket_id, user_id=user_id)
    assert result1 == True, "락 획득에 실패했습니다"
    print(f"✅ 락 획득 성공: ticket_id={ticket_id}, user_id={user_id}")
    
    # 2. 같은 좌석에 다시 락 시도 (실패해야 함)
    result2 = redis_service.try_lock_seat(ticket_id, user_id=2)
    assert result2 == False, "이미 잠긴 좌석에 락을 획득할 수 없어야 합니다"
    print(f"✅ 중복 락 시도 차단 성공: 다른 사용자가 락을 획득할 수 없음")
    
    # 3. 락 해제
    redis_service.unlock_seat(ticket_id)
    print(f"✅ 락 해제 성공")
    
    # 4. 해제 후 다시 락 시도 (성공해야 함)
    result3 = redis_service.try_lock_seat(ticket_id, user_id=2)
    assert result3 == True, "락 해제 후 다시 락을 획득할 수 있어야 합니다"
    print(f"✅ 락 해제 후 재획득 성공")
    
    # 정리
    redis_service.unlock_seat(ticket_id)
    print("\n✅ 모든 테스트 통과!")


def test_lock_timeout():
    """락 타임아웃 테스트"""
    if not redis_service.ping():
        pytest.skip("Redis에 연결할 수 없습니다")
    
    ticket_id = 99998
    user_id = 1
    
    # 기존 락 해제
    redis_service.unlock_seat(ticket_id)
    
    # 락 획득 (짧은 타임아웃으로)
    result = redis_service.try_lock_seat(ticket_id, timeout=2, user_id=user_id)
    assert result == True, "락 획득에 실패했습니다"
    
    # 락이 설정되었는지 확인
    lock_user_id = redis_service.get_lock_user_id(ticket_id)
    assert lock_user_id == user_id, f"락 사용자 ID가 일치하지 않습니다: {lock_user_id} != {user_id}"
    print(f"✅ 락 설정 확인: user_id={lock_user_id}")
    
    # 타임아웃 대기 (3초)
    print("⏳ 락 타임아웃 대기 중... (2초)")
    time.sleep(3)
    
    # 타임아웃 후 락이 자동으로 해제되었는지 확인
    lock_user_id_after = redis_service.get_lock_user_id(ticket_id)
    assert lock_user_id_after is None, "타임아웃 후 락이 자동으로 해제되어야 합니다"
    print("✅ 락 타임아웃 확인: 자동 해제됨")
    
    # 정리
    redis_service.unlock_seat(ticket_id)


def test_concurrent_lock_attempts():
    """동시 락 시도 테스트"""
    if not redis_service.ping():
        pytest.skip("Redis에 연결할 수 없습니다")
    
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    ticket_id = 99997
    num_users = 5
    
    # 기존 락 해제
    redis_service.unlock_seat(ticket_id)
    
    def try_lock(user_id):
        """락 시도 함수"""
        return redis_service.try_lock_seat(ticket_id, user_id=user_id)
    
    # 5명이 동시에 락 시도
    results = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(try_lock, i+1) for i in range(num_users)]
        for future in as_completed(futures):
            results.append(future.result())
    
    # 정확히 1명만 성공해야 함
    success_count = sum(1 for r in results if r)
    assert success_count == 1, f"정확히 1명만 락을 획득해야 하는데, {success_count}명이 성공했습니다"
    print(f"✅ 동시 락 시도 테스트 통과: {success_count}명 성공, {num_users - success_count}명 실패")
    
    # 정리
    redis_service.unlock_seat(ticket_id)


if __name__ == "__main__":
    """
    테스트 실행 방법:
    
    pytest tests/test_redis_lock_simple.py -v -s
    """
    pytest.main([__file__, "-v", "-s"])
