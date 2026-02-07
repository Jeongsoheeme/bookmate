from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, String
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.database import get_db
from app.models.event import Event
from app.models.event_schedule import EventSchedule
from app.models.event_seat_grade import EventSeatGrade
from app.schemas.event import EventResponse
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.redis_service import redis_service
import openai
import json
import uuid
from datetime import datetime

router = APIRouter()

# OpenAI 클라이언트 초기화 (API 키가 있는 경우에만)
openai_client = None
if settings.OPENAI_API_KEY:
    openai_client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)


# ============================================================================
# 개선된 검색 알고리즘: 2단계 필터링 방식
# ============================================================================
# 
# [기존 방식 - 비효율적]
# 1. 모든 이벤트를 DB에서 가져옴 (예: 10,000개)
# 2. 모든 이벤트 정보를 LLM에게 전달
# 3. LLM이 10,000개 중에서 선택
# 
# 문제점:
# - LLM API 호출 비용 증가 (토큰 수 증가)
# - 응답 시간 증가 (많은 데이터 처리)
# - 확장성 문제 (이벤트가 많아질수록 더 느려짐)
#
# [개선된 방식 - 효율적]
# 1. 사용자 쿼리에서 키워드 추출 (LLM 사용, 가벼운 작업)
#    예: "조용필 콘서트 예매해줘" → ["조용필", "콘서트"]
# 2. SQL 쿼리로 1차 필터링 (DB에서 빠르게)
#    제목, 설명, 장르, 장소 등에서 키워드 검색
#    예: 10,000개 → 5개로 축소
# 3. 필터링된 결과만 LLM에게 전달하여 최종 선택
#
# 장점:
# - LLM API 호출 비용 감소 (토큰 수 대폭 감소)
# - 응답 시간 단축 (적은 데이터 처리)
# - 확장성 향상 (이벤트가 많아져도 성능 유지)
# ============================================================================

async def extract_keywords_from_query(query: str) -> List[str]:
    """
    사용자 쿼리에서 검색 키워드를 추출합니다.
    LLM을 사용하여 의미 있는 키워드를 추출합니다.
    
    예시:
    - "조용필 콘서트 예매해줘" → ["조용필"]
    - "서울에서 열리는 뮤지컬 찾아줘" → ["서울", "뮤지컬"]
    - "락 메탈 공연" → ["락", "메탈", "락/메탈"]
    """
    if not openai_client:
        # LLM이 없으면 간단한 키워드 추출 (공백 기준)
        return [word.strip() for word in query.split() if len(word.strip()) > 1]
    
    try:
        system_prompt = """당신은 검색 키워드 추출 도우미입니다.
사용자의 자연어 쿼리에서 검색에 유용한 키워드만 추출해주세요.

다음 형식의 JSON으로 응답해주세요:
{
    "keywords": ["키워드1", "키워드2", ...],
    "confidence": 신뢰도 점수 (0.0 ~ 1.0)
}

추출 규칙:
1. 아티스트 이름, 가수 이름, 배우 이름 등은 반드시 포함
2. 장르 (콘서트, 뮤지컬, 연극 등)는 포함
3. 장소 (서울, 부산 등)는 포함
4. 불필요한 단어 (예매해줘, 찾아줘, 알려줘 등)는 제외
5. 키워드는 1~3개 정도로 제한 (너무 많으면 의미 없음)

예시:
- "조용필 콘서트 예매해줘" → {"keywords": ["조용필"], "confidence": 0.9}
- "서울에서 열리는 뮤지컬 찾아줘" → {"keywords": ["서울", "뮤지컬"], "confidence": 0.8}
- "락 메탈 공연 보여줘" → {"keywords": ["락", "메탈"], "confidence": 0.7}"""

        user_prompt = f"""사용자 쿼리: "{query}"

위 쿼리에서 검색 키워드를 추출해주세요."""

        response = openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,  # 키워드 추출은 일관성이 중요하므로 낮은 temperature
        )
        
        ai_result = json.loads(response.choices[0].message.content)
        keywords = ai_result.get("keywords", [])
        
        # 키워드가 없거나 빈 리스트인 경우, 원본 쿼리를 단어로 분리
        if not keywords or len(keywords) == 0:
            keywords = [word.strip() for word in query.split() if len(word.strip()) > 1]
        
        return keywords[:5]  # 최대 5개까지만 반환
        
    except Exception as e:
        # LLM 호출 실패 시, 간단한 키워드 추출로 폴백
        # 불필요한 단어 제거
        stop_words = ["예매", "예약", "찾아", "알려", "보여", "해줘", "해주세요", "하고", "싶어", "싶다"]
        words = query.split()
        keywords = [word.strip() for word in words if word.strip() not in stop_words and len(word.strip()) > 1]
        return keywords[:5]


