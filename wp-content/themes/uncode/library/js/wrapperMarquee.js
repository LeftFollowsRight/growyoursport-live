(function($) {
	"use strict";

	UNCODE.wrapperMarquee = function () {

	function createMarquee(opts) {
		if (!opts) return;

		var parent = opts.parent;
		var originals = opts.originals;

		if (!parent || !originals) return;
		if (parent.getAttribute('data-marquee-init') === '1') return;
		parent.setAttribute('data-marquee-init', '1');

		function raf(cb) {
			return (window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				function (fn) { return window.setTimeout(fn, 16); }
			)(cb);
		}

		function caf(id) {
			return (window.cancelAnimationFrame ||
				window.webkitCancelAnimationFrame ||
				window.mozCancelAnimationFrame ||
				function (tid) { window.clearTimeout(tid); }
			)(id);
		}

		function getWidth(el) {
			if (!el) return 0;
			if (el.getBoundingClientRect) return el.getBoundingClientRect().width;
			return el.offsetWidth || 0;
		}

		function getPointX(e) {
			if (e.touches && e.touches.length) return e.touches[0].clientX;
			if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
			return e.clientX;
		}

		function getPointY(e) {
			if (e.touches && e.touches.length) return e.touches[0].clientY;
			if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientY;
			return e.clientY;
		}

		function getPageY() {
			if (typeof window.pageYOffset === 'number') return window.pageYOffset;
			return (document.documentElement ? document.documentElement.scrollTop : 0);
		}

		function getViewportW() {
			return window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0);
		}

		var baseSpeed = (typeof opts.speed === 'number') ? opts.speed : 50;
		var direction = (typeof opts.direction === 'number') ? opts.direction : -1;
		var maxReps = (typeof opts.maxReps === 'number') ? opts.maxReps : 12;

		var scrollDriven = (opts.scrollDriven === true);
		var scrollFactor = (typeof opts.scrollFactor === 'number') ? opts.scrollFactor : 0.6;
		var isScrollControlled = (opts.isScrollControlled === true);

		var inViewOnly = (opts.inViewOnly !== false);
		var viewMargin = (typeof opts.viewMargin === 'number') ? opts.viewMargin : 80;

		var hoverSpeed = (typeof opts.hoverSpeed === 'number') ? opts.hoverSpeed : null;
		var isHover = false;

		var infinite = (opts.infinite === true) && !SiteParameters.is_frontend_editor;
		var draggable = (opts.draggable === true);

		var freezeMode = (typeof opts.freeze === 'string') ? opts.freeze : null;
		var freezeBp = (typeof opts.freezeBp === 'number') ? opts.freezeBp : 960;

		function isFrozenNow() {
			if (!freezeMode) return false;

			var w = getViewportW();
			if (freezeMode === 'always') return true;
			if (freezeMode === 'desktop') return w >= freezeBp;
			if (freezeMode === 'mobile') return w < freezeBp;

			return false;
		}

		function closestRowParent(el) {
			if (!el || !el.closest) return null;
			return el.closest('[data-parent="true"]') || null;
		}

		function ensureId(el, prefix) {
			if (!el) return null;
			if (el.id && el.id.length) return el.id;

			var p = prefix || 'uncode-row';
			var rnd = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 12);
			el.id = p + '-' + rnd;
			return el.id;
		}

		function dispatchClonesEvent(payload) {
			try {
				parent.dispatchEvent(new CustomEvent('uncode:marquee:clones-built', {
					bubbles: true,
					detail: payload
				}));
			} catch (e) {}
		}

		var clonesEventRaf = 0;
		function dispatchClonesEventDebounced(payload) {
			if (clonesEventRaf) return;
			clonesEventRaf = raf(function () {
				clonesEventRaf = 0;
				dispatchClonesEvent(payload);
			});
		}

		var base = [];
		var i;
		for (i = 0; i < originals.length; i++) base.push(originals[i]);
		if (!base.length) return;

		var track = document.createElement('div');
		track.className = (opts.trackClassName ? opts.trackClassName : 'cs-track');

		gsap.set(track, {
			x: 0,
			force3D: true,
			willChange: 'transform'
		});

		var baseWrap = document.createElement('div');
		baseWrap.className = 'cs-base';

		var leftWrap = null;
		var rightWrap = null;

		parent.insertBefore(track, parent.firstChild);

		if (infinite) {
			leftWrap = document.createElement('div');
			leftWrap.className = 'cs-clones cs-clones--left';

			rightWrap = document.createElement('div');
			rightWrap.className = 'cs-clones cs-clones--right';

			track.appendChild(leftWrap);
			track.appendChild(baseWrap);
			track.appendChild(rightWrap);
		} else {
			track.appendChild(baseWrap);
		}

		var sourceWrap = document.createElement('div');
		sourceWrap.className = 'cs-source';
		sourceWrap.style.display = 'none';

		track.parentNode.insertBefore(sourceWrap, track);

		for (i = 0; i < base.length; i++) {
			sourceWrap.appendChild(base[i]);
		}

		function fillBaseWrapFromSource() {
			baseWrap.innerHTML = '';

			var fragBase = document.createDocumentFragment();
			var k, clone;

			for (k = 0; k < base.length; k++) {
				clone = base[k].cloneNode(true);
				clone.setAttribute('data-marquee-clone', '1');
				clone.setAttribute('data-marquee-origin-index', k);
				clone.setAttribute('aria-hidden', 'true');
				fragBase.appendChild(clone);
			}

			baseWrap.appendChild(fragBase);
		}

		fillBaseWrapFromSource();

		var cycleW = 1;

		function clearClones() {
			if (!infinite) return;
			leftWrap.innerHTML = '';
			rightWrap.innerHTML = '';
		}

		function measureCycle() {
			cycleW = baseWrap.scrollWidth || 0;
			if (!cycleW || cycleW < 1) cycleW = 1;

			track.style.width = cycleW + 'px';
		}

		function buildClones() {
			fillBaseWrapFromSource();
			
			measureCycle();

			if (!infinite) {
				var rowP0 = closestRowParent(parent);
				var rowId0 = ensureId(rowP0, 'uncode-row');

				dispatchClonesEventDebounced({
					type: 'measured-only',
					parent: parent,
					track: track,
					baseWrap: baseWrap,
					leftWrap: leftWrap,
					rightWrap: rightWrap,
					rowParent: rowP0,
					rowParentId: rowId0,
					infinite: false,
					cycleW: cycleW,
					reps: 0
				});

				triggerMarqueeRefreshDebounced(baseWrap);
				dispatchMarqueeReady();
				return true;
			}

			clearClones();

			var parentW = getWidth(parent);
			if (!cycleW || !parentW) return false;

			var reps = Math.ceil((parentW * 2) / cycleW) + 1;
			if (reps < 1) reps = 1;
			if (reps > maxReps) reps = maxReps;

			var fragL = document.createDocumentFragment();
			var fragR = document.createDocumentFragment();
			var r, k, clone;

			for (r = 0; r < reps; r++) {
				for (k = 0; k < base.length; k++) {
					clone = base[k].cloneNode(true);
					clone.setAttribute('data-marquee-clone', '1');
					clone.setAttribute('data-marquee-origin-index', k);
					clone.setAttribute('aria-hidden', 'true');
					fragL.appendChild(clone);
				}
			}

			for (r = 0; r < reps; r++) {
				for (k = 0; k < base.length; k++) {
					clone = base[k].cloneNode(true);
					clone.setAttribute('data-marquee-clone', '1');
					clone.setAttribute('data-marquee-origin-index', k);
					clone.setAttribute('aria-hidden', 'true');
					fragR.appendChild(clone);
				}
			}

			leftWrap.appendChild(fragL);
			rightWrap.appendChild(fragR);

			measureCycle();

			var rowP = closestRowParent(parent);
			var rowId = ensureId(rowP, 'uncode-row');

			dispatchClonesEventDebounced({
				type: 'clones-built',
				parent: parent,
				track: track,
				baseWrap: baseWrap,
				leftWrap: leftWrap,
				rightWrap: rightWrap,
				rowParent: rowP,
				rowParentId: rowId,
				infinite: true,
				cycleW: cycleW,
				reps: reps
			});

			triggerMarqueeRefreshDebounced(baseWrap);
			dispatchMarqueeReady();

			return true;
		}

		function findClosestClone(node) {
			while (node && node !== parent) {
				if (node.getAttribute && node.getAttribute('data-marquee-clone') === '1') {
					return node;
				}
				node = node.parentNode;
			}
			return null;
		}

		function findClickableInsideClone(node, cloneRoot) {
			while (node && node !== cloneRoot) {
				if (node.matches && node.matches('a[href], [data-lbox], [data-lightbox], .uncode-lbox')) {
					return node;
				}
				node = node.parentNode;
			}
			return null;
		}

		function findMatchingOriginalClickable(originalRoot, clickedEl) {
			if (!originalRoot || !clickedEl) return null;

			var all = originalRoot.querySelectorAll('a[href], [data-lbox], [data-lightbox], .uncode-lbox');
			if (!all.length) return null;

			var href = clickedEl.getAttribute && clickedEl.getAttribute('href');
			var dataLbox = clickedEl.getAttribute && clickedEl.getAttribute('data-lbox');

			var i, el;
			for (i = 0; i < all.length; i++) {
				el = all[i];

				if (dataLbox && el.getAttribute('data-lbox') === dataLbox) return el;
				if (href && el.getAttribute('href') === href) return el;
			}

			return all[0];
		}

		function onCloneDelegatedClick(e) {
			var cloneRoot = findClosestClone(e.target);
			if (!cloneRoot) return;

			var clickedEl = findClickableInsideClone(e.target, cloneRoot);
			if (!clickedEl) return;

			var idx = parseInt(cloneRoot.getAttribute('data-marquee-origin-index'), 10);
			if (isNaN(idx) || !base[idx]) return;

			var originalClickable = findMatchingOriginalClickable(base[idx], clickedEl);
			if (!originalClickable) return;

			if (e.preventDefault) e.preventDefault();
			if (e.stopPropagation) e.stopPropagation();
			e.cancelBubble = true;

			originalClickable.dispatchEvent(new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				view: window
			}));

			return false;
		}

		var xRaw = 0;
		var manualOffset = 0;
		var lastTs = 0;
		var frameId = 0;
		var isActive = true;

		var lastVisibilityCheck = 0;
		var visibilityCheckEvery = 120;

		var isDragging = false;
		var isTouchDragging = false;
		var touchDirectionLocked = null;
		var dragStartX = 0;
		var dragStartY = 0;
		var dragStartOffset = 0;
		var hasDragged = false;
		var dragThreshold = 6;
		var touchDirectionThreshold = 8;

		var throwV = 0;
		var lastDragX = 0;
		var lastDragT = 0;

		var lastPageY = getPageY();
		var scrollVelocity = 0;

		var io = new IntersectionObserver(function(entries) {
			isActive = entries[0].isIntersecting;
		}, { rootMargin: viewMargin + 'px' });

		io.observe(parent);

		function updateInView() {
			if (!inViewOnly) isActive = true;
		}

		function getEffectiveSpeed() {
			if (hoverSpeed !== null && isHover) return hoverSpeed;
			return baseSpeed;
		}

		function dispatchMarqueeReady() {
			if ( SiteParameters.is_frontend_editor ) return;
			requestTimeout(function() {

				var rowP = closestRowParent(parent);
				var rowId = ensureId(rowP, 'uncode-row');

				document.dispatchEvent(new CustomEvent('uncode:marquee:ready', {
					bubbles: true,
					detail: {
						parent: parent,
						baseWrap: baseWrap,
						leftWrap: leftWrap,
						rightWrap: rightWrap,
						infinite: infinite,
						rowParent: rowP,
						rowParentId: rowId,
					}
				}));
			}, 0);
		}

		function triggerMarqueeReinit(contextEl) {
			try {
				$(document).trigger('uncode-marquee-updated', {
					parent: parent,
					context: contextEl || baseWrap,
					baseWrap: baseWrap,
					leftWrap: leftWrap,
					rightWrap: rightWrap
				});
			} catch (e) {}
		}

		var marqueeRefreshT = 0;
		function triggerMarqueeRefreshDebounced(contextEl) {
			if (marqueeRefreshT) {
				window.clearTimeout(marqueeRefreshT);
			}
			marqueeRefreshT = window.setTimeout(function() {
				triggerMarqueeReinit(contextEl || baseWrap);
				marqueeRefreshT = 0;
			}, 60);
		}
		
		function render() {
			var x;
			var totalX = xRaw + manualOffset;

			if (infinite) {
				var m = totalX % cycleW;
				if (m > 0) m -= cycleW;
				x = m;
			} else {
				x = totalX;
			}

			gsap.set(track, {
				x: x,
				force3D: true
			});
		}

		function tick(ts) {
			if (!lastTs) lastTs = ts;
			var dt = (ts - lastTs) / 1000;
			lastTs = ts;

			if (dt > 0.05) dt = 0.05;

			updateInView();

			if (!isActive) {
				frameId = raf(tick);
				return;
			}

			if (!isDragging) {

				if (isFrozenNow()) {
					throwV = 0;
					frameId = raf(tick);
					return;
				}

				if (isScrolling) {
					frameId = raf(tick);
					return;
				}

				if (!scrollDriven) {
					var s = getEffectiveSpeed();
					if (s) xRaw += (direction * s * dt);
				}

				if (throwV) {
					xRaw += (throwV * dt);
					throwV *= Math.pow(0.04, dt);
					if (throwV < 8 && throwV > -8) throwV = 0;
				}

				render();
			}

			frameId = raf(tick);
		}

		function start() {
			if (!buildClones()) {
				window.setTimeout(start, 50);
				return;
			}

			lastTs = 0;

			if (isScrollControlled) {
				render();
				return;
			}

			if (frameId) caf(frameId);
			frameId = raf(tick);
			render();
		}

		function stop() {
			if (frameId) caf(frameId);
			frameId = 0;
		}

		function onDown(e) {
			if (e.type === 'mousedown' && e.button !== 0) return;
			if (isFrozenNow()) return;

			dragStartX = getPointX(e);
			dragStartY = getPointY(e);
			dragStartOffset = manualOffset;
			hasDragged = false;

			throwV = 0;
			lastDragX = dragStartX;
			lastDragT = (new Date()).getTime();

			isTouchDragging = e.type === 'touchstart';
			touchDirectionLocked = null;

			if (!isTouchDragging) {
				isDragging = true;

				if (e.preventDefault) e.preventDefault();
				if (e.stopPropagation) e.stopPropagation();
			} else {
				isDragging = false;
			}

			bindMoveUp(true);
		}

		function onMove(e) {
			var nowX = getPointX(e);
			var nowY = getPointY(e);
			var dx = nowX - dragStartX;
			var dy = nowY - dragStartY;

			if (isTouchDragging && touchDirectionLocked === null) {
				if (Math.abs(dx) < touchDirectionThreshold && Math.abs(dy) < touchDirectionThreshold) {
					return;
				}

				if (Math.abs(dy) > Math.abs(dx)) {
					touchDirectionLocked = 'vertical';
					isDragging = false;
					bindMoveUp(false);
					return;
				}

				touchDirectionLocked = 'horizontal';
				isDragging = true;
			}

			if (!isDragging) return;

			if (!hasDragged && (dx < -dragThreshold || dx > dragThreshold)) hasDragged = true;

			manualOffset = dragStartOffset + dx;
			render();

			var nowT = (new Date()).getTime();
			var dtMs = nowT - lastDragT;
			if (dtMs > 0) {
				var vx = (nowX - lastDragX) / (dtMs / 1000);
				if (vx > 2500) vx = 2500;
				if (vx < -2500) vx = -2500;
				throwV = vx * 0.5;
			}

			lastDragX = nowX;
			lastDragT = nowT;

			if (e.preventDefault) e.preventDefault();
		}

		function onUp(e) {
			if (!isDragging && !isTouchDragging) return;

			isDragging = false;
			isTouchDragging = false;
			touchDirectionLocked = null;

			lastTs = 0;
			lastPageY = getPageY();

			render();
			bindMoveUp(false);

			if (e && hasDragged && e.preventDefault) e.preventDefault();

			setTimeout(function () { hasDragged = false; }, 0);
		}

		function bindMoveUp(bind) {
			if (bind) {
				document.addEventListener('mousemove', onMove, false);
				document.addEventListener('mouseup', onUp, false);
				document.addEventListener('touchmove', onTouchMoveDetect, { passive: true });
				document.addEventListener('touchend', onUp, false);
				document.addEventListener('touchcancel', onUp, false);
			} else {
				document.removeEventListener('mousemove', onMove, false);
				document.removeEventListener('mouseup', onUp, false);
				document.removeEventListener('touchmove', onTouchMoveDetect, { passive: true });
				document.removeEventListener('touchmove', onMove, { passive: false });
				document.removeEventListener('touchend', onUp, false);
				document.removeEventListener('touchcancel', onUp, false);
			}
		}

		function onTouchMoveDetect(e) {
			var dx = Math.abs(getPointX(e) - dragStartX);
			var dy = Math.abs(getPointY(e) - dragStartY);
			if (dx < touchDirectionThreshold && dy < touchDirectionThreshold) return;

			document.removeEventListener('touchmove', onTouchMoveDetect, { passive: true });

			if (dy > dx) {
				isDragging = false;
				touchDirectionLocked = 'vertical';
				bindMoveUp(false);
			} else {
				touchDirectionLocked = 'horizontal';
				isDragging = true;
				document.addEventListener('touchmove', onMove, { passive: false });
			}
		}

		if (parent.addEventListener) {
			if (draggable) {
				parent.addEventListener('mousedown', onDown, false);
				parent.addEventListener('touchstart', onDown, { passive: true });
			}

			if (hoverSpeed !== null) {
				parent.addEventListener('mouseenter', function () { isHover = true; }, false);
				parent.addEventListener('mouseleave', function () { isHover = false; }, false);
			}

			parent.addEventListener('click', onCloneDelegatedClick, false);

		} else {
			if (draggable) {
				parent.onmousedown = onDown;
				parent.ontouchstart = onDown;
			}
		}

		function onClickCapture(e) {
			if (hasDragged) {
				if (e.preventDefault) e.preventDefault();
				if (e.stopPropagation) e.stopPropagation();
				e.cancelBubble = true;
				return false;
			}
		}

		if (draggable) {
			if (parent.addEventListener) parent.addEventListener('click', onClickCapture, true);
			else parent.onclick = onClickCapture;
		}

		var resizeTimer = 0;
		var lastResizeW = getViewportW();

		function onResize() {
			var currentW = getViewportW();

			if (Math.abs(currentW - lastResizeW) < 2) {
				return;
			}

			lastResizeW = currentW;

			if (resizeTimer) window.clearTimeout(resizeTimer);

			resizeTimer = window.setTimeout(function () {
				buildClones();
				render();
			}, 150);
		}

		if (window.addEventListener) window.addEventListener('resize', onResize, false);
		else window.onresize = onResize;

		var isScrolling = false;
		var scrollEndTimer = 0;

		function onWindowScroll() {
			isScrolling = true;
			if (scrollEndTimer) clearTimeout(scrollEndTimer);
			scrollEndTimer = setTimeout(function () {
				isScrolling = false;
				lastTs = 0; // evita spike dt alla ripresa
			}, 80);
		}

		if (scrollDriven) {
			if (window.addEventListener) window.addEventListener('scroll', onWindowScroll, { passive: true });
			else window.onscroll = onWindowScroll;
		}

		start();

		window.setTimeout(function () {
			buildClones();
			render();
			triggerMarqueeRefreshDebounced(baseWrap);
		}, 500);

		return {
			start: start,
			stop: stop,
			setX: function (value) { xRaw = value; render(); },
			addX: function (delta) { xRaw += delta; render(); },
			setManualOffset: function (value) { manualOffset = value; render(); },
			getManualOffset: function () { return manualOffset; },
			resetManualOffset: function () { manualOffset = 0; render(); },
			getCycleW: function () { return cycleW; },
			update: function () {
				buildClones();
				render();
			},
			isFrozen: function () { return isFrozenNow(); }
		};
	}

	function initMarqueesOnce() {
		if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
			return false;
		}
		gsap.registerPlugin(ScrollTrigger);
		function getViewportW() {
			return window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0);
		}
		var wrappers = document.querySelectorAll('.cs-wrapper-marquee, .cs-wrapper');

		if (!wrappers || !wrappers.length) wrappers = document.getElementsByClassName('cs-wrapper');

		var itemClass = 'cs-container';

		if (!wrappers || !wrappers.length) {
			return false;
		}

		function isScrollMode(wrapper) {
			var mode = wrapper.getAttribute('data-mode');
			return mode === 'marquee-scroll' || mode === 'marquee-scroll-opposite';
		}

		function getDirection(wrapper) {
			var mode = wrapper.getAttribute('data-mode');
			if (mode === 'marquee-opposite' || mode === 'marquee-scroll-opposite') return 1;
			return -1;
		}

		function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

		function readStep(wrapper) {
			var v = parseFloat(wrapper.getAttribute('data-speed'));
			if (isNaN(v)) v = 0;
			return clamp(v, -4, 4);
		}

		function stepToPxPerSec(step, baseDefault) {
			return (baseDefault / 5) * (step + 5);
		}

		function readFreeze(wrapper) {
			var f = wrapper.getAttribute('data-freeze');
			if (f !== 'always' && f !== 'desktop' && f !== 'mobile') return null;
			return f;
		}

		function isFrozenByAttr(freezeMode, bp) {
			if (!freezeMode) return false;
			var w = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0);
			if (freezeMode === 'always') return true;
			if (freezeMode === 'desktop') return w >= bp;
			if (freezeMode === 'mobile') return w < bp;
			return false;
		}

		var baseDefault = 50;
		var autoFactor = 5;
		var freezeBp = 960;

		var inited = 0;

		for (var i = 0; i < wrappers.length; i++) {
			(function (wrapper) {

				if (wrapper.getAttribute('data-anim') !== 'uncode_slider_marquee') {
					return;
				}

				var items = wrapper.getElementsByClassName(itemClass);
				if (!items || !items.length) {
					return;
				}

				var scrollMode = isScrollMode(wrapper);
				var dir = getDirection(wrapper);

				var step = readStep(wrapper);
				var pxPerSec = stepToPxPerSec(step, baseDefault);
				var autoplayPxPerSec = pxPerSec * autoFactor;

				var needHover = wrapper.getAttribute('data-hover');
				var hoverSpeed;
				if (needHover === 'yes') hoverSpeed = autoplayPxPerSec * 0.2;
				else if (needHover === 'pause') hoverSpeed = 0;
				else hoverSpeed = autoplayPxPerSec;

				var freeze = readFreeze(wrapper);

				var marquee = createMarquee({
					parent: wrapper,
					originals: items,
					infinite: wrapper.getAttribute('data-infinite') === 'yes' && !SiteParameters.is_frontend_editor,
					speed: scrollMode ? 0 : autoplayPxPerSec,
					draggable: wrapper.getAttribute('data-draggable') === 'yes' || SiteParameters.is_frontend_editor,
					scrollDriven: false,
					isScrollControlled: scrollMode,
					inViewOnly: true,
					viewMargin: 300,
					maxReps: getViewportW() < 570 ? 4 : 8,
					direction: dir,
					hoverSpeed: scrollMode || SiteParameters.is_frontend_editor ? 0 : hoverSpeed,
					freeze: freeze && !SiteParameters.is_frontend_editor,
					freezeBp: freezeBp
				});

				if (!marquee) {
					return;
				}

				wrapper._uncodeMarqueeApi = marquee;
	
				inited++;

				if (!scrollMode || SiteParameters.is_frontend_editor) {
					ScrollTrigger.create({
						trigger: wrapper,
						start: 'top bottom',
						end: 'bottom top',
						invalidateOnRefresh: true,
						refreshPriority: -1,
						onEnter: function () {
							if (isFrozenByAttr(freeze, freezeBp)) return;
							marquee.start();
						},
						onEnterBack: function () {
							if (isFrozenByAttr(freeze, freezeBp)) return;
							marquee.start();
						},
						onLeave: function () { marquee.stop(); },
						onLeaveBack: function () { marquee.stop(); }
					});
				} else {
					ScrollTrigger.create({
						trigger: wrapper,
						start: 'top bottom',
						end: 'bottom top',
						scrub: true,
						invalidateOnRefresh: true,
						refreshPriority: -1,
						onUpdate: function (self) {
							if (isFrozenByAttr(freeze, freezeBp)) return;

							var w = marquee.getCycleW();
							if (!w) return;

							var cycles = pxPerSec / baseDefault;

							if (getViewportW() < 570) {
								cycles *= 0.55;
							}

							marquee.setX(dir * self.progress * cycles * w);
						}
					});
				}

			})(wrappers[i]);
		}

		if (typeof ResizeObserver !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
			var t = 0;
			function refreshST() {
				if (t) window.clearTimeout(t);
				t = window.setTimeout(function () {
					ScrollTrigger.refresh();
				}, 150);
			}

			var ro = new ResizeObserver(function () {
				refreshST();
			});

			if (getViewportW() >= 960) {
				ro.observe(document.body);
			}
		}

		window.setTimeout(function () {
			if (typeof ScrollTrigger !== 'undefined') {
				ScrollTrigger.sort();
				ScrollTrigger.refresh();
			}
		}, 0);
		
		return true;
	}

	(function retryInit() {
		var tries = 0;
		var maxTries = 40;
		function go() {
			tries++;
			var ok = initMarqueesOnce();
			if (ok) return;
			if (tries >= maxTries) {
				return;
			}
			window.setTimeout(go, 100);
		}
		go();
	})();
};

})(jQuery);
