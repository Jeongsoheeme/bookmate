# 대기열 시스템이 어떻게 바뀌었을까?

## 놀이공원으로 비유해볼게요!

인기 있는 놀이기구를 타려면 줄을 서야 하잖아요?
우리 앱에서도 인기 공연 티켓을 사려면 줄을 서야 해요.

이 "줄 서기"가 바로 **대기열**이에요.

---

## 수정한 파일 목록

| 파일 | 역할 | 한 줄 설명 |
|---|---|---|
| `backend/app/core/config.py` | 설정 | "50명씩, 10초마다" 같은 숫자를 정해놓는 곳 |
| `backend/app/api/v1/endpoints/queue.py` | 대기열 핵심 | 줄 세우기, 배치 통과, 토큰 발급 |
| `backend/app/api/v1/endpoints/events.py` | 이벤트 조회 | 공연 정보 보여주기 (입장권 확인) |
| `backend/app/api/v1/endpoints/tickets.py` | 티켓/예매 | 좌석 보기, 잠그기, 예매하기 (입장권 확인) |
| `frontend/src/services/api.ts` | API 타입 | 서버 응답의 모양을 정의하는 곳 |
| `frontend/src/pages/QueuePage.tsx` | 대기 화면 | 사용자가 보는 "대기 중" 화면 |
| `frontend/src/index.css` | CSS | 숫자가 바뀔 때 애니메이션 |

---

## 변경점 1: 설정값 추가 (config.py)

> 파일: `backend/app/core/config.py`

"50명씩 10초마다 통과" 같은 규칙을 정해놓는 곳이에요.
마치 급식실에 "한 번에 몇 명씩 들어갈 수 있어요" 하고 안내문을 붙여놓는 것과 같아요.

```python
# 대기열 배치 처리 설정
QUEUE_BATCH_SIZE: int = 50       # 배치당 통과 인원
QUEUE_BATCH_INTERVAL: int = 10   # 배치 간격 (초)
QUEUE_TOKEN_TTL: int = 600       # 토큰 유효기간 (초, 10분)
```

| 설정 | 값 | 비유 |
|---|---|---|
| `QUEUE_BATCH_SIZE = 50` | 한 번에 50명 | 급식실에 한 번에 50명 입장 |
| `QUEUE_BATCH_INTERVAL = 10` | 10초마다 | 10초마다 문을 열어줌 |
| `QUEUE_TOKEN_TTL = 600` | 10분 유효 | 입장권이 10분 후 만료 |

이 숫자들을 바꾸면 전체 시스템이 바뀌어요. 예를 들어 `QUEUE_BATCH_SIZE`를 100으로 바꾸면 한 번에 100명씩 통과시킬 수 있어요.

---

## 변경점 2: 대기열 핵심 로직 전체 재작성 (queue.py)

> 파일: `backend/app/api/v1/endpoints/queue.py`

이 파일이 가장 많이 바뀌었어요. 대기열의 "두뇌" 같은 파일이에요.

### 2-1. Redis에 저장하는 데이터 (냉장고 칸 정리)

Redis는 엄청 빠른 저장소예요. 냉장고처럼 칸이 있고, 각 칸에 이름표를 붙여요.

| Redis 키 (냉장고 칸 이름) | 타입 | 비유 |
|---|---|---|
| `queue:event:{eid}` | Sorted Set | 줄 서 있는 사람들 (시간순) |
| `queue_token:event:{eid}:user:{uid}` | String | 입장권 (통과한 사람에게 줌) |
| `queue_history:event:{eid}` | Sorted Set | 지금까지 통과한 사람 기록 |
| `queue_batch_cursor:event:{eid}` | String | **신규** - "여기까지 통과시켰어요" 표시 |
| `queue_batch_last_time:event:{eid}` | String | **신규** - "마지막으로 문 연 시간" |

### 2-2. Lua 스크립트: 50명씩 한꺼번에 통과시키기

> 문지기가 하는 일을 코드로 적어놓은 거예요

**왜 Lua 스크립트를 쓸까요?**

100명이 동시에 "내 차례야?" 하고 물어봐도, Lua 스크립트는 **한 번에 하나씩만** 실행돼요.
그래서 "동시에 두 번 문을 여는 실수"가 절대 안 생겨요!

