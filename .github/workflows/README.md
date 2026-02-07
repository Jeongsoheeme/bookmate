# GitHub Actions CI/CD 가이드

이 폴더에는 GitHub Actions 워크플로우 파일들이 있습니다. 이 문서는 초급자를 위한 상세한 설명입니다.

## 📚 목차

1. [GitHub Actions란?](#github-actions란)
2. [워크플로우 파일 구조](#워크플로우-파일-구조)
3. [현재 설정된 워크플로우](#현재-설정된-워크플로우)
4. [워크플로우 실행 확인 방법](#워크플로우-실행-확인-방법)
5. [문제 해결](#문제-해결)

---

## GitHub Actions란?

**GitHub Actions**는 GitHub에서 제공하는 CI/CD(Continuous Integration/Continuous Deployment) 도구입니다.

### CI/CD란?

- **CI (Continuous Integration)**: 코드를 통합할 때마다 자동으로 테스트하고 빌드하는 것
- **CD (Continuous Deployment)**: 테스트가 통과하면 자동으로 배포하는 것

### 왜 필요한가요?

1. **자동화**: 코드를 푸시하면 자동으로 테스트와 빌드를 실행
2. **품질 보장**: 문제가 있는 코드를 미리 발견
3. **시간 절약**: 수동으로 테스트할 필요 없음
4. **협업 향상**: 팀원들이 안전하게 코드를 통합 가능

---

## 워크플로우 파일 구조

워크플로우 파일은 `.github/workflows/` 폴더에 YAML 형식으로 작성합니다.

### 기본 구조

```yaml
name: 워크플로우 이름

on:
  # 언제 실행할지 정의
  push:
    branches: [main]

jobs:
  # 어떤 작업을 할지 정의
  job-name:
    runs-on: ubuntu-latest
    steps:
      - name: 단계 이름
        run: 실행할 명령어
```

### 주요 키워드 설명

| 키워드    | 설명                                                     |
| --------- | -------------------------------------------------------- |
| `name`    | 워크플로우의 이름 (GitHub UI에 표시됨)                   |
| `on`      | 워크플로우를 실행할 트리거 (push, pull_request 등)       |
| `jobs`    | 실행할 작업들의 집합                                     |
| `runs-on` | 실행할 가상 머신 환경 (ubuntu-latest, windows-latest 등) |
| `steps`   | 작업 내에서 순차적으로 실행할 단계들                     |
| `uses`    | 재사용 가능한 액션 사용 (예: actions/checkout@v4)        |
| `run`     | 실행할 쉘 명령어                                         |

---

## 현재 설정된 워크플로우

현재 `ci.yml` 파일에는 다음 3개의 작업이 설정되어 있습니다:

### 1. Backend (Python/FastAPI)

**실행 내용:**

- Python 3.11 환경 설정
- PostgreSQL 및 Redis 서비스 시작
- 의존성 설치 (`requirements.txt`)
- 테스트 실행 (pytest)
- 빌드 확인

**소요 시간:** 약 2-3분

### 2. Frontend (React/TypeScript)

**실행 내용:**

- Node.js 20 환경 설정
- 의존성 설치 (`npm ci`)
- 코드 스타일 검사 (ESLint)
- TypeScript 타입 검사
- 프로덕션 빌드 (`npm run build`)

**소요 시간:** 약 1-2분

### 3. Admin Frontend (React/TypeScript)

**실행 내용:**

- Frontend와 동일한 과정
- 관리자 페이지 빌드 확인

**소요 시간:** 약 1-2분

### 병렬 실행

이 3개의 작업은 **동시에 병렬로 실행**됩니다. 따라서 전체 워크플로우는 가장 오래 걸리는 작업의 시간만큼만 소요됩니다.

---

## 워크플로우 실행 확인 방법

### 1. GitHub 웹사이트에서 확인

1. GitHub 저장소 페이지로 이동
2. 상단 메뉴에서 **"Actions"** 탭 클릭
3. 왼쪽 사이드바에서 **"CI/CD Pipeline"** 선택
4. 실행 중인 워크플로우나 과거 실행 기록 확인

### 2. 실행 상태 아이콘

- ✅ **초록색 체크**: 모든 작업이 성공
- ❌ **빨간색 X**: 하나 이상의 작업이 실패
- 🟡 **노란색 원**: 현재 실행 중
- ⚪ **회색 원**: 대기 중

### 3. 실패한 작업 확인

1. 실패한 워크플로우 실행 클릭
2. 실패한 작업(job) 클릭
3. 실패한 단계(step) 클릭
4. 로그를 확인하여 오류 원인 파악

---

## 문제 해결

### 자주 발생하는 문제들

#### 1. "테스트 파일이 없습니다" 메시지

**원인:** `backend/tests/` 폴더에 테스트 파일이 없음

**해결:**

- 테스트 파일을 작성하거나
- 워크플로우에서 테스트 단계를 제거

#### 2. Lint 오류

**원인:** 코드 스타일이 ESLint 규칙을 위반

**해결:**

```bash
# 로컬에서 실행하여 오류 확인
cd frontend
npm run lint

# 자동 수정 (가능한 경우)
npm run lint -- --fix
```

#### 3. TypeScript 오류

**원인:** TypeScript 타입 오류

**해결:**

```bash
# 로컬에서 타입 검사
cd frontend
npx tsc --noEmit
```

#### 4. 빌드 실패

**원인:** 코드에 오류가 있거나 의존성 문제

**해결:**

```bash
# 로컬에서 빌드 테스트
cd frontend
npm run build
```

#### 5. 데이터베이스 연결 실패

**원인:** 환경 변수 설정 문제

**해결:**

- 워크플로우 파일의 `env` 섹션 확인
- 데이터베이스 서비스가 정상적으로 시작되었는지 확인

#### 6. Docker Hub 로그인 실패 (unauthorized: incorrect username or password)

**원인:** Docker Hub는 2021년 11월부터 계정 비밀번호 대신 Personal Access Token(PAT)을 사용해야 합니다.

**해결:**

1. **Docker Hub Personal Access Token 생성**

   - https://hub.docker.com/settings/security 접속
   - "New Access Token" 클릭
   - 토큰 이름 입력 (예: "github-actions")
   - 권한 선택 (Read & Write 권한 필요)
   - "Generate" 클릭하여 토큰 생성
   - **⚠️ 중요: 토큰은 한 번만 표시되므로 복사하여 안전한 곳에 보관하세요**

2. **GitHub Secrets 업데이트**

   - GitHub 저장소 → Settings → Secrets and variables → Actions
   - `DOCKER_USERNAME`: Docker Hub 사용자명 (기존 값 유지)
   - `DOCKER_PASSWORD`: 생성한 Personal Access Token으로 업데이트
   - "Update secret" 클릭하여 저장

3. **워크플로우 재실행**
   - Actions 탭에서 실패한 워크플로우 확인
   - "Re-run jobs" 버튼으로 재실행

---

## 다음 단계: 배포 자동화

현재는 CI(테스트 및 빌드)만 설정되어 있습니다. CD(자동 배포)를 추가하려면:

1. **배포 환경 선택**

   - AWS, Azure, GCP 등 클라우드 서비스
   - Vercel, Netlify (프론트엔드)
   - Railway, Render (풀스택)

2. **배포 워크플로우 추가**

   - `.github/workflows/deploy.yml` 파일 생성
   - 배포 서비스의 액션 사용 (예: `vercel-action`)

3. **시크릿 설정**
   - GitHub 저장소 → Settings → Secrets and variables → Actions
   - API 키, 토큰 등 민감한 정보 저장

---

## 추가 학습 자료

- [GitHub Actions 공식 문서](https://docs.github.com/en/actions)
- [GitHub Actions 시작하기](https://docs.github.com/en/actions/quickstart)
- [워크플로우 문법](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

---

## 질문이 있으신가요?

문제가 발생하거나 질문이 있으시면:

1. GitHub Actions 로그를 확인하세요
2. 로컬에서 동일한 명령어를 실행해보세요
3. 오류 메시지를 검색해보세요
