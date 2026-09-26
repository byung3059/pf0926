import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

(function () {
	const visualEl = document.getElementById("project_visual");
	const wrap = visualEl && visualEl.querySelector(".cube_wrap");
	const canvas = document.getElementById("gl_cube");
	const titleEl = visualEl && visualEl.querySelector(".slg .tit h2");
	if (!visualEl || !wrap || !canvas) return;

	const BG_COLOR = "#0a0a0a"; // --bg-color
	const TXT_COLOR = "#ffffff"; // 타이틀
	const PRI_COLOR = "#9b0000"; // --pri-color
	const LINE_COLOR = "rgba(255,255,255,0.1)";

	const CAM_Z = 1400; // 카메라 거리 (world 1 = 화면 1px 이 되도록 fov 를 역산)
	const PLANE_Z = -900; // 배경(타이틀) 평면 위치

	/* ---------- 렌더러 ---------- */
	let renderer;
	try {
		renderer = new THREE.WebGLRenderer({
			canvas: canvas,
			antialias: true,
			alpha: false,
			powerPreference: "high-performance",
		});
	} catch (e) {
		return; // WebGL 미지원 → CSS 큐브 그대로 사용
	}

	renderer.setClearColor(new THREE.Color(BG_COLOR), 1);
	renderer.toneMapping = THREE.NoToneMapping;
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	const isMobile = matchMedia("(max-width: 768px)").matches;
	const MAX_DPR = isMobile ? 1.75 : 2;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(45, 1, 10, 6000);
	camera.position.set(0, 0, CAM_Z);

	/* ---------- 배경(타이틀) 텍스처 ---------- */
	const txCanvas = document.createElement("canvas");
	const txCtx = txCanvas.getContext("2d");
	const txTexture = new THREE.CanvasTexture(txCanvas);
	txTexture.colorSpace = THREE.SRGBColorSpace;
	txTexture.minFilter = THREE.LinearFilter;
	txTexture.generateMipmaps = false;

	let titleText = "Detail Oriented";
	let pointText = ".";
	if (titleEl) {
		const point = titleEl.querySelector(".point");
		pointText = point ? point.textContent.trim() : "";
		titleText = titleEl.textContent.replace(pointText, "").trim().toUpperCase();
	}

	let viewW = 0,
		viewH = 0;

	function drawBackdrop() {
		if (!viewW || !viewH) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		txCanvas.width = Math.max(2, Math.floor(viewW * dpr));
		txCanvas.height = Math.max(2, Math.floor(viewH * dpr));
		txCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

		txCtx.fillStyle = BG_COLOR;
		txCtx.fillRect(0, 0, viewW, viewH);

		// 타이틀 (CSS 와 동일한 규칙: 1024px 이하 11.5vw / 그 외 120px)
		const fs = viewW <= 1024 ? viewW * 0.115 : 120;
		txCtx.font = "900 " + fs + "px Unbounded, sans-serif";
		txCtx.textAlign = "left";
		txCtx.textBaseline = "middle";

		const w1 = txCtx.measureText(titleText).width;
		const w2 = pointText ? txCtx.measureText(pointText).width : 0;
		const total = w1 + w2;
		const cx = viewW / 2,
			cy = viewH / 2;
		const startX = cx - total / 2;

		// 데스크탑에서만 보이는 h2 의 위/아래 보더 + 세로 라인
		if (viewW > 1024) {
			const boxW = total + 64; // padding: 0 32px
			const boxH = fs; // line-height: 1
			const left = cx - boxW / 2;
			const top = cy - boxH / 2;
			const vH = boxH + 56;

			txCtx.fillStyle = LINE_COLOR;
			txCtx.fillRect(left, top, boxW, 1);
			txCtx.fillRect(left, top + boxH - 1, boxW, 1);
			txCtx.fillRect(left + 32, cy - vH / 2, 1, vH);
			txCtx.fillRect(left + boxW - 33, cy - vH / 2, 1, vH);
		}

		txCtx.fillStyle = TXT_COLOR;
		txCtx.fillText(titleText, startX, cy);
		if (pointText) {
			txCtx.fillStyle = PRI_COLOR;
			txCtx.fillText(pointText, startX + w1, cy);
		}

		txTexture.needsUpdate = true;
	}

	const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: txTexture, toneMapped: false }));
	backdrop.position.z = PLANE_Z;
	scene.add(backdrop);

	/* ---------- 환경맵 (유리 반사/하이라이트용) ---------- */
	function makeEnvTexture() {
		const c = document.createElement("canvas");
		c.width = 1024;
		c.height = 512;
		const g = c.getContext("2d");

		// 어두운 배경에 맞춰 톤 다운
		const base = g.createLinearGradient(0, 0, 0, 512);
		base.addColorStop(0.0, "#8a8d96");
		base.addColorStop(0.4, "#3a3c44");
		base.addColorStop(0.52, "#1c1d22");
		base.addColorStop(1.0, "#060608");
		g.fillStyle = base;
		g.fillRect(0, 0, 1024, 512);

		function blob(x, y, r, rgb, a) {
			const rg = g.createRadialGradient(x, y, 0, x, y, r);
			rg.addColorStop(0, "rgba(" + rgb + "," + a + ")");
			rg.addColorStop(1, "rgba(" + rgb + ",0)");
			g.fillStyle = rg;
			g.beginPath();
			g.arc(x, y, r, 0, Math.PI * 2);
			g.fill();
		}

		// 컬러 (색수차/이리데선스가 물릴 소스)
		blob(150, 150, 260, "120,220,255", 0.45);
		blob(470, 120, 240, "255,120,220", 0.35);
		blob(760, 170, 260, "255,225,120", 0.4);
		blob(980, 300, 220, "150,255,200", 0.3);

		// 소프트박스 (또렷한 흰 하이라이트)
		g.fillStyle = "rgba(255,255,255,0.95)";
		g.fillRect(60, 40, 300, 46);
		g.fillRect(560, 60, 220, 34);
		g.fillRect(300, 210, 420, 22);

		const tex = new THREE.CanvasTexture(c);
		tex.mapping = THREE.EquirectangularReflectionMapping;
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}

	const pmrem = new THREE.PMREMGenerator(renderer);
	pmrem.compileEquirectangularShader();
	const envTex = makeEnvTexture();
	scene.environment = pmrem.fromEquirectangular(envTex).texture;
	envTex.dispose();
	pmrem.dispose();

	scene.add(new THREE.AmbientLight(0xffffff, 0.4));
	const key = new THREE.DirectionalLight(0xffffff, 2.6);
	key.position.set(600, 900, 900);
	scene.add(key);
	const rim = new THREE.DirectionalLight(0xffffff, 1.4);
	rim.position.set(-800, -300, 600);
	scene.add(rim);

	/* ---------- 유리 큐브 ---------- */
	const geo = new RoundedBoxGeometry(1, 1, 1, isMobile ? 3 : 5, 0.035);

	// ▼ 유리 느낌 조절 3개: thickness(왜곡량) / dispersion(무지개) / roughness(선명도)
	const mat = new THREE.MeshPhysicalMaterial({
		color: 0xffffff,
		metalness: 0,
		roughness: 0.02,
		transmission: 1,
		thickness: 0.42, // ← 글자 굴절(왜곡) 세기
		ior: 1.55,
		dispersion: 6, // ← 무지개 색수차 (three r167+)
		iridescence: 0.4,
		iridescenceIOR: 1.35,
		iridescenceThicknessRange: [120, 460],
		clearcoat: 1,
		clearcoatRoughness: 0.02,
		envMapIntensity: 1.4,
		specularIntensity: 1,
	});

	const pivot = new THREE.Group(); // 마우스 패럴랙스
	const cubeGroup = new THREE.Group(); // 반응형 크기 + 상시 회전
	const cube = new THREE.Mesh(geo, mat);
	cube.scale.setScalar(0.0001); // reveal 전에는 숨김
	cubeGroup.add(cube);
	pivot.add(cubeGroup);
	scene.add(pivot);

	/* ---------- 리사이즈 ---------- */
	function resize() {
		const w = wrap.clientWidth || window.innerWidth;
		const h = wrap.clientHeight || window.innerHeight;
		if (!w || !h) return;

		viewW = w;
		viewH = h;

		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
		renderer.setSize(w, h, false);

		// world 1 = 1px 이 되도록 fov 역산
		camera.fov = (2 * Math.atan(h / 2 / CAM_Z) * 180) / Math.PI;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();

		// 배경 평면이 화면을 꽉 채우도록
		const dist = CAM_Z - PLANE_Z;
		const vh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
		backdrop.scale.set(vh * camera.aspect * 1.02, vh * 1.02, 1);

		// --cube-size 와 동일한 규칙
		const size = w <= 768 ? w * 0.56 : w <= 1024 ? w * 0.4 : 440;
		cubeGroup.scale.setScalar(size);

		drawBackdrop();
	}

	if (window.ResizeObserver) {
		new ResizeObserver(resize).observe(wrap);
	} else {
		window.addEventListener("resize", resize);
	}
	window.addEventListener("orientationchange", resize);
	resize();

	// 폰트 로드 후 타이틀 다시 그리기
	if (document.fonts) {
		document.fonts
			.load("900 120px Unbounded")
			.then(function () {
				return document.fonts.ready;
			})
			.then(drawBackdrop)
			.catch(function () {});
	}

	/* ---------- 마우스 패럴랙스 ---------- */
	const pointer = { x: 0, y: 0 };
	window.addEventListener(
		"pointermove",
		function (e) {
			pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
			pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
		},
		{ passive: true },
	);

	/* ---------- 루프 ---------- */
	// 섹션이 화면 밖이면 렌더 스킵
	let inView = true;
	if (window.IntersectionObserver) {
		new IntersectionObserver(function (entries) {
			inView = entries[0].isIntersecting;
		}).observe(visualEl);
	}

	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const clock = new THREE.Clock();

	function tick() {
		const dt = Math.min(clock.getDelta(), 0.05);
		if (document.hidden || !inView) return;

		if (!reduceMotion) {
			cubeGroup.rotation.x += dt * 0.16;
			cubeGroup.rotation.y += dt * 0.22;
			cubeGroup.rotation.z += dt * 0.08;
		}

		pivot.rotation.y += (pointer.x * 0.22 - pivot.rotation.y) * 0.05;
		pivot.rotation.x += (pointer.y * 0.16 - pivot.rotation.x) * 0.05;

		renderer.render(scene, camera);
	}
	renderer.setAnimationLoop(tick);

	/* ---------- 등장 연출 ---------- */
	function reveal() {
		if (window.gsap) {
			gsap.fromTo(cube.scale, { x: 0.15, y: 0.15, z: 0.15 }, { x: 1, y: 1, z: 1, duration: 1.8, ease: "power3.out" });
			gsap.fromTo(cube.rotation, { x: -0.9, y: -1.7, z: 0.6 }, { x: 0, y: 0, z: 0, duration: 2.4, ease: "power3.out" });
		} else {
			cube.scale.setScalar(1);
		}
	}

	visualEl.classList.add("gl_on");
	reveal();
})();