```lua
-- BATCH_ADVANCE_LUA 스크립트 (queue.py 25~78번 줄)

-- 1단계: 마지막으로 문 연 시간 확인
local last_time = tonumber(redis.call('GET', last_time_key) or '0')

-- 2단계: 10초가 지났는지 확인
if (current_time - last_time) < batch_interval then
    -- 아직 10초 안 됐으면 → 문 안 열고 현재 상태만 알려줌
    local cursor = redis.call('GET', cursor_key)
    if cursor == false then return '0' end
    return cursor
end

-- 3단계: 10초 지났으면 → 다음 50명 찾기!
local members
if cursor == 0 then
    -- 처음이면 맨 앞 50명
    members = redis.call('ZRANGEBYSCORE', queue_key, '-inf', '+inf',
                         'WITHSCORES', 'LIMIT', 0, batch_size)
else
    -- 이전 커서 이후 50명
    members = redis.call('ZRANGEBYSCORE', queue_key,
                         '(' .. tostring(cursor), '+inf',
                         'WITHSCORES', 'LIMIT', 0, batch_size)
end

-- 4단계: 마지막 사람의 점수를 새 커서로 저장
local new_cursor = members[#members]
redis.call('SET', cursor_key, tostring(new_cursor))
redis.call('SET', last_time_key, tostring(current_time))
```

그림으로 보면:

```
줄:  [1번(10.1초)] [2번(10.2초)] ... [50번(10.9초)] [51번(11.0초)] ...
      ←─────── 1차 배치 통과 ──────→   ←─── 아직 대기 ───→

커서: 10.9초 (여기까지 통과!)

10초 후...

줄:  [51번(11.0초)] [52번(11.1초)] ... [100번(11.9초)] [101번(12.0초)] ...
      ←─────── 2차 배치 통과 ──────→     ←─── 아직 대기 ───→

커서: 11.9초 (여기까지 통과!)
```

이 Lua 스크립트를 실제로 실행하는 Python 함수:

```python
# queue.py 81~99번 줄
async def _try_advance_batch(event_id: int) -> float:
    """배치 진행 시도 - Lua 스크립트를 Redis에서 실행"""
    last_time_key = f"queue_batch_last_time:event:{event_id}"
    cursor_key = f"queue_batch_cursor:event:{event_id}"
    queue_key = f"queue:event:{event_id}"

    current_time = time.time()
    result = redis_service.client.eval(
        BATCH_ADVANCE_LUA,        # 위의 Lua 스크립트
        3,                         # 키 3개 전달
        last_time_key, cursor_key, queue_key,  # 키들
        settings.QUEUE_BATCH_INTERVAL,  # 10초
        settings.QUEUE_BATCH_SIZE,      # 50명
        current_time                    # 지금 시간
    )
    return float(result)  # 현재 커서 값 반환
```

### 2-3. 통과 확인: "내가 통과했어?"

내 점수(줄 선 시간)가 커서보다 작거나 같으면 → 통과!

```python
# queue.py 102~114번 줄
def _is_user_released(event_id: int, user_id: int, cursor: float) -> bool:
    """내가 배치 커서를 통과했는지 확인"""
    queue_key = f"queue:event:{event_id}"
    user_score = redis_service.client.zscore(queue_key, str(user_id))
    #  ↑ "내가 줄 선 시간" 조회 (O(1) = 한 번에 바로!)

    if user_score is None:
        return False   # 줄에 없음
    if cursor <= 0:
        return False   # 아직 아무도 안 불림
    return user_score <= cursor
    #      ↑ 내 시간이 커서 이하면 → 통과!
```

비유하면:
```
내가 줄 선 시간: 10.5초
커서(여기까지 통과): 10.9초

10.5 <= 10.9 → True! → 통과!
```

### 2-4. 토큰(입장권) 발급

통과한 사람에게 "입장권"을 줘요. 이걸 **토큰**이라고 해요.

