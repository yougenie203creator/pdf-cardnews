# PDF 쉬운 해설 & 카드뉴스 생성기

## 배포
1. 이 폴더의 내용을 GitHub 저장소 맨 바깥에 올립니다.
2. Vercel에서 저장소를 Import합니다. Framework Preset은 Other입니다.
3. Vercel Settings → Environment Variables에 `GEMINI_API_KEY`를 입력합니다.
4. 필요하면 `ACCESS_CODE`, `GEMINI_MODEL`, `THINKING_LEVEL`도 입력합니다.
5. 환경변수를 추가하거나 변경한 뒤에는 Redeploy합니다.

API 키는 `public`에 들어 있지 않고 `api/analyze.js`의 서버 환경변수에서만 읽습니다.
