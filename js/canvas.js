/* canvas.js — .canvas_wrap 안에 유리 모핑 WebGL 렌더
   필요: three.js r128 (canvas.js보다 먼저 로드)
   설정: canvas.js보다 먼저 window.GLASS_CONFIG = { ... } 로 덮어쓰기 (빠진 값은 아래 기본값) */
(async () => {
	const CFG = Object.assign(
		{
			bgColor: "#000000", // 배경색
			textColor: "#ffffff", // 타이틀 글자색
			pointColor: "#9b0000", // 포인트 점 색
			glassColor: "#ffffff", // 유리 색 (흰색 = 무색)
			clear: [0, 1, 0], // 도형별 투명도 0~1 (너트, 링, 큐브)
			chroma: 0.55, // 무지개 번짐 세기 (0 = 번짐 없음)
			saturation: 1.12, // 채도 (0 = 흑백)
			refraction: 0.32, // 굴절 세기
			shine: 1.0, // 반사광(하이라이트) 세기
			edgeRainbow: 0, // 모서리 무지개 세기 0~1
			edgeDark: 0, // 모서리 어두운 테두리 0~1 (밝은 배경일 때 윤곽용)
			blur: 0.1, // 유리 속 번짐(블러) 0 = 선명
			rainbowFrom: 0.5, // 무지개가 시작되는 기울기 0~1 (낮을수록 면 전체로 넓게)
			rainbowDeep: 0, // 무지개 진하기 0~1 (1 = 진한 빨강·남색까지 프리즘처럼)
			rimWhite: 0.8, // 실루엣 흰 테두리 0~1
			bodyShade: 0, // 몸통 음영 0~1 (흰 배경에서 입체감)
			darkReflect: 0, // 어두운 반사 띠 세기 0~1 (스튜디오 유리 느낌)
			reflectFringe: 0.04, // 반사 띠 경계의 색 갈라짐 폭
			lightReflect: 0, // 밝은 반사 띠 세기 0~1 (어두운 배경에서 입체감)
			dragSpeed: 0.008, // 드래그 회전 감도 (px당 라디안)
			dragInertia: 0.95, // 놓은 뒤 관성 0~1 (1에 가까울수록 오래 돎)
			bgColor2: "", // 배경 그라데이션 두 번째 색 (마우스를 따라다님). 비우면 단색
			bgGlowSize: 0.55, // 그라데이션 크기 (화면 대각선 대비 0~1)
			bgGlowEase: 0.08, // 마우스 따라가는 속도 0~1 (낮을수록 느리고 부드럽게)
			fontFamily: "Unbounded", // 타이틀 폰트 (페이지에 로드된 폰트)
			textWeight: 900, // 타이틀 굵기
			textSize: 120, // 타이틀 크기(px) — 화면 1024px 초과
			textSizeM: 11.5, // 타이틀 크기(vw) — 화면 1024px 이하
			lineHeight: 1, // 줄 간격 (글자 크기 배수)
			textAlign: "center", // 가로 정렬: "left" | "center" | "right"
			textVAlign: "center", // 세로 정렬: "top" | "center" | "bottom"
			textX: 0, // 가로 여백(px): left면 왼쪽에서, right면 오른쪽에서, center면 가운데에서 이동(+오른쪽)
			textY: 0, // 세로 여백(px): top이면 위에서, bottom이면 아래에서, center면 가운데에서 이동(+아래)
			morph: 1.6, // 변형 시간(초)
			startShape: 3, // 처음 보이는 도형 (0 너트, 1 링, 2 큐브, 3 유리 블록)
			mobileDpr: 1.5, // 모바일 최대 해상도 배율 (PC는 2)
			mobileSamples: 8, // 모바일 유리 셰이더 샘플 수 (PC는 16, 낮을수록 가볍고 번짐이 거칠어짐)
		},
		window.GLASS_CONFIG || {},
	);
	// 배경 그라데이션은 전역 설정(CURSOR_CONFIG.glow*)을 따름 — GLASS_CONFIG에 직접 적으면 그 값 우선
	const CC = window.CURSOR_CONFIG || {},
		GC = window.GLASS_CONFIG || {};
	if (GC.bgColor2 === undefined && CC.glowColor !== undefined) CFG.bgColor2 = CC.glowColor;
	if (GC.bgGlowSize === undefined && CC.glowSize !== undefined) CFG.bgGlowSize = CC.glowSize;
	if (GC.bgGlowEase === undefined && CC.glowEase !== undefined) CFG.bgGlowEase = CC.glowEase;
	["bgColor", "bgColor2", "textColor", "pointColor", "glassColor"].forEach((k) => (CFG[k] = String(CFG[k]).trim()));
	if (!Array.isArray(CFG.clear) || CFG.clear.length < 3) CFG.clear = [0, 1, 0];
	// 유리 블록 도형 모양 (GLASS_CONFIG.blades 로 일부만 덮어써도 됨)
	CFG.blades = Object.assign(
		{
			count: 6, // 블록 개수
			inner: 0.45, // 중심에서 블록 안쪽 끝까지 거리
			length: 1.65, // 블록 길이 (바깥 방향)
			width: 1.05, // 블록 폭
			thick: 0.42, // 블록 두께
			round: 0.14, // 모서리 둥글기
			twist: 30, // 프로펠러처럼 비튼 각도(도)
			skew: 24, // 중심에서 옆으로 비껴 나가는 각도(도)
		},
		(window.GLASS_CONFIG || {}).blades || {},
	);
	const MORPH = CFG.morph;

	const wrap = document.querySelector(".canvas_wrap");
	if (!wrap) return;
	if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
	const canvas = document.createElement("canvas");
	canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
	wrap.appendChild(canvas);

	// 모바일(마우스 없는 터치 기기)은 GPU 부담을 줄임: 해상도 배율·유리 셰이더 샘플 수·안티앨리어싱
	const MOBILE = matchMedia("(hover: none) and (pointer: coarse)").matches;
	const SAMPLES = Math.max(1, Math.round(MOBILE ? CFG.mobileSamples : 16));

	// WebGL을 못 쓰면 DOM 타이틀을 대신 보여줌 (흰 화면 방지)
	let renderer;
	try {
		if (!window.THREE) throw new Error("three.js not loaded");
		renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE });
	} catch (e) {
		canvas.remove();
		(wrap.closest("#project_visual") || document.body).classList.add("is-no-webgl");
		return;
	}
	const DPR = Math.min(window.devicePixelRatio || 1, MOBILE ? CFG.mobileDpr : 2);
	renderer.setPixelRatio(DPR);
	renderer.setClearColor(new THREE.Color(CFG.bgColor), 1);
	renderer.autoClear = false;

	/* ---------- 타이틀 텍스처: .slg .tit h2 문구를 캔버스에 그려 유리 뒤 배경으로 사용 ---------- */
	const titleEl = document.querySelector(".slg .tit h2");
	const lines = [""]; // <br> 기준 줄 나눔
	let pointText = "";
	if (titleEl) {
		titleEl.childNodes.forEach((nd) => {
			if (nd.nodeName === "BR") lines.push("");
			else if (nd.classList && nd.classList.contains("point")) pointText = nd.textContent.trim();
			else lines[lines.length - 1] += nd.textContent;
		});
		for (let i = 0; i < lines.length; i++) lines[i] = lines[i].trim().toUpperCase();
		// 마지막 줄 끝의 "."은 빨간 포인트 점으로 대체 (visual_cube.js와 동일 처리)
		if (pointText) lines[lines.length - 1] = lines[lines.length - 1].replace(/\.$/, "");
		titleEl.style.opacity = 0; // DOM 타이틀은 숨김 (마크업/SEO 유지)
	} else {
		lines[0] = "DETAIL";
		lines.push("ORIENTED");
		pointText = ".";
	}
	try {
		await document.fonts.load(`${CFG.textWeight} 120px "${CFG.fontFamily}"`);
	} catch (e) {}

	const tc = document.createElement("canvas");
	const tctx = tc.getContext("2d");
	const textTex = new THREE.CanvasTexture(tc);
	textTex.minFilter = THREE.LinearFilter;
	textTex.generateMipmaps = false;

	/* 반응형: GLASS_CONFIG.responsive = { 1440: {...}, 768: {...} }
	   CSS의 max-width 미디어 쿼리처럼 화면 너비가 그 값 이하일 때 덮어씀 (작은 쪽이 우선)
	   breakpoint에 textSize(px)를 적으면 1024px 이하의 textSizeM(vw) 규칙보다 우선 */
	const RESP_KEYS = ["textColor", "pointColor", "fontFamily", "textWeight", "textSize", "textSizeM", "lineHeight", "textAlign", "textVAlign", "textX", "textY"];
	const BASE = {};
	RESP_KEYS.forEach((k) => (BASE[k] = CFG[k]));
	const RESP = CFG.responsive || {};
	const BPS = Object.keys(RESP)
		.map(Number)
		.filter((n) => !isNaN(n))
		.sort((a, b) => b - a); // 큰 값부터 적용 → 작은 값이 마지막에 덮어씀
	let sizePx = false; // true면 화면 크기와 상관없이 textSize(px) 사용
	function applyResponsive() {
		const vw = window.innerWidth;
		Object.assign(CFG, BASE);
		sizePx = false;
		BPS.forEach((bp) => {
			if (vw > bp) return;
			const o = RESP[bp] || {};
			RESP_KEYS.forEach((k) => o[k] !== undefined && (CFG[k] = typeof o[k] === "string" ? o[k].trim() : o[k]));
			if (o.textSizeM !== undefined) sizePx = false;
			if (o.textSize !== undefined) sizePx = true;
		});
	}
	function redrawTitle(W, H) {
		applyResponsive();
		drawTitle(W, H);
		// breakpoint에서 폰트/굵기를 바꿨는데 아직 안 불러왔으면 불러온 뒤 다시 그림
		const fk = `${CFG.textWeight} 120px "${CFG.fontFamily}"`;
		if (!document.fonts.check(fk)) document.fonts.load(fk).then(() => drawTitle(W, H), () => {});
	}

	function drawTitle(W, H) {
		tc.width = Math.max(2, Math.floor(W * DPR));
		tc.height = Math.max(2, Math.floor(H * DPR));
		tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
		// 배경색·그라데이션은 셰이더에서 칠함 (마우스 추적) → 여기선 글자만 투명 캔버스에
		tctx.clearRect(0, 0, W, H);
		// 크기: 화면 1024px 초과면 textSize(px), 이하면 textSizeM(vw) — responsive에서 textSize를 적은 구간은 textSize(px)
		const fs = !sizePx && W <= 1024 ? (W * CFG.textSizeM) / 100 : CFG.textSize;
		const lh = fs * CFG.lineHeight;
		tctx.font = `${CFG.textWeight} ${fs}px ${CFG.fontFamily}, "Arial Black", sans-serif`;
		tctx.textAlign = "left";
		tctx.textBaseline = "alphabetic";
		// 대문자 높이(글자 윗선~기준선)로 실제 보이는 글자 끝에 맞춰 정렬
		const capH = tctx.measureText("H").actualBoundingBoxAscent || fs * 0.72;
		const n = lines.length;
		// 첫 줄 기준선 위치: top = 위에서 textY / bottom = 아래에서 textY / center = 가운데 + textY
		const firstBase =
			CFG.textVAlign === "top" ? CFG.textY + capH : CFG.textVAlign === "bottom" ? H - CFG.textY - lh * (n - 1) : H / 2 - (capH + lh * (n - 1)) / 2 + capH + CFG.textY;
		lines.forEach((ln, i) => {
			const isLast = i === n - 1;
			const m1 = tctx.measureText(ln);
			const w1 = m1.width;
			const w2 = isLast && pointText ? tctx.measureText(pointText).width : 0;
			const w = w1 + w2;
			// 가로: left = 왼쪽에서 textX / right = 오른쪽에서 textX / center = 가운데 + textX
			const x =
				CFG.textAlign === "left"
					? CFG.textX + (m1.actualBoundingBoxLeft || 0) // 글자 좌측 여백 보정 → 잉크가 정확히 textX에서 시작
					: CFG.textAlign === "right"
						? W - w - CFG.textX
						: W / 2 - w / 2 + CFG.textX;
			const y = firstBase + lh * i;
			tctx.fillStyle = CFG.textColor;
			tctx.fillText(ln, x, y);
			if (w2) {
				tctx.fillStyle = CFG.pointColor;
				tctx.fillText(pointText, x + w1, y);
			}
		});
		textTex.needsUpdate = true;
	}

	/* ---------- 배경(텍스트) 패스 ---------- */
	const res = { value: new THREE.Vector2(1, 1) };
	const glow = { value: new THREE.Vector2(0, 0) }; // 그라데이션 중심(px, 캔버스 좌표 · 아래가 0)
	// 색 + 투명도 파싱: "rgba(r,g,b,a)" / "#rrggbbaa" / 일반 색 → { color, alpha }
	function parseRGBA(str) {
		const s = String(str || "").trim();
		let m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i);
		if (m) {
			let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
			return { color: new THREE.Color(m[1] / 255, m[2] / 255, m[3] / 255), alpha: a };
		}
		m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
		if (m) return { color: new THREE.Color("#" + m[1]), alpha: parseInt(m[2], 16) / 255 };
		return { color: new THREE.Color(s || "#000"), alpha: 1 };
	}
	const bg2 = parseRGBA(CFG.bgColor2);
	const bgMat = new THREE.ShaderMaterial({
		uniforms: {
			tText: { value: textTex },
			uRes: res,
			uBg1: { value: new THREE.Color(CFG.bgColor) },
			uBg2: { value: bg2.color },
			uHas2: { value: CFG.bgColor2 ? 1 : 0 },
			uBg2A: { value: bg2.alpha }, // bgColor2 투명도
			uGlow: glow,
			uGlowSize: { value: CFG.bgGlowSize },
		},
		vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
		fragmentShader: `
      uniform sampler2D tText; uniform vec2 uRes, uGlow; uniform vec3 uBg1, uBg2; uniform float uHas2, uGlowSize, uBg2A;
      varying vec2 vUv;
      void main(){
        vec3 bg = uBg1;
        if (uHas2 > 0.5) {
          // 마우스 위치 중심 원형 그라데이션: 가운데 bgColor2 → 바깥 bgColor
          float d = length(gl_FragCoord.xy - uGlow) / length(uRes);
          bg = mix(uBg1, uBg2, (1.0 - smoothstep(0.0, uGlowSize, d)) * uBg2A);
        }
        vec4 t = texture2D(tText, vUv);
        gl_FragColor = vec4(mix(bg, t.rgb, t.a), 1.0);
      }`,
		depthTest: false,
		depthWrite: false,
	});
	const bgScene = new THREE.Scene();
	bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));
	const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

	/* ---------- 도형: 피라미드(A) ↔ 사각 바(B) 모핑 ---------- */
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
	camera.position.set(0, 0, 10);

	/* 모든 도형을 같은 토폴로지(각도 N분할 × 단면 4변: 바깥벽/윗면/안쪽벽/아랫면)로 생성
     → 정점 수가 같아서 셰이더에서 바로 보간 가능. 속이 찬 도형은 안쪽 반지름 0 */
	const N = 96; // 4각·6각 꼭짓점이 모두 샘플에 걸리도록 4·6의 배수
	const polyR = (n, R, corner) => (th) => {
		// 정n각형의 각도별 반지름
		const seg = (Math.PI * 2) / n;
		const l = (((th - corner) % seg) + seg) % seg;
		return (R * Math.cos(Math.PI / n)) / Math.cos(l - Math.PI / n);
	};
	const zero = () => 0;
	/* 단면(프로필)을 4변 × S분할 = K점으로 통일 → 링처럼 곡면인 도형도 같은 정점 수로 표현 */
	const S = 16,
		K = S * 4;
	const P = (th, r, y) => [Math.cos(th) * r, y, Math.sin(th) * r];
	// 직선 4변 프로필: 바깥벽 → 윗면 → 안쪽벽 → 아랫면
	const lineProf = (o) => (th) => {
		const c = [
			[o.outB(th), o.y0],
			[o.outT(th), o.y1],
			[o.inT(th), o.y1],
			[o.inB(th), o.y0],
		];
		const pts = [];
		for (let e = 0; e < 4; e++) {
			const [r0, y0] = c[e],
				[r1, y1] = c[(e + 1) % 4];
			for (let i = 0; i < S; i++) {
				const f = i / S;
				pts.push(P(th, r0 + (r1 - r0) * f, y0 + (y1 - y0) * f));
			}
		}
		return pts;
	};
	// 둥근 링(와셔) 프로필: 바깥반지름 R, 구멍 r, 두께 h, 바깥/안쪽 모서리 라운드 cr/ci
	// 4변(바깥벽/윗면/안쪽벽/아랫면)을 모서리 곡선의 중간에서 나눠 각 S점으로 균일 재배치
	// R에 함수를 넘기면 각도별 바깥반지름 (예: 둥근 사각형 → 모서리 둥근 큐브)
	const ringProf = (R, r, h, cr, ci) => {
		if (typeof R === "function") {
			const cache = new Map();
			return (th) => {
				const Rt = R(th);
				if (!cache.has(Rt)) cache.set(Rt, ringProf(Rt, r, h, cr, ci));
				return cache.get(Rt)(th);
			};
		}
		const y1 = h / 2,
			y0 = -h / 2;
		const arc = (cx, cy, rad, a0, a1) => {
			const out = [];
			for (let i = 0; i <= 12; i++) {
				const a = a0 + ((a1 - a0) * i) / 12;
				out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
			}
			return out;
		};
		const D = Math.PI / 180;
		const segs = [
			[...arc(R - cr, y0 + cr, cr, -45 * D, 0), ...arc(R - cr, y1 - cr, cr, 0, 45 * D)], // 바깥벽
			[...arc(R - cr, y1 - cr, cr, 45 * D, 90 * D), ...arc(r + ci, y1 - ci, ci, 90 * D, 135 * D)], // 윗면
			[...arc(r + ci, y1 - ci, ci, 135 * D, 180 * D), ...arc(r + ci, y0 + ci, ci, 180 * D, 225 * D)], // 안쪽벽
			[...arc(r + ci, y0 + ci, ci, 225 * D, 270 * D), ...arc(R - cr, y0 + cr, cr, 270 * D, 315 * D)], // 아랫면
		];
		const prof = [];
		segs.forEach((pl) => {
			const len = [0];
			for (let i = 1; i < pl.length; i++) len.push(len[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]));
			const total = len[len.length - 1];
			for (let i = 0, j = 1; i < S; i++) {
				const d = (total * i) / S;
				while (j < pl.length - 1 && len[j] < d) j++;
				const f = (d - len[j - 1]) / (len[j] - len[j - 1] || 1);
				prof.push([pl[j - 1][0] + (pl[j][0] - pl[j - 1][0]) * f, pl[j - 1][1] + (pl[j][1] - pl[j - 1][1]) * f]);
			}
		});
		return (th) => prof.map(([rr, y]) => P(th, rr, y));
	};
	function buildShape(prof, matrix, smooth) {
		const pos = [];
		for (let i = 0; i < N; i++) {
			const a = prof((i / N) * Math.PI * 2),
				b = prof(((i + 1) / N) * Math.PI * 2);
			for (let k = 0; k < K; k++) {
				const k2 = (k + 1) % K;
				pos.push(...a[k], ...a[k2], ...b[k2], ...a[k], ...b[k2], ...b[k]);
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		if (matrix) g.applyMatrix4(matrix);
		g.computeVertexNormals();
		if (smooth) {
			// 곡면 도형은 부드러운 노멀: 같은 위치 정점끼리 면 노멀을 평균
			const p = g.attributes.position.array,
				n = g.attributes.normal.array;
			const acc = new Map();
			const key = (i) => `${p[i].toFixed(4)},${p[i + 1].toFixed(4)},${p[i + 2].toFixed(4)}`;
			for (let i = 0; i < p.length; i += 3) {
				const k = key(i),
					a = acc.get(k) || [0, 0, 0];
				a[0] += n[i];
				a[1] += n[i + 1];
				a[2] += n[i + 2];
				acc.set(k, a);
			}
			for (let i = 0; i < p.length; i += 3) {
				const a = acc.get(key(i)),
					l = Math.hypot(a[0], a[1], a[2]) || 1;
				n[i] = a[0] / l;
				n[i + 1] = a[1] / l;
				n[i + 2] = a[2] / l;
			}
		}
		return { p: g.attributes.position.array, n: g.attributes.normal.array };
	}
	const SQ = Math.PI / 4; // 사각형 꼭짓점 45°
	const HX = Math.PI / 2; // 육각형 꼭짓점 90° (눕히면 위아래 뾰족)
	const SHAPES = [
		// 0: 육각 너트
		buildShape(lineProf({ outB: polyR(6, 2.1, HX), outT: polyR(6, 2.1, HX), inT: () => 1.18, inB: () => 1.18, y0: -0.45, y1: 0.45 }), new THREE.Matrix4().makeRotationX(Math.PI / 2)),
		// 1: 둥근 유리 링 (너트와 같은 축으로 세워서 모핑이 자연스럽게)
		buildShape(ringProf(2.0, 0.72, 1.0, 0.34, 0.22), new THREE.Matrix4().makeRotationX(Math.PI / 2), true),
		// 2: 정육면체
		buildShape(lineProf({ outB: polyR(4, 2.6 / Math.SQRT2, SQ), outT: polyR(4, 2.6 / Math.SQRT2, SQ), inT: zero, inB: zero, y0: -1.3, y1: 1.3 })),
		// 3: 유리 블록 (꽃잎처럼 원형 배치)
		buildBlades(),
	];
	while (CFG.clear.length < SHAPES.length) CFG.clear.push(1);

	/* 유리 블록: 둘레 N조각을 count개 묶음으로 나눠 묶음마다 모서리 둥근 직육면체 하나를 만듦
	   → 다른 도형과 정점 수·순서가 같아서 링/너트의 각 부분이 가까운 블록으로 갈라지며 모핑됨
	   묶음의 첫/끝 단면은 한 점으로 모아 뚜껑(평평한 끝면)을 닫고, 블록 사이 이음은 면적 0이라 안 보임 */
	function buildBlades() {
		const B = CFG.blades;
		const COUNT = B.count,
			LEN = B.length,
			HW = B.width / 2,
			HT = B.thick / 2;
		// 단면(둥근 사각형) 둘레를 K점으로 균일 분할
		function rectProfile(hw, ht, r) {
			r = Math.max(0.005, Math.min(r, hw, ht));
			const pl = [];
			const corner = (cy, cz, a0) => {
				for (let i = 0; i <= 8; i++) {
					const a = a0 + (Math.PI / 2) * (i / 8);
					pl.push([cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
				}
			};
			corner(hw - r, ht - r, 0);
			corner(-hw + r, ht - r, Math.PI / 2);
			corner(-hw + r, -ht + r, Math.PI);
			corner(hw - r, -ht + r, (Math.PI * 3) / 2);
			pl.push(pl[0]);
			const len = [0];
			for (let i = 1; i < pl.length; i++) len.push(len[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]));
			const total = len[len.length - 1];
			const out = [];
			for (let i = 0, j = 1; i < K; i++) {
				const d = (total * i) / K;
				while (j < pl.length - 1 && len[j] < d) j++;
				const f = (d - len[j - 1]) / (len[j] - len[j - 1] || 1);
				out.push([pl[j - 1][0] + (pl[j][0] - pl[j - 1][0]) * f, pl[j - 1][1] + (pl[j][1] - pl[j - 1][1]) * f]);
			}
			return out;
		}
		const tw = (B.twist * Math.PI) / 180,
			sk = (B.skew * Math.PI) / 180;
		function makeTable(reverse) {
			const table = new Array(N);
			for (let b = 0; b < COUNT; b++) {
				const s0 = Math.round((b * N) / COUNT),
					s1 = Math.round(((b + 1) * N) / COUNT),
					m = s1 - s0;
				// 링/너트와 같은 방향에 오도록 (그 도형들은 X축 90° 회전 → 각도 부호 반대)
				const phi = -(((s0 + s1) / 2 / N) * Math.PI * 2);
				for (let j = 0; j < m; j++) {
					const cap = j === 0 || j === m - 1;
					// 길이 방향 위치: 양 끝에 촘촘하게 (끝 모서리 라운드용)
					const s = cap ? (j === 0 ? 0 : LEN) : LEN * (0.5 - 0.5 * Math.cos((Math.PI * (j - 1)) / (m - 3)));
					const d = Math.min(s, LEN - s);
					const inset = d < B.round ? B.round - Math.sqrt(Math.max(0, B.round * B.round - (B.round - d) * (B.round - d))) : 0;
					let prof = cap ? new Array(K).fill([0, 0]) : rectProfile(HW - inset, HT - inset, B.round - inset * 0.6);
					if (reverse) prof = prof.slice().reverse();
					table[s0 + j] = prof.map(([y, z]) => {
						let x = B.inner + s;
						// 1) 길이축 기준 비틀기 (프로펠러처럼)
						const y1 = y * Math.cos(tw) - z * Math.sin(tw),
							z1 = y * Math.sin(tw) + z * Math.cos(tw);
						// 2) 안쪽 끝 기준으로 옆으로 기울이기 (중심에서 살짝 비껴 나가게)
						const x2 = B.inner + (x - B.inner) * Math.cos(sk) - y1 * Math.sin(sk),
							y2 = (x - B.inner) * Math.sin(sk) + y1 * Math.cos(sk);
						// 3) 원형 배치
						return [x2 * Math.cos(phi) - y2 * Math.sin(phi), x2 * Math.sin(phi) + y2 * Math.cos(phi), z1];
					});
				}
			}
			return table;
		}
		const build = (reverse) => {
			const table = makeTable(reverse);
			return buildShape((th) => table[Math.round((th / (Math.PI * 2)) * N) % N], null, true);
		};
		// 면이 바깥을 향하도록 부피 부호로 감기 방향 확인
		let shape = build(false);
		let vol = 0;
		const p = shape.p;
		for (let i = 0; i < p.length; i += 9) {
			vol +=
				p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7]) -
				p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6]) +
				p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6]);
		}
		if (vol < 0) shape = build(true);
		return shape;
	}

	const geoA = new THREE.BufferGeometry();
	const aPos = new THREE.BufferAttribute(new Float32Array(SHAPES[0].p), 3);
	const aNrm = new THREE.BufferAttribute(new Float32Array(SHAPES[0].n), 3);
	const bPos = new THREE.BufferAttribute(new Float32Array(SHAPES[1].p), 3);
	const bNrm = new THREE.BufferAttribute(new Float32Array(SHAPES[1].n), 3);
	geoA.setAttribute("position", aPos);
	geoA.setAttribute("normal", aNrm);
	geoA.setAttribute("aPosB", bPos);
	geoA.setAttribute("aNormB", bNrm);
	geoA.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
	function setPair(from, to) {
		aPos.array.set(SHAPES[from].p);
		aNrm.array.set(SHAPES[from].n);
		bPos.array.set(SHAPES[to].p);
		bNrm.array.set(SHAPES[to].n);
		aPos.needsUpdate = aNrm.needsUpdate = bPos.needsUpdate = bNrm.needsUpdate = true;
	}

	const prism = new THREE.Mesh(geoA);
	prism.frustumCulled = false;
	scene.add(prism);

	const morph = { value: 0 };
	const clear = { value: 0 };
	const CLEAR = CFG.clear; // 도형별 투명도 (너트, 링, 큐브)

	const glassVS = `
    attribute vec3 aPosB; attribute vec3 aNormB;
    uniform float uMorph;
    varying vec3 vN; varying vec3 vEye;
    void main(){
      vec3 p = mix(position, aPosB, uMorph);
      vec3 n = mix(normal, aNormB, uMorph) + 1e-5;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vN = normalize(mat3(modelMatrix) * n);
      vEye = normalize(wp.xyz - cameraPosition);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
	const glassFS = `
    uniform sampler2D uTex; uniform vec2 uRes;
    uniform float uPower, uChroma, uSat, uShine, uFres, uSpec, uClear, uIri, uEdge, uBlur, uIriFrom, uIriDeep, uRim, uShade, uRefl, uFringe, uLRefl;
    uniform vec3 uLight, uTint;
    varying vec3 vN; varying vec3 vEye;
    vec3 sat(vec3 c, float a){ return mix(vec3(dot(c, vec3(.2125,.7154,.0721))), c, a); }
    // 반사 방향(y)에 따른 어두운 띠 두 줄 (위쪽 굵게, 아래쪽 약하게)
    float darkBand(float y){
      return smoothstep(-0.05, 0.1, y) * (1.0 - smoothstep(0.3, 0.45, y))
           + 0.7 * smoothstep(-0.75, -0.6, y) * (1.0 - smoothstep(-0.5, -0.4, y));
    }
    // 반사 방향(y)에 따른 밝은 띠 (위쪽 소프트박스 + 아래쪽 반사판)
    float lightBand(float y){
      return smoothstep(0.35, 0.55, y) * (1.0 - smoothstep(0.8, 0.95, y))
           + 0.5 * smoothstep(-0.3, -0.15, y) * (1.0 - smoothstep(-0.05, 0.08, y));
    }
    // 프리즘 팔레트 (레퍼런스 픽셀에서 추출): 크림 → 노랑 → 호박 → 진한 빨강 → 보라 → 파랑 → 시안 → 핑크 → 크림
    vec3 prism(float t){
      t = fract(t);
      vec3 c0 = vec3(0.984, 0.906, 0.749), c1 = vec3(0.855, 0.761, 0.031), c2 = vec3(0.710, 0.471, 0.039),
           c3 = vec3(0.290, 0.020, 0.055), c4 = vec3(0.208, 0.000, 0.498), c5 = vec3(0.008, 0.255, 0.761),
           c6 = vec3(0.004, 0.702, 0.831), c7 = vec3(0.976, 0.616, 0.800);
      if (t < 0.12) return mix(c0, c1, t / 0.12);
      if (t < 0.25) return mix(c1, c2, (t - 0.12) / 0.13);
      if (t < 0.37) return mix(c2, c3, (t - 0.25) / 0.12);
      if (t < 0.50) return mix(c3, c4, (t - 0.37) / 0.13);
      if (t < 0.62) return mix(c4, c5, (t - 0.50) / 0.12);
      if (t < 0.72) return mix(c5, c6, (t - 0.62) / 0.10);
      if (t < 0.85) return mix(c6, c7, (t - 0.72) / 0.13);
      return mix(c7, c0, (t - 0.85) / 0.15);
    }
    vec3 samp(vec3 n, float ior, float off){
      vec3 r = refract(vEye, n, 1.0 / ior);
      return texture2D(uTex, gl_FragCoord.xy / uRes + r.xy * off * (1.0 - 0.65 * uClear)).rgb;
    }
    void main(){
      vec3 n = normalize(vN);
      vec3 col = vec3(0.0);
      const int L = SAMPLES;
      for (int i = 0; i < L; i++) {
        float s = float(i) / float(L) * uBlur;
        float R = samp(n, 1.15, (uPower + s)       * uChroma).r;
        vec3 ty = samp(n, 1.16, (uPower + s * 1.5) * uChroma); float Y = (ty.r*2. + ty.g*2. - ty.b) / 6.;
        float G = samp(n, 1.18, (uPower + s * 2.0) * uChroma).g;
        vec3 tc = samp(n, 1.22, (uPower + s * 2.5) * uChroma); float C = (tc.g*2. + tc.b*2. - tc.r) / 6.;
        float B = samp(n, 1.22, (uPower + s * 3.0) * uChroma).b;
        vec3 tp = samp(n, 1.22, (uPower + s * 1.0) * uChroma); float P = (tp.b*2. + tp.r*2. - tp.g) / 6.;
        col.r += R + (2.*P + 2.*Y - C) / 3.;
        col.g += G + (2.*Y + 2.*C - P) / 3.;
        col.b += B + (2.*C + 2.*P - Y) / 3.;
      }
      col = sat(col / (float(L) * 1.5), uSat); // 6파장 합이 원래 밝기의 1.5배라 정규화
      // 투명도: 굴절 안 된 배경을 섞어 더 맑게
      col = mix(col, texture2D(uTex, gl_FragCoord.xy / uRes).rgb, uClear * 0.35);
      col *= uTint; // 유리 색
      // 어두운 반사 띠: 주변 어두운 환경이 곡면에 비침. 채널별로 살짝 어긋나게 해서 띠 경계에 호박/파랑 색 갈라짐
      vec3 rr = reflect(vEye, n);
      float yy = rr.y + rr.x * 0.35;
      vec3 dk = vec3(darkBand(yy + uFringe), darkBand(yy), darkBand(yy - uFringe));
      col *= 1.0 - uRefl * (0.55 + 0.45 * (1.0 - abs(dot(vEye, n)))) * dk;
      // 밝은 반사 띠: 조명(소프트박스)이 곡면에 비침 → 어두운 배경에서 입체감
      vec3 lt = vec3(lightBand(yy + uFringe), lightBand(yy), lightBand(yy - uFringe));
      col += uLRefl * (0.35 + 0.65 * (1.0 - abs(dot(vEye, n)))) * lt;
      // 모서리(비스듬히 보이는 곡면): 무지개 분광 + 살짝 어두운 테두리 → 밝은 배경에서도 유리 윤곽이 보임
      float edge = 1.0 - abs(dot(vEye, n));
      float band = smoothstep(uIriFrom, uIriFrom + 0.35, edge) * (1.0 - smoothstep(0.93, 1.0, edge) * 0.5);
      // 프리즘 스펙트럼: 면 기울기 + 화면 위치로 색상이 흐름. uIriDeep이 클수록 진한 빨강/남색까지 내려감
      float hue = edge * 1.4 + dot(n, vec3(0.45, 0.3, 0.2)) + (gl_FragCoord.x - gl_FragCoord.y * 0.5) / uRes.x * 0.5;
      vec3 spectrum = prism(hue);
      col = mix(col, mix(col * (0.4 + spectrum), spectrum, uIriDeep), band * uIri);
      col *= 1.0 - uEdge * smoothstep(0.55, 0.95, edge);
      // 몸통 음영: 아래·오른쪽을 향한 면을 살짝 어둡게 → 흰 배경에서도 입체감
      col *= 1.0 - uShade * smoothstep(-0.3, 1.0, dot(n, normalize(vec3(0.35, -0.8, 0.3))));
      col = mix(col, vec3(1.0), smoothstep(0.9, 1.0, edge) * uRim); // 실루엣 바로 안쪽 흰 테두리
      vec3 Lv = normalize(-uLight);
      float spec = pow(max(dot(n, normalize(Lv - vEye)), 0.0), uShine);
      float fres = pow(1.0 - abs(dot(vEye, n)), uFres);
      // 밝은 배경에서는 흰 광택 더하기를 줄여 유리 몸통이 배경색과 같게 (어두운 배경은 그대로)
      float bgL = dot(texture2D(uTex, gl_FragCoord.xy / uRes).rgb, vec3(0.3333));
      col += (spec * 0.9 + fres * 0.5 * (1.0 - 0.6 * uClear)) * uSpec * mix(1.0, 0.15, bgL);
      gl_FragColor = vec4(col, 1.0);
    }`;
	const makeGlass = (side, spec) =>
		new THREE.ShaderMaterial({
			uniforms: {
				uTex: { value: null },
				uRes: res,
				uMorph: morph,
				uClear: clear,
				uPower: { value: CFG.refraction },
				uChroma: { value: CFG.chroma },
				uSat: { value: CFG.saturation },
				uShine: { value: 42 },
				uFres: { value: 7 },
				uSpec: { value: spec * CFG.shine },
				uLight: { value: new THREE.Vector3(-1, -1.2, -1) },
				uTint: { value: new THREE.Color(CFG.glassColor) },
				uIri: { value: CFG.edgeRainbow },
				uEdge: { value: CFG.edgeDark },
				uBlur: { value: CFG.blur },
				uIriFrom: { value: CFG.rainbowFrom },
				uIriDeep: { value: CFG.rainbowDeep },
				uRim: { value: CFG.rimWhite },
				uShade: { value: CFG.bodyShade },
				uRefl: { value: CFG.darkReflect },
				uFringe: { value: CFG.reflectFringe },
				uLRefl: { value: CFG.lightReflect },
			},
			defines: { SAMPLES },
			vertexShader: glassVS,
			fragmentShader: glassFS,
			side,
		});
	const backMat = makeGlass(THREE.BackSide, 0.35);
	const frontMat = makeGlass(THREE.FrontSide, 1.0);

	const rtBg = new THREE.WebGLRenderTarget(1, 1);
	const rtBack = new THREE.WebGLRenderTarget(1, 1);
	backMat.uniforms.uTex.value = rtBg.texture;
	frontMat.uniforms.uTex.value = rtBack.texture;

	// 모바일에서 메모리가 부족하면 브라우저가 WebGL을 회수했다가 돌려줌 → 돌아오면 타이틀 텍스처 다시 올림
	canvas.addEventListener("webglcontextrestored", () => {
		textTex.needsUpdate = true;
	});

	/* ---------- 리사이즈 / 입력 ---------- */
	let W = 0,
		H = 0;
	function resize() {
		W = wrap.clientWidth || 1;
		H = wrap.clientHeight || 1;
		renderer.setSize(W, H, false);
		rtBg.setSize(W * DPR, H * DPR);
		rtBack.setSize(W * DPR, H * DPR);
		res.value.set(W * DPR, H * DPR);
		redrawTitle(W, H);
		camera.aspect = W / H;
		camera.position.z = W / H < 0.9 ? (10 / (W / H)) * 0.8 : 10;
		camera.updateProjectionMatrix();
	}
	new ResizeObserver(resize).observe(wrap);
	resize();

	const mouse = { x: 0, y: 0 };
	// 배경 그라데이션 중심: 처음엔 오른쪽 위, 마우스가 움직이면 따라감 (wrap 기준 px)
	const glowT = { x: W * 0.95, y: 0 },
		glowP = { x: W * 0.95, y: 0 };
	window.addEventListener("pointermove", (e) => {
		const r = wrap.getBoundingClientRect();
		mouse.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
		mouse.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
		glowT.x = e.clientX - r.left;
		glowT.y = e.clientY - r.top;
	});

	/* ---------- 모핑: 도형 클릭 시 다음 도형으로 (너트 → 링 → 큐브 → 반복) ---------- */
	const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
	const START = Math.max(0, Math.min(SHAPES.length - 1, CFG.startShape | 0));
	const stage = { from: START, to: (START + 1) % SHAPES.length, start: -1 }; // start < 0 이면 대기 중
	function stageAt(t) {
		if (stage.start < 0) return { from: stage.from, to: stage.to, u: 0 };
		const c = (t - stage.start) / MORPH;
		if (c >= 1) {
			// 변형 완료 → 도착한 도형을 기준으로 다음 쌍 준비
			stage.from = stage.to;
			stage.to = (stage.to + 1) % SHAPES.length;
			stage.start = -1;
			return { from: stage.from, to: stage.to, u: 0 };
		}
		return { from: stage.from, to: stage.to, u: ease(c) };
	}

	// 도형 히트 테스트 (앞/뒷면 모두)
	const ray = new THREE.Raycaster();
	const hitMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
	const ndc = new THREE.Vector2();
	function hitShape(e) {
		const r = wrap.getBoundingClientRect();
		if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return false;
		ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
		ray.setFromCamera(ndc, camera);
		const keep = prism.material;
		prism.material = hitMat;
		const hit = ray.intersectObject(prism).length > 0;
		prism.material = keep;
		return hit;
	}
	const isUI = (e) => e.target.closest && e.target.closest("a, button, input, label, select, textarea");
	// 커서 상태 알림: 전역 커서(cursor.js)는 <html data-cursor>를 읽고, 없을 땐 기본 커서로 대체
	const NATIVE = { drag: "grab", grabbing: "grabbing" };
	function setCursor(s) {
		const root = document.documentElement;
		if (s) root.dataset.cursor = s;
		else delete root.dataset.cursor;
		wrap.style.cursor = NATIVE[s] || "";
	}

	/* ---------- 드래그로 자유 회전 (360°, 놓으면 관성으로 계속 돌다가 멈춤) ---------- */
	const qUser = new THREE.Quaternion(),
		qStep = new THREE.Quaternion();
	const AX = new THREE.Vector3(1, 0, 0),
		AY = new THREE.Vector3(0, 1, 0);
	const drag = { on: false, moved: false, x: 0, y: 0, vx: 0, vy: 0 };
	function spinBy(dx, dy) {
		// 화면 기준 축으로 회전 (좌우 드래그 = 세로축, 상하 드래그 = 가로축)
		qStep.setFromAxisAngle(AY, dx);
		qUser.premultiply(qStep);
		qStep.setFromAxisAngle(AX, dy);
		qUser.premultiply(qStep);
	}
	window.addEventListener("pointerdown", (e) => {
		drag.moved = false; // 누를 때마다 초기화 (이전 드래그 흔적이 다음 클릭을 막지 않게)
		if (isUI(e) || !hitShape(e)) return;
		e.preventDefault(); // 드래그 중 텍스트 선택 방지
		Object.assign(drag, { on: true, moved: false, x: e.clientX, y: e.clientY, vx: 0, vy: 0 });
		setCursor("grabbing");
	});
	window.addEventListener("pointermove", (e) => {
		if (drag.on) {
			const dx = e.clientX - drag.x,
				dy = e.clientY - drag.y;
			drag.x = e.clientX;
			drag.y = e.clientY;
			if (Math.hypot(dx, dy) > 2) drag.moved = true; // 조금이라도 끌면 클릭(변형)으로 치지 않음
			const k = CFG.dragSpeed;
			spinBy(dx * k, dy * k);
			drag.vx = dx * k;
			drag.vy = dy * k;
			return;
		}
		setCursor(!isUI(e) && hitShape(e) ? "drag" : ""); // 도형 위에서는 DRAG 커서
	});
	const endDrag = () => {
		if (!drag.on) return;
		drag.on = false;
		setCursor("drag");
	};
	window.addEventListener("pointerup", endDrag);
	window.addEventListener("pointercancel", endDrag);
	// 터치로 도형을 돌릴 때 페이지 스크롤 막기
	window.addEventListener("touchmove", (e) => drag.on && e.preventDefault(), { passive: false });

	// 클릭(드래그 아님) 시 다음 도형으로 변형
	window.addEventListener("click", (e) => {
		if (drag.moved) return (drag.moved = false); // 방금 드래그했으면 클릭 무시
		if (isUI(e)) return;
		if (stage.start >= 0 || !hitShape(e)) return; // 변형 중이거나 도형 밖이면 무시
		stage.start = clock.getElapsedTime();
	});

	/* ---------- 루프 ---------- */
	const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const clock = new THREE.Clock();
	const tilt = { x: 0, z: 0 };
	const qA = new THREE.Quaternion(),
		qB = new THREE.Quaternion();
	const eA = new THREE.Euler(),
		eB = new THREE.Euler();
	let curFrom = -1; // 첫 프레임에 시작 도형 쌍을 올림

	let visible = true;
	new IntersectionObserver(([en]) => {
		visible = en.isIntersecting;
	}).observe(wrap);

	function tick() {
		requestAnimationFrame(tick);
		if (!visible) return;
		const t = clock.getElapsedTime();
		const m = reduce ? 0 : 1;
		const ge = reduce ? 1 : CFG.bgGlowEase;
		glowP.x += (glowT.x - glowP.x) * ge;
		glowP.y += (glowT.y - glowP.y) * ge;
		glow.value.set(glowP.x * DPR, (H - glowP.y) * DPR);

		const st = reduce ? { from: START, to: (START + 1) % SHAPES.length, u: 0 } : stageAt(t);
		if (st.from !== curFrom) {
			setPair(st.from, st.to);
			curFrom = st.from;
		}
		const u = st.u;
		morph.value = u;
		clear.value = CLEAR[st.from] + (CLEAR[st.to] - CLEAR[st.from]) * u;

		tilt.x += (mouse.y * 0.25 - tilt.x) * 0.05;
		tilt.z += (mouse.x * -0.15 - tilt.z) * 0.05;
		const sway = Math.sin(t * 0.4) * m,
			spin = t * 0.25 * m;

		// 도형별 자세
		const pose = [
			[0.42 + sway * 0.12 + tilt.x, -0.35 + Math.sin(t * 0.27) * 0.25 * m + mouse.x * 0.45, -0.12 + Math.sin(t * 0.2) * 0.05 * m], // 너트
			[0.85 + sway * 0.1 + tilt.x, -0.3 + Math.sin(t * 0.3) * 0.2 * m + mouse.x * 0.4, -0.4 + tilt.z], // 링 (사진처럼 비스듬히 누운 각도)
			[0.55 + tilt.x, 0.6 + spin + mouse.x * 0.4, 0.12 + tilt.z], // 큐브
			[0.3 + sway * 0.1 + tilt.x, -0.28 + Math.sin(t * 0.3) * 0.2 * m + mouse.x * 0.4, -spin * 0.6 + tilt.z], // 유리 블록 (정면에서 천천히 회전)
		];
		eA.set(...pose[st.from]);
		eB.set(...pose[st.to]);
		qA.setFromEuler(eA);
		qB.setFromEuler(eB);
		prism.quaternion.copy(qA).slerp(qB, u);
		// 드래그 회전 + 관성
		if (!drag.on && (Math.abs(drag.vx) > 1e-5 || Math.abs(drag.vy) > 1e-5)) {
			spinBy(drag.vx, drag.vy);
			drag.vx *= CFG.dragInertia;
			drag.vy *= CFG.dragInertia;
		}
		prism.quaternion.premultiply(qUser);
		// 변형 중간에 살짝 커졌다 돌아오는 탄성
		prism.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.06);

		renderer.setRenderTarget(rtBg);
		renderer.clear();
		renderer.render(bgScene, orthoCam);
		renderer.setRenderTarget(rtBack);
		renderer.clear();
		renderer.render(bgScene, orthoCam);
		prism.material = backMat;
		renderer.render(scene, camera);
		renderer.setRenderTarget(null);
		renderer.clear();
		renderer.render(bgScene, orthoCam);
		prism.material = frontMat;
		renderer.render(scene, camera);
	}
	tick();
})();
