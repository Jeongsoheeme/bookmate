# ============================================
# Admin Frontend Dockerfile (React + Nginx)
# ============================================
# 멀티 스테이지 빌드 사용

# Stage 1: 빌드 단계
FROM node:20-alpine AS builder

WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci

# 소스 코드 복사
COPY . .

# 프로덕션 빌드
RUN npm run build

# Stage 2: 실행 단계 (Nginx)
FROM nginx:alpine

# 빌드된 파일을 Nginx의 기본 디렉토리로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx 설정 파일 복사 (선택사항)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# 포트 노출
EXPOSE 80

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]

