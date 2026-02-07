import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { queueApi } from "../services/api";

type QueueState = "loading" | "waiting" | "error";

const QueuePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<QueueState>("loading");
  const [position, setPosition] = useState<number | null>(null);
  const [prevPosition, setPrevPosition] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);
  const [batchSize, setBatchSize] = useState(50);
  const [batchInterval, setBatchInterval] = useState(10);
  const [errorCount, setErrorCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pollingActiveRef = useRef(false);

  const MAX_RETRIES = 5;

  // 적응형 폴링 간격
  const getPollingInterval = useCallback(
    (currentPosition: number | null): number => {
      if (currentPosition === null) return 2000;
      if (currentPosition <= batchSize) return 1000;
      if (currentPosition <= batchSize * 3) return 2000;
      if (currentPosition <= batchSize * 10) return 3000;
      return 5000;
    },
    [batchSize],
  );

  // 지수 백오프 간격
  const getBackoffInterval = useCallback((retries: number): number => {
    const base = 2000;
    const interval = base * Math.pow(2, retries);
    return Math.min(interval, 30000);
  }, []);

  // 토큰 획득 후 이동 처리
  const handleTokenReceived = useCallback(
    (token: string) => {
      localStorage.setItem(`queueToken:${eventId}`, token);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      pollingActiveRef.current = false;
      navigate(`/event/${eventId}`);
    },
    [eventId, navigate],
  );

  // 폴링 함수
  const pollStatus = useCallback(async () => {
    if (!mountedRef.current || !pollingActiveRef.current) return;

    try {
      const status = await queueApi.getStatus(Number(eventId));

      if (!mountedRef.current) return;

      // 성공 시 에러 카운트 리셋
      setErrorCount(0);
      setErrorMessage("");

      if (!status.in_queue && status.queue_token) {
        handleTokenReceived(status.queue_token);
        return;
      }

      if (status.in_queue) {
        setPrevPosition(position);
        setPosition(status.position);
        setTotal(status.total);
        setEstimatedWaitTime(status.estimated_wait_time || 0);
        if (status.batch_size) setBatchSize(status.batch_size);
        if (status.batch_interval) setBatchInterval(status.batch_interval);

        if (pollingActiveRef.current && mountedRef.current) {
          const nextInterval = getPollingInterval(status.position);
          timeoutRef.current = setTimeout(pollStatus, nextInterval);
        }
      }
    } catch (error) {
      if (!mountedRef.current) return;

      console.error("대기열 상태 확인 실패:", error);
      setErrorCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= MAX_RETRIES) {
          setState("error");
          setErrorMessage(
            "대기열 상태를 확인할 수 없습니다. 네트워크 연결을 확인해주세요.",
          );
          pollingActiveRef.current = false;
          return newCount;
        }
        // 지수 백오프로 재시도
        if (pollingActiveRef.current && mountedRef.current) {
          const backoff = getBackoffInterval(newCount);
          timeoutRef.current = setTimeout(pollStatus, backoff);
        }
        return newCount;
      });
    }
  }, [
    eventId,
    position,
    handleTokenReceived,
    getPollingInterval,
    getBackoffInterval,
  ]);

  // 폴링 시작
  const startPolling = useCallback(() => {
    pollingActiveRef.current = true;
    pollStatus();
  }, [pollStatus]);

  // 초기화: enterQueue 완료 후에만 폴링 시작 (레이스 컨디션 해결)
  useEffect(() => {
    if (!eventId) return;
    mountedRef.current = true;

    const initQueue = async () => {
      try {
        const response = await queueApi.enter(Number(eventId));

        if (!mountedRef.current) return;

        if (!response.in_queue && response.queue_token) {
          handleTokenReceived(response.queue_token);
          return;
        }

        if (response.in_queue) {
          setPosition(response.position);
          setTotal(response.total);
          setEstimatedWaitTime(response.estimated_wait_time || 0);
          if (response.batch_size) setBatchSize(response.batch_size);
          if (response.batch_interval) setBatchInterval(response.batch_interval);
          setState("waiting");
          // enterQueue 완료 후 순차적으로 폴링 시작
          startPolling();
        }
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("대기열 진입 실패:", error);
        setState("error");
        setErrorMessage("대기열에 진입할 수 없습니다. 다시 시도해주세요.");
      }
    };

    initQueue();

    return () => {
      mountedRef.current = false;
      pollingActiveRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // 재시도 핸들러
  const handleRetry = () => {
    setState("loading");
    setErrorCount(0);
    setErrorMessage("");
    pollingActiveRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const retryInit = async () => {
      try {
        const response = await queueApi.enter(Number(eventId));
        if (!mountedRef.current) return;

        if (!response.in_queue && response.queue_token) {
          handleTokenReceived(response.queue_token);
          return;
        }

        if (response.in_queue) {
          setPosition(response.position);
          setTotal(response.total);
          setEstimatedWaitTime(response.estimated_wait_time || 0);
          if (response.batch_size) setBatchSize(response.batch_size);
          if (response.batch_interval) setBatchInterval(response.batch_interval);
          setState("waiting");
          startPolling();
        }
      } catch {
        if (!mountedRef.current) return;
        setState("error");
        setErrorMessage("대기열에 진입할 수 없습니다. 다시 시도해주세요.");
      }
    };

    retryInit();
  };

  const formatWaitTime = (seconds: number): string => {
    if (seconds < 60) {
      return `약 ${seconds}초`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `약 ${minutes}분`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.ceil((seconds % 3600) / 60);
      return `약 ${hours}시간 ${minutes}분`;
    }
  };

  const progressPercent =
    position && total > 0 ? ((total - position + 1) / total) * 100 : 0;

  // position 변경 감지 (애니메이션 트리거)
  const positionChanged =
    prevPosition !== null && position !== null && prevPosition !== position;

  // 로딩 상태
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
            <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 text-lg">대기열에 진입하고 있습니다...</p>
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (state === "error") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
            <div className="text-red-500 text-5xl mb-4">!</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              오류가 발생했습니다
            </h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 대기 중 상태
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          {/* 헤더 */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-3">
              <span className="absolute inline-flex h-4 w-4 rounded-full bg-blue-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              대기 중입니다
            </h2>
          </div>

          {/* 현재 순서 (대형 표시) */}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500 mb-1">현재 대기 순서</p>
            <p
              className={`text-5xl font-bold text-blue-600 transition-all duration-300 ${
                positionChanged ? "animate-count-change" : ""
              }`}
            >
              {position !== null ? `${position}번` : "확인 중..."}
            </p>
          </div>

          {/* 프로그레스바 */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progressPercent, 2)}%` }}
              />
            </div>
          </div>

          {/* 2열 정보 카드 */}
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

          {/* 배치 정보 */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-blue-700">
              {batchSize}명씩 {batchInterval}초 간격으로 입장합니다
            </p>
          </div>

          {/* 안내 메시지 */}
          <p className="text-sm text-gray-500 text-center">
            잠시만 기다려주세요. 순서가 되면 자동으로 진행됩니다.
          </p>

          {estimatedWaitTime > 0 && (
            <p className="text-xs text-gray-400 text-center mt-2">
              * 실제 대기 시간은 상황에 따라 달라질 수 있습니다
            </p>
          )}

          {/* 에러 카운트 표시 (재시도 중일 때) */}
          {errorCount > 0 && errorCount < MAX_RETRIES && (
            <p className="text-xs text-amber-500 text-center mt-3">
              연결 재시도 중... ({errorCount}/{MAX_RETRIES})
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueuePage;
