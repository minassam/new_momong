# MERCI MOMONG — 기술 구조

> **어떻게 만들었는가** 의 single source of truth. 디렉토리, 데이터, 인프라, 배포 흐름.
> 제품 정의는 [PLANNING.md](./PLANNING.md), 실행 방법은 [README.md](./README.md).

---

## 1. 시스템 구성도

```
                          ┌────────────────────────────────────┐
                          │         사용자 (디자이너)           │
                          │      https://www.merci-momong.com  │
                          └─────────────────┬──────────────────┘
                                            │
                                            ▼
              ┌──────────────────────────────────────────────────┐
              │             user frontend (Next.js)               │
              │      AWS Amplify, repo path: frontend/user        │
              └──────┬────────────────────────────┬──────────────┘
                     │ JWT bearer                  │ direct PUT
                     ▼                              ▼
              ┌────────────────┐       ┌──────────────────────────┐
              │   backend EB    │◄──────┤  S3 momong-staging       │
              │   (NestJS)      │  GET  │  /face-analysis/<uid>/.. │
              │ Application:    │ presign│ /elasticbeanstalk-...    │
              │ momong-staging  │        └──────────────────────────┘
              └──┬──────────┬───┘
   PG TypeORM   │          │     POST /analyze-url
  ┌─────────────▼─┐        ▼
  │   RDS         │   ┌──────────────────────────────┐
  │  PostgreSQL   │   │  face_landmark Python EB     │
  │ tables: users │   │ (FastAPI, MediaPipe, OpenCV) │
  │ consultations │   │ Application:                  │
  │ face_analysis │   │ momong-face-analyze-staging  │
  │ _results 등    │   └──────────────────────────────┘
  └───────────────┘

                          ┌────────────────────────────────────┐
                          │      관리자 (운영팀)                │
                          │      https://admin.merci-momong.com │
                          └─────────────────┬──────────────────┘
                                            │
                                            ▼
              ┌──────────────────────────────────────────────────┐
              │            admin frontend (Next.js)               │
              │      AWS Amplify, repo path: frontend/admin       │
              └─────────────────────────┬────────────────────────┘
                                        │
                                        ▼ JWT bearer (admin)
                              (위와 동일한 backend EB 호출)
```

---

## 2. 기술 스택

| 영역 | 기술 | 비고 |
|---|---|---|
| Backend | NestJS 11 + TypeORM | port 3200 (local) |
| DB | PostgreSQL 15 | RDS (운영), 로컬 자체 설치 |
| Frontend (user) | Next.js 16 + React 19 + Tailwind v4 | port 3203 (local) |
| Frontend (admin) | Next.js 16 + React 19 + Tailwind v4 | port 3202 (local) |
| 인증 | JWT (HS256) | secret = `JWT_SECRET` env |
| 얼굴 분석 | FastAPI + MediaPipe + OpenCV | 별도 repo `face_landmark/` |
| 클라이언트 얼굴 검출 | `@mediapipe/tasks-vision` | CDN 모델, 픽스된 버전 0.10.35 |
| 애니메이션 | `motion/react` | |
| 이미지 저장 | AWS S3 (`momong-staging`) | presigned URL PUT/GET |
| E2E 테스트 | Playwright | `e2e/` 디렉토리 |
| 배포 (backend) | GitHub Actions → S3 → EB | `.github/workflows/deploy-backend.yml` |
| 배포 (frontend) | AWS Amplify (auto on push) | `amplify.yml` |

---

## 3. 디렉토리 구조

