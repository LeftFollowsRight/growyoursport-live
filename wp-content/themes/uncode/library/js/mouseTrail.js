(function($) {
	"use strict";

	UNCODE.mouseTrail = (function () {

	"use strict";

	var __globalDestroy = null;

	return function () {

		if (typeof __globalDestroy === "function") {
			try { __globalDestroy(); } catch (e) {}
			__globalDestroy = null;
		}

		function initImageTrail(options) {

			options = options || {};

			var area = options.area;
			var hoverArea = options.hoverArea;

			var images       = options.images || [];
			var size         = options.size != null ? options.size : 120;

			var minWidth = (options.minWidth != null) ? options.minWidth : null;
			var maxWidth = (options.maxWidth != null) ? options.maxWidth : null;

			var life         = options.life != null ? options.life : 1.6;
			var spawnEvery   = options.spawnEvery != null ? options.spawnEvery : 60;
			var touchSpawnEvery = options.touchSpawnEvery != null
				? options.touchSpawnEvery
				: spawnEvery * 2;
			var minDistance  = options.minDistance != null ? options.minDistance : 18;
			var rotateRange  = options.rotateRange != null ? options.rotateRange : 10;
			var scaleRange   = options.scaleRange || [0.9, 1.05];
			var zIndex       = options.zIndex != null ? options.zIndex : 10;
			var inOpacity    = options.inOpacity != null ? options.inOpacity : 0;
			var midOpacity   = options.midOpacity != null ? options.midOpacity : 1;
			var outOpacity   = options.outOpacity != null ? options.outOpacity : 0;
			var drift        = options.drift != null ? options.drift : true;

			var poolSize     = options.poolSize != null ? options.poolSize : 16;

			var inScale      = options.inScale != null ? options.inScale : 0.6;
			var outScale     = options.outScale != null ? options.outScale : 0.6;
			var inDuration   = options.inDuration != null ? options.inDuration : 0.2;
			var outDuration  = options.outDuration != null ? options.outDuration : 0.35;
			var inEase       = options.inEase || "power3.out";
			var outEase      = options.outEase || "power3.in";

			var scrollOn     = options.scrollOn != null ? options.scrollOn : true;

			if (!area || !hoverArea) return null;

			var areaStyle = window.getComputedStyle(area);
			if (areaStyle.position === "static") area.style.position = "relative";

			var lastTime = 0;
			var lastX = null;
			var lastY = null;

			var pointerX = null;
			var pointerY = null;

			var scrollLastTime = 0;
			var scrollLastPageY = null;
			var scrollSpawnEvery = options.scrollSpawnEvery != null ? options.scrollSpawnEvery : 220;
			var scrollMinDistance = options.scrollMinDistance != null ? options.scrollMinDistance : 40;

			var touchViewportOn = options.touchViewportOn !== false;
			var desktopAutoOn = options.desktopAutoOn === true;

			var safeW = options.safeW != null ? options.safeW : 0;
			var safeH = options.safeH != null ? options.safeH : 0;
			var safeMode = options.safeMode || "avoid";
			var particleSafeAreaOn = options.particleSafeAreaOn === true;

			var isTouchDevice = (
				("ontouchstart" in window) ||
				(navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
				(navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
			) && !window.matchMedia("(pointer: fine)").matches;

			var useAutoViewportTrail = isTouchDevice
				? touchViewportOn
				: desktopAutoOn;

			var autoSpawnEvery = isTouchDevice
				? touchSpawnEvery
				: spawnEvery;

			var autoTimer = null;
			var autoRunning = false;
			var rafWatch = 0;
			var watchActive = true;

			var i = 0;

			for (var p = 0; p < images.length; p++) {
				var preload = new Image();
				preload.src = images[p];
			}

			var pool = [];
			var poolIndex = 0;

			function rectVisible(rect, vh) {
				return rect.bottom > 0 && rect.top < vh && rect.height > 0;
			}

			function buildSafeRect(rect) {
				if (!particleSafeAreaOn || !safeW || !safeH) return null;

				var w = rect.width * (safeW / 100);
				var h = rect.height * (safeH / 100);

				if (!w || !h) return null;

				return {
					left: rect.left + (rect.width - w) / 2,
					top: rect.top + (rect.height - h) / 2,
					right: rect.left + (rect.width + w) / 2,
					bottom: rect.top + (rect.height + h) / 2,
					width: w,
					height: h
				};
			}

			function pointInSafeRect(x, y, safeRect) {
				if (!safeRect) return false;
				return (
					x >= safeRect.left &&
					x <= safeRect.right &&
					y >= safeRect.top &&
					y <= safeRect.bottom
				);
			}

			function randomPointInRect(rect) {
				var safeRect = buildSafeRect(rect);

				if (!safeRect) {
					return {
						x: gsap.utils.random(rect.left + 1, rect.right - 1, 1),
						y: gsap.utils.random(rect.top + 1, rect.bottom - 1, 1)
					};
				}

				if (safeMode === "soft") {
					var best = null;
					var cx = safeRect.left + safeRect.width / 2;
					var cy = safeRect.top + safeRect.height / 2;

					for (var i = 0; i < 40; i++) {
						var x = gsap.utils.random(rect.left + 1, rect.right - 1, 1);
						var y = gsap.utils.random(rect.top + 1, rect.bottom - 1, 1);

						var dx = x - cx;
						var dy = y - cy;
						var dist = Math.sqrt(dx * dx + dy * dy);

						if (pointInSafeRect(x, y, safeRect)) {
							dist -= 99999;
						}

						if (!best || dist > best.score) {
							best = {
								x: x,
								y: y,
								score: dist
							};
						}
					}

					return {
						x: best.x,
						y: best.y
					};
				}

				for (var j = 0; j < 40; j++) {
					var px = gsap.utils.random(rect.left + 1, rect.right - 1, 1);
					var py = gsap.utils.random(rect.top + 1, rect.bottom - 1, 1);

					if (!pointInSafeRect(px, py, safeRect)) {
						return {
							x: px,
							y: py
						};
					}
				}

				return {
					x: gsap.utils.random(rect.left + 1, rect.right - 1, 1),
					y: gsap.utils.random(rect.top + 1, rect.bottom - 1, 1)
				};
			}

			function spawnRandomInViewportArea() {
				var rect = hoverArea.getBoundingClientRect();
				var vh = window.innerHeight || document.documentElement.clientHeight;

				if (!rectVisible(rect, vh)) return;

				var p = randomPointInRect(rect);

				lastX = null;
				lastY = null;

				spawn(p.x, p.y);
			}

			function startAutoViewportTrail() {
				if (!useAutoViewportTrail || autoRunning) return;

				autoRunning = true;

				function loop() {
					if (!autoRunning) return;
					spawnRandomInViewportArea();
					autoTimer = setTimeout(loop, autoSpawnEvery);
				}

				loop();
			}

			function stopAutoViewportTrail() {
				autoRunning = false;
				if (autoTimer) {
					clearTimeout(autoTimer);
					autoTimer = null;
				}
			}

			function resetPool() {
				for (var ii = 0; ii < pool.length; ii++) {
					var img = pool[ii];
					if (!img) continue;

					img.__trailToken = (img.__trailToken || 0) + 1;
					gsap.killTweensOf(img);

					gsap.set(img, {
						x: -9999,
						y: -9999,
						opacity: 0,
						scale: inScale,
						rotation: 0
					});
				}
			}

			function onVisibilityChange() {
				if (document.visibilityState === "hidden") {
					stopAutoViewportTrail();
					resetPool();
					lastX = null;
					lastY = null;
					scrollLastPageY = null;
					pointerX = null;
					pointerY = null;
					lastTime = 0;
					scrollLastTime = 0;
					if (rafWatch) {
						cancelAnimationFrame(rafWatch);
						rafWatch = 0;
					}
				} else {
					resetPool();
					if (useAutoViewportTrail) {
						watchViewportAutoState();
					}
				}
			}

			function watchViewportAutoState() {
				if (!watchActive || rafWatch) return;

				function tick() {
					if (!watchActive) {
						rafWatch = 0;
						return;
					}

					if (useAutoViewportTrail) {
						var rect = hoverArea.getBoundingClientRect();
						var vh = window.innerHeight || document.documentElement.clientHeight;

						if (rectVisible(rect, vh)) startAutoViewportTrail();
						else stopAutoViewportTrail();
					}

					rafWatch = requestAnimationFrame(tick);
				}

				rafWatch = requestAnimationFrame(tick);
			}

			function endsWith(str, suffix) {
				str = String(str);
				suffix = String(suffix);
				return str.indexOf(suffix, str.length - suffix.length) !== -1;
			}

			function cssSizeToPx(value, referenceEl) {
				if (value == null) return null;
				if (typeof value === "number") return value;

				value = String(value).trim();

				if (endsWith(value, "px")) return parseFloat(value);
				if (endsWith(value, "vw")) return window.innerWidth * parseFloat(value) / 100;
				if (endsWith(value, "vh")) return window.innerHeight * parseFloat(value) / 100;

				if (endsWith(value, "%")) {
					var rect = referenceEl.getBoundingClientRect();
					return rect.width * parseFloat(value) / 100;
				}

				if (!isNaN(value)) return parseFloat(value);

				return null;
			}

			function getRandomWidthPx() {

				if (minWidth == null && maxWidth == null) return null;

				var minPx = cssSizeToPx(minWidth, area);
				var maxPx = cssSizeToPx(maxWidth, area);

				if (minPx == null && maxPx == null) return null;

				if (minPx == null) minPx = maxPx;
				if (maxPx == null) maxPx = minPx;

				if (maxPx < minPx) {
					var t = minPx;
					minPx = maxPx;
					maxPx = t;
				}

				return gsap.utils.random(minPx, maxPx, 1);
			}

			function applySizing(el) {
				el.style.minWidth = "";
				el.style.maxWidth = "";

				if (size !== "auto" && size != null) {
					el.style.width = (typeof size === "number") ? (size + "px") : String(size);
					el.style.height = "auto";
					return;
				}

				el.style.width = "";
				el.style.height = "auto";

				if (minWidth != null && minWidth !== "") el.style.minWidth = String(minWidth);
				if (maxWidth != null && maxWidth !== "") el.style.maxWidth = String(maxWidth);
			}

			for (var k = 0; k < poolSize; k++) {
				var el = document.createElement("img");
				el.className = "trail-img";

				applySizing(el);

				el.style.zIndex = zIndex;
				el.style.position = "absolute";
				el.style.left = "0";
				el.style.top = "0";
				el.style.pointerEvents = "none";
				el.style.userSelect = "none";
				el.style.willChange = "transform,opacity";

				el.__trailToken = 0;

				area.appendChild(el);

				gsap.set(el, {
					x: -9999,
					y: -9999,
					opacity: 0,
					scale: inScale,
					rotation: 0,
					transformOrigin: "50% 50%"
				});

				pool.push(el);
			}

			function whenDecoded(img, cb) {
				if (img && img.decode) {
					img.decode().then(function () { cb(); }).catch(function () { cb(); });
				} else {
					cb();
				}
			}

			function spawn(clientX, clientY) {

				if (!images.length) return;

				var src = images[i % images.length];
				i++;

				var img = pool[poolIndex % pool.length];
				poolIndex++;

				if (img.parentNode !== area) area.appendChild(img);

				img.__trailToken = (img.__trailToken || 0) + 1;
				var token = img.__trailToken;

				gsap.killTweensOf(img);

				applySizing(img);

				if (img.getAttribute("src") !== src) {
					img.setAttribute("src", src);
				}

				var rect = area.getBoundingClientRect();
				var localX = clientX - rect.left;
				var localY = clientY - rect.top;

				var rot = gsap.utils.random(-rotateRange, rotateRange, 0.1);
				var scl = gsap.utils.random(scaleRange[0], scaleRange[1], 0.01);

				var randomWidth = getRandomWidthPx();
				if (randomWidth) {
					img.style.width = randomWidth + "px";
					img.style.height = "auto";
				}

				gsap.set(img, {
					x: localX,
					y: localY,
					xPercent: -50,
					yPercent: -50,
					rotation: rot,
					scale: inScale,
					opacity: inOpacity,
					transformOrigin: "50% 50%"
				});

				whenDecoded(img, function () {

					if (img.__trailToken !== token) return;

					var tl = gsap.timeline({
						onComplete: function () {
							if (img.__trailToken !== token) return;
							gsap.set(img, { x: -9999, y: -9999, opacity: 0, scale: inScale, rotation: 0 });
						}
					});

					tl.to(img, {
						opacity: midOpacity,
						scale: scl,
						duration: inDuration,
						ease: inEase
					}, 0);

					if (drift) {
						tl.to(img, {
							x: "+=" + gsap.utils.random(-12, 12, 1),
							y: "+=" + gsap.utils.random(-18, 18, 1),
							rotation: rot + gsap.utils.random(-6, 6, 0.1),
							duration: life,
							ease: inEase
						}, 0);
					}

					tl.to(img, {
						opacity: outOpacity,
						scale: outScale,
						duration: outDuration,
						ease: outEase
					}, Math.max(0, life - outDuration));

				});
			}

			function onMove(e) {

				pointerX = e.clientX;
				pointerY = e.clientY;

				var now = Date.now();
				if (now - lastTime < spawnEvery) return;

				var x = e.clientX;
				var y = e.clientY;

				if (lastX !== null) {
					var dx = x - lastX;
					var dy = y - lastY;
					var dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < minDistance) return;
				}

				lastTime = now;
				lastX = x;
				lastY = y;

				spawn(x, y);
			}

			function onLeave() {
				lastX = null;
				lastY = null;
				scrollLastPageY = null;
			}

			function onPointerMove(e) {
				pointerX = e.clientX;
				pointerY = e.clientY;
			}

			function pointInRect(x, y, rect) {
				return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
			}

			function onScroll() {

				if (pointerX === null || pointerY === null) return;

				var now = Date.now();
				if (now - scrollLastTime < scrollSpawnEvery) return;

				var rect = hoverArea.getBoundingClientRect();
				if (!pointInRect(pointerX, pointerY, rect)) return;

				var pageY = window.pageYOffset || document.documentElement.scrollTop || 0;

				if (scrollLastPageY !== null) {
					var scrollDelta = Math.abs(pageY - scrollLastPageY);
					if (scrollDelta < scrollMinDistance) return;
				}

				var x = Math.min(Math.max(pointerX, rect.left + 1), rect.right - 1);
				var y = Math.min(Math.max(pointerY, rect.top + 1), rect.bottom - 1);

				scrollLastTime = now;
				scrollLastPageY = pageY;

				spawn(x, y);
			}

			if (!useAutoViewportTrail) {
				hoverArea.addEventListener("mousemove", onMove);
				hoverArea.addEventListener("mouseleave", onLeave);

				if (scrollOn) {
					window.addEventListener("mousemove", onPointerMove, { passive: true });
					window.addEventListener("scroll", onScroll, { passive: true });
				}
			} else {
				watchViewportAutoState();
			}

			document.addEventListener("visibilitychange", onVisibilityChange);

			return function () {

				document.removeEventListener("visibilitychange", onVisibilityChange);

				if (!useAutoViewportTrail) {
					hoverArea.removeEventListener("mousemove", onMove);
					hoverArea.removeEventListener("mouseleave", onLeave);

					if (scrollOn) {
						window.removeEventListener("mousemove", onPointerMove);
						window.removeEventListener("scroll", onScroll);
					}
				}

				stopAutoViewportTrail();

				watchActive = false;
				if (rafWatch) {
					cancelAnimationFrame(rafWatch);
					rafWatch = 0;
				}

				for (var ii = 0; ii < pool.length; ii++) {
					if (pool[ii] && pool[ii].parentNode) {
						gsap.killTweensOf(pool[ii]);
						pool[ii].parentNode.removeChild(pool[ii]);
					}
				}
				pool.length = 0;
			};

		}

		function getTrailImagesFromArea(area, useParticleImages) {
			var node = null;

			if (useParticleImages) {
				node = area.querySelector(".particle-images");
				if (!node) node = area.querySelector(".trail-images");
			} else {
				node = area.querySelector(".trail-images");
				if (!node) node = area.querySelector(".particle-images");
			}

			if (!node) return [];

			var json = node.textContent || node.innerText || "[]";
			try {
				return JSON.parse(json);
			} catch (e) {
				return [];
			}
		}

		function closestPolyfill(el, selector) {
			while (el && el.nodeType === 1) {
				if (matchesSelector(el, selector)) return el;
				el = el.parentNode;
			}
			return null;
		}

		function matchesSelector(el, selector) {
			var p = Element.prototype;
			var fn = p.matches || p.webkitMatchesSelector || p.mozMatchesSelector || p.msMatchesSelector || p.oMatchesSelector;
			if (!fn) return false;
			return fn.call(el, selector);
		}

		function getDataFromArea(area, key, fallback) {
			if (!area || !key) return fallback;

			var attr = key.indexOf("data-") === 0 ? key : "data-" + key;
			var raw = area.getAttribute(attr);
			if (raw == null) return fallback;

			raw = String(raw).trim();

			if (raw === "true") return true;
			if (raw === "false") return false;
			if (raw === "null") return null;

			var num = raw.replace(",", ".");
			if (num !== "" && isFinite(num)) return parseFloat(num);

			if (
				(raw.charAt(0) === "{" && raw.charAt(raw.length - 1) === "}") ||
				(raw.charAt(0) === "[" && raw.charAt(raw.length - 1) === "]")
			) {
				try { return JSON.parse(raw); } catch (e) {}
			}

			return raw;
		}

		var destroyers = [];

		var areas = document.querySelectorAll(".uncode-bg-trail");
		for (var n = 0; n < areas.length; n++) {

			var renderArea = areas[n];

			if (renderArea.__trailDestroy && typeof renderArea.__trailDestroy === "function") {
				try { renderArea.__trailDestroy(); } catch (e) {}
				renderArea.__trailDestroy = null;
			}

			var hoverArea = renderArea.closest
				? renderArea.closest('.vc_row[data-parent="true"]')
				: closestPolyfill(renderArea, '.vc_row[data-parent="true"]');

			if (!hoverArea) continue;

			var isTouchDevice = (
				("ontouchstart" in window) ||
				(navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
				(navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
			) && !window.matchMedia("(pointer: fine)").matches;

			var desktopAutoOn = String(getDataFromArea(renderArea, "desktop-auto", "no")) === "yes";
			var mobileAutoOn = String(getDataFromArea(renderArea, "mobile-no-auto", "no")) !== "yes";

			var useParticleImages = isTouchDevice ? mobileAutoOn : desktopAutoOn;

			var images = getTrailImagesFromArea(renderArea, useParticleImages);

			renderArea.__trailDestroy = initImageTrail({
				area: renderArea,
				hoverArea: hoverArea,
				images: images,
				size: "auto",

				minWidth: getDataFromArea(renderArea, "min-width", null),
				maxWidth: getDataFromArea(renderArea, "max-width", null),

				life: (getDataFromArea(renderArea, "life", 1) +
					getDataFromArea(renderArea, "in-duration", 0.25) +
					getDataFromArea(renderArea, "out-duration", 0.3)),

				spawnEvery: getDataFromArea(renderArea, "interval", 100),
				minDistance: getDataFromArea(renderArea, "distance", 150),
				scrollSpawnEvery: Math.max(180, getDataFromArea(renderArea, "interval", 100) * 2),
				scrollMinDistance: 30,

				poolSize: getDataFromArea(renderArea, "count", 16),

				inScale: 0,
				outScale: 0,
				inDuration: getDataFromArea(renderArea, "in-duration", 0.25),
				outDuration: getDataFromArea(renderArea, "out-duration", 0.3),

				rotateRange: getDataFromArea(renderArea, "rotate", 10),

				inOpacity: 0,
				midOpacity: 1,
				outOpacity: 0,
				drift: getDataFromArea(renderArea, "drift", false),
				scrollOn: getDataFromArea(renderArea, "scroll", false),

				touchViewportOn: String(getDataFromArea(renderArea, "mobile-no-auto", "no")) !== "yes",
				touchSpawnEvery: getDataFromArea(renderArea, "mobile-interval", 1750),
				desktopAutoOn: String(getDataFromArea(renderArea, "desktop-auto", "no")) === "yes",

				particleSafeAreaOn: useParticleImages,
				safeW: getDataFromArea(renderArea, "safe-w", 0),
				safeH: getDataFromArea(renderArea, "safe-h", 0),
				safeMode: String(getDataFromArea(renderArea, "safe-mode", "avoid")),

				inEase: "power3.out",
				outEase: "power3.in"
			}) || null;

			if (renderArea.__trailDestroy) {
				destroyers.push(renderArea.__trailDestroy);
			}
		}

		__globalDestroy = function () {
			for (var i = 0; i < destroyers.length; i++) {
				try { destroyers[i](); } catch (e) {}
			}
			destroyers.length = 0;
		};

	};

})();

})(jQuery);