```python
# queue.py 117~122번 줄
async def _issue_queue_token(event_id: int, user_id: int) -> str:
    """대기열 토큰 발급"""
    token = secrets.token_urlsafe(32)  # 랜덤 문자열 생성
    token_key = f"queue_token:event:{event_id}:user:{user_id}"
    redis_service.client.setex(token_key, settings.QUEUE_TOKEN_TTL, token)
    #                          ↑ 키         ↑ 10분 후 만료      ↑ 값
    return token
```

마치 놀이공원에서 줄 서다가 내 차례가 되면 팔찌를 받는 것처럼,
이 토큰이 있어야 공연 정보를 볼 수 있어요.

### 2-5. 예상 대기시간 계산

"나 언제쯤 들어갈 수 있어?"에 대한 답을 계산해요.

```python
# queue.py 155~174번 줄
async def _calculate_estimated_wait_time(event_id: int, position: int) -> int:
    batch_size = settings.QUEUE_BATCH_SIZE      # 50
    batch_interval = settings.QUEUE_BATCH_INTERVAL  # 10초

    # 기본 계산: 내 앞에 몇 번의 배치가 있는지
    batches_ahead = max(0, (position - 1)) // batch_size
    base_estimate = batches_ahead * batch_interval

    # 최근 실제 처리 속도가 있으면 섞어서 더 정확하게
    recent_rate = await _get_recent_processing_rate(event_id)
    if recent_rate > 0:
        rate_estimate = int(position / recent_rate)
        estimated = int(base_estimate * 0.6 + rate_estimate * 0.4)
        return max(estimated, 0)

    return max(base_estimate, 0)
```

예시:
```
나: 120번
배치 크기: 50명
배치 간격: 10초

내 앞에 있는 배치 수 = (120 - 1) // 50 = 2번
예상 대기시간 = 2 x 10 = 20초!
```

### 2-6. 토큰 검증 함수 (다른 파일에서 공유)

**예전 방식 (느림):**
이름표 상자를 **전부** 뒤져서 찾음

**새 방식 (빠름):**
"3번 이벤트의 7번 사용자" 칸에서 **바로** 꺼냄

```python
# queue.py 177~187번 줄
def validate_queue_token(event_id: int, user_id: int, token: str) -> bool:
    """대기열 토큰 검증 - O(1) 직접 조회"""
    token_key = f"queue_token:event:{event_id}:user:{user_id}"
    #           ↑ 정확한 주소를 알고 있으니 바로 찾아감!
    try:
        stored_token = redis_service.client.get(token_key)
        return stored_token == token
        #      ↑ 저장된 토큰과 보내온 토큰이 같은지 비교
    except Exception:
        return False
```

이 함수를 `events.py`와 `tickets.py`에서 가져다 쓰는 거예요 (import).

### 2-7. 대기열 진입 API (줄 서기)

사용자가 "줄 서기" 버튼을 누르면 이 함수가 실행돼요.

```python
# queue.py 190~257번 줄
@router.post("/queue/enter/{event_id}")
async def enter_queue(event_id, current_user, db):
    # 1. 인기 이벤트가 아니면 → 줄 안 서도 됨! 바로 입장권!
    if not event.is_hot:
        token = await _issue_queue_token(event_id, current_user.id)
        return {"in_queue": False, "queue_token": token, ...}

    # 2. 인기 이벤트면 → 줄에 추가 (시간 기록)
    timestamp = time.time()
    redis_service.client.zadd(queue_key, {str(current_user.id): timestamp})

    # 3. 혹시 지금 배치 시간 됐나? → Lua 스크립트 실행
    cursor = await _try_advance_batch(event_id)

    # 4. 내가 통과 대상이야?
    if _is_user_released(event_id, current_user.id, cursor):
        token = await _issue_queue_token(event_id, current_user.id)
        return {"in_queue": False, "queue_token": token, ...}

    # 5. 아직 대기 중이면 순서와 배치 정보 알려주기
    return {
        "in_queue": True,
        "position": pos,
        "total": total,
        "estimated_wait_time": estimated_wait_time,
        "batch_size": settings.QUEUE_BATCH_SIZE,      # 50
        "batch_interval": settings.QUEUE_BATCH_INTERVAL,  # 10
    }
```

### 2-8. 상태 조회 API (내 차례 됐어?)

