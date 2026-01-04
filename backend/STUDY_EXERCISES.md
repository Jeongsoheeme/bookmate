# Python 복습 실습 예제

이 파일은 Bookmate 프로젝트의 코드를 기반으로 한 실습 예제입니다.

## 📝 실습 1: 타입 힌팅 이해하기

### 현재 코드 분석

```python
# backend/app/api/v1/endpoints/users.py의 register 함수
def register(user_data: UserCreate, db: Session = Depends(get_db)) -> User:
```

### 실습 과제

1. 위 함수의 각 매개변수와 반환값의 타입을 설명해보세요
2. `UserCreate`와 `User`의 차이점은 무엇인가요?
3. `Depends()`는 무엇을 하는 함수인가요?

### 답안 작성 공간

```
1.
2.
3.
```

---

## 📝 실습 2: Enum 클래스 이해하기

### 현재 코드 분석

```python
# backend/app/models/event.py
class EventGenre(str, enum.Enum):
    MUSICAL = "뮤지컬"
    THEATER = "연극"
    CONCERT = "콘서트"
```

### 실습 과제

1. `str`을 상속받는 이유는 무엇인가요?
2. Enum 값을 문자열로 사용할 수 있는 이유는?
3. 새로운 장르를 추가하려면 어떻게 해야 하나요?

### 실습 코드 작성

```python
# 여기에 새로운 Enum 클래스를 만들어보세요
# 예: TicketStatus (예약됨, 취소됨, 대기중)
```

---

## 📝 실습 3: 제너레이터 함수 이해하기

### 현재 코드 분석

```python
# backend/app/database.py
def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()
```

### 실습 과제

1. `yield`는 무엇을 하는 키워드인가요?
2. `return`과 `yield`의 차이점은?
3. `finally` 블록이 필요한 이유는?

### 실습 코드 작성

```python
# 간단한 제너레이터 함수를 만들어보세요
# 예: 1부터 n까지의 숫자를 생성하는 함수
```

---

## 📝 실습 4: Context Manager 이해하기

### 현재 코드 분석

```python
# backend/app/services/redis_service.py
@contextmanager
def lock_seat(self, ticket_id: int, timeout: int = None):
    # ... LOCK 획득 로직 ...
    try:
        yield acquired
    finally:
        # ... LOCK 해제 로직 ...
```

### 실습 과제

1. `@contextmanager` 데코레이터의 역할은?
2. `with` 문과 함께 사용할 수 있는 이유는?
3. `finally` 블록에서 LOCK을 해제하는 이유는?

### 실습 코드 작성

```python
# 간단한 Context Manager를 만들어보세요
# 예: 파일을 열고 자동으로 닫는 Context Manager
```

---

## 📝 실습 5: SQLAlchemy 쿼리 이해하기

### 현재 코드 분석

```python
# backend/app/api/v1/endpoints/users.py
existing_user = db.query(User).filter(User.email == user_data.email).first()
```

### 실습 과제

1. `.query()`는 무엇을 반환하나요?
2. `.filter()`는 SQL의 어떤 절과 같나요?
3. `.first()`와 `.all()`의 차이점은?

### 실습 코드 작성

```python
# 다음 쿼리를 작성해보세요:
# 1. 이메일이 "test@example.com"인 활성 사용자 찾기
# 2. 최근 7일 내에 생성된 사용자 목록 가져오기
# 3. 관리자 권한이 있는 사용자 수 세기
```

---

## 📝 실습 6: JWT 토큰 이해하기

### 현재 코드 분석

```python
# backend/app/core/security.py
def create_access_token(data: dict, expires_delta: timedelta = None):
  to_encode = data.copy()
  expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
  to_encode.update({"exp": expire, "type": "access"})
  encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
  return encoded_jwt
```

### 실습 과제

1. JWT 토큰의 구조는 어떻게 되어 있나요?
2. `exp` 필드는 무엇을 의미하나요?
3. `SECRET_KEY`가 필요한 이유는?

### 실습 코드 작성

```python
# 토큰을 디코딩해서 페이로드를 확인하는 함수를 만들어보세요
```

---

## 📝 실습 7: 비밀번호 해싱 이해하기

### 현재 코드 분석

```python
# backend/app/core/security.py
def get_password_hash(password: str) -> str:
  password_hash_bytes = hashlib.sha256(password.encode('utf-8')).digest()
  hashed = bcrypt.hashpw(password_hash_bytes, bcrypt.gensalt())
  return hashed.decode('utf-8')
```

### 실습 과제

