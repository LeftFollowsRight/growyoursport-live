(function($) {
	"use strict";

	var marqueeCheckResize,
	initMarquee;

UNCODE.textMarquee = function( $titles ) {

	var isInitMarque = false;
	var lastMarqueeDocH = Math.round($(document).height());

	var initTextMarquee = function( $titles ){

		if ( typeof $titles == 'undefined' ) {
			$titles = $('.un-text-marquee');
		}

		if ( ! $titles.length ) {
			return;
		}

		isInitMarque = true;

		var stableHeight = UNCODE.wheight;

		$titles.each(function(){
			var $title = $(this),
				marqueeNS = '.textMarquee-' + Math.random().toString(36).slice(2),
				$span = $('> span, > i > span', $title),
				txt,
				first = true,
				dataSpeed = parseFloat( $title.closest('.heading-text').attr('data-marquee-speed') ),
				dataSpace = parseFloat( $title.closest('.heading-text').attr('data-marquee-space') ),
				dataTrigger = $title.closest('.heading-text').attr('data-marquee-trigger'),
				hasSticky = false,
				dataNavBar = $title.closest('.heading-text').attr('data-marquee-navbar'),
				dataNavBarMobile = $title.closest('.heading-text').attr('data-marquee-navbar-mobile'),
				newW = UNCODE.wwidth,
				marqueeTL, inview,
				isInMenu = $title.closest('.megamenu-block-wrapper').length;


			var getStickyBound = function() {
				var $sticky = $title.closest('.sticky-trigger, .sticky-element');

				if ( $sticky.length ) {
					var $pinSpacer = $sticky.closest('.pin-spacer');
					return $pinSpacer.length ? $pinSpacer : $sticky;
				}

				var $pinSpacerOnly = $title.closest('.pin-spacer');

				if ( $pinSpacerOnly.length ) {
					return $pinSpacerOnly;
				}

				return $title.closest('.vc_row');
			};

			if ( $title.closest('.sticky-trigger').length || $title.closest('.sticky-element').length || $title.closest('.pin-spacer').length ) {
				hasSticky = true;
				dataTrigger = 'row';
			}

			if ( UNCODE.wwidth <= UNCODE.mediaQuery ) {
				dataNavBar = dataNavBarMobile;
			}

			dataSpeed = isNaN(dataSpeed) ? 0 : dataSpeed;
			dataSpace = isNaN(dataSpace) ? 'default' : dataSpace;
			var dataX = dataSpeed;

			dataSpeed += 5;

			$('.marquee-clone-wrap', $title).remove();

			txt = $span.html();

			if ( ! $('.marquee-original-core', $span).length ) {
				txt = $span.html();
				$span = $('> span, > i > span', $title).wrapInner('<span class="marquee-original-core" />').addClass('marquee-original');
			} else {
				txt = $('.marquee-original-core', $span).html();
			}

			var spanW,
				$prepended = $('<span class="marquee-clone-wrap wrap-prepended" />'),
				$appended = $('<span class="marquee-clone-wrap wrap-appended" />'),
				speed = 10 - dataSpeed;

			$span.prepend($prepended);
			$span.append($appended);

			var continuousTextMarquee = function () {
				var bound = $title
						.css({
							transform: "none",
							opacity: 0,
						})
						.offset(),
					ease = "none";

				var xStrt =
						first || $title.hasClass("un-marquee-infinite")
							? 0
							: UNCODE.wwidth - bound.left,
					xEnd = $title.hasClass("un-marquee-infinite")
						? spanW
						: spanW + bound.left,
					xSpeed =
						((xEnd + xStrt) / (dataSpeed * dataSpeed * dataSpeed) / 5) *
						dataSpeed,
					direction = $title.hasClass("un-marquee-opposite") ? 1 : -1,
					speedSlow = (xEnd + xStrt) / 45,
					transFormVal,
					translX;

				if ( typeof marqueeTL !== 'undefined' && marqueeTL !== null ) {
					marqueeTL.kill();
				}

				marqueeTL = new TimelineMax({ paused: true, reversed: true });
				marqueeTL.play();

				var inViewElement =
						dataTrigger === "row" ? ( hasSticky ? getStickyBound()[0] : $title.closest(".vc_row")[0] ) : $title[0],
					wayOff =
						dataTrigger === "row" && dataNavBar === "yes"
							? UNCODE.menuHeight
							: 0;

				if ( isInMenu ) {
					$(document).on('un-menu-show.marquee', function(e, $ul){
						marqueeTL.restart();
					});
					$(document).on('un-menu-hide.marquee', function(e, $ul){
						marqueeTL.pause();
					});
				} else {
					inview = new Waypoint.Inview({
						element: inViewElement,
						offset: wayOff,
						enter: function (direction) {
							marqueeTL.play();
						},
						exited: function (direction) {
							if (!$title.closest(".pin-spacer").length) {
								marqueeTL.pause();
							}
						},
					});
				}

				if ($title.hasClass("un-marquee-hover")) {
					var $column = $title.closest(".wpb_column"),
						$col_link = $(".col-link", $column),
						$hover_sel = $title;

					if ($col_link.length) {
						$hover_sel = $title.add($column);
					}
					$hover_sel
						.on("mouseover", function () {
							ease = "power2.out";
							transFormVal = $title.css("transform").split(/[()]/)[1];
							translX = transFormVal.split(",")[4];
							speedSlow = (xEnd + (xStrt - translX)) / 45;
							marqueeTL.duration(speedSlow);
						})
						.on("mouseout", function () {
							ease = "power2.in";
							transFormVal = $title.css("transform").split(/[()]/)[1];
							translX = transFormVal.split(",")[4];
							speedSlow =
								((xEnd + (xStrt - translX)) /
									(dataSpeed * dataSpeed * dataSpeed) /
									5) *
								dataSpeed;
							marqueeTL.duration(speedSlow);
						});
				}
		
				gsap.killTweensOf($title);
				marqueeTL.fromTo( $title, {
					opacity: 1,
					x: xStrt * direction * -1
				},
				{
					duration: xSpeed,
					x: xEnd * direction,
					onComplete: function(){
						first = false;
						if ( isInMenu ) {
							marqueeTL.restart();
						} else {
							continuousTextMarquee();
						}
					},
					onUpdate: function(){
						if ( ! $title[0].isConnected ) {
							marqueeTL.kill();
							initTextMarquee();
						}
					},
					ease: ease
				});
		
			};
			
			var runTextMarquee = function(){
				var $row = $title.closest('.vc_row');
				if ( hasSticky ) {
					$row = getStickyBound();
				}
				var $bound = (dataTrigger === 'row' || dataTrigger === 'row-middle') ? $row : $title;

				if ( !$bound.length ) {
					return;
				}

				if ( $title.data('marqueeScrollActive') ) {
					return;
				}

				var boundEl = $bound[0],
					titleEl = $title[0],
					direction = $title.hasClass('un-marquee-scroll-opposite') ? -1 : 1,
					dataMove = dataX >= 0 ? 1 + dataX : -1 * ( 5 / (dataX - 0.5) * 0.25);

				$title.data('marqueeScrollActive', true);

				var loop = function(){
					if ( ! titleEl.isConnected ) {
						$title.data('marqueeScrollActive', false);
						initTextMarquee();
						return;
					}

					var bound = boundEl.getBoundingClientRect(),
						bound_top = bound.top,
						gsap_calc = ( ( stableHeight * 0.35 - bound_top ) * dataMove ) * 0.5 * direction;

					if ( dataTrigger === 'row' || dataTrigger === 'row-middle' ) {
						if ( dataTrigger === 'row-middle' ) {
							bound_top = (bound.top + bound.height*0.5) - (stableHeight * 0.5);
						}
						if ( dataNavBar === 'yes' ) {
							bound_top = bound_top - UNCODE.menuHeight;
						}
						gsap_calc = ( bound_top * dataMove ) * 0.5 * direction;
					}

					titleEl.style.transform = 'translate3d(' + gsap_calc + 'px, 0, 0)';

					requestAnimationFrame( loop );
				};

				requestAnimationFrame( loop );
			};

			var cloneSpan = function($_title, cntnt){

				if ( $_title.hasClass('un-marquee-infinite') ) {
					$('> span.marquee-clone-wrap', $_title).text('');
				}

				gsap.to( $_title, {
					duration: 0,
					x: 0
				});

				spanW = $span.outerWidth();


				if ( !spanW ) {
					return;
				}

				var part = Math.ceil( UNCODE.wwidth / spanW ) * 2,
					spaceSpan = dataSpace !== 'default' ? '<span class="marquee-space-' + dataSpace + '">\u00A0</span>' : "\u00A0";

				if ( $_title.hasClass('un-marquee-infinite') ) {

					for ( var i = 0; i < part; i++ ) {
						$prepended.append(cntnt + spaceSpan);
						$appended.append(cntnt + spaceSpan);
					}
				}

				if ( $('body').hasClass('compose-mode') ) {
					$('.uncode_fe_safe').remove();
					return;
				}

				if ( $title.closest('.marquee-freezed').length ) {
					return;
				}

				if ( $_title.hasClass('un-marquee') || $_title.hasClass('un-marquee-opposite') ) {
					continuousTextMarquee();
				}

				if ( $_title.hasClass('un-marquee-scroll') || $_title.hasClass('un-marquee-scroll-opposite') ) {
					runTextMarquee();
				}

			};

			var marqueeResize = function(e){
				if ( isInMenu ) {
					return;
				}
				var tOut = 1000;
				if ( isInMenu ) {
						gsap.killTweensOf($title);
						if ( typeof inview !== 'undefined' && inview !== null ) {
							inview.destroy();
						}
						if ( typeof marqueeTL !== 'undefined' && marqueeTL !== null ) {
							marqueeTL.kill();
						}
						first = true;
						$(window).off(marqueeNS);
						$(document).off(marqueeNS);
						initTextMarquee();
				} else {
					clearRequestTimeout(marqueeCheckResize);
					marqueeCheckResize = requestTimeout(function(){
						if ( newW !== UNCODE.wwidth ) {
							gsap.killTweensOf($title);
							if ( typeof inview !== 'undefined' && inview !== null ) {
								inview.destroy();
							}
							if ( typeof marqueeTL !== 'undefined' && marqueeTL !== null ) {
								marqueeTL.kill();
							}
							first = true;
							$(window).off(marqueeNS);
							$(document).off(marqueeNS);
							initTextMarquee();
							newW = UNCODE.wwidth;
						}
					}, tOut);
				}
			};

			$(window).off('resize', marqueeResize)
			.on( 'resize', marqueeResize);
			$(window).off('uncode.re-layout', marqueeResize)
			.on( 'uncode.re-layout', marqueeResize);

			cloneSpan($title, txt);

			if ( $('body').hasClass('compose-mode') && typeof window.parent.vc !== 'undefined' ) {
				window.parent.vc.events.on( 'shortcodeView:updated', function( e ){
					var $_titles = $('.un-text-marquee',e.view.$el);
					clearRequestTimeout(marqueeCheckResize);
					marqueeCheckResize = requestTimeout(function(){
						initTextMarquee($_titles);
					}, 1000);
				});
			}
		});

		$(window).on( 'load wwResize', function(e) {
			stableHeight = UNCODE.wheight;
		});

	};

	document.addEventListener("DOMContentLoaded", function() {
		if ( isInitMarque !== true ) {
			initTextMarquee();
		}
	});

	if ( document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function' ) {
		document.fonts.ready.then(function(){
			initTextMarquee();
		});
	}

	$(window).on('focus load resize',function(){
		clearTimeout(initMarquee);
		initMarquee = setTimeout(function(){
			if ( isInitMarque !== true ) {
				initTextMarquee();
			}
		}, 500);
	});
	
	$(document).on('pumAfterOpen pumAfterClose', function(args){
		initTextMarquee();
	});

	$(document).on('uncode-scrolltrigger-refresh', function(args){
		var nextDocH = Math.round($(document).height());

		if ( Math.abs(nextDocH - lastMarqueeDocH) <= 2 ) {
			return;
		}

		lastMarqueeDocH = nextDocH;

		clearRequestTimeout(marqueeCheckResize);

		marqueeCheckResize = requestTimeout(function(){
			initTextMarquee();
		}, 250);
	});
};

})(jQuery);
