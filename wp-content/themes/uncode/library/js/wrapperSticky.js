(function($) {
	"use strict";

	UNCODE.wrapperSticky = function(){
    (function () {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        gsap.registerPlugin(ScrollTrigger);

        var wrappers = document.getElementsByClassName('cs-wrapper-sticky');
        var i;

        function ensureTrack(wrapper) {
            var track = wrapper.querySelector('.cs-track');
            if (track) return track;

            track = document.createElement('div');
            track.className = 'cs-track';

            var items = wrapper.getElementsByClassName('cs-container');
            var list = [];
            var k;
            for (k = 0; k < items.length; k++) list.push(items[k]);

            wrapper.insertBefore(track, wrapper.firstChild);
            for (k = 0; k < list.length; k++) track.appendChild(list[k]);

            return track;
        }

        function setupHorizontalPin(wrapper) {
            var track = ensureTrack(wrapper);
            var tween = null;
            var st = null;

            function getTriggerElement() {
                if (wrapper.closest) {
                    return wrapper.closest('.vc_row[data-parent]') || wrapper;
                }
                return wrapper;
            }

            function isStickyDisabled() {
                var w = window.innerWidth || document.documentElement.clientWidth;

                if (wrapper.getAttribute('data-disable-sticky-mobile') === 'yes' && w < 570) {
                    return true;
                }

                if (wrapper.getAttribute('data-disable-sticky-tablet') === 'yes' && w < 960) {
                    return true;
                }

                return false;
            }

            function getDirection() {
                var d = wrapper.getAttribute('data-direction');
                if (d === 'reverse' || d === 'rtl' || d === 'right') return 1;
                return -1;
            }

            function getStartPosition() {
                var align = wrapper.getAttribute('data-align');
                return align ? align : 'top top';
            }

            function getDistance() {
                var wrapperW = wrapper.getBoundingClientRect
                    ? wrapper.getBoundingClientRect().width
                    : wrapper.offsetWidth;

                var dist = track.scrollWidth - wrapperW;
                if (dist < 0) dist = 0;
                return dist;
            }

            function destroy() {
                if (st) {
                    st.kill();
                    st = null;
                }

                if (tween) {
                    tween.kill();
                    tween = null;
                }

                gsap.set(track, { clearProps: 'transform' });
            }

            function make() {
                destroy();

                if (isStickyDisabled()) {
                    return;
                }

                var dist = getDistance();
                if (!dist) return;

                var dir = getDirection();
                var startPos = getStartPosition();
                var triggerEl = getTriggerElement();

                gsap.set(track, { x: 0 });

                tween = gsap.to(track, {
                    x: dist * dir,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: triggerEl,
                        start: startPos,
                        end: function () { return '+=' + dist; },
                        scrub: true,
                        pin: triggerEl,
                        anticipatePin: 1,
                        invalidateOnRefresh: true
                    }
                });

                st = tween.scrollTrigger;
            }

            make();

            ScrollTrigger.addEventListener('refreshInit', function () {
                if (!isStickyDisabled()) {
                    gsap.set(track, { x: 0 });
                }
            });

            var resizeT = 0;
            var lastResizeW = window.innerWidth || document.documentElement.clientWidth;

            window.addEventListener('resize', function () {
                var currentW = window.innerWidth || document.documentElement.clientWidth;

                if (Math.abs(currentW - lastResizeW) < 2) {
                    return;
                }

                lastResizeW = currentW;

                if (resizeT) window.clearTimeout(resizeT);

                resizeT = window.setTimeout(function () {
                    make();
                    ScrollTrigger.refresh();
                }, 150);
            }, false);

            setTimeout(function () {
                ScrollTrigger.refresh();
            }, 500);
        }

        for (i = 0; i < wrappers.length; i++) {
            setupHorizontalPin(wrappers[i]);
        }
    })();

};

})(jQuery);
