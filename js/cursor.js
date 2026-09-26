/* cursor.js — 사이트 전역 커스텀 원형 커서 + 마우스 따라다니는 배경 그라데이션
   설정: cursor.js보다 먼저 window.CURSOR_CONFIG = { ... } 로 덮어쓰기 (빠진 값은 아래 기본값)
   상태: 다른 스크립트가 <html data-cursor="drag|grabbing"> 을 넣으면 그 모양으로 바뀜 (canvas.js가 유리 도형 위에서 사용)
   그라데이션: body 배경을 투명으로 바꾸고(색은 html로 옮김) 그 사이에 고정 레이어로 깔림 → 모든 섹션에서 보임 */
(() => {
	const CFG = Object.assign(
		{
			glowColor: "", // 배경 그라데이션 색 (rgba로 투명도 가능, 비우면 없음)
			glowSize: 0.55, // 그라데이션 크기 (화면 대각선 대비 0~1)
			glowEase: 0.08, // 마우스 따라가는 속도 0~1 (낮을수록 느리고 부드럽게)
			size: 14, // 기본 지름(px)
			color: "#ffffff", // 커서 색 (difference 블렌드라 배경에 따라 반전돼 보임)
			blend: "difference", // mix-blend-mode ("normal"로 하면 색 그대로)
			mono: false, // 커서를 항상 흑백으로 (뒤 배경을 흑백으로 바꾼 뒤 반전 → 컬러 이미지 위에서도 흑/백)
			ease: 1, // 따라오는 속도 0~1 (1 = 마우스와 동일)
			linkScale: 3, // 링크·버튼 위에서 확대 배수
			dragSize: 84, // 유리 도형 위 지름(px)
			dragText: "DRAG OR CLICK", // 유리 도형 위 글자 (비우면 글자 없음)
			hideNative: true, // 기본 마우스 커서 숨김
		},
		window.CURSOR_CONFIG || {},
	);

	/* ---------- 배경 그라데이션 (전역, 마우스 추적) ---------- */
	const tgt = { x: innerWidth * 0.95, y: 0 }; // 마우스 움직이기 전엔 오른쪽 위
	const glowPos = { x: tgt.x, y: tgt.y };
	let glowEl = null;
	function rgba(str) {
		const t = document.createElement("i");
		t.style.color = str;
		document.body.appendChild(t);
		const m = getComputedStyle(t).color.match(/[\d.]+/g) || [0, 0, 0];
		t.remove();
		return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
	}
	function setupGlow() {
		if (!CFG.glowColor) return;
		const root = document.documentElement,
			body = document.body;
		// body 배경색을 html로 옮기고 body는 투명 → 그 사이에 그라데이션 레이어
		const bb = getComputedStyle(body).backgroundColor;
		if (bb && bb !== "transparent" && bb !== "rgba(0, 0, 0, 0)") root.style.backgroundColor = bb;
		body.style.backgroundColor = "transparent";
		const [r, g, b, a] = rgba(CFG.glowColor);
		const c = (k) => `rgba(${r},${g},${b},${(a * k).toFixed(4)})`;
		glowEl = document.createElement("div");
		glowEl.className = "g-glow";
		// 부드러운 감쇠 (canvas.js의 smoothstep과 같은 곡선)
		glowEl.style.cssText = `position:fixed;inset:0;z-index:-1;pointer-events:none;
			background:radial-gradient(circle var(--gr) at var(--gx) var(--gy), ${c(1)} 0%, ${c(0.84)} 25%, ${c(0.5)} 50%, ${c(0.16)} 75%, ${c(0)} 100%);`;
		body.prepend(glowEl);
	}
	function updateGlow() {
		if (!glowEl) return;
		glowPos.x += (tgt.x - glowPos.x) * CFG.glowEase;
		glowPos.y += (tgt.y - glowPos.y) * CFG.glowEase;
		glowEl.style.setProperty("--gx", glowPos.x + "px");
		glowEl.style.setProperty("--gy", glowPos.y + "px");
		glowEl.style.setProperty("--gr", Math.hypot(innerWidth, innerHeight) * CFG.glowSize + "px");
	}

	// 마우스가 없는 기기(터치)에서는 커서 없이 그라데이션만
	const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
	if (!fine) {
		const start = () => {
			setupGlow();
			(function loop() {
				requestAnimationFrame(loop);
				updateGlow();
			})();
		};
		document.body ? start() : document.addEventListener("DOMContentLoaded", start);
		return;
	}

	const style = document.createElement("style");
	style.textContent = `
		${CFG.hideNative ? "html, html * { cursor: none !important; }" : ""}
		.g-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
			width: ${CFG.size}px; height: ${CFG.size}px; margin: ${-CFG.size / 2}px 0 0 ${-CFG.size / 2}px;
			border-radius: 50%; background: ${CFG.color}; mix-blend-mode: ${CFG.blend};
			display: flex; align-items: center; justify-content: center; opacity: 0;
			transition: width .35s cubic-bezier(.2,.8,.2,1), height .35s cubic-bezier(.2,.8,.2,1),
				margin .35s cubic-bezier(.2,.8,.2,1), opacity .25s, transform .15s; will-change: translate; }
		${CFG.mono ? ".g-cursor { -webkit-backdrop-filter: grayscale(1); backdrop-filter: grayscale(1); }" : ""}
		.g-cursor.is-on { opacity: 1; }
		.g-cursor.is-link { transform: scale(${CFG.linkScale}); }
		.g-cursor.is-drag, .g-cursor.is-grabbing { width: ${CFG.dragSize}px; height: ${CFG.dragSize}px;
			margin: ${-CFG.dragSize / 2}px 0 0 ${-CFG.dragSize / 2}px; }
		.g-cursor.is-grabbing { transform: scale(0.85); }
		.g-cursor span { display: block; max-width: 78%; text-align: center; white-space: normal;
			font: 700 11px/1.25 "Pretendard", sans-serif; letter-spacing: .1em; color: #000;
			margin-right: -.1em; /* 마지막 글자 뒤 자간만큼 보정 → 정확히 가운데 */
			opacity: 0; transition: opacity .2s; }
		.g-cursor.is-drag span, .g-cursor.is-grabbing span { opacity: 1; }
		.g-cursor.is-down { transform: scale(0.7); }
	`;
	document.head.appendChild(style);

	// html 배경이 투명이면(body에만 배경) difference 블렌드가 섞을 바탕이 없어 커서가 안 보임
	// → body 배경색을 html에도 채움 (보이는 화면은 동일)
	const fixBackdrop = () => {
		const root = document.documentElement;
		const hb = getComputedStyle(root).backgroundColor;
		if (hb === "transparent" || hb === "rgba(0, 0, 0, 0)") {
			const bb = document.body && getComputedStyle(document.body).backgroundColor;
			root.style.backgroundColor = bb && bb !== "rgba(0, 0, 0, 0)" && bb !== "transparent" ? bb : "#fff";
		}
	};

	const el = document.createElement("div");
	el.className = "g-cursor";
	el.innerHTML = CFG.dragText ? `<span>${CFG.dragText}</span>` : "";
	const mount = () => {
		setupGlow();
		document.body.appendChild(el);
		fixBackdrop();
	};
	document.body ? mount() : document.addEventListener("DOMContentLoaded", mount);

	const pos = { x: -100, y: -100 };
	let first = true;

	window.addEventListener("pointermove", (e) => {
		tgt.x = e.clientX;
		tgt.y = e.clientY;
		if (e.pointerType !== "mouse") return;
		if (first || CFG.ease >= 1) {
			// ease 1: 프레임 기다리지 않고 바로 이동 → 실제 마우스와 같은 속도
			pos.x = tgt.x;
			pos.y = tgt.y;
			el.style.translate = `${pos.x}px ${pos.y}px`;
			first = false;
		}
		el.classList.add("is-on");
		// 링크·버튼 위 확대
		const link = e.target.closest && e.target.closest("a, button, [role='button'], input, select, textarea, label");
		el.classList.toggle("is-link", !!link && !document.documentElement.dataset.cursor);
	});
	document.addEventListener("mouseleave", () => el.classList.remove("is-on"));
	window.addEventListener("pointerdown", () => el.classList.add("is-down"));
	window.addEventListener("pointerup", () => el.classList.remove("is-down"));

	// 다른 스크립트가 알려주는 상태 (drag / grabbing) → 바뀌는 즉시 반영
	function applyState() {
		const s = document.documentElement.dataset.cursor || "";
		el.classList.remove("is-drag", "is-grabbing");
		if (s) el.classList.add("is-" + s, "is-on");
		if (s) el.classList.remove("is-link");
	}
	new MutationObserver(applyState).observe(document.documentElement, { attributes: true, attributeFilter: ["data-cursor"] });
	applyState();

	(function loop() {
		requestAnimationFrame(loop);
		updateGlow();
		if (first || CFG.ease >= 1) return; // ease 1이면 pointermove에서 바로 이동
		pos.x += (tgt.x - pos.x) * CFG.ease;
		pos.y += (tgt.y - pos.y) * CFG.ease;
		el.style.translate = `${pos.x}px ${pos.y}px`;
	})();
})();