def filter_events_by_keywords(db: Session, keywords: List[str], limit: int = 50) -> List[Event]:
    """
    키워드 기반으로 이벤트를 SQL 쿼리로 필터링합니다.
    제목, 설명, 장르, 세부장르, 장소에서 키워드를 검색합니다.
    
    Args:
        db: 데이터베이스 세션
        keywords: 검색 키워드 리스트
        limit: 최대 반환 개수 (너무 많으면 LLM 처리 비용 증가)
    
    Returns:
        필터링된 이벤트 리스트
    """
    if not keywords:
        return []
    
    # 각 키워드에 대해 OR 조건으로 검색
    # 제목, 설명, 장르, 세부장르, 장소에서 검색
    conditions = []
    for keyword in keywords:
        keyword_lower = keyword.lower()
        keyword_conditions = [
            func.lower(Event.title).contains(keyword_lower),
        ]
        
        # 설명이 None이 아닌 경우에만 검색 조건 추가
        keyword_conditions.append(
            func.lower(Event.description).contains(keyword_lower)
        )
        
        # 장소가 None이 아닌 경우에만 검색 조건 추가
        keyword_conditions.append(
            func.lower(Event.location).contains(keyword_lower)
        )
        
        # 장르는 enum이므로 문자열로 변환하여 검색
        keyword_conditions.append(
            func.cast(Event.genre, String).contains(keyword)
        )
        
        # 세부장르도 enum이므로 문자열로 변환하여 검색
        keyword_conditions.append(
            func.cast(Event.sub_genre, String).contains(keyword)
        )
        
        conditions.append(or_(*keyword_conditions))
    
    # 모든 키워드 조건을 OR로 연결
    query = db.query(Event)
    if conditions:
        query = query.filter(or_(*conditions))
    
    # 결과 제한 및 반환
    filtered_events = query.limit(limit).all()
    return filtered_events

class AISearchRequest(BaseModel):
    query: str

class AISearchResponse(BaseModel):
    event_id: Optional[int] = None
    event_title: Optional[str] = None
    confidence: float
    message: str
    schedules: Optional[List[Dict[str, Any]]] = None  # 날짜 선택을 위한 스케줄 정보

class IntentClassificationRequest(BaseModel):
    query: str

class IntentClassificationResponse(BaseModel):
    intent: str  # "search" or "booking"
    confidence: float
    message: str

class KeywordExtractionResponse(BaseModel):
    keywords: List[str]  # 추출된 키워드 리스트
    confidence: float

@router.get("/", response_model=List[EventResponse])
def get_all_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """모든 사용자가 접근 가능한 이벤트 목록 조회 (캐싱 적용)"""
    from app.services.redis_service import redis_service
    import json
    
    cache_key = f"events:all:{skip}:{limit}"
    
    # 캐시 확인
    try:
        cached = redis_service.client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    
    # DB 조회
    events = db.query(Event).offset(skip).limit(limit).all()
    result = [EventResponse.from_orm(e) for e in events]
    
    # 캐시 저장 (5분)
    try:
        redis_service.client.setex(
            cache_key,
            300,
            json.dumps([e.dict() for e in result], default=str)
        )
    except Exception:
        pass
    
    return result