```
new_momong/
├─ backend/                       NestJS API 서버
│  ├─ src/
│  │  ├─ admin/                   어드민 인증 + 유저 관리
│  │  ├─ auth/                    매장(디자이너) 회원/로그인
│  │  ├─ customers/               고객 정보
│  │  ├─ consultations/           컨설팅 기록 (FIT/3WAY 공용)
│  │  ├─ shares/                  공유 링크
│  │  ├─ pre-surveys/             사전설문지 (공개 토큰 기반)
│  │  │  ├─ pre-surveys.entity.ts        (table: pre_surveys)
│  │  │  ├─ pre-surveys.service.ts       (토큰 생성/조회/저장 + photoDisplayUrls 매핑)
│  │  │  └─ pre-surveys.controller.ts    (인증 + 공개 토큰 endpoint)
│  │  ├─ feature-settings/        기능 플래그 (FIT/3WAY/코스 on-off)
│  │  ├─ module-configs/         얼굴분석 모듈 표시 설정 (라벨/순서/노출/단위)
│  │  │  ├─ module-config.entity.ts      (table: module_configs)
│  │  │  ├─ module-configs.service.ts    (조회/수정 + 24개 시드 + 새 모듈 자동생성)
│  │  │  └─ module-configs.controller.ts (공개 조회 + admin 수정)
│  │  ├─ face-analysis/           얼굴 분석 (Python 호출 + S3 + DB)
│  │  │  ├─ face-analysis.entity.ts        (table: face_analysis_results)
│  │  │  ├─ python-analysis.service.ts     (Python 호출 + S3 presign)
│  │  │  ├─ face-analysis.service.ts       (분석 호출 + DB 저장 + 기록 조회)
│  │  │  └─ face-analysis.controller.ts    (user/admin 분리 endpoint)
│  │  └─ common/                  미들웨어/필터
│  ├─ migrations/                 운영 DB 수동 마이그레이션 SQL
│  │  ├─ 001_create_face_analysis_results.sql
│  │  ├─ 002_add_source_to_face_analysis_results.sql
│  │  ├─ 003_create_pre_surveys.sql
│  │  └─ 004_create_module_configs.sql
│  └─ Procfile                    EB 실행 (web: node dist/main)
├─ frontend/
│  ├─ user/                       디자이너용 (3203)
│  │  └─ src/
│  │     ├─ app/
│  │     │  ├─ (app)/             공통 AppHeader layout (인증 필요)
│  │     │  │  ├─ /3way, /3way/consulting
│  │     │  │  ├─ /fit
│  │     │  │  ├─ /consulting/start
│  │     │  │  └─ /customers, /customers/[id]
│  │     │  ├─ login, signup, find-id, reset-password
│  │     │  ├─ share/[token]      컨설팅 결과 공유 (공개, 비밀번호)
│  │     │  └─ pre-survey/[token] 사전설문지 작성 (공개, 토큰만)
│  │     ├─ components/
│  │     │  ├─ steps/             FIT 컨설팅 step 컴포넌트
│  │     │  ├─ 3way/              3WAY 컨설팅 화면 (28+ 컴포넌트)
│  │     │  ├─ pre-survey/        사전설문 8섹션 + PageLayout + PhotoUploader
│  │     │  └─ ui/                공용 UI (Modal, ProgressBar 등)
│  │     ├─ contexts/             AuthContext, FeaturesContext
│  │     └─ utils/                api.ts, 3way-api.ts, face-analysis-api.ts, pre-survey-api.ts, image-resize.ts
│  └─ admin/                      운영자용 (3202)
│     └─ src/
│        ├─ app/                  /dashboard, /users, /features, /face-analysis-test, /face-modules
│        ├─ components/           AdminHeader, AdminFaceAnalysisCapture, FaceOverlay, useFaceDetector
│        └─ utils/                api.ts, auth.ts, face-analysis-api.ts, image-resize.ts
├─ .github/workflows/             deploy-backend.yml (GitHub Actions → EB)
├─ amplify.yml                    Amplify 빌드 설정 (user/admin 동시 정의)
├─ e2e/                           Playwright E2E
├─ figma/                         Figma Make 원본 (참고용)
├─ docs/                          기능별 상세 설계 노트 (얼굴분석 매핑/동적구조, 3WAY 디자인방향 로직, 디자이너 폼)
├─ PLANNING.md                    제품 정의
├─ ARCHITECTURE.md                본 문서
├─ README.md                      실행/운영
└─ TODO.md                        남은 작업
```

### 3-1. 프론트 공통 코드 중복 (의도된 것 — 합칠 수 없음)

`user` 와 `admin` 은 **완전히 독립된 두 Next.js 앱**이다. `amplify.yml` 이 각 앱의
`appRoot` 안에서 따로 `npm ci` 를 돌리므로, `frontend/` 상위에는 `node_modules` 가 없다.

