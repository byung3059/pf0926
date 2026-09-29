/*
 * 스무스 스크롤 (Lenis)
 * - 마우스 휠 스크롤을 부드럽게 보간, 터치 기기는 브라우저 기본 스크롤 유지 (smoothTouch: false)
 * - GSAP ticker로 구동하고 ScrollTrigger와 스크롤 위치를 동기화
 * - 다른 스크립트에서 window.lenis로 접근 가능 (예: lenis.scrollTo("#project_site"))
 */
(function () {
	if (!window.Lenis) return;

	var cfg = Object.assign(
		{
			duration: 1.2, // 스크롤이 목표 위치까지 가는 시간(초) — 클수록 느리고 부드럽게
			wheelMultiplier: 1, // 휠 한 번에 움직이는 양 배수
		},
		window.SMOOTH_SCROLL_CONFIG || {}
	);

	var lenis = new Lenis({
		duration: cfg.duration,
		easing: function (t) {
			return Math.min(1, 1.001 - Math.pow(2, -10 * t));
		},
		smoothWheel: true,
		smoothTouch: false,
		wheelMultiplier: cfg.wheelMultiplier,
	});
	window.lenis = lenis;

	if (window.gsap) {
		if (window.ScrollTrigger) {
			gsap.registerPlugin(ScrollTrigger);
			lenis.on("scroll", ScrollTrigger.update);
		}
		gsap.ticker.add(function (time) {
			lenis.raf(time * 1000);
		});
		gsap.ticker.lagSmoothing(0);
	} else {
		requestAnimationFrame(function raf(time) {
			lenis.raf(time);
			requestAnimationFrame(raf);
		});
	}
})();
