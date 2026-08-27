(function($) {
	"use strict";

	UNCODE.thumbDrop = (function () {

	"use strict";

	var __globalDestroy = null;

	return function () {

		if (!window.Matter) return;

		if (typeof __globalDestroy === "function") {
			try { __globalDestroy(); } catch (e) {}
			__globalDestroy = null;
		}

		var Engine = Matter.Engine;
		var World  = Matter.World;
		var Bodies = Matter.Bodies;
		var Body   = Matter.Body;
		var Mouse  = Matter.Mouse;
		var MouseConstraint = Matter.MouseConstraint;

		function getDropImagesFromArea(area) {
			var node = area.querySelector("script.drop-images");
			if (!node) return [];
			var json = node.textContent || node.innerText || "[]";
			try { return JSON.parse(json); } catch (e) { return []; }
		}

		function matchesSelector(el, selector) {
			var p = Element.prototype;
			var fn = p.matches || p.webkitMatchesSelector || p.mozMatchesSelector || p.msMatchesSelector || p.oMatchesSelector;
			if (!fn) return false;
			return fn.call(el, selector);
		}

		function closestPolyfill(el, selector) {
			while (el && el.nodeType === 1) {
				if (matchesSelector(el, selector)) return el;
				el = el.parentNode;
			}
			return null;
		}

		function debounce(fn, wait) {
			var t = null;
			return function () {
				var ctx = this;
				var args = arguments;
				clearTimeout(t);
				t = setTimeout(function () { fn.apply(ctx, args); }, wait);
			};
		}

		function clamp(v, a, b) {
			return v < a ? a : (v > b ? b : v);
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
			probe.style.width = "0";
			probe.style.height = "0";

			var parent = (el && el.parentNode) ? el.parentNode : document.body;
			parent.appendChild(probe);

			probe.style.width = s;
			var px = probe.getBoundingClientRect().width;

			parent.removeChild(probe);

			if (!px || !isFinite(px)) return fallback;
			return px;
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

		function raf2(cb) {
			requestAnimationFrame(function () {
				requestAnimationFrame(function () {
					cb();
				});
			});
		}

		function normalizeDragMode(v) {
			if (v == null) return "";
			if (v === true) return "drag";
			var s = String(v).trim().toLowerCase();
			if (!s) return "";
			if (s === "1" || s === "yes" || s === "true") return "drag";
			if (s === "drag" || s === "hover") return s;
			return "";
		}

		function initMatterDrop(options) {
			options = options || {};

			var area    = options.area;
			var surface = options.surface;
			var images  = options.images || [];

			var maxAvailable = images.length;
			var duplicateImages = options.duplicateImages !== false;
			var count = options.count != null ? options.count : Math.min(18, maxAvailable);

			if (!duplicateImages && count > maxAvailable) {
				count = maxAvailable;
			}

			var sizeMin    = options.sizeMin != null ? options.sizeMin : 140;
			var sizeMax    = options.sizeMax != null ? options.sizeMax : 260;
			var spawnEvery = options.spawnEvery != null ? options.spawnEvery : 160;
			var startDelay = options.startDelay != null ? options.startDelay : 0;

			var gravityY    = options.gravityY != null ? options.gravityY : 1.25;
			var restitution = options.restitution != null ? options.restitution : 0.35;
			var frictionAir = options.frictionAir != null ? options.frictionAir : 0.02;
			var friction    = options.friction != null ? options.friction : 0.25;
			var density     = options.density != null ? options.density : 0.001;

			var wallThickness = options.wallThickness != null ? options.wallThickness : 80;
			var floorPadding  = options.floorPadding != null ? options.floorPadding : 0;

			var rotateRange = options.rotateRange != null ? options.rotateRange : 18;

			var once       = options.once !== false;
			var threshold  = options.threshold != null ? options.threshold : 0.25;
			var rootMargin = options.rootMargin || "0px 0px -10% 0px";

			var dragMode = normalizeDragMode(options.enableDrag);
			var enableDrag = dragMode === "drag";
			var enableHoverRepel = dragMode === "hover";

			var dragStiffness = options.dragStiffness != null ? options.dragStiffness : 0.18;
			var dragDamping   = options.dragDamping != null ? options.dragDamping : 0.06;

			var hoverRadius = options.hoverRadius != null ? options.hoverRadius : 260;
			var spawnXMode = String(options.spawnXMode || "random").toLowerCase();
			var spawnXFixed = options.spawnXFixed != null ? options.spawnXFixed : 50;
			var spawnXJitter = options.spawnXJitter != null ? options.spawnXJitter : 0;	

			if (!area || !surface || !images.length) return null;

			var cs = window.getComputedStyle(area);
			if (cs.position === "static") area.style.position = "absolute";
			if (!area.style.left) area.style.left = "0";
			if (!area.style.top) area.style.top = "0";
			if (!area.style.width) area.style.width = "100%";
			if (!area.style.height) area.style.height = "100%";

			area.style.pointerEvents = enableDrag ? "auto" : "none";

			var engine = Engine.create();
			engine.enableSleeping = false;
			engine.gravity.y = gravityY;

			var alive = true;
			var started = false;

			var bounds = { w: 0, h: 0 };
			var walls = null;
			var items = [];

			var spawnTimer = null;
			var spawned = 0;

			var ro = null;
			var pollTimer = null;
			var lastW = 0;
			var lastH = 0;

			var mouseConstraint = null;

			var rafId = 0;
			var io = null;
			var scrollHandler = null;
			var dragMousemoveHandler = null;

			var hoverMoveHandler = null;
			var hoverLeaveHandler = null;
			var hoverX = null;
			var hoverY = null;
			var hoverActive = false;

			function updateRects() {
				bounds.w = area.offsetWidth;
				bounds.h = area.offsetHeight;
			}

			function removeWalls() {
				if (!walls) return;
				World.remove(engine.world, walls.floor);
				World.remove(engine.world, walls.left);
				World.remove(engine.world, walls.right);
				walls = null;
			}

			function createWalls() {
				updateRects();

				var w = bounds.w;
				var h = bounds.h;
				if (!w || !h) return false;

				var t = wallThickness;
				var floorY = h + t * 0.5 + floorPadding;

				var floor = Bodies.rectangle(w * 0.5, floorY, w + t * 2, t, { isStatic: true, restitution: 0, friction: 1 });
				var left  = Bodies.rectangle(-t * 0.5, h * 0.5, t, h + t * 2, { isStatic: true, restitution: 0, friction: 1 });
				var right = Bodies.rectangle(w + t * 0.5, h * 0.5, t, h + t * 2, { isStatic: true, restitution: 0, friction: 1 });

				walls = { floor: floor, left: left, right: right };
				World.add(engine.world, [floor, left, right]);

				return true;
			}

			function setTransform(el, x, y, a) {
				el.style.transform = "translate3d(" + x + "px," + y + "px,0) rotate(" + a + "deg)";
			}

			function preloadAll(list) {
				for (var i = 0; i < list.length; i++) {
					var im = new Image();
					im.src = list[i];
				}
			}

			function recalcSpawnSizes() {
				if (!options.rawMin && !options.rawMax) return;

				var newMin = cssLengthToPx(options.rawMin, area, sizeMin);
				var newMax = cssLengthToPx(options.rawMax, area, sizeMax);

				if (newMax < newMin) { var t = newMin; newMin = newMax; newMax = t; }

				sizeMin = newMin;
				sizeMax = newMax;
			}

			function setupDrag() {
				if (!enableDrag || !Mouse || !MouseConstraint) return;

				var mouse = Mouse.create(area);
				mouse.pixelRatio = 1;

				mouseConstraint = MouseConstraint.create(engine, {
					mouse: mouse,
					constraint: {
						stiffness: dragStiffness,
						damping: dragDamping,
						render: { visible: false }
					}
				});

				World.add(engine.world, mouseConstraint);

				dragMousemoveHandler = function () {
					mouse.offset.x = 0;
					mouse.offset.y = 0;
				};
				area.addEventListener("mousemove", dragMousemoveHandler);

				area.style.userSelect = "none";
				area.style.webkitUserSelect = "none";
			}

			function setupHoverRepel() {
				if (!enableHoverRepel) return;

				area.style.pointerEvents = "auto";

				hoverMoveHandler = function (e) {
					var r = area.getBoundingClientRect();
					hoverX = e.clientX - r.left;
					hoverY = e.clientY - r.top;

					hoverActive = true;
				};

				hoverLeaveHandler = function () {
					hoverActive = false;
					hoverX = null;
					hoverY = null;
				};

				area.addEventListener("mousemove", hoverMoveHandler);
				area.addEventListener("mouseleave", hoverLeaveHandler);
			}

			function getSpawnX(w) {
				var minX = w * 0.5;
				var maxX = Math.max(minX, bounds.w - w * 0.5);

				if (spawnXMode === "fixed") {
					var pct = clamp(spawnXFixed, 0, 100) / 100;
					var baseX = minX + (maxX - minX) * pct;

					if (spawnXJitter > 0) {
						var jitterPx = (bounds.w * spawnXJitter / 100) * (Math.random() - 0.5);
						baseX += jitterPx;
					}

					return clamp(baseX, minX, maxX);
				}

				if (spawnXMode === "sequence") {
					var total = Math.max(1, count);

					if (total === 1) {
						return (minX + maxX) * 0.5;
					}

					var progress = duplicateImages
						? ((spawned % total) / (total - 1))
						: (spawned / Math.max(1, total - 1));

					return minX + (maxX - minX) * progress;
				}

				return minX + Math.random() * Math.max(0, maxX - minX);
			}

			function spawnOne() {
				if (!alive) return;
				if (spawned >= count) return;

				updateRects();
				if (!bounds.w || !bounds.h) return;

				if (!duplicateImages && spawned >= images.length) return;

				var src = duplicateImages
					? images[spawned % images.length]
					: images[spawned];

				var w = Math.round(Matter.Common.random(sizeMin, sizeMax));
				var x = getSpawnX(w);

				var img = new Image();
				img.onload = function () {
					if (!alive) return;

					var css = getComputedStyle(area);
					var ratioVar = (css.getPropertyValue("--bgm-ratio") || "").trim();
					var ratio = null;

					if (ratioVar) {
						var parts = ratioVar.split("/");
						if (parts.length === 2) {
							var rw = parseFloat(parts[0]);
							var rh = parseFloat(parts[1]);
							if (rw > 0 && rh > 0) ratio = rh / rw;
						}
					}

					var r = ratio;
					if (!r) {
						if (img.naturalWidth && img.naturalHeight) r = img.naturalHeight / img.naturalWidth;
						else r = 1;
					}

					var h = Math.max(20, Math.round(w * r));

					var startY = -(h + 300);

					var el = document.createElement("img");
					el.className = "drop-img";
					el.setAttribute("src", src);
					el.style.width = w + "px";
					el.style.height = h + "px";
					el.style.position = "absolute";
					el.style.left = "0";
					el.style.top = "0";
					el.style.willChange = "transform";
					el.style.pointerEvents = "none";
					el.style.userSelect = "none";

					el.style.opacity = "0";

					setTransform(el, x - w * 0.5, startY - h * 0.5, 0);

					area.appendChild(el);

					var body = Bodies.rectangle(x, startY, w, h, {
						restitution: restitution,
						frictionAir: frictionAir,
						friction: friction,
						density: density
					});

					Body.setVelocity(body, {
						x: (Math.random() - 0.5) * 4,
						y: Math.random() * 2
					});

					World.add(engine.world, body);
					items.push({ el: el, body: body, w: w, h: h });

					requestAnimationFrame(function () {
						el.style.opacity = "1";
					});

					setTransform(el, body.position.x - w * 0.5, body.position.y - h * 0.5, body.angle * 180 / Math.PI);
				};
				img.onerror = function () {};
				img.src = src;

				spawned++;
			}

			function applyHoverRepel() {

				if (!enableHoverRepel) return;
				if (!hoverActive || hoverX == null || hoverY == null) return;

				var radius = hoverRadius;
				var r2 = radius * radius;

				for (var i = 0; i < items.length; i++) {

					var b = items[i].body;

					var dx = b.position.x - hoverX;
					var dy = b.position.y - hoverY;

					var d2 = dx * dx + dy * dy;
					if (d2 > r2 || d2 < 0.001) continue;

					var d = Math.sqrt(d2);

					var nx = dx / d;
					var ny = dy / d;

					var strength = (1 - d / radius) * 25;

					Body.setVelocity(b, {
						x: b.velocity.x + nx * strength,
						y: b.velocity.y + ny * strength - strength * 0.6
					});

					for (var j = 0; j < items.length; j++) {

						if (i === j) continue;

						var nb = items[j].body;

						var ddx = nb.position.x - b.position.x;
						var ddy = nb.position.y - b.position.y;

						var dist = Math.sqrt(ddx * ddx + ddy * ddy);

						if (dist < 120 && dist > 0.001) {

							var nnx = ddx / dist;
							var nny = ddy / dist;

							Body.setVelocity(nb, {
								x: nb.velocity.x + nnx * 2,
								y: nb.velocity.y + nny * 2
							});

						}
					}
				}
			}

			function tick() {
				if (!alive) return;

				applyHoverRepel();

				if (mouseConstraint && mouseConstraint.body) {
					var dragged = mouseConstraint.body;

					for (var di = 0; di < items.length; di++) {
						if (items[di].body === dragged) {
							var halfW = items[di].w * 0.5;
							var halfH = items[di].h * 0.5;

							var clampedX = clamp(dragged.position.x, halfW + 2, bounds.w - halfW - 2);
							var clampedY = clamp(dragged.position.y, halfH + 2, bounds.h - halfH - 2);

							if (clampedX !== dragged.position.x || clampedY !== dragged.position.y) {
								Body.setPosition(dragged, { x: clampedX, y: clampedY });
								Body.setVelocity(dragged, { x: 0, y: 0 });
							}
							break;
						}
					}
				}
	
				Engine.update(engine, 1000 / 60);

				var sideLimit = Math.max(120, wallThickness * 1.5);
				var bottomLimit = bounds.h + Math.max(160, wallThickness * 1.5);

				for (var i = 0; i < items.length; i++) {
					var it0 = items[i];
					var b0 = it0.body;

					var halfW = it0.w * 0.5;
					var halfH = it0.h * 0.5;

					var minX = halfW + 2;
					var maxX = bounds.w - halfW - 2;
					var rescueY = Math.max(halfH + 2, 20);
					var floorY = bounds.h - halfH - 2;

					var outLeft = b0.position.x < -sideLimit;
					var outRight = b0.position.x > bounds.w + sideLimit;
					var outBottom = b0.position.y > bottomLimit;

					if (outLeft || outRight || outBottom) {
						var safeX = clamp(b0.position.x, minX, maxX);
						var safeY = clamp(b0.position.y, rescueY, floorY);

						if (outBottom) safeY = floorY;

						Body.setPosition(b0, { x: safeX, y: safeY });
						Body.setVelocity(b0, { x: 0, y: 0 });
						Body.setAngularVelocity(b0, 0);
					}
				}

				for (var j = 0; j < items.length; j++) {
					var it = items[j];
					var b = it.body;
					setTransform(it.el, b.position.x - it.w * 0.5, b.position.y - it.h * 0.5, b.angle * 180 / Math.PI);
				}

				rafId = requestAnimationFrame(tick);
			}

			function resetToNewSize() {
				if (!started) return;

				removeWalls();
				if (!createWalls()) return;

				updateRects();

				var w = bounds.w;
				var h = bounds.h;

				for (var i = 0; i < items.length; i++) {
					var it = items[i];
					var bw = it.w;
					var bh = it.h;

					var px = clamp(it.body.position.x, bw * 0.5 + 2, w - bw * 0.5 - 2);
					var py = clamp(it.body.position.y, -2000, h - bh * 0.5 - 2);
					Body.setPosition(it.body, { x: px, y: py });
				}
			}

			function startSizeObserver() {
				updateRects();
				lastW = bounds.w;
				lastH = bounds.h;

				if ("ResizeObserver" in window) {
					ro = new ResizeObserver(function () {
						raf2(function () {
							updateRects();
							if (bounds.w !== lastW || bounds.h !== lastH) {
								lastW = bounds.w;
								lastH = bounds.h;
								resetToNewSize();
							}
						});
					});
					ro.observe(area);
					return;
				}

				pollTimer = setInterval(function () {
					updateRects();
					if (bounds.w !== lastW || bounds.h !== lastH) {
						lastW = bounds.w;
						lastH = bounds.h;
						resetToNewSize();
					}
				}, 200);
			}

			function stopSizeObserver() {
				if (ro) { ro.disconnect(); ro = null; }
				if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
			}

			function startSpawning() {
				if (!alive) return;
				if (started) return;

				var tries = 0;
				var stable = 0;
				var prevW = 0;
				var prevH = 0;

				function check() {
					if (!alive) return;

					updateRects();

					if (!bounds.w || !bounds.h) {
						tries++;
						if (tries < 40) setTimeout(check, 150);
						return;
					}

					if (bounds.w === prevW && bounds.h === prevH) stable++;
					else {
						stable = 0;
						prevW = bounds.w;
						prevH = bounds.h;
					}

					if (stable < 2) {
						setTimeout(check, 150);
						return;
					}

					started = true;

					removeWalls();
					if (!createWalls()) {
						started = false;
						setTimeout(check, 200);
						return;
					}

					setupDrag();
					setupHoverRepel();
					tick();

					var start = function () {
						spawnOne();
						spawnTimer = setInterval(function () {
							if (!alive) return;
							if (spawned >= count) {
								clearInterval(spawnTimer);
								spawnTimer = null;
								return;
							}
							spawnOne();
						}, spawnEvery);
					};

					if (startDelay > 0) setTimeout(start, startDelay);
					else start();
				}

				check();
			}

			function setupViewportTrigger() {
				if ("IntersectionObserver" in window) {
					io = new IntersectionObserver(function (entries) {
						for (var i = 0; i < entries.length; i++) {
							if (entries[i].isIntersecting) {
								startSpawning();
								if (once && io) { io.disconnect(); io = null; }
								break;
							}
						}
					}, { root: null, rootMargin: rootMargin, threshold: threshold });

					io.observe(surface);
					return;
				}

				scrollHandler = debounce(function () {
					var r = surface.getBoundingClientRect();
					var vh = window.innerHeight || document.documentElement.clientHeight;
					if (r.top < vh * 0.9 && r.bottom > vh * 0.1) {
						startSpawning();
						if (once && scrollHandler) {
							window.removeEventListener("scroll", scrollHandler);
							scrollHandler = null;
						}
					}
				}, 100);

				window.addEventListener("scroll", scrollHandler);
				scrollHandler();
			}

			recalcSpawnSizes();
			preloadAll(images);
			startSizeObserver();
			setupViewportTrigger();

			return function destroy() {
				alive = false;

				if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }

				stopSizeObserver();

				if (io) { try { io.disconnect(); } catch (e) {} io = null; }

				if (scrollHandler) {
					window.removeEventListener("scroll", scrollHandler);
					scrollHandler = null;
				}

				if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }

				if (dragMousemoveHandler) {
					area.removeEventListener("mousemove", dragMousemoveHandler);
					dragMousemoveHandler = null;
				}

				if (hoverMoveHandler) {
					area.removeEventListener("mousemove", hoverMoveHandler);
					hoverMoveHandler = null;
				}
				if (hoverLeaveHandler) {
					area.removeEventListener("mouseleave", hoverLeaveHandler);
					hoverLeaveHandler = null;
				}

				removeWalls();

				if (mouseConstraint) {
					World.remove(engine.world, mouseConstraint);
					mouseConstraint = null;
				}

				for (var i = 0; i < items.length; i++) {
					try { World.remove(engine.world, items[i].body); } catch (e) {}
					if (items[i].el && items[i].el.parentNode) items[i].el.parentNode.removeChild(items[i].el);
				}
				items.length = 0;

				var nodes = area.querySelectorAll(".drop-img");
				for (var n = nodes.length - 1; n >= 0; n--) {
					if (nodes[n] && nodes[n].parentNode) nodes[n].parentNode.removeChild(nodes[n]);
				}
			};
		}

		var destroyers = [];

		var areas = document.querySelectorAll(".uncode-bg-drop");
		for (var n = 0; n < areas.length; n++) {

			var renderArea = areas[n];

			if (renderArea.__thumbDropDestroy && typeof renderArea.__thumbDropDestroy === "function") {
				try { renderArea.__thumbDropDestroy(); } catch (e) {}
				renderArea.__thumbDropDestroy = null;
			}

			var surface = renderArea.closest
				? renderArea.closest('.vc_row[data-parent="true"]')
				: closestPolyfill(renderArea, '.vc_row[data-parent="true"]');

			if (!surface) continue;

			var images = getDropImagesFromArea(renderArea);
			if (!images.length) continue;

			var rawMin = getDataFromArea(renderArea, "min-width", "140px");
			var rawMax = getDataFromArea(renderArea, "max-width", "260px");

			var minW = cssLengthToPx(rawMin, renderArea, 140);
			var maxW = cssLengthToPx(rawMax, renderArea, 260);
			if (maxW < minW) { var tmp = minW; minW = maxW; maxW = tmp; }

			renderArea.__thumbDropDestroy = initMatterDrop({
				area: renderArea,
				surface: surface,
				images: images,

				rawMin: rawMin,
				rawMax: rawMax,

				count: toNumber(getDataFromArea(renderArea, "count", 14), 14),
				duplicateImages: String(getDataFromArea(renderArea, "unique", "no")) !== "yes",
				sizeMin: minW,
				sizeMax: maxW,

				spawnEvery: toNumber(getDataFromArea(renderArea, "interval", 160), 160),
				startDelay: toNumber(getDataFromArea(renderArea, "delay", 0), 0),

				gravityY: toNumber(getDataFromArea(renderArea, "gravity", 1.25), 1.25),
				restitution: toNumber(getDataFromArea(renderArea, "restitution", 0.35), 0.35),
				frictionAir: toNumber(getDataFromArea(renderArea, "friction-air", 0.02), 0.02),
				friction: toNumber(getDataFromArea(renderArea, "friction", 0.25), 0.25),
				density: toNumber(getDataFromArea(renderArea, "density", 0.001), 0.001),

				wallThickness: toNumber(getDataFromArea(renderArea, "wall", 80), 80),
				floorPadding: toNumber(getDataFromArea(renderArea, "floor", 0), 0),

				rotateRange: toNumber(getDataFromArea(renderArea, "rotate", 18), 18),

				once: String(getDataFromArea(renderArea, "once", "yes")) !== "no",
				threshold: toNumber(getDataFromArea(renderArea, "threshold", 0.25), 0.25),
				rootMargin: String(getDataFromArea(renderArea, "root-margin", "0px 0px -10% 0px")),

				enableDrag: String(getDataFromArea(renderArea, "interactive", "")),

				dragStiffness: toNumber(getDataFromArea(renderArea, "drag-stiffness", 0.18), 0.18),
				dragDamping: toNumber(getDataFromArea(renderArea, "drag-damping", 0.06), 0.06),

				hoverRadius: toNumber(getDataFromArea(renderArea, "hover-radius", 50), 50),

				spawnXMode: String(getDataFromArea(renderArea, "spawn-x-mode", "random")),
				spawnXFixed: toNumber(getDataFromArea(renderArea, "spawn-x-fixed", 50), 50),
				spawnXMode: String(getDataFromArea(renderArea, "spawn-x-mode", "random")),
				spawnXFixed: toNumber(getDataFromArea(renderArea, "spawn-x-fixed", 50), 50),
				spawnXJitter: toNumber(getDataFromArea(renderArea, "spawn-x-jitter", 13), 13),

			}) || null;

			if (renderArea.__thumbDropDestroy) {
				destroyers.push(renderArea.__thumbDropDestroy);
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