몇 초마다 서버에 "내 차례야?" 하고 물어보는 함수예요.

```python
# queue.py 260~316번 줄
@router.get("/queue/status/{event_id}")
async def get_queue_status(event_id, current_user):
    # ⚠️ 예전에 있던 캐시(cache_key) 코드가 완전히 삭제됨!
    # → 다른 사람 데이터가 섞이는 문제 해결!

    # 1. 배치 진행 시도
    cursor = await _try_advance_batch(event_id)

    # 2. 내 순서 확인
    position = redis_service.client.zrank(queue_key, str(current_user.id))

    # 3. 통과했으면 → 토큰 발급!
    if _is_user_released(event_id, current_user.id, cursor):
        token = await _issue_queue_token(event_id, current_user.id)
        redis_service.client.zrem(queue_key, str(current_user.id))  # 줄에서 제거
        return {"in_queue": False, "queue_token": token, ...}

    # 4. 아직이면 → 현재 상태 알려주기
    return {
        "in_queue": True,
        "position": pos,
        "estimated_wait_time": estimated_wait_time,
        "batch_size": settings.QUEUE_BATCH_SIZE,
        "batch_interval": settings.QUEUE_BATCH_INTERVAL,
    }
```

**핵심 변경**: 예전에는 `cache_key`로 이벤트 단위 캐시를 썼는데, 이제 완전히 제거했어요.
캐시를 쓰면 A 사용자의 정보가 B 사용자에게 보일 수 있었거든요.

---

## 변경점 3: 이벤트 조회 - 이름표 확인 개선 (events.py)

> 파일: `backend/app/api/v1/endpoints/events.py` (238~282번 줄)

공연 정보를 볼 때 "이 사람이 진짜 줄을 서서 통과한 사람이 맞는지" 확인해요.

**예전 코드 (느림 - 이름표를 전부 뒤짐):**
```python
# ❌ 예전: KEYS 패턴으로 전체 스캔 (O(N) - 느림!)
token_pattern = f"queue_token:event:{event_id}:*"
keys = redis_service.client.keys(token_pattern)  # 모든 키를 가져옴
token_valid = False
for key in keys:                    # 하나씩 비교
    stored_token = redis_service.client.get(key)
    if stored_token == x_queue_token:
        token_valid = True
        break
```

**새 코드 (빠름 - 정확한 칸에서 바로 꺼냄):**
```python
# ✅ 지금: 직접 조회 (O(1) - 빠름!)
from app.api.v1.endpoints.queue import validate_queue_token

# current_user가 새로 추가됨 → 누구인지 알아야 정확한 칸을 찾을 수 있음
if not validate_queue_token(event_id, current_user.id, x_queue_token):
    raise HTTPException(status_code=403, detail={...})
```

**바뀐 점 2가지:**
1. `current_user: User = Depends(get_current_user)` 파라미터 추가 (누구인지 알아야 함)
2. `validate_queue_token()` 함수로 교체 (O(N) → O(1))

비유하면:
```
예전: 사물함 1000개를 전부 열어보면서 "이 열쇠가 맞는 사물함이 어디지?" 찾기
지금: "7번 사물함"에 바로 가서 열쇠가 맞는지 확인하기
```

---

## 변경점 4: 티켓/예매 - 이름표 확인 개선 3곳 (tickets.py)

> 파일: `backend/app/api/v1/endpoints/tickets.py`

이 파일에서는 **3가지 함수**가 모두 같은 방식으로 바뀌었어요.

### 바뀐 함수 3개

| 함수 | 하는 일 | 줄 번호 |
|---|---|---|
| `get_event_tickets()` | 좌석 목록 보여주기 | 32번 줄 |
| `lock_seats()` | 좌석 잠그기 (선택 완료) | 362번 줄 |
| `create_bookings()` | 실제 예매하기 | 466번 줄 |

세 함수 모두 **똑같은 패턴**으로 변경:

```python
# ✅ 3개 함수 모두 이렇게 바뀜
from app.api.v1.endpoints.queue import validate_queue_token

if not validate_queue_token(event_id, current_user.id, x_queue_token):
    raise HTTPException(status_code=403, detail={
        "error": "대기열 토큰 무효",
        "message": "대기열 토큰이 만료되었거나 유효하지 않습니다."
    })
```

