# 🔐 GitHub Actions 인증 가이드

이 문서는 GitHub Actions에서 인증이 어떻게 작동하는지 설명합니다.

## ✅ 기본 설정: 인증 불필요!

**현재 워크플로우는 추가 인증 설정이 필요 없습니다!**

### 왜 인증이 필요 없나요?

GitHub Actions는 **자동으로 `GITHUB_TOKEN`을 제공**합니다:

```yaml
- name: Checkout code
  uses: actions/checkout@v4
  # 👆 이것만으로 충분합니다!
  # GitHub가 자동으로 토큰을 제공합니다
```

### GITHUB_TOKEN이란?

- GitHub Actions가 **자동으로 생성**하는 토큰
- 현재 저장소에 대한 **읽기/쓰기 권한** 자동 제공
- **별도 설정 불필요**
- 워크플로우가 실행되는 동안만 유효

---

## 🔍 언제 추가 인증이 필요한가요?

다음 경우에만 추가 설정이 필요합니다:

### 1. 다른 저장소 접근

다른 저장소의 코드를 가져와야 할 때:

```yaml
- name: Checkout other repo
  uses: actions/checkout@v4
  with:
    repository: other-owner/other-repo
    token: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
    path: ./other-repo
```

### 2. Private 패키지 설치

GitHub Packages에서 private 패키지를 설치할 때:

```yaml
- name: Install private package
  run: npm install @myorg/private-package
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. 외부 서비스 배포

AWS, Vercel, Railway 등에 배포할 때:

```yaml
- name: Deploy to Vercel
  uses: amondnet/vercel-action@v20
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.ORG_ID }}
    vercel-project-id: ${{ secrets.PROJECT_ID }}
```

---

## 🛠️ Personal Access Token (PAT) 생성 방법

필요한 경우에만 다음 단계를 따르세요:

### Step 1: GitHub에서 토큰 생성

1. GitHub 웹사이트 접속
2. 우측 상단 프로필 클릭 → **Settings**
3. 왼쪽 메뉴에서 **Developer settings**
4. **Personal access tokens** → **Tokens (classic)**
5. **Generate new token** → **Generate new token (classic)**
6. 토큰 이름 입력 (예: "GitHub Actions")
7. 권한 선택:
   - `repo` (전체 저장소 접근)
   - `read:packages` (패키지 읽기)
   - `write:packages` (패키지 쓰기)
8. **Generate token** 클릭
9. **토큰을 복사** (한 번만 보여줍니다!)

### Step 2: GitHub Secrets에 저장

1. 저장소 페이지로 이동
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**
4. **New repository secret** 클릭
5. Name: `PERSONAL_ACCESS_TOKEN` (또는 원하는 이름)
6. Secret: 복사한 토큰 붙여넣기
7. **Add secret** 클릭

### Step 3: 워크플로우에서 사용

```yaml
- name: Use token
  env:
    MY_TOKEN: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
  run: echo "토큰 사용"
```

---

## ⚠️ 보안 주의사항

### ❌ 절대 하지 말아야 할 것들

1. **패스워드를 코드에 직접 입력**

   ```yaml
   # ❌ 절대 이렇게 하지 마세요!
   password: mypassword123
   ```

2. **토큰을 커밋에 포함**

   ```yaml
   # ❌ 위험합니다!
   token: ghp_xxxxxxxxxxxxx
   ```

3. **공개 저장소에 민감한 정보 노출**
   - `.env` 파일 커밋
   - 하드코딩된 API 키

### ✅ 올바른 방법

1. **GitHub Secrets 사용**

   ```yaml
   # ✅ 안전합니다!
   token: ${{ secrets.MY_SECRET }}
   ```

2. **환경 변수 사용**

   ```yaml
   # ✅ 안전합니다!
   env:
     API_KEY: ${{ secrets.API_KEY }}
   ```

3. **`.gitignore`에 민감한 파일 추가**
   ```
   .env
   *.key
   secrets/
   ```

---

## 📊 현재 프로젝트 인증 상태

### ✅ 자동으로 작동하는 것들

- ✅ 코드 체크아웃 (`actions/checkout@v4`)
- ✅ 저장소 읽기/쓰기
- ✅ 워크플로우 실행

### ❌ 현재 필요 없는 것들

- ❌ Personal Access Token
- ❌ GitHub 아이디/패스워드
- ❌ 추가 인증 설정

---

## 🎯 요약

| 상황                      | 인증 필요? | 방법                    |
| ------------------------- | ---------- | ----------------------- |
| 현재 저장소 코드 가져오기 | ❌ 아니오  | 자동 (`GITHUB_TOKEN`)   |
| 다른 저장소 접근          | ✅ 예      | Personal Access Token   |
| Private 패키지 설치       | ✅ 예      | `GITHUB_TOKEN` 또는 PAT |
| 외부 서비스 배포          | ✅ 예      | 서비스별 토큰 (Secrets) |

**현재 설정으로는 추가 인증이 전혀 필요 없습니다!** 🎉

---

## 📚 참고 자료

- [GitHub Actions 인증 문서](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [Personal Access Token 생성](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Secrets 관리](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