그래서 아래 두 파일은 **양쪽에 동일한 복사본으로 존재한다.**

| 파일 | user | admin |
|---|---|---|
| `useFaceDetector.ts` | `src/components/3way/` | `src/components/` |
| `image-resize.ts` | `src/utils/` | `src/utils/` |

`frontend/shared/` 로 빼는 방법은 **검증 결과 실패한다** — Turbopack 이 프로젝트 루트
바깥 경로를 해석하지 못하고(`Module not found: Can't resolve '@shared/...'`),
TypeScript 도 `react` / `@mediapipe/tasks-vision` 을 해석하지 못한다.

> **합치려면**: `frontend/` 를 npm workspaces 로 전환 + `amplify.yml` 의 `npm ci` 를
> repo 루트로 이동 (또는 `next.config.ts` 에 `turbopack.root` 지정).
> 배포 구조 변경이라 보류 중.
>
> **그때까지**: 두 파일 상단에 동기화 경고 주석이 달려 있다. **한쪽을 고치면 반드시 나머지도 같이 고칠 것.**

---

## 4. 데이터 모델

> 컬럼 상세는 `backend/src/**/*.entity.ts` 가 정답. 여기는 개요.

| 엔티티 | 키 컬럼 | 비고 |
|---|---|---|
| `users` | id, email, store_name, owner_name, password_hash, phone, status, role | 디자이너 |
| `customers` | id, user_id, name, phone, gender, age_group, memo | 고객 |
| `consultations` | id, user_id, customer_id, visit_date, designer_name, after_note, client_info(jsonb), today_keyword, fashion_style, face_image_type, hair_condition, hair_style_proposal, today_design, next_direction, design_cycle_guide | FIT + 3WAY 공용 |
| `consultation_shares` | id, consultation_id, token, password, expires_at | 공유 링크 |
| `admin_accounts` | id, email, password_hash | 디자이너 users 와 별도 |
| `feature_settings` | id(=1), fit_enabled, three_way_enabled, course_*_enabled | 싱글톤 |
| `face_analysis_results` | id, user_id, customer_id, detection_type(WNC/SNH), source(consultation/admin_test), face_image_url, python_analysis_result(jsonb), client_provided_data(jsonb), detected_at | 한 분석 = WNC + SNH 2행 |
| `pre_surveys` | id, user_id, customer_id, token(unique), answers(jsonb), filled_at, created_at, updated_at | 디자이너 발급 토큰으로 고객이 방문 전 작성. 사진 URL 도 answers 안에 raw S3 URL 로 저장 |
| `module_configs` | id, axis(WNC/SNH), module_key, label, sort_order, display, unit, updated_at | 얼굴분석 모듈의 **표시** 설정 (전역). `(axis, module_key)` unique. 측정값(Python)과 분리된 표시 SSOT — 상세는 [docs/face-analysis-dynamic-architecture.md](./docs/face-analysis-dynamic-architecture.md) |

### 4-1. consultation 에서 얼굴 분석 결과 참조

`consultations.client_info.threeWay.faceAnalysis` jsonb 안에:

```jsonc
{
  "wncId": "uuid-...",           // face_analysis_results FK 역할
  "snhId": "uuid-...",
  "wncFinal": "W",               // 빠른 조회용 캐시
  "snhFinal": "N",
  "imageType": "W / N",
  "faceImageUrl": "https://momong-staging.s3.../face-analysis/<uid>/<uuid>.jpg"
}
```

→ DB schema 변경 없이 jsonb 만으로 연결. 한 컨설팅 = 한 행 + face_analysis_results 의 2행.

### 4-3. 모몽 OS 연동 (리포트 → 직원 앱 고객 기록)