`get_event_tickets()`에는 `current_user` 파라미터가 **새로 추가**됐어요:

```python
# 예전: current_user가 없었음
def get_event_tickets(event_id, schedule_id, db, x_queue_token):

# 지금: current_user 추가 (누구인지 알아야 토큰을 정확히 찾으니까)
def get_event_tickets(event_id, schedule_id, db, current_user, x_queue_token):
#                                                 ↑ 새로 추가!
```

`lock_seats()`와 `create_bookings()`는 원래 `current_user`가 있어서 파라미터 변경 없이 검증 코드만 바꿨어요.

---

## 변경점 5: 서버 응답 타입 업데이트 (api.ts)

> 파일: `frontend/src/services/api.ts` (424~442번 줄)

프론트엔드에서 "서버가 보내주는 데이터의 모양"을 정해놓는 곳이에요.
서버가 새로 `batch_size`와 `batch_interval`을 보내주니까, 여기에도 추가해야 해요.

```typescript
// 대기열 상태 응답 타입
export interface QueueStatusResponse {
  in_queue: boolean;
  queue_token: string | null;
  position: number | null;
  total: number;
  estimated_wait_time?: number;
  batch_size?: number;      // ← 새로 추가! (한 번에 몇 명)
  batch_interval?: number;  // ← 새로 추가! (몇 초마다)
}

// 대기열 진입 응답 타입
export interface QueueEnterResponse {
  in_queue: boolean;
  queue_token: string | null;
  position: number;
  total: number;
  estimated_wait_time?: number;
  batch_size?: number;      // ← 새로 추가!
  batch_interval?: number;  // ← 새로 추가!
}
```

`?`가 붙은 건 "있을 수도 있고 없을 수도 있어"라는 뜻이에요.
비인기 이벤트처럼 대기열이 없는 경우에도 에러 없이 동작해요.

---

## 변경점 6: 대기 화면 전체 재작성 (QueuePage.tsx)

> 파일: `frontend/src/pages/QueuePage.tsx`

사용자가 보는 "대기 중" 화면이에요. 가장 많이 바뀐 프론트엔드 파일이에요.

### 6-1. 레이스 컨디션 해결 (순서 꼬임 방지)

**예전 코드 (동시에 실행 - 순서가 꼬임):**
```typescript
// ❌ 예전: enterQueue와 pollStatus가 동시에 시작됨
useEffect(() => {
  enterQueue();   // 줄 서기 시작 (아직 완료 안 됨)
  pollStatus();   // 동시에 "몇 번이야?" 물어봄 ← 위험!
}, []);
```

**새 코드 (순서대로 실행 - 안전):**
```typescript
// ✅ 지금: enterQueue가 끝난 후에만 pollStatus 시작
useEffect(() => {
  const initQueue = async () => {
    try {
      const response = await queueApi.enter(Number(eventId));
      //                ↑ await = "이거 끝날 때까지 기다려!"

      if (!response.in_queue && response.queue_token) {
        handleTokenReceived(response.queue_token);
        return;  // 바로 통과! 폴링 필요 없음
      }

      if (response.in_queue) {
        setPosition(response.position);
        setState("waiting");
        startPolling();  // ← 줄 서기가 끝난 다음에야 폴링 시작!
      }
    } catch (error) {
      setState("error");
    }
  };

  initQueue();
}, [eventId]);
```

비유하면:
```
예전: 번호표 안 받았는데 "내 번호가 뭐야?!" 하고 물어봄 → 혼란
지금: 번호표 받고 → 그 다음에 "내 차례 됐어?" 물어봄 → 정상
```

### 6-2. 3가지 화면 상태

예전에는 하나의 화면만 있었는데, 지금은 상황에 따라 3가지 화면을 보여줘요.

```typescript
type QueueState = "loading" | "waiting" | "error";
//                 로딩 중     대기 중      에러 발생
```

