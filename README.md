# PDF 쉬운 해설 & 카드뉴스 생성기

## 배포 전 환경변수
Vercel 프로젝트 Settings > Environment Variables에 다음을 추가합니다.

- `GEMINI_API_KEY`: Gemini API 키
- `GEMINI_MODEL`: `gemini-3.8-flash`

API 키는 프론트엔드 코드와 GitHub 저장소에 넣지 않습니다. 환경변수를 추가하거나 변경한 뒤에는 Redeploy해야 합니다.
