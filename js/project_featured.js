/*
 * PROJECT 섹션 효과 (lusion.co Featured Work 이식) — 애니메이션은 GSAP, 굴절 그리기만 WebGL
 * 1) 타이틀(h2): 글자별로 아래에서 회전하며 올라옴
 * 2) 카드 제목(p): 글자별 슬롯머신처럼 굴러 내려옴 (가운데 글자부터)
 * 3) 카드 이미지: 작게 기울어진 상태에서 펼쳐지며 등장 (GSAP이 셰이더 값을 트윈)
 * 4) 스크롤 속도만큼 이미지가 화면 위·아래에서 바깥으로 휘어짐 (WebGL 셰이더)
 * - 화면에서 벗어나면 초기화되고, 다시 들어오면 재생됨
 * - WebGL/텍스처를 쓸 수 없으면 이미지는 기존 CSS 배경 그대로, 텍스트 효과만 동작
 */
(function () {
	if (!window.gsap || !window.ScrollTrigger) return;
	gsap.registerPlugin(ScrollTrigger);

	var cfg = Object.assign(
		{
			maxStrength: 0.15, // 스크롤 굴절 최대 세기 (원본 0.15)
			strengthScale: 0.5, // 스크롤 속도 → 굴절 배수 (원본 0.5)
			decay: 10, // 스크롤 멈춘 뒤 펴지는 속도
			radius: 16, // 이미지 모서리 둥글기(px) — style.scss의 border-radius와 동일하게
		},
		window.PROJECT_FEATURED_CONFIG || {}
	);

	// 원본 ease.lusion = cubic-bezier(.35, 0, 0, 1)
	// 모바일(터치 기기·작은 화면)은 해상도 배율을 낮춰 GPU 부담을 줄임
	var MOBILE = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) <= 768;

	var EASE_LUSION = "power4.out";
	if (window.CustomEase) {
		gsap.registerPlugin(CustomEase);
		CustomEase.create("lusion", "M0,0 C0.35,0 0,1 1,1");
		EASE_LUSION = "lusion";
	}

	/* ---------- 셰이더 ---------- */
	var vert = [
		"uniform vec2 u_domXY;",
		"uniform vec2 u_domWH;",
		"uniform vec2 u_pad;",
		"uniform float u_rot;",
		"uniform float u_offsetX;",
		"varying vec2 v_uv;",
		"void main() {",
		// 평면을 바깥쪽으로 u_pad만큼 넓혀 굴절된 이미지가 나갈 공간 확보
		"	float totalW = u_domWH.x + u_pad.x + u_pad.y;",
		"	vec2 local = vec2(uv.x * totalW - u_pad.x, (1.0 - uv.y) * u_domWH.y);",
		"	v_uv = local / u_domWH;",
		"	vec2 c = local - u_domWH * 0.5;",
		"	float s = sin(u_rot), co = cos(u_rot);",
		"	c = vec2(c.x * co - c.y * s, c.x * s + c.y * co);",
		"	vec2 screen = u_domXY + u_domWH * 0.5 + c + vec2(u_offsetX, 0.0);",
		"	gl_Position = projectionMatrix * vec4(screen.x, -screen.y, 0.0, 1.0);",
		"}",
	].join("\n");

	var frag = [
		"uniform sampler2D u_texture;",
		"uniform vec2 u_textureSize;",
		"uniform vec2 u_domWH;",
		"uniform vec2 u_resolution;",
		"uniform float u_rippleStrength;",
		"uniform float u_showRatio;",
		"uniform float u_zoomRatio;",
		"uniform float u_radius;",
		"varying vec2 v_uv;",
		"float sdRoundedBox(vec2 p, vec2 b, float r) {",
		"	vec2 q = abs(p) - b + r;",
		"	return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;",
		"}",
		"void main() {",
		"	vec2 screenUv = gl_FragCoord.xy / u_resolution;",
		"	vec2 baseUv = v_uv;",
		// lusion 원본 굴절 식
		"	baseUv.x -= (screenUv.x - 0.5) * (1.0 - sin(screenUv.y * 3.141592)) * u_rippleStrength;",
		// 등장: 마스크 70% → 100%
		"	vec2 halfSize = u_domWH * mix(0.7, 1.0, u_showRatio) * 0.5;",
		"	float d = sdRoundedBox((baseUv - 0.5) * u_domWH, halfSize, u_radius);",
		"	float alpha = clamp(0.5 - d, 0.0, 1.0);",
		"	if (alpha <= 0.0) discard;",
		// background-size: cover + 등장 시 확대(75% → 100%) + 호버 줌
		"	vec2 s = u_domWH / u_textureSize;",
		"	vec2 fit = u_domWH / (u_textureSize * max(s.x, s.y));",
		"	vec2 uv = (baseUv - 0.5) * mix(0.75, 1.0, u_showRatio) * mix(0.975, 1.0, u_zoomRatio) * fit + 0.5;",
		"	vec3 color = texture2D(u_texture, vec2(uv.x, 1.0 - uv.y)).rgb;",
		"	gl_FragColor = vec4(color, alpha);",
		"}",
	].join("\n");

	/* ---------- 텍스트 분리 ---------- */
	function splitTitle(el) {
		var text = el.textContent.trim();
		el.textContent = "";
		el.classList.add("fx-title");
		return text.split("").map(function (ch) {
			var span = document.createElement("span");
			span.className = "fx-title-char";
			span.textContent = ch === " " ? " " : ch;
			el.appendChild(span);
			return span;
		});
	}

	function splitSlot(el) {
		var text = el.textContent.trim();
		el.textContent = "";
		el.classList.add("fx-slot");
		return text.split("").map(function (ch) {
			var col = document.createElement("span");
			col.className = "fx-slot-col";
			if (ch === " ") col.style.width = "0.3em";
			else
				for (var i = 0; i < 4; i++) {
					var s = document.createElement("span");
					s.textContent = ch;
					col.appendChild(s);
				}
			el.appendChild(col);
			return col;
		});
	}

	// 화면에 들어오면 처음부터 재생, 완전히 벗어나면 초기화 (원본 동작)
	function playInView(trigger, tl) {
		ScrollTrigger.create({
			trigger: trigger,
			start: "top bottom",
			end: "bottom top",
			onEnter: function () {
				tl.restart();
			},
			onEnterBack: function () {
				tl.restart();
			},
			onLeave: function () {
				tl.pause(0);
			},
			onLeaveBack: function () {
				tl.pause(0);
			},
		});
	}

	function init() {
		var section = document.getElementById("project_site");
		if (!section) return;

		/* 1) 타이틀: 글자당 0.67초, 1/30초 간격 (원본 time*1.5 - i/20) */
		var titleEl = section.querySelector("h2");
		if (titleEl) {
			var chars = splitTitle(titleEl);
			var titleTl = gsap.timeline({ paused: true });
			titleTl.fromTo(
				chars,
				{ yPercent: 100, rotation: 10 },
				{ yPercent: 0, rotation: 0, duration: 1 / 1.5, ease: EASE_LUSION, stagger: 1 / 20 / 1.5 }
			);
			gsap.set(chars, { yPercent: 100, rotation: 10 });
			playInView(titleEl, titleTl);
		}

		/* 2) 카드 */
		var items = [];
		gsap.utils.toArray("#project_site .pro_site > a").forEach(function (a, index) {
			var item = {
				a: a,
				box: a.parentNode, // transform이 걸리지 않는 원래 자리 (.pro_site)
				index: index,
				active: false,
				ready: false,
				state: { zoom: 0 },
			};
			items.push(item);

			var tl = gsap.timeline({ paused: true });

			// 제목 슬롯: 1.25초 expo.inOut, 가운데 글자가 앞서감 (원본 cos 스태거)
			var p = a.querySelector("p");
			if (p) {
				var cols = splitSlot(p);
				var n = cols.length;
				cols.forEach(function (col, k) {
					var ang = n > 1 ? gsap.utils.mapRange(0, n - 1, Math.PI / 2, (3 * Math.PI) / 2, k) : Math.PI / 2;
					var lead = Math.abs(Math.cos(ang)) / 20; // 0 ~ 0.05
					tl.fromTo(col, { yPercent: -500 }, { yPercent: 0, duration: 1.25, ease: "expo.inOut" }, (0.05 - lead) * 1.25);
				});
				gsap.set(cols, { yPercent: -500 });
			}

			// 카드 등장: 카드(a) 자체를 움직여서 제목·호버 오버레이가 이미지와 함께 움직임
			// WebGL 이미지는 이 값을 그대로 읽어서 같은 위치에 그림
			// 크기 70% → 100% 1.5초, 위치(좌우 번갈아 화면 너비 5%)·회전 2초 (expo.out)
			var side = (index % 2) - 0.5;
			tl.fromTo(a, { scale: 0.7 }, { scale: 1, duration: 1.5, ease: "expo.out" }, 0);
			tl.fromTo(
				a,
				{
					x: function () {
						return side * -window.innerWidth * 0.1;
					},
					rotation: side * 0.1 * (180 / Math.PI),
				},
				{ x: 0, rotation: 0, duration: 2, ease: "expo.out" },
				0
			);

			ScrollTrigger.create({
				trigger: item.box,
				start: "top bottom",
				end: "bottom top",
				onToggle: function (self) {
					item.active = self.isActive;
					if (self.isActive) tl.invalidate().restart();
					else tl.pause(0);
				},
			});

			// 호버: 이미지 살짝 줌아웃 (원본 zoomRatio)
			a.addEventListener("mouseenter", function () {
				gsap.to(item.state, { zoom: 1, duration: 0.8, ease: "power3.out", overwrite: true });
			});
			a.addEventListener("mouseleave", function () {
				gsap.to(item.state, { zoom: 0, duration: 0.8, ease: "power3.out", overwrite: true });
			});
		});

		/* 3) WebGL: 굴절된 이미지 그리기만 담당 */
		if (!window.THREE) return;
		var renderer;
		try {
			renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
		} catch (e) {
			return;
		}
		var canvas = renderer.domElement;
		canvas.className = "project_fx_canvas";
		document.body.appendChild(canvas);

		var scene = new THREE.Scene();
		var camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
		var resolution = new THREE.Vector2();
		var geometry = new THREE.PlaneGeometry(1, 1);

		function resize() {
			var w = window.innerWidth;
			var h = window.innerHeight;
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2));
			renderer.setSize(w, h);
			camera.right = w;
			camera.bottom = -h;
			camera.updateProjectionMatrix();
			renderer.getDrawingBufferSize(resolution);
		}
		resize();
		window.addEventListener("resize", resize);

		items.forEach(function (item) {
			var match = getComputedStyle(item.a).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
			if (!match) return;
			item.uniforms = {
				u_texture: { value: null },
				u_textureSize: { value: new THREE.Vector2(1, 1) },
				u_domXY: { value: new THREE.Vector2() },
				u_domWH: { value: new THREE.Vector2(1, 1) },
				u_pad: { value: new THREE.Vector2() },
				u_rot: { value: 0 },
				u_offsetX: { value: 0 },
				u_resolution: { value: resolution },
				u_rippleStrength: { value: 0 },
				u_showRatio: { value: 0 },
				u_zoomRatio: { value: 0 },
				u_radius: { value: cfg.radius },
			};
			item.mesh = new THREE.Mesh(
				geometry,
				new THREE.ShaderMaterial({
					uniforms: item.uniforms,
					vertexShader: vert,
					fragmentShader: frag,
					transparent: true,
					depthTest: false,
					depthWrite: false,
				})
			);
			item.mesh.frustumCulled = false;
			item.mesh.visible = false;
			scene.add(item.mesh);

			new THREE.TextureLoader().load(match[1], function (tex) {
				tex.minFilter = THREE.LinearFilter;
				tex.generateMipmaps = false;
				item.uniforms.u_texture.value = tex;
				item.uniforms.u_textureSize.value.set(tex.image.width, tex.image.height);
				item.ready = true;
				// WebGL 이미지가 준비되면 CSS 배경은 숨김
				item.a.parentNode.classList.add("is-gl");
			});
		});

		var lastScrollY = window.scrollY;
		var easedStrength = 0;

		gsap.ticker.add(function (time, deltaTime) {
			var dt = Math.min(deltaTime / 1000, 0.1);
			var vw = window.innerWidth;
			var vh = window.innerHeight;
			// 백그라운드 탭에서 열려 크기가 0으로 잡힌 경우 등 대비
			if (camera.right !== vw || camera.bottom !== -vh) resize();
			var scrollY = window.scrollY;
			var delta = (scrollY - lastScrollY) / vh;
			lastScrollY = scrollY;

			// 스크롤 세기 (원본 scrollManager.easedScrollStrength)
			easedStrength += Math.abs(delta);
			easedStrength += (0 - easedStrength) * (1 - Math.exp(-cfg.decay * dt));
			easedStrength = Math.min(easedStrength, 1);
			var ripple = Math.min(cfg.maxStrength, easedStrength * cfg.strengthScale);

			var anyVisible = false;
			items.forEach(function (it) {
				if (!it.mesh) return;
				it.mesh.visible = it.active && it.ready;
				if (!it.mesh.visible) return;
				anyVisible = true;

				// 원래 자리 + 카드(a)에 걸린 GSAP 값 → 이미지가 카드와 똑같이 움직임
				var r = it.box.getBoundingClientRect();
				var pad = r.width * 0.5;
				var isLeft = r.left + r.width * 0.5 < vw * 0.5;
				var u = it.uniforms;
				u.u_domXY.value.set(r.left, r.top);
				u.u_domWH.value.set(r.width, r.height);
				u.u_pad.value.set(isLeft ? pad : 0, isLeft ? 0 : pad);
				u.u_offsetX.value = gsap.getProperty(it.a, "x");
				u.u_rot.value = gsap.getProperty(it.a, "rotation") * (Math.PI / 180);
				u.u_showRatio.value = (gsap.getProperty(it.a, "scale") - 0.7) / 0.3;
				u.u_zoomRatio.value = it.state.zoom;
				u.u_rippleStrength.value = ripple;
			});

			canvas.style.visibility = anyVisible ? "visible" : "hidden";
			if (anyVisible) renderer.render(scene, camera);
		});
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
})();