| 상태 | 화면 | 언제 보이나? |
|---|---|---|
| `loading` | 로딩 스피너 (뱅글뱅글) | 처음 줄 서는 중 |
| `waiting` | 대기 순서 + 배치 정보 | 줄 서서 기다리는 중 |
| `error` | 에러 메시지 + 다시 시도 버튼 | 문제 발생 시 |

### 6-3. 적응형 폴링 (똑똑한 물어보기 간격)

순서가 가까울수록 자주 물어보고, 멀수록 천천히 물어봐요.

```typescript
// QueuePage.tsx 29~38번 줄
const getPollingInterval = (currentPosition: number | null): number => {
  if (currentPosition === null) return 2000;       // 모르겠으면 2초
  if (currentPosition <= batchSize) return 1000;    // 1~50번: 1초 (곧 내 차례!)
  if (currentPosition <= batchSize * 3) return 2000; // 51~150번: 2초
  if (currentPosition <= batchSize * 10) return 3000; // 151~500번: 3초
  return 5000;                                       // 500번 이후: 5초
};
```

왜 이렇게 할까요?
```
50번: 다음 배치에 들어갈 수 있으니까 → 1초마다 확인! (설렘)
300번: 아직 한참 남았으니까 → 3초마다 확인 (느긋)
1000번: 많이 남았으니까 → 5초마다 확인 (서버도 쉬게 해줌)
```

### 6-4. 지수 백오프 (에러 시 똑똑한 재시도)

인터넷이 끊기면 바로 포기하지 않고, 점점 간격을 늘려가며 다시 시도해요.

```typescript
// QueuePage.tsx 41~45번 줄
const getBackoffInterval = (retries: number): number => {
  const base = 2000;  // 기본 2초
  const interval = base * Math.pow(2, retries);  // 2의 거듭제곱
  return Math.min(interval, 30000);  // 최대 30초
};
```

이렇게 동작해요:
```
1번째 실패 → 2초 후 재시도
2번째 실패 → 4초 후 재시도
3번째 실패 → 8초 후 재시도
4번째 실패 → 16초 후 재시도
5번째 실패 → 포기! "다시 시도" 버튼 보여줌
```

왜 점점 늘릴까요?
- 서버가 잠깐 아프면 조금만 기다리면 나아요
- 서버가 많이 아프면 자주 물어보면 더 아파져요
- 그래서 점점 천천히 물어보는 거예요!

### 6-5. 서버 응답에서 배치 정보 받기

```typescript
// 서버에서 보내준 배치 정보를 화면에 저장
if (status.batch_size) setBatchSize(status.batch_size);      // 50
if (status.batch_interval) setBatchInterval(status.batch_interval);  // 10
```

이 값을 화면에서 이렇게 보여줘요:
```tsx
{/* 배치 정보 표시 */}
<div className="bg-blue-50 rounded-xl p-4 mb-6 text-center">
  <p className="text-sm text-blue-700">
    {batchSize}명씩 {batchInterval}초 간격으로 입장합니다
  </p>
</div>
```

결과: 화면에 `50명씩 10초 간격으로 입장합니다`라고 보여요.

### 6-6. UI 요소들

**반짝이는 파란 점 (대기 중 표시):**
```tsx
<div className="relative inline-block mb-3">
  <span className="absolute inline-flex h-4 w-4 rounded-full bg-blue-400 opacity-75 animate-ping" />
  {/* ↑ 바깥 원: 퍼져나가는 애니메이션 (animate-ping) */}
  <span className="relative inline-flex h-4 w-4 rounded-full bg-blue-500" />
  {/* ↑ 안쪽 원: 고정된 파란 점 */}
</div>
```

**숫자 변경 애니메이션:**
```tsx
<p className={`text-5xl font-bold text-blue-600 transition-all duration-300 ${
    positionChanged ? "animate-count-change" : ""
}`}>
  {position !== null ? `${position}번` : "확인 중..."}
</p>
```
순서가 바뀌면 `animate-count-change` 클래스가 붙어서 숫자가 커졌다 작아지는 효과!

**그라데이션 프로그레스바:**
```tsx
<div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
  <div
    className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600
               transition-all duration-500 ease-out"
    style={{ width: `${Math.max(progressPercent, 2)}%` }}
    {/* ↑ 최소 2%는 보여줌 (너무 작으면 안 보이니까) */}
  />
</div>
```