`backend/src/os-sync/` — 상담 저장 · 수정 · 삭제, 공유 링크 만들기 때 `OsSyncService` 가
모몽 OS(`momong9311-dot/merci-care-cloudflare`) `POST /api/consult-report` 로 요약을 보낸다
(헤더 `x-merci-key`, 기다리지 않음 · 실패해도 저장은 그대로). env `MOMONG_OS_URL` + `MOMONG_OS_KEY`.
보내는 것: 상담 id · 매장(`users.store_name`) · 담당 · 날짜 · 코스 · 고객(이름 · 전화 · 성별 · 연령대) ·
요약(`consult-summary.ts` — 이미지 타입 · 원하는 이미지 · 키워드 · 모발 상태 · 오늘 디자인 · 다음 방향 ·
관리 주기 · 애프터 노트) · 공유 링크와 비밀번호. 모몽 OS 는 전화번호 + 이름으로 자기 고객을 찾아
고객 창 '헤어컨설팅 리포트'에 보여 준다. 1WAY 스타일 id → 이름 표는 `HairConsulting.tsx` 의 옵션과 맞출 것.

### 4-2. face_analysis_results.python_analysis_result jsonb 구조

```jsonc
{
  "final": "W",                    // 다수결 W/N/C 또는 S/N/H
  "counts": { "W": 6, "N": 3, "C": 1 },
  "results": {
    "1": {
      "name": "피부톤",
      "grade": "W",
      "value": 1.42,                // optional, 모듈마다 다름
      "description": "...",          // optional
      "measurement": {               // 오버레이 그리기용
        "image_size": { "width": 800, "height": 1000 },
        "shapes": [
          { "type": "rectangle", "points": [...], "stroke": "#A52A2A", "dashed": true },
          { "type": "text", "point": {...}, "text": "1.42" }
        ]
      }
    }
  }
}
```

---

## 5. API 구조

> 전역 프리픽스 `/api` (`main.ts` 의 `setGlobalPrefix('api', { exclude: ['/'] })`).
> 정확한 시그니처/스키마는 Swagger 가 자동 생성: `http://localhost:3200/api/docs` (Basic Auth)

가드 표기: **J** = `JwtAuthGuard` (디자이너 토큰) · **A** = `AdminGuard` (어드민 토큰) · **공개** = 인증 없음

### 5-0. 헬스 체크
| 메서드 | 경로 | 가드 | 설명 |
|---|---|---|---|
| GET | `/` | 공개 | EB 헬스 체크. `{ status, uptime, timestamp }` (프리픽스 제외 대상) |

### 5-1. 인증/유저 (`/api/auth`)
| 메서드 | 경로 | 가드 | 설명 |
|---|---|---|---|
| POST | `/signup` | 공개 | 디자이너 가입 (`status: pending`) |
| POST | `/login` | 공개 | 로그인 |
| POST | `/find-id` | 공개 | 아이디(이메일) 찾기 |
| POST | `/reset-password` | 공개 | 비밀번호 재설정 |
| GET | `/me` | J | 내 정보 |

- 디자이너 status: `pending` → admin 승인 → `approved` (거절 시 `rejected`)

### 5-2. 고객 (`/api/customers`) — 전부 **J**
`GET /` · `GET /:id` · `POST /` · `PATCH /:id` · `DELETE /:id`

### 5-3. 컨설팅 (`/api/consultations`) — 전부 **J**
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/` | 저장 (body 의 `customerId` 로 고객 연결, 전화번호 upsert 폴백) |
| GET | `/` | 내 컨설팅 목록 |
| GET | `/by-customer/:phone` | 전화번호로 조회 (레거시 경로) |
| GET | `/by-customer-id/:customerId` | **고객 ID 로 조회 (현재 프론트가 쓰는 경로)** |
| GET | `/:id` | 단건 조회 |
| PATCH | `/:id` | 수정 |
| DELETE | `/:id` | 삭제 |

### 5-4. 공유 링크 (`/api/shares`)
| 메서드 | 경로 | 가드 | 설명 |
|---|---|---|---|
| POST | `/:consultationId` | J | 공유 링크 발급 (비밀번호 지정) |
| GET | `/by-consultation/:consultationId` | J | 해당 컨설팅의 발급된 링크 조회 |
| POST | `/:token/verify` | 공개 | 비밀번호 검증 후 컨설팅 내용 반환 |

> 공유 페이지는 비밀번호를 **POST body 로** 보내 검증한다. 토큰만으로 조회하는 `GET /:token` 은 **없다.**

### 5-5. 얼굴 분석 (`/api/face-analysis`)
| 메서드 | 경로 | 가드 | 설명 |
|---|---|---|---|
| POST | `/upload-url` | J | PUT presigned URL 발급 |
| POST | `/analyze` | J | Python 호출 + DB 저장 (`source=consultation`) |
| POST | `/admin/upload-url` | A | admin 테스트용 presigned URL |
| POST | `/analyze-test` | A | `source=admin_test` |
| GET | `/admin/history?limit=N` | A | admin_test 기록 목록 |
| GET | `/admin/:id` | A | 단건 상세 |
| DELETE | `/admin/:id` | A | WNC/SNH 짝 삭제 |

### 5-6. 사전설문지 (`/api/pre-surveys`)
**디자이너** (J, owner 확인)
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/` | 토큰 발급 (body: `{ customerId }`) |
| GET | `/by-customer/:customerId` | 고객별 설문 목록 |
| GET | `/:id` | 단건 상세 (answers + `photoDisplayUrls` 매핑) |
| DELETE | `/:id` | 삭제 |

