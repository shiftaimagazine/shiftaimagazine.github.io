o200k.js — gpt-tokenizer 4.1.0 (MIT, https://github.com/niieani/gpt-tokenizer) 의 o200k_base 인코딩만 묶은 브라우저용 파일.
만든 방법: esbuild 로 `import { countTokens } from 'gpt-tokenizer/encoding/o200k_base'; window.SHIFT_O200K = { countTokens };` 를 IIFE 로 묶음(--minify).
쓰는 곳: /tools/char-count/ (글자 수·토큰 세기). 글은 브라우저 안에서만 셉니다.
