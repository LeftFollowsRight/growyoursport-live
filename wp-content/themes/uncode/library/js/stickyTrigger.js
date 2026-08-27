(function($) {
	"use strict";

	UNCODE.stickyTrigger = function($el) {
	if (SiteParameters.is_frontend_editor) {
		return false;
	}

	var resizeTimer;
	var oldW = UNCODE.wwidth;
	var stickyObservers = [];
	var stickyInstances = [];
	var isRefreshing = false;
	var pendingRefresh = false;
	var lastStickyMetrics = {
		rowH: 0,
		uncontH: 0
	};

	function clearStickyInstances() {
		stickyInstances.forEach(function(st) {
			if (st && st.kill) {
				st.kill();
			}
		});
		stickyInstances = [];
	}

	function clearStickyObservers() {
		stickyObservers.forEach(function(observer) {
			try {
				observer.disconnect();
			} catch (e) {}
		});
		stickyObservers = [];
	}

	function getStickyMetrics() {
		var $firstSticky = $('.sticky-trigger').first();
		if (!$firstSticky.length) {
			return {
				rowH: 0,
				uncontH: 0
			};
		}

		var $row = $firstSticky.closest('.vc_row');
		var $uncont = $firstSticky.closest('.uncont');

		return {
			rowH: $row.length ? Math.round($row.outerHeight()) : 0,
			uncontH: $uncont.length ? Math.round($uncont.outerHeight()) : 0
		};
	}

	function metricsChanged(nextMetrics) {
		return (
			Math.abs(nextMetrics.rowH - lastStickyMetrics.rowH) > 1 ||
			Math.abs(nextMetrics.uncontH - lastStickyMetrics.uncontH) > 1
		);
	}

	function buildSticky() {
		clearStickyInstances();
		clearStickyObservers();

		$('.sticky-trigger').each(function() {
			var $sticky = $(this);
			var $inside = $sticky.children('div').first();
			var $row = $sticky.closest('.vc_row');
			var $uncont = $sticky.closest('.uncont');

			if (!$inside.length || !$row.length || !$uncont.length) {
				return;
			}

			var st = ScrollTrigger.create({
				trigger: $sticky[0],
				start: function() {
					var insideH = $inside.outerHeight() || 0;
					return 'top center-=' + (insideH / 2);
				},
				endTrigger: $row[0],
				end: function() {
					var insideH = $inside.outerHeight() || 0;
					var rowBottom = $row.offset().top + $row.outerHeight();
					var uncontBottom = $uncont.offset().top + $uncont.outerHeight();
					var diffBottom = rowBottom - uncontBottom;

					return 'bottom center+=' + (insideH / 2 + diffBottom);
				},
				anticipatePin: true,
				pin: true,
				pinSpacing: false,
				scrub: true,
				invalidateOnRefresh: true
			});

			stickyInstances.push(st);

			if (typeof ResizeObserver !== 'undefined') {
				var ro = new ResizeObserver(function() {
					if (isRefreshing) {
						pendingRefresh = true;
						return;
					}

					var nextMetrics = getStickyMetrics();

					if (!metricsChanged(nextMetrics)) {
						return;
					}

					refreshSticky(true);
				});

				try {
					// NON osservare $inside: tende a creare loop continui
					ro.observe($row[0]);
					ro.observe($uncont[0]);
					stickyObservers.push(ro);
				} catch (e) {}
			}
		});

		lastStickyMetrics = getStickyMetrics();
	}

	function refreshSticky(fromObserver) {
		clearRequestTimeout(resizeTimer);

		resizeTimer = requestTimeout(function() {
			if (isRefreshing) {
				pendingRefresh = true;
				return;
			}

			isRefreshing = true;
			pendingRefresh = false;

			if (!fromObserver) {
				buildSticky();
			}

			requestTimeout(function() {
				isRefreshing = false;

				lastStickyMetrics = getStickyMetrics();

				if (!fromObserver) {
					$(document).trigger('uncode-scrolltrigger-refresh');
				} else {
					$(document).trigger('uncode-scrolltrigger-refresh');
				}

				if (pendingRefresh) {
					pendingRefresh = false;
					refreshSticky(true);
				}
			}, 120);
		}, fromObserver ? 160 : 100);
	}

	function maybeDelayedRefresh() {
		var carousel = document.querySelector('.owl-carousel');
		var grid = document.querySelector('.isotope-container');
		var stickyAll = document.querySelectorAll('.sticky-trigger');
		var sticky = stickyAll.length ? stickyAll[stickyAll.length - 1] : null;
		var carousel_position;
		var grid_position;

		if (!sticky) {
			return;
		}

		if (carousel) {
			carousel_position = sticky.compareDocumentPosition(carousel);
		}
		if (grid) {
			grid_position = sticky.compareDocumentPosition(grid);
		}

		if (carousel_position === 2 || grid_position === 2) {
			setTimeout(function() {
				refreshSticky(false);
			}, 500);
		}
	}

	$(window).on('load', function() {
		buildSticky();
		maybeDelayedRefresh();
	});

	$(window).on('resize uncode.re-layout', function(e) {
		if (e.type === 'resize' && oldW === UNCODE.wwidth) {
			return;
		}

		oldW = UNCODE.wwidth;
		refreshSticky(false);
	});

	$(document).on('uncode-sticky-refresh uncode-toggle-change', function() {
		refreshSticky(false);
	});
};

})(jQuery);