1. 왜 SHA256과 bcrypt를 둘 다 사용하나요?
2. `gensalt()`는 무엇을 하나요?
3. 같은 비밀번호를 해싱해도 결과가 다른 이유는?

### 실습 코드 작성

```python
# 비밀번호를 해싱하고 검증하는 간단한 예제를 작성해보세요
```

---

## 📝 실습 8: Redis 분산 락 이해하기

### 현재 코드 분석

```python
# backend/app/services/redis_service.py
acquired = self.client.set(
    lock_key,
    lock_value,
    nx=True,  # 키가 없을 때만 설정
    ex=lock_timeout  # 만료 시간 설정
)
```

### 실습 과제

1. `nx=True`는 무엇을 의미하나요?
2. `ex=lock_timeout`은 무엇을 하나요?
3. 분산 락이 필요한 이유는?

### 실습 코드 작성

```python
# Redis를 사용한 간단한 카운터를 만들어보세요
# 여러 프로세스에서 동시에 접근해도 안전하게 동작해야 합니다
```

---

## 📝 실습 9: 의존성 주입 이해하기

### 현재 코드 분석

```python
# backend/app/api/v1/endpoints/users.py
def register(user_data: UserCreate, db: Session = Depends(get_db)) -> User:
```

### 실습 과제

1. `Depends()`는 어떻게 동작하나요?
2. 의존성 주입의 장점은 무엇인가요?
3. `get_current_user`는 어떻게 사용되나요?

### 실습 코드 작성

```python
# 간단한 의존성 함수를 만들어보세요
# 예: 현재 시간을 반환하는 의존성
```

---

## 📝 실습 10: 에러 처리 이해하기

### 현재 코드 분석

```python
# backend/app/api/v1/endpoints/users.py
if existing_user:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Email already registered"
    )
```

### 실습 과제

1. `HTTPException`은 무엇인가요?
2. 적절한 HTTP 상태 코드를 선택하는 기준은?
3. 에러 메시지는 어떻게 작성해야 하나요?

### 실습 코드 작성

```python
# 다양한 에러 상황에 대한 예외 처리를 작성해보세요
# 예: 사용자를 찾을 수 없을 때, 권한이 없을 때 등
```

---

## 🎯 종합 실습 프로젝트

### 미니 프로젝트: 리뷰 시스템 추가하기

다음 기능을 구현해보세요:

1. **모델 생성**: `Review` 모델 만들기

   - 이벤트와 사용자에 대한 관계 설정
   - 평점, 댓글 필드 추가

2. **API 엔드포인트**:

   - 리뷰 작성 (POST)
   - 리뷰 목록 조회 (GET)
   - 리뷰 수정 (PUT)
   - 리뷰 삭제 (DELETE)

3. **검증 로직**:

   - 본인이 작성한 리뷰만 수정/삭제 가능
   - 평점은 1-5 사이의 값만 허용

4. **추가 기능**:
   - 이벤트별 평균 평점 계산
   - 최신 리뷰 순으로 정렬

### 구현 체크리스트

- [ ] 모델 정의 완료
- [ ] Pydantic 스키마 정의 완료
- [ ] API 엔드포인트 구현 완료
- [ ] 인증/권한 검증 완료
- [ ] 에러 처리 완료
- [ ] 테스트 완료

---

## 💡 학습 팁

1. **코드를 직접 타이핑**: 복사-붙여넣기보다 직접 타이핑하며 학습
2. **에러를 경험하기**: 의도적으로 에러를 발생시켜보고 해결하기
3. **변형해보기**: 기존 코드를 수정해서 다른 방식으로 구현해보기
4. **문서 읽기**: 공식 문서를 읽으며 개념 이해하기
5. **동료와 토론**: 다른 사람과 코드를 리뷰하며 학습하기

---

## 📚 참고 자료

각 실습을 완료한 후, 다음 자료를 참고하세요:

- **타입 힌팅**: [PEP 484](https://www.python.org/dev/peps/pep-0484/)
- **Enum**: [Python Enum 공식 문서](https://docs.python.org/3/library/enum.html)
- **제너레이터**: [Python 제너레이터 가이드](https://docs.python.org/3/howto/functional.html#generators)
- **Context Manager**: [Python Context Manager](https://docs.python.org/3/library/contextlib.html)
- **SQLAlchemy**: [SQLAlchemy 튜토리얼](https://docs.sqlalchemy.org/en/14/tutorial/)
- **JWT**: [JWT.io](https://jwt.io/)
- **Redis**: [Redis 공식 문서](https://redis.io/docs/)

행운을 빕니다! 🚀