@router.get("/{event_id}", response_model=EventResponse)
def get_event_by_id(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_queue_token: str | None = Header(None, alias="X-Queue-Token")
):
    """
    이벤트 상세 정보 조회

    인기 이벤트의 경우 대기열 토큰이 필요합니다.
    토큰은 X-Queue-Token 헤더로 전달됩니다.
    """
    from app.api.v1.endpoints.queue import validate_queue_token

    event = (
        db.query(Event)
        .options(joinedload(Event.schedules))
        .filter(Event.id == event_id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # 인기 이벤트인 경우 대기열 토큰 검증
    if event.is_hot or getattr(event, 'queue_enabled', False):
        if not x_queue_token:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "대기열 토큰 필요",
                    "message": "인기 이벤트는 대기열을 통과해야 합니다."
                }
            )

        if not validate_queue_token(event_id, current_user.id, x_queue_token):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "대기열 토큰 무효",
                    "message": "대기열 토큰이 만료되었거나 유효하지 않습니다."
                }
            )

    return event

@router.post("/search/ai", response_model=AISearchResponse)
async def search_event_by_ai(
    request: AISearchRequest,
    db: Session = Depends(get_db)
):
    """
    [개선된 방식] AI를 사용하여 자연어 쿼리로 이벤트 검색
    
    개선 전: 모든 이벤트를 LLM에게 전달 (비효율적)
    개선 후: 키워드 추출 → SQL 필터링 → 필터링된 결과만 LLM에게 전달 (효율적)
    
    처리 과정:
    1. 사용자 쿼리에서 키워드 추출 (LLM 사용, 가벼운 작업)
    2. SQL 쿼리로 1차 필터링 (DB에서 빠르게)
    3. 필터링된 결과만 LLM에게 전달하여 최종 선택
    """
    if not openai_client:
        raise HTTPException(
            status_code=503,
            detail="AI 검색 기능이 설정되지 않았습니다. OPENAI_API_KEY를 설정해주세요."
        )
    
    try:
        # ========================================================================
        # STEP 1: 키워드 추출 (LLM 사용)
        # ========================================================================
        # 사용자 쿼리에서 검색에 유용한 키워드를 추출합니다.
        # 예: "조용필 콘서트 예매해줘" → ["조용필"]
        keywords = await extract_keywords_from_query(request.query)
        
        if not keywords:
            return AISearchResponse(
                event_id=None,
                event_title=None,
                confidence=0.0,
                message="검색 키워드를 추출할 수 없습니다. 더 구체적으로 검색해주세요.",
                schedules=None
            )
        
        # ========================================================================
        # STEP 2: SQL 쿼리로 1차 필터링 (DB에서 빠르게)
        # ========================================================================
        # 키워드 기반으로 이벤트를 필터링합니다.
        # 제목, 설명, 장르, 세부장르, 장소에서 검색합니다.
        # 예: 10,000개 → 5개로 축소
        filtered_events = filter_events_by_keywords(db, keywords, limit=50)
        
        if not filtered_events:
            # 필터링 결과가 없으면 키워드 기반 검색으로 폴백
            return AISearchResponse(
                event_id=None,
                event_title=None,
                confidence=0.0,
                message=f"'{', '.join(keywords)}' 키워드로 검색된 이벤트가 없습니다. 다른 키워드로 검색해보세요.",
                schedules=None
            )
        
        # ========================================================================
        # STEP 3: 필터링된 결과만 LLM에게 전달하여 최종 선택
        # ========================================================================
        # 필터링된 이벤트 정보를 JSON 형식으로 정리
        events_context = []
        for event in filtered_events:
            events_context.append({
                "id": event.id,
                "title": event.title,
                "description": event.description or "",
                "genre": event.genre.value if event.genre else None,
                "sub_genre": event.sub_genre.value if event.sub_genre else None,
                "location": event.location or "",
            })
        
        system_prompt = """당신은 콘서트 및 공연 이벤트 검색 도우미입니다.
사용자의 자연어 쿼리를 분석하여 가장 관련성 높은 이벤트를 찾아주세요.

다음 형식의 JSON으로 응답해주세요:
{
    "event_id": 가장 관련성 높은 이벤트의 ID (정수),
    "confidence": 관련성 점수 (0.0 ~ 1.0),
    "reason": 선택 이유 (한국어로 간단히 설명)
}

만약 관련성 높은 이벤트를 찾지 못했다면 event_id를 null로 설정하고 confidence를 0.0으로 설정하세요.
이벤트 제목, 장르, 설명, 장소 등을 종합적으로 고려하여 판단하세요."""

        user_prompt = f"""사용자 검색어: "{request.query}"

추출된 키워드: {', '.join(keywords)}

다음은 키워드 기반으로 필터링된 이벤트 목록입니다 (총 {len(events_context)}개):
{json.dumps(events_context, ensure_ascii=False, indent=2)}

위 이벤트 목록 중에서 사용자 검색어와 가장 관련성 높은 이벤트를 찾아주세요."""

        response = openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        
        ai_result = json.loads(response.choices[0].message.content)
        event_id = ai_result.get("event_id")
        confidence = ai_result.get("confidence", 0.0)
        reason = ai_result.get("reason", "")
        
        # 이벤트 ID가 유효한지 확인
        if event_id is None or confidence < 0.3:
            return AISearchResponse(
                event_id=None,
                event_title=None,
                confidence=confidence,
                message=f"검색 결과를 찾지 못했습니다. 다른 키워드로 검색해보세요. ({reason if reason else '관련 이벤트 없음'})",
                schedules=None
            )
        
        # 이벤트 존재 여부 확인 및 스케줄 정보 가져오기
        event = (
            db.query(Event)
            .options(joinedload(Event.schedules))
            .filter(Event.id == event_id)
            .first()
        )
        if not event:
            return AISearchResponse(
                event_id=None,
                event_title=None,
                confidence=0.0,
                message="검색된 이벤트를 찾을 수 없습니다.",
                schedules=None
            )
        
        # 스케줄 정보를 직렬화 가능한 형식으로 변환
        schedules_data = None
        if event.schedules:
            schedules_data = [
                {
                    "id": schedule.id,
                    "start_datetime": schedule.start_datetime.isoformat(),
                    "end_datetime": schedule.end_datetime.isoformat() if schedule.end_datetime else None,
                    "running_time": schedule.running_time,
                }
                for schedule in sorted(event.schedules, key=lambda s: s.start_datetime)
            ]
        
        return AISearchResponse(
            event_id=event.id,
            event_title=event.title,
            confidence=confidence,
            message=f"'{event.title}' 이벤트를 찾았습니다! ({reason})",
            schedules=schedules_data
        )
        
    except openai.RateLimitError as e:
        # OpenAI API 할당량 초과 오류
        return AISearchResponse(
            event_id=None,
            event_title=None,
            confidence=0.0,
            message="AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.",
            schedules=None
        )
    except openai.APIError as e:
        # OpenAI API 기타 오류
        error_message = "AI 검색 서비스에 일시적인 문제가 발생했습니다."
        if hasattr(e, 'status_code'):
            if e.status_code == 429:
                error_message = "AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요."
            elif e.status_code == 401:
                error_message = "AI 서비스 인증에 문제가 있습니다. 관리자에게 문의해주세요."
        return AISearchResponse(
            event_id=None,
            event_title=None,
            confidence=0.0,
            message=error_message,
            schedules=None
        )
    except Exception as e:
        # AI 검색 실패 시, 간단한 키워드 기반 검색으로 폴백
        # 개선된 방식: 키워드 추출 실패 시에도 SQL 필터링 시도
        try:
            # 간단한 키워드 추출 (공백 기준)
            simple_keywords = [word.strip() for word in request.query.split() if len(word.strip()) > 1]
            filtered_events = filter_events_by_keywords(db, simple_keywords, limit=10)
            
            if filtered_events:
                # 첫 번째 결과 반환
                event = (
                    db.query(Event)
                    .options(joinedload(Event.schedules))
                    .filter(Event.id == filtered_events[0].id)
                    .first()
                )
                schedules_data = None
                if event and event.schedules:
                    schedules_data = [
                        {
                            "id": schedule.id,
                            "start_datetime": schedule.start_datetime.isoformat(),
                            "end_datetime": schedule.end_datetime.isoformat() if schedule.end_datetime else None,
                            "running_time": schedule.running_time,
                        }
                        for schedule in sorted(event.schedules, key=lambda s: s.start_datetime)
                    ]
                return AISearchResponse(
                    event_id=event.id if event else None,
                    event_title=event.title if event else None,
                    confidence=0.7,
                    message=f"'{event.title if event else ''}' 이벤트를 찾았습니다!",
                    schedules=schedules_data
                )
        except:
            pass
        
        return AISearchResponse(
            event_id=None,
            event_title=None,
            confidence=0.0,
            message="검색 결과를 찾지 못했습니다. 다른 키워드로 검색해보세요.",
            schedules=None
        )

