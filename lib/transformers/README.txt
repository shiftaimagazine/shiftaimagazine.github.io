transformers.js — 브라우저 안에서 AI 모델을 돌리는 라이브러리 (SHIFT AI 무료 도구: 영상 자막·회의 녹음 받아쓰기·사진 배경 지우기·사진 화질 올리기)

들어 있는 파일
- transformers.min.js : @huggingface/transformers 4.3.2 의 dist/transformers.min.js 그대로 (Apache-2.0, LICENSE-transformers.js.txt)
                        onnxruntime-web 1.31.0-dev.20260914-8d85527a0 이 함께 묶여 있음 (MIT, Copyright (c) Microsoft Corporation, LICENSE-onnxruntime-web.txt)
- ort-wasm-simd-threaded.mjs / ort-wasm-simd-threaded.asyncify.mjs : 같은 판 onnxruntime-web 의 dist/ 에서 그대로 (계산용 .wasm 을 불러오는 코드)

밖에서 받는 것 (이 폴더에 두지 않음, GitHub Pages 용량을 아끼려고)
- 계산용 .wasm (약 12~24MB): https://cdn.jsdelivr.net/npm/onnxruntime-web@<위 판>/dist/ — 판 번호는 transformers.min.js 안의 값을 그대로 씀
- AI 모델 파일: https://huggingface.co/ (onnx-community/whisper-base·whisper-small, studioludens/birefnet-lite-512, Xenova/swin2SR-lightweight-x2-64·swin2SR-realworld-sr-x4-64-bsrgan-psnr)
  모두 /assets/ai-worker.js(작업용 워커) 안에서 받는다. URL 로 만든 워커는 페이지의 <meta> CSP 를 물려받지 않으므로 페이지 CSP 는 바꾸지 않았다.
  응답 머리(HTTP 헤더)로 CSP 를 거는 곳으로 옮기면, 워커 쪽 connect-src 에 huggingface.co, *.huggingface.co, *.hf.co, cdn.jsdelivr.net 을 열어야 한다.

판을 올릴 때
- npm i @huggingface/transformers@<새 판> 후 dist/transformers.min.js 와 node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*.mjs 를 함께 바꾼다(.mjs 와 .wasm 판이 어긋나면 돌지 않음).
- _src/widgets/ai-worker.js 의 ORT 상수(예비 값)도 같은 판으로.