**고객** (공개 — 토큰 자체가 권한)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/token/:token` | 설문 + 작성중 답변 + `photoDisplayUrls`(signed GET) |
| PATCH | `/token/:token` | `{ answers, submit? }`. `submit=true` 면 `filled_at` 세팅 (제출 후 수정 불가) |
| POST | `/token/:token/upload-url` | 사진 업로드용 S3 PUT presigned URL (5MB 제한, 제출된 설문은 거부) |

- 토큰은 `crypto.randomBytes(24).toString('base64url')` (192 bit), 만료 없음, 재발급 무제한

### 5-7. 기능 플래그
| 메서드 | 경로 | 가드 | 설명 |
|---|---|---|---|
| GET | `/api/feature-settings` | 공개 | FIT/3WAY/코스 on-off 조회 (user 프론트가 부팅 시 조회) |
| PATCH | `/api/admin/feature-settings` | A | 토글 수정 (admin `/features`) |

### 5-8. 얼굴분석 모듈 표시 설정
| 메서드 | 경로 | 가드 | 설명 |
|---|---|---|---|
| GET | `/api/module-configs` | 공개 | 모듈 라벨/순서/노출/단위 조회 (user 얼굴분석 표가 이걸로 렌더) |
| PATCH | `/api/admin/module-configs/:id` | A | 라벨/순서/노출/단위 수정 (admin `/face-modules`) |

> 분석 응답에 설정에 없는 `module_key` 가 오면 백엔드가 행을 **자동 생성**(`display:false`)한다.
> 설계 배경: [docs/face-analysis-dynamic-architecture.md](./docs/face-analysis-dynamic-architecture.md)

### 5-9. Admin (`/api/admin`)
| 메서드 | 경로 | 가드 | 설명 |
|---|---|---|---|
| POST | `/auth/login` | 공개 | 어드민 로그인 |
| POST | `/auth/register` | 조건부 | 어드민 계정 추가. **어드민이 하나도 없으면 인증 불필요, 있으면 Bearer 토큰 필요** (부트스트랩용) |
| GET | `/users` | A | 전체 디자이너 목록 |
| GET | `/stats` | A | 가입/승인 통계 |
| PATCH | `/users/:id/approve` | A | 디자이너 승인 |
| PATCH | `/users/:id/reject` | A | 디자이너 거절 |

---

## 6. face_landmark Python 서버

별도 repo: `/Users/won/Development Project/NAS-Projects/02-Work/W007-MerciMomong/face_landmark/`

### 6-1. 구조
- FastAPI 앱 (`application.py`) — `/analyze`, `/analyze-url`, `/analyze-base64`, `/health`
- `analyze_face.py` — subprocess 진입점, 모듈 24개 호출
- `modules/` — **24개 = WNC 10 + SNH 14** (`WNC_TYPE_01_skin_tone.py` 등). 디렉토리 파일 수 = 레지스트리 등록 수
  - `SNH_TYPE_07_eyelid.py`(쌍꺼풀 형태) · `SNH_TYPE_08_eye_fat.py`(눈 밑 지방) 는 파일만 있고
    `snh_modules` dict 에 등록되지 않아 오래 실행되지 않았다. **2026-08-22 에 등록 복구** —
    동시에 나머지 22개와 동일한 반환 규격(`value` / `description` / `measurement`)으로 맞췄다.
  - 두 모듈은 `module_configs` 에 `display:false` 로 시드된다. 노출하려면 admin `/face-modules` 에서 켠다.
- MediaPipe Face Mesh 468 landmarks + OpenCV 영상 분석

### 6-2. 분석 모듈 분류

**WNC (Warm / Neutral / Cool) — 10 모듈**
1 피부톤 · 2 턱각도 · 3 광대발달 · 4 윤곽라인 · 5 눈썹형태
6 눈형태 · 7 눈꼬리각도 · 8 코형태 · 9 입술두께 · 10 입술산형태

**SNH (Soft / Neutral / Hard) — 14 모듈**
1 피부톤밝기 · 2 얼굴길이 · 3 눈썹두께 · 4 눈썹-눈거리
5 눈사이거리 · 6 눈바깥여백 · **7 쌍꺼풀형태** · **8 눈밑지방**
9 코길이 · 10 코너비 · 11 중안부비율 · 12 인중길이 · 13 입너비 · 14 턱길이

각 모듈은 `{grade, value, description, measurement}` 반환. measurement 는 오버레이 좌표 데이터.

### 6-3. measurement schema

frontend `FaceOverlay` 가 그릴 수 있는 도형:
- `point`, `line`, `polyline`, `polygon`, `rectangle`, `circle`, `text`
- 좌표는 원본 이미지 절대 픽셀 (image_size 기준)
- 색상/두께/dashed 등 스타일 옵션 포함

**좌표 키 규약** (2026-08-22 정리)

| 도형 | 좌표 키 |
|---|---|
| `point` · `circle` · `text` | `point: {x, y}` (+ `circle` 은 `radius`) |
| `line` · `polyline` · `polygon` · `rectangle` | `points: [{x, y}, ...]` |

> ⚠️ 과거 일부 모듈(SNH_04 · SNH_13)이 `circle` 에 `center` 키를 보내
> `FaceOverlay` 가 `shape.point.x` 에서 터지던 버그가 있었다. Python 쪽을 `point` 로 통일했고,
> `FaceOverlay` 는 이미 저장된 과거 jsonb 호환을 위해 `point ?? center` 둘 다 받는다.

---

## 7. S3 / 환경 분리

| 환경 | S3 버킷 | EB 환경 | DB |
|---|---|---|---|
| 로컬 dev | `momong-dev` (localhost CORS) | localhost backend + Python | 로컬 PostgreSQL |
| 운영 | `momong-staging` (`*.merci-momong.com` CORS) | `Momong-staging-env` + `momong-face-analyze-staging-env` | RDS |

> 운영 EB 환경명에 'staging' 이 들어가지만 실제 운영용. 명칭 정리는 미루어둠.

### S3 키 구조
- 사용자 얼굴 사진: `face-analysis/<userId>/<uuid>.<ext>`
- admin 테스트: `face-analysis/admin/<uuid>.<ext>`
- 사전설문 사진: `pre-surveys/<customerId>/<uuid>.<ext>`
- backend 배포 아티팩트: `elasticbeanstalk-artifacts/fit-hair-deploy-<sha>.zip`

### S3Client 옵션 (브라우저 PUT 호환)
`PythonAnalysisService` 의 `S3Client` 인스턴스는 다음 옵션 필수:
```ts
new S3Client({
  region,
  credentials,
  requestChecksumCalculation: 'WHEN_REQUIRED',   // presigned URL 에 x-amz-checksum-* 자동 추가 끄기
  responseChecksumValidation: 'WHEN_REQUIRED',
})
```
AWS SDK v3 가 기본으로 추가하는 CRC32 체크섬 헤더 때문에 브라우저 fetch PUT 이 SignatureDoesNotMatch 로 거부되던 문제를 해결. face-analysis 와 pre-surveys 양쪽 모두에 영향.

### CORS 정책 (`momong-staging`)
```json
AllowedOrigins: ["http://localhost:3002", "https://*.merci-momong.com"]
AllowedMethods: ["PUT", "POST", "GET", "HEAD"]
```

---

## 8. 배포 흐름

### 8-1. Backend (자동)
1. `git push origin main` → GitHub Actions 트리거 ([.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml))
2. Node 22 build → zip → S3 업로드
3. EB `create-application-version` + `update-environment`
4. 5-10분 후 운영 반영

### 8-2. Frontend (자동)
- Amplify 가 GitHub `main` watch → push 감지 → 자동 빌드/배포
- user / admin 별도 앱으로 등록되어 있어야 양쪽 다 자동 배포
- `amplify.yml` 에 각 앱의 appRoot 정의 (`frontend/user`, `frontend/admin`)
- 빌드 시간: 각 3-5분

### 8-3. Python 서버 (face_landmark)
- 별도 EB 환경 (`momong-face-analyze-staging-env`)
- 별도 repo, 별도 배포 파이프라인 (해당 repo 의 CI 사용 또는 수동)

### 8-4. DB 마이그레이션 (수동)
- dev: TypeORM `synchronize: true` 자동 스키마 적용
- 운영: `backend/migrations/*.sql` 을 psql/pgAdmin 으로 수동 실행
  - `001_create_face_analysis_results.sql` (테이블 생성)
  - `002_add_source_to_face_analysis_results.sql` (source 컬럼)
  - `003_create_pre_surveys.sql` (pre_surveys 테이블 + 인덱스 3개)
  - `004_create_module_configs.sql` (module_configs 테이블 — 첫 부팅 시 24개 시드 자동 삽입)

---

## 9. 환경 변수 (운영 EB)

### Backend (`Momong-staging-env` Configuration)

| 키 | 용도 |
|---|---|
| `NODE_ENV=production` | TypeORM synchronize OFF + SSL ON |
| `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE` | RDS 접근 |
| `JWT_SECRET` | JWT 서명 |
| `ALLOWED_ORIGINS` | `https://www.merci-momong.com,https://admin.merci-momong.com` |
| `FRONTEND_URL` | 공유 링크 base URL |
| `PYTHON_SERVER_URL` | face_landmark EB URL |
| `AWS_REGION` | `ap-northeast-2` |
| `AWS_S3_BUCKET` | `momong-staging` |
| `AWS_ACCESS_KEY_ID` / `SECRET_ACCESS_KEY` | (또는 IAM Instance Profile) |
| `AWS_PRESIGNED_EXPIRES_IN` | 기본 300 |
| `SWAGGER_USER` / `SWAGGER_PASSWORD` | Swagger Basic Auth |

### Frontend (Amplify Environment Variables)

| 키 | 값 (운영) |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.merci-momong.com/api` (또는 backend EB URL) |

---

## 10. 로컬 개발 환경

> 자세한 실행 절차는 [README.md](./README.md). 여기는 인프라 차이점만.

| 항목 | 로컬 | 운영 |
|---|---|---|
| DB | localhost PostgreSQL | RDS |
| backend | `npm run start:dev` (3200) | EB (auto deploy) |
| user frontend | `PORT=3203 npm run dev` | Amplify |
| admin frontend | `PORT=3202 npm run dev` | Amplify |
| Python 서버 | `cd face_landmark && python application.py` (3201) | 별도 EB |
| S3 | `momong-dev` (CORS: localhost) | `momong-staging` (CORS: `*.merci-momong.com`) |
| 인증 | 자동 시드 admin (`admin@momong.com` / `!Password1234`) | env 통한 강한 시드 |

---

## 11. 보안/운영 메모

- **face_landmark 운영 환경명에 'staging'** — 별도 production 환경 분리 권장 (작업 미루어둠)
- **JWT secret** — env 로 강제. 운영에선 절대 default 사용 금지
- **얼굴 이미지 원본 보존 정책** — 현재 영구. S3 lifecycle 정책 (30일/90일) 추후 검토
- **Backend EB Application 이름이 `momong-staging`** — application name 만 그렇고 환경은 실제 운영