@router.post("/ai/intent", response_model=IntentClassificationResponse)
async def classify_intent(
    request: IntentClassificationRequest,
    db: Session = Depends(get_db)
):
    """
    사용자의 질문 의도를 분류합니다.
    "검색" 또는 "예매" 중 하나로 분류합니다.
    """
    if not openai_client:
        raise HTTPException(
            status_code=503,
            detail="AI 기능이 설정되지 않았습니다. OPENAI_API_KEY를 설정해주세요."
        )
    
    try:
        system_prompt = """당신은 사용자의 의도를 분류하는 도우미입니다.
사용자의 질문을 분석하여 다음 중 하나로 분류해주세요:
- "search": 콘서트나 이벤트를 찾고 싶을 때
- "booking": 콘서트나 이벤트를 예매하고 싶을 때

다음 형식의 JSON으로 응답해주세요:
{
    "intent": "search" 또는 "booking",
    "confidence": 신뢰도 점수 (0.0 ~ 1.0),
    "reason": 분류 이유 (한국어로 간단히 설명)
}

예매 관련 키워드: 예매, 예약, 티켓 구매, 좌석 선택, 예매하고 싶어, 예약하고 싶어, 티켓 사고 싶어
검색 관련 키워드: 찾아줘, 검색, 어떤 콘서트, 추천, 보여줘, 알려줘"""

        user_prompt = f"""사용자 질문: "{request.query}"

위 질문의 의도를 분류해주세요."""

        response = openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        
        ai_result = json.loads(response.choices[0].message.content)
        intent = ai_result.get("intent", "search")
        confidence = ai_result.get("confidence", 0.5)
        reason = ai_result.get("reason", "")
        
        # intent가 유효한지 확인
        if intent not in ["search", "booking"]:
            intent = "search"
        
        return IntentClassificationResponse(
            intent=intent,
            confidence=confidence,
            message=f"의도: {intent} ({reason})"
        )
        
    except openai.RateLimitError:
        # OpenAI API 할당량 초과 오류
        return IntentClassificationResponse(
            intent="search",
            confidence=0.5,
            message="AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요."
        )
    except openai.APIError as e:
        # OpenAI API 기타 오류
        error_message = "AI 서비스에 일시적인 문제가 발생했습니다."
        if hasattr(e, 'status_code'):
            if e.status_code == 429:
                error_message = "AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요."
            elif e.status_code == 401:
                error_message = "AI 서비스 인증에 문제가 있습니다. 관리자에게 문의해주세요."
        return IntentClassificationResponse(
            intent="search",
            confidence=0.5,
            message=error_message
        )
    except Exception as e:
        # 기본적으로 검색으로 분류
        return IntentClassificationResponse(
            intent="search",
            confidence=0.5,
            message="의도 분류 중 오류가 발생했습니다. 기본값으로 검색으로 분류합니다."
        )