**2열 정보 카드:**
```tsx
<div className="grid grid-cols-2 gap-3 mb-6">
  <div className="bg-gray-50 rounded-xl p-4 text-center">
    <p className="text-xs text-gray-500 mb-1">전체 대기</p>
    <p className="text-xl font-semibold text-gray-900">{total}명</p>
  </div>
  <div className="bg-gray-50 rounded-xl p-4 text-center">
    <p className="text-xs text-gray-500 mb-1">예상 대기시간</p>
    <p className="text-xl font-semibold text-gray-900">
      {estimatedWaitTime > 0 ? formatWaitTime(estimatedWaitTime) : "-"}
    </p>
  </div>
</div>
```

---

## 변경점 7: 숫자 애니메이션 (index.css)

> 파일: `frontend/src/index.css` (23~30번 줄)

순서 숫자가 바뀔 때 "톡!" 하고 살짝 커졌다 돌아오는 효과예요.

```css
@keyframes count-change {
  0% { transform: scale(1.1); opacity: 0.7; }
  /* 시작: 1.1배 크기, 약간 투명 */

  100% { transform: scale(1); opacity: 1; }
  /* 끝: 원래 크기, 완전 불투명 */
}

.animate-count-change {
  animation: count-change 0.3s ease-out;
  /* 0.3초 동안 부드럽게 */
}
```

동작 순서:
```
120번 → 80번으로 바뀔 때:
  1. 숫자 "80번"이 살짝 크게(1.1배) + 약간 투명하게 나타남
  2. 0.3초에 걸쳐 원래 크기 + 완전 불투명으로 돌아옴
  → 결과: "톡!" 하고 눈에 띄는 효과!
```

---

## 전체 흐름 정리

```
[사용자가 인기 공연 클릭]
        ↓
[QueuePage.tsx] initQueue() 실행
        ↓
[api.ts] queueApi.enter(eventId) → 서버에 POST 요청
        ↓
[queue.py] enter_queue() 실행
  ├── 인기 이벤트? → 대기열에 추가
  ├── _try_advance_batch() → Lua 스크립트로 배치 진행
  ├── _is_user_released() → 내가 통과했는지 확인
  └── 응답: {position, total, batch_size, batch_interval}
        ↓
[QueuePage.tsx] 응답 받음 → 화면 업데이트 → startPolling() 시작
        ↓
[QueuePage.tsx] pollStatus() 반복 실행 (1~5초 간격)
        ↓
[queue.py] get_queue_status() → 매번 배치 진행 + 통과 확인
        ↓
[통과되면]
  ├── [queue.py] 토큰 발급 + 대기열에서 제거
  ├── [QueuePage.tsx] 토큰 저장 → navigate(`/event/${eventId}`)
  └── [events.py] validate_queue_token()으로 토큰 확인 → 공연 정보 보여줌
        ↓
[좌석 선택 → 예매]
  ├── [tickets.py] get_event_tickets() → validate_queue_token() 확인
  ├── [tickets.py] lock_seats() → validate_queue_token() 확인
  └── [tickets.py] create_bookings() → validate_queue_token() 확인
```

---

## 정리

| 항목 | 예전 | 지금 |
|---|---|---|
| 통과 방식 | 1명씩 (`position == 0`) | **50명씩** 배치 (`user_score <= cursor`) |
| 통과 간격 | 불규칙 | **10초**마다 정기적 |
| 동시성 보장 | 없음 (레이스 컨디션) | **Lua 스크립트** (원자적 실행) |
| 캐시 | 이벤트 단위 (데이터 누출) | **캐시 제거** (매번 직접 조회) |
| 토큰 검증 | `KEYS *` 패턴 스캔 O(N) | `GET` 직접 조회 **O(1)** |
| 프론트 순서 | enter + poll 동시 | **enter 완료 후** poll 시작 |
| 폴링 간격 | 고정 | **적응형** (1초~5초) |
| 에러 처리 | alert 1번 | **지수 백오프** (최대 5번 재시도) |
| UI | 기본 | 애니메이션 + **배치 정보** + 2열 카드 |
