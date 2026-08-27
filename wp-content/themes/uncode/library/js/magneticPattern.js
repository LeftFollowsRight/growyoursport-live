(function($) {
	"use strict";

	UNCODE.magneticPattern = (function () {

	"use strict";

	var __globalDestroy = null;

	return function () {

		if (typeof __globalDestroy === "function") {
			try { __globalDestroy(); } catch (e) {}
			__globalDestroy = null;
		}

		function getMagneticImagesFromArea(area) {
			var node = area.querySelector(".magnetic-images");
			if (!node) return [];
			var json = node.textContent || node.innerText || "[]";
			try { return JSON.parse(json); } catch (e) { return []; }
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

		function clamp01(v) {
			if (v < 0) return 0;
			if (v > 1) return 1;
			return v;
		}

		function toNumber(value, fallback) {
			if (value == null) return fallback;
			var s = String(value).trim();
			if (!s) return fallback;
			s = s.replace(",", ".");
			var m = s.match(/-?\d+(\.\d+)?/);
			if (!m) return fallback;
			var n = parseFloat(m[0]);
			return isFinite(n) ? n : fallback;
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

		function dedupeImages(list) {
			var uniq = [];
			var seen = {};
			for (var i = 0; i < list.length; i++) {
				var src = list[i];
				if (src == null) continue;
				src = String(src);
				if (!seen[src]) {
					seen[src] = true;
					uniq.push(src);
				}
			}
			return uniq;
		}

		function rectsOverlap(a, b) {
			return !(
				a.x + a.w <= b.x ||
				b.x + b.w <= a.x ||
				a.y + a.h <= b.y ||
				b.y + b.h <= a.y
			);
		}

		function initMagneticPattern(options) {

			options = options || {};

			var renderArea = options.area;
			var hoverArea  = options.hoverArea;
			var images     = options.images || [];

			if (!renderArea || !hoverArea || !images.length) return null;

			var count      = (options.count != null) ? options.count : 12;
			var padding    = (options.padding != null) ? options.padding : 24;
			var jitter     = (options.jitter != null) ? options.jitter : 0.35;

			var rawMoveX   = (options.moveX != null) ? options.moveX : 200;
			var rawMoveY   = (options.moveY != null) ? options.moveY : 150;
			var rawSpillX  = (options.spillX != null) ? options.spillX : 0;
			var rawSpillY  = (options.spillY != null) ? options.spillY : 0;

			var moveX      = cssLengthToPx(rawMoveX, hoverArea, 200);
			var moveY      = cssLengthToPx(rawMoveY, hoverArea, 150);
			var spillX     = cssLengthToPx(rawSpillX, renderArea, 0);
			var spillY     = cssLengthToPx(rawSpillY, renderArea, 0);

			var easeDur    = (options.easeDur != null) ? options.easeDur : 0.6;
			var easeLeave  = (options.easeLeave != null) ? options.easeLeave : 1.2;
			var ease       = options.ease || "power3.out";

			var opacityMin = (options.opacityMin != null) ? options.opacityMin : 0.25;
			var opacityMax = (options.opacityMax != null) ? options.opacityMax : 0.9;

			var enableBlur = options.enableBlur === true;
			var blurMin    = (options.blurMin != null) ? options.blurMin : 0;
			var blurMax    = (options.blurMax != null) ? options.blurMax : 6;

			var scaleMin   = (options.scaleMin != null) ? options.scaleMin : 0.6;
			var scaleMax   = (options.scaleMax != null) ? options.scaleMax : 1;

			var depthMin   = (options.depthMin != null) ? options.depthMin : 0.3;
			var depthMax   = (options.depthMax != null) ? options.depthMax : 1;

			var unique     = options.unique === true;

			var zIndexBase     = (options.zIndexBase != null) ? options.zIndexBase : 1;
			var zIndexRange    = (options.zIndexRange != null) ? options.zIndexRange : 30;
			var enableRotation = options.enableRotation !== false;
			var rotationRange  = (options.rotationRange != null) ? options.rotationRange : 8;

			var noOverlap = options.noOverlap === true;
			var attempts  = (options.attempts != null) ? options.attempts : 120;
			var gap       = (options.gap != null) ? options.gap : 8;

			var baseWidth = (options.baseWidth != null) ? options.baseWidth : 300;

			var depthEnabled = options.flatDepth !== true;

			var enableScrollMotion = options.scrollMotion !== false;

			var safeW = (options.safeW != null) ? options.safeW : 0;
			var safeH = (options.safeH != null) ? options.safeH : 0;
			var safeMode = options.safeMode || "avoid";

			var items = [];

			function cssLengthToPx(value, el, fallback) {
				if (value == null) return fallback;

				if (typeof value === "number") return isFinite(value) ? value : fallback;

				var s = String(value).trim();
				if (!s) return fallback;

				var n = parseFloat(s.replace(",", "."));
				if (isFinite(n) && String(n) === s.replace(",", ".")) return n;

				var probe = document.createElement("div");
				probe.style.position = "absolute";
				probe.style.visibility = "hidden";
				probe.style.pointerEvents = "none";
				probe.style.width = s;
				probe.style.height = "0";

				var parent = (el && el.parentNode) ? el.parentNode : document.body;
				parent.appendChild(probe);

				var px = probe.getBoundingClientRect().width;
				parent.removeChild(probe);

				return (px && isFinite(px)) ? px : fallback;
			}

			if (window.getComputedStyle(renderArea).position === "static") {
				renderArea.style.position = "relative";
			}

			function lerp(a, b, t) {
				return a + (b - a) * t;
			}

			function clearAll() {
				var nodes = renderArea.querySelectorAll(".pattern-img");
				for (var i = nodes.length - 1; i >= 0; i--) {
					if (nodes[i] && nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
				}
				items.length = 0;
			}

			function buildSafeRect(virtualW, virtualH, originX, originY) {
				if (!safeW || !safeH) return null;

				var szW = (safeW / 100) * virtualW;
				var szH = (safeH / 100) * virtualH;

				if (!szW || !szH) return null;

				return {
					x: originX + (virtualW - szW) / 2,
					y: originY + (virtualH - szH) / 2,
					w: szW,
					h: szH
				};
			}

			var rafWatch = 0;
			var lastTop = null;
			var lastHeight = null;
			var watchActive = true;

			function watchPosition() {
				if (!watchActive) return;

				var rect = hoverArea.getBoundingClientRect();
				var top = Math.round(rect.top);
				var height = Math.round(rect.height);

				var movedEnough =
					lastTop === null ||
					Math.abs(top - lastTop) > 1 ||
					Math.abs(height - lastHeight) > 1;

				if (movedEnough) {
					lastTop = top;
					lastHeight = height;
					onScroll();
				}

				rafWatch = requestAnimationFrame(watchPosition);
			}
			
			function buildLayout() {

				clearAll();

				var rect = renderArea.getBoundingClientRect();

				var width  = rect.width  + spillX * 2;
				var height = rect.height + spillY * 2;

				var originX = -spillX;
				var originY = -spillY;

				var safeRect = buildSafeRect(width, height, originX, originY);

				var imgs = unique ? dedupeImages(images) : images;
				var effectiveCount = unique ? Math.min(count, imgs.length) : count;

				var cols = Math.ceil(Math.sqrt(effectiveCount));
				var rows = Math.ceil(effectiveCount / cols);

				var cellW = (width  - padding * 2) / cols;
				var cellH = (height - padding * 2) / rows;

				var frag = document.createDocumentFragment();
				var placed = [];

				for (var i = 0; i < effectiveCount; i++) {

					var src = imgs[i % imgs.length];

					var el = document.createElement("img");
					el.className = "pattern-img";
					el.src = src;

					el.style.position = "absolute";
					el.style.left = "0";
					el.style.top = "0";
					el.style.pointerEvents = "none";
					el.style.userSelect = "none";
					el.style.willChange = "transform,opacity,filter";

					el.style.width = baseWidth + "px";
					el.style.height = "auto";

					var col = i % cols;
					var row = Math.floor(i / cols);

					var baseCellX = originX + padding + col * cellW;
					var baseCellY = originY + padding + row * cellH;

					var baseX = baseCellX + cellW / 2 + (Math.random() - 0.5) * cellW * jitter;
					var baseY = baseCellY + cellH / 2 + (Math.random() - 0.5) * cellH * jitter;

					var placedOk = true;

					function isBadCandidate(x, y) {
						var cand = { x: x, y: y, w: baseWidth + gap, h: baseWidth + gap };

						if (safeRect && rectsOverlap(cand, safeRect)) {
							if (safeMode === "avoid") return true;
						}

						if (noOverlap) {
							for (var p = 0; p < placed.length; p++) {
								if (rectsOverlap(cand, placed[p])) return true;
							}
						}

						return false;
					}

					if (safeRect && safeMode === "soft") {
						var best = { x: baseX, y: baseY, score: -999999 };
						var softTries = Math.max(20, Math.min(120, attempts));

						for (var st = 0; st < softTries; st++) {
							var rxS = baseCellX + (Math.random() * cellW);
							var ryS = baseCellY + (Math.random() * cellH);

							var candS = { x: rxS, y: ryS, w: baseWidth + gap, h: baseWidth + gap };

							var score = 0;

							if (noOverlap) {
								for (var pp = 0; pp < placed.length; pp++) {
									if (rectsOverlap(candS, placed[pp])) { score -= 1000; break; }
								}
							}

							if (rectsOverlap(candS, safeRect)) score -= 500;

							var sx = safeRect.x + safeRect.w / 2;
							var sy = safeRect.y + safeRect.h / 2;
							var dxs = (rxS - sx);
							var dys = (ryS - sy);
							score += Math.sqrt(dxs * dxs + dys * dys);

							if (score > best.score) best = { x: rxS, y: ryS, score: score };
						}

						baseX = best.x;
						baseY = best.y;

						if (noOverlap) {
							if (isBadCandidate(baseX, baseY)) {
								placedOk = false;
							}
						}

					} else {
						if (noOverlap || safeRect) {
							placedOk = false;

							for (var a = 0; a < attempts; a++) {
								var rx = baseCellX + (Math.random() * cellW);
								var ry = baseCellY + (Math.random() * cellH);

								if (safeRect && safeMode === "avoid") {
									var cx = rx + (baseWidth / 2);
									var cy = ry + (baseWidth / 2);
									if (cx >= safeRect.x && cx <= safeRect.x + safeRect.w &&
										cy >= safeRect.y && cy <= safeRect.y + safeRect.h) {
										continue;
									}
								}

								var cand = { x: rx, y: ry, w: baseWidth + gap, h: baseWidth + gap };

								var collides = false;
								if (noOverlap) {
									for (var p = 0; p < placed.length; p++) {
										if (rectsOverlap(cand, placed[p])) { collides = true; break; }
									}
								}

								if (!collides) {
									baseX = rx;
									baseY = ry;
									placed.push(cand);
									placedOk = true;
									break;
								}
							}

							if (!placedOk) continue;
						}
					}

					if (noOverlap && placedOk) {
						placed.push({ x: baseX, y: baseY, w: baseWidth + gap, h: baseWidth + gap });
					}

					var rnd = Math.random();
					var tDepth = depthEnabled ? rnd : 0;

					var tScale = depthEnabled ? (1 - tDepth) : Math.random();
					tScale = clamp01(tScale);

					var scale = lerp(scaleMin, scaleMax, tScale);

					var moveFactor = depthEnabled ? lerp(1, 0.25, tDepth) : 1;

					var opacity = depthEnabled
						? lerp(opacityMax, opacityMin, tDepth)
						: lerp(opacityMin, opacityMax, Math.random());

					var blur = 0;
					if (enableBlur) {
						blur = depthEnabled
							? lerp(blurMin, blurMax, tDepth)
							: lerp(blurMin, blurMax, Math.random());
					}

					var tZ = depthEnabled
						? (1 - tDepth)
						: ((scaleMax === scaleMin) ? 1 : (scale - scaleMin) / (scaleMax - scaleMin));
					tZ = clamp01(tZ);

					el.style.zIndex = zIndexBase + Math.round(zIndexRange * tZ);

					var rot = 0;
					if (enableRotation) {
						rot = gsap.utils.random(-rotationRange, rotationRange, 0.1);
					}

					gsap.set(el, {
						x: baseX,
						y: baseY,
						scale: scale,
						rotation: rot,
						opacity: opacity,
						filter: enableBlur ? "blur(" + blur.toFixed(2) + "px)" : "none"
					});

					items.push({
						el: el,
						baseX: baseX,
						baseY: baseY,
						moveFactor: moveFactor
					});

					frag.appendChild(el);
				}

				renderArea.appendChild(frag);
			}

			buildLayout();

			function onMove(e) {

				var rect = hoverArea.getBoundingClientRect();
				if (!rect.width || !rect.height) return;

				var nx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
				var ny = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);

				for (var i = 0; i < items.length; i++) {
					var it = items[i];

					var dx = -nx * moveX * it.moveFactor;
					var dy = -ny * moveY * it.moveFactor;

					gsap.to(it.el, {
						x: it.baseX + dx,
						y: it.baseY + dy,
						duration: easeDur,
						ease: ease,
						overwrite: true
					});
				}
			}

			function onScroll() {

				if (!enableScrollMotion) return;

				var rect = hoverArea.getBoundingClientRect();
				var vh = window.innerHeight || document.documentElement.clientHeight;

				if (!rect.height) return;

				// completamente fuori
				if (rect.bottom <= 0 || rect.top >= vh) {
					for (var k = 0; k < items.length; k++) {
						var it0 = items[k];
						gsap.to(it0.el, {
							x: it0.baseX,
							y: it0.baseY,
							duration: easeLeave,
							ease: ease,
							overwrite: true
						});
					}
					return;
				}

				var travel = vh + rect.height;
				var progress = (vh - rect.top) / travel;

				if (progress < 0) progress = 0;
				if (progress > 1) progress = 1;

				var ny = progress * 2 - 1;
				var nx = ny * 0.35;

				for (var i = 0; i < items.length; i++) {
					var it = items[i];

					var dx = -nx * moveX * 0.35 * it.moveFactor;
					var dy = -ny * moveY * 0.35 * it.moveFactor;

					gsap.to(it.el, {
						x: it.baseX + dx,
						y: it.baseY + dy,
						duration: easeDur,
						ease: ease,
						overwrite: true
					});
				}
			}

			function onLeave() {
				for (var i = 0; i < items.length; i++) {
					var it = items[i];
					gsap.to(it.el, {
						x: it.baseX,
						y: it.baseY,
						duration: easeLeave,
						ease: ease,
						overwrite: true
					});
				}
			}

			var sizeObserver = null;
			var lastLayoutW = 0;
			var lastLayoutH = 0;

			function updateLayoutSizeCache() {
				var r = renderArea.getBoundingClientRect();
				lastLayoutW = Math.round(r.width);
				lastLayoutH = Math.round(r.height);
			}

			function shouldRebuildLayout() {
				var r = renderArea.getBoundingClientRect();
				var newW = Math.round(r.width);
				var newH = Math.round(r.height);

				var dw = Math.abs(newW - lastLayoutW);
				var dh = Math.abs(newH - lastLayoutH);

				// rebuild sempre se cambia la larghezza
				// sull'altezza, tollera micro-variazioni tipiche del browser mobile durante lo scroll
				var mustRebuild = dw > 1 || dh > 80;

				if (mustRebuild) {
					lastLayoutW = newW;
					lastLayoutH = newH;
				}

				return mustRebuild;
			}

			updateLayoutSizeCache();

			if ("ResizeObserver" in window) {
				sizeObserver = new ResizeObserver(function () {
					if (shouldRebuildLayout()) {
						buildLayout();
					}
					onScroll();
				});
				sizeObserver.observe(renderArea);
			}

			hoverArea.addEventListener("mousemove", onMove);
			hoverArea.addEventListener("mouseleave", onLeave);

			function onWindowResize() {
				if (shouldRebuildLayout()) {
					buildLayout();
				}
				onScroll();
			}

			window.addEventListener("resize", onWindowResize);
			window.addEventListener("scroll", onScroll, { passive: true });
			onScroll();
			watchPosition();

			return function () {
				hoverArea.removeEventListener("mousemove", onMove);
				hoverArea.removeEventListener("mouseleave", onLeave);
				window.removeEventListener("resize", onWindowResize);
				window.removeEventListener("scroll", onScroll);

				if (sizeObserver) {
					sizeObserver.disconnect();
					sizeObserver = null;
				}

				watchActive = false;
				if (rafWatch) {
					cancelAnimationFrame(rafWatch);
					rafWatch = 0;
				}
				
				clearAll();
			};

		}

		var destroyers = [];

		var areas = document.querySelectorAll(".uncode-bg-magnetic");
		for (var n = 0; n < areas.length; n++) {
			var renderArea = areas[n];

			if (renderArea.__magneticDestroy && typeof renderArea.__magneticDestroy === "function") {
				try { renderArea.__magneticDestroy(); } catch (e) {}
				renderArea.__magneticDestroy = null;
			}

			var hoverArea = renderArea.closest
				? renderArea.closest('.vc_row[data-parent="true"]')
				: closestPolyfill(renderArea, '.vc_row[data-parent="true"]');

			if (!hoverArea) continue;

			var images = getMagneticImagesFromArea(renderArea);
			if (!images.length) continue;

			function cssLengthToPx(value, el, fallback) {
				if (value == null) return fallback;

				if (typeof value === "number") return isFinite(value) ? value : fallback;

				var s = String(value).trim();
				if (!s) return fallback;

				var n = parseFloat(s.replace(",", "."));
				if (isFinite(n) && String(n) === s.replace(",", ".")) return n;

				var probe = document.createElement("div");
				probe.style.position = "absolute";
				probe.style.visibility = "hidden";
				probe.style.pointerEvents = "none";
				probe.style.width = s;
				probe.style.height = "0";

				var parent = (el && el.parentNode) ? el.parentNode : document.body;
				parent.appendChild(probe);

				var px = probe.getBoundingClientRect().width;
				parent.removeChild(probe);

				return (px && isFinite(px)) ? px : fallback;
			}

			var rawMin = getDataFromArea(renderArea, "min-width", "100px");
			var rawMax = getDataFromArea(renderArea, "max-width", "300px");

			var minW = cssLengthToPx(rawMin, renderArea, 100);
			var maxW = cssLengthToPx(rawMax, renderArea, 300);
			if (maxW < minW) { var tmp = minW; minW = maxW; maxW = tmp; }

			var scaleMin = (maxW > 0) ? (minW / maxW) : 1;

			var rawMoveX = getDataFromArea(renderArea, "move-x", "400px");
			var rawMoveY = getDataFromArea(renderArea, "move-y", "300px");
			var rawSpillX = getDataFromArea(renderArea, "spill-x", null);
			var rawSpillY = getDataFromArea(renderArea, "spill-y", null);

			if (rawSpillX == null || rawSpillX === "") {
				if (typeof rawMoveX === "number") rawSpillX = rawMoveX / 2;
				else rawSpillX = "calc((" + rawMoveX + ") / 2)";
			}

			if (rawSpillY == null || rawSpillY === "") {
				if (typeof rawMoveY === "number") rawSpillY = rawMoveY / 2;
				else rawSpillY = "calc((" + rawMoveY + ") / 2)";
			}

			renderArea.__magneticDestroy = initMagneticPattern({
				area: renderArea,
				hoverArea: hoverArea,
				images: images,

				count: toNumber(getDataFromArea(renderArea, "count", 16), 16),

				padding: 27,
				jitter: 0.35,

				moveX: rawMoveX,
				moveY: rawMoveY,
				spillX: rawSpillX,
				spillY: rawSpillY,

				easeDur: 0.7,
				easeLeave: 1.7,
				ease: "power3.out",

				opacityMin: toNumber(getDataFromArea(renderArea, "min-opacity", 0.25), 0.25),
				opacityMax: toNumber(getDataFromArea(renderArea, "max-opacity", 1), 1),

				zIndexBase: 1,
				zIndexRange: 30,

				enableRotation: false,
				rotationRange: 8,

				enableBlur: String(getDataFromArea(renderArea, "blur", "no")) === "yes",
				blurMin: 0,
				blurMax: 1.5,

				baseWidth: maxW,
				scaleMin: scaleMin,
				scaleMax: 1,

				flatDepth: String(getDataFromArea(renderArea, "depth", "no")) !== "yes",

				noOverlap: String(getDataFromArea(renderArea, "no-overlap", "no")) === "yes",
				attempts: toNumber(getDataFromArea(renderArea, "attempts", 120), 120),
				gap: toNumber(getDataFromArea(renderArea, "gap", 8), 8),

				depthMin: 0.25,
				depthMax: 1.0,

				unique: String(getDataFromArea(renderArea, "unique", "no")) === "yes",

				safeW: toNumber(getDataFromArea(renderArea, "safe-w", 0), 0),
				safeH: toNumber(getDataFromArea(renderArea, "safe-h", 0), 0),
				safeMode: String(getDataFromArea(renderArea, "safe-mode", "avoid")),

				scrollMotion: String(getDataFromArea(renderArea, "stop-scroll", "no")) !== "yes",
			}) || null;

			if (renderArea.__magneticDestroy) {
				destroyers.push(renderArea.__magneticDestroy);
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
