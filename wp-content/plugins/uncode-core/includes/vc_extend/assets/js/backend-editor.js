! function($) {
	"use strict";
    window.vc.events.on('shortcodeView:ready', function(e) {
        var model = e.model,
            shortcode = typeof model !== 'undefined' ? model.attributes.shortcode : false,
            cloned =  typeof model !== 'undefined' ? model.attributes.cloned : false;
        if ( ( shortcode === 'vc_accordion_tab' ||  shortcode === 'vc_tab' ) && cloned ) {
            model.attributes.params.tab_id = model.attributes.cloned_from.params.tab_id + Math.floor(Math.random() * 10);;
        } else if ( ( shortcode === 'vc_gallery' ||  shortcode === 'uncode_index' ||  shortcode === 'uncode_slider' ) && cloned ) {
            model.attributes.params.el_id = model.attributes.cloned_from.params.el_id + Math.floor(Math.random() * 10);;
        }
    });

    window.parent.vc.events.on("vc-param-group-add-new", function(e, t, a){
		$('select', t).each(function(index) {
			var $select = $(this);
            if ( ! $select.closest('.select-wrapper').length ) {
                $select.wrap('<div class="select-wrapper" />');
            }
		});
    });

    window.parent.vc.events.on("editElementPanel:ready", function(){
        $('.vc_ui-panel-window.vc_active').addClass('is_ready');
        if (vc.active_panel && vc.active_panel.on) {
            vc.active_panel.on('hide', function() {
                $('.vc_ui-panel-window.is_ready').removeClass('is_ready');
            });
        }
    });

    (function() {
        var STORAGE_KEY = 'uncode_settings_clipboard';
        var ROW_ELEMENTS = ['vc_row', 'vc_row_inner', 'vc_section'];
        var COLUMN_ELEMENTS = ['vc_column', 'vc_column_inner'];
        var TABS_ACCORDION_ELEMENTS = ['vc_accordion', 'vc_accordion_tab', 'vc_tabs', 'vc_tab'];
        var EXCLUDED_PARAMS = [
            'uncode_shortcode_id',
            'el_id',
            // Content params to always exclude when copying/pasting settings
            'title',
            'media',
            'media_title_custom',
            'media_subtitle_custom',
            'media_caption_custom',
            'medias',
            'subheading',
            'content',
            'link_text',
            'link',
            'tab_id',
            'slug',
            'excerpt',
            'json',
            'price',
            'body',
            'button',
            'nav_menu',
            'values',
            'value',
            'prefix',
            'suffix',
            'units',
            'rate',
            'text',
            'label_value',
            'date',
            'media_before',
            'media_after'
        ];

        // Generate a random ID similar to PHP's uncode_big_rand()
        function generateShortcodeId(len) {
            len = len || 6;
            var rand = '';
            while (rand.length < len) {
                rand += Math.floor(Math.random() * 1e10).toString();
            }
            return rand.substr(0, len);
        }

        function getStoredSettings() {
            try {
                var stored = localStorage.getItem(STORAGE_KEY);
                return stored ? JSON.parse(stored) : null;
            } catch(e) {
                return null;
            }
        }

        function storeSettings(shortcode, params) {
            var cleanParams = {};
            var hadShortcodeId = false;
            for (var key in params) {
                if (params.hasOwnProperty(key)) {
                    if (key === 'uncode_shortcode_id') {
                        hadShortcodeId = true;
                    } else if (EXCLUDED_PARAMS.indexOf(key) === -1) {
                        cleanParams[key] = params[key];
                    }
                }
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                shortcode: shortcode,
                params: cleanParams,
                hadShortcodeId: hadShortcodeId,
                timestamp: Date.now()
            }));
        }

        function copySettings(model, $btn) {
            // Get the model from the DOM element - this is the actual model used by VC
            var $element = $btn.closest('.wpb_sortable, [data-model-id]');
            var modelId = $element.data('modelId') || $element.data('model-id') || model.get('id');

            // Get model from parent VC shortcodes collection
            var parentVC = window.parent.vc;
            var sourceModel = parentVC && parentVC.shortcodes ? parentVC.shortcodes.get(modelId) : null;

            // Fallback to DOM data or original model
            if (!sourceModel) {
                sourceModel = $element.data('model') || model;
            }

            var shortcode = sourceModel.get('shortcode');
            var params = sourceModel.get('params');
            storeSettings(shortcode, params);

            // Visual feedback
            $btn.addClass('vc_settings-copied');
            setTimeout(function() { $btn.removeClass('vc_settings-copied'); }, 1000);

            // Update all paste buttons
            updateAllPasteButtons();
        }

        // Get list of valid param names for a shortcode from vc.map
        function getShortcodeParamNames(shortcode) {
            var vcRef = (typeof window.parent !== 'undefined' && window.parent.vc) ? window.parent.vc : window.vc;
            var paramNames = [];

            if (vcRef && vcRef.map && vcRef.map[shortcode] && vcRef.map[shortcode].params) {
                vcRef.map[shortcode].params.forEach(function(param) {
                    if (param.param_name) {
                        paramNames.push(param.param_name);
                    }
                });
            }

            return paramNames;
        }

        function pasteSettings(model, $btn) {
            var stored = getStoredSettings();

            if (!stored) {
                return;
            }

            // Get the model from the DOM element - this is the actual model used by VC
            var $element = $btn.closest('.wpb_sortable, [data-model-id]');
            var modelId = $element.data('modelId') || $element.data('model-id') || model.get('id');

            // Get model from parent VC shortcodes collection
            var parentVC = window.parent.vc;
            var targetModel = parentVC && parentVC.shortcodes ? parentVC.shortcodes.get(modelId) : null;

            // Fallback to DOM data or original model
            if (!targetModel) {
                targetModel = $element.data('model') || model;
            }

            var targetShortcode = targetModel.get('shortcode');
            var sourceShortcode = stored.shortcode;
            var currentParams = targetModel.get('params') || {};
            var newParams;

            if (targetShortcode === sourceShortcode) {
                // SAME MODULE TYPE: Replace ALL params with copied ones
                // This ensures dependent fields work correctly (unset params stay unset)
                newParams = $.extend({}, stored.params);

                // Preserve excluded params from original
                EXCLUDED_PARAMS.forEach(function(key) {
                    if (currentParams[key]) {
                        newParams[key] = currentParams[key];
                    }
                });
            } else {
                // DIFFERENT MODULE TYPE: Only copy matching params
                newParams = $.extend({}, currentParams);

                // Get the target module's defined param names from vc.map
                var targetParamNames = getShortcodeParamNames(targetShortcode);

                // Only copy params that are defined in the target module
                for (var key in stored.params) {
                    if (stored.params.hasOwnProperty(key) && EXCLUDED_PARAMS.indexOf(key) === -1) {
                        if (targetParamNames.indexOf(key) !== -1) {
                            newParams[key] = stored.params[key];
                        }
                    }
                }
            }

            // Preserve column width from original
            if (COLUMN_ELEMENTS.indexOf(targetShortcode) !== -1 && currentParams.width) {
                newParams.width = currentParams.width;
            }

            // If source had uncode_shortcode_id but target doesn't, generate a new one
            if (stored.hadShortcodeId && !currentParams.uncode_shortcode_id) {
                newParams.uncode_shortcode_id = generateShortcodeId(6);
            }

            // Update the model
            targetModel.save({ params: newParams });

            // Clear the is_add_element flag to prevent using cached empty form
            if (targetModel.attributes && targetModel.attributes.is_add_element) {
                delete targetModel.attributes.is_add_element;
            }

            // Clear any cached edit panel content for this element
            // This forces a fresh AJAX call when the panel is opened next
            var parentVC = window.parent.vc;
            if (parentVC) {
                // Clear the element-specific AJAX cache
                if (parentVC.EditElementEditorAjaxCache && parentVC.EditElementEditorAjaxCache[modelId]) {
                    delete parentVC.EditElementEditorAjaxCache[modelId];
                }

                // If the edit panel is currently open for this element, re-render it
                if (parentVC.active_panel && parentVC.active_panel.model &&
                    parentVC.active_panel.model.get('id') === modelId) {
                    // Close and reopen to force fresh render with new params
                    parentVC.edit_element_block_view.render(targetModel);
                }
            }

            // Visual feedback
            $btn.addClass('vc_settings-pasted');
            setTimeout(function() { $btn.removeClass('vc_settings-pasted'); }, 1000);
        }

        function updateAllPasteButtons() {
            var stored = getStoredSettings();
            $('.vc_control-btn-paste-settings, .column_paste_settings').each(function() {
                var $btn = $(this);
                if (!stored) {
                    $btn.addClass('vc_btn-disabled');
                } else {
                    $btn.removeClass('vc_btn-disabled');
                }
            });
        }

        function injectSettingsButtons($el, model) {
            var shortcode = model.get('shortcode');
            var isRow = ROW_ELEMENTS.indexOf(shortcode) !== -1;
            var isColumn = COLUMN_ELEMENTS.indexOf(shortcode) !== -1;
            var isTabsAccordion = TABS_ACCORDION_ELEMENTS.indexOf(shortcode) !== -1;
            var $controls, $referenceBtn;

            if (isRow) {
                // For rows: Add to ".controls_row .vc_row_edit_clone_delete", before ".column_paste"
                $controls = $el.find('.controls_row .vc_row_edit_clone_delete').first();
                if (!$controls.length) return;
                $referenceBtn = $controls.find('.column_paste').first();
                if (!$referenceBtn.length) return;
            } else if (isColumn) {
                // For columns: Add to ".vc_control-column", after ".column_paste"
                $controls = $el.find('.vc_control-column').first();
                if (!$controls.length) return;
                $referenceBtn = $controls.find('.column_paste').first();
                if (!$referenceBtn.length) return;
            } else if (isTabsAccordion) {
                // For tabs/accordion containers: .vc_controls-out-tc
                // For tab/accordion_tab items: .vc_controls-tc
                $controls = $el.find('.vc_controls > .vc_controls-out-tc').first();
                if (!$controls.length) {
                    $controls = $el.find('.vc_controls > .vc_controls-tc').first();
                }
                if (!$controls.length) return;
                $referenceBtn = $controls.find('.vc_control-btn-delete').first();
                if (!$referenceBtn.length) return;
            } else if (shortcode === 'uncode_flexbox' || shortcode === 'uncode_flexbox_inner') {
                // For flexbox containers: use container control selectors (same as tabs/accordion)
                $controls = $el.find('.vc_controls > .vc_controls-out-tc').first();
                if (!$controls.length) {
                    $controls = $el.find('.vc_controls > .vc_controls-tc').first();
                }
                if (!$controls.length) return;
                $referenceBtn = $controls.find('.vc_control-btn-delete').first();
                if (!$referenceBtn.length) return;
            } else {
                // For other elements: Add to ".vc_controls-cc", before delete button
                $controls = $el.find('.vc_controls-cc').first();
                if (!$controls.length) return;
                $referenceBtn = $controls.find('.vc_control-btn-delete').first();
                if (!$referenceBtn.length) return;
            }

            // Check if already injected
            if ($controls.find('.vc_control-btn-copy-settings, .column_copy_settings').length) return;

            var stored = getStoredSettings();
            var pasteDisabled = !stored ? ' vc_btn-disabled' : '';

            var $copyBtn, $pasteBtn;
            if (isRow || isColumn) {
                $copyBtn = $('<a class="vc_control column_copy_settings vc_column-copy-settings" href="#" title="Copy Settings"><span class="vc_btn-content">C<span>S</span></span></a>');
                $pasteBtn = $('<a class="vc_control column_paste_settings vc_column-paste-settings' + pasteDisabled + '" href="#" title="Paste Settings"><span class="vc_btn-content">P<span>S</span></span></a>');
            } else {
                $copyBtn = $('<a class="vc_control-btn vc_control-btn-copy-settings" href="#" title="Copy Settings"><span class="vc_btn-content">C<span>S</span></span></a>');
                $pasteBtn = $('<a class="vc_control-btn vc_control-btn-paste-settings' + pasteDisabled + '" href="#" title="Paste Settings"><span class="vc_btn-content">P<span>S</span></span></a>');
            }

            if (isRow) {
                // For rows: insert before reference (special positioning)
                $copyBtn.insertBefore($referenceBtn);
                $pasteBtn.insertBefore($referenceBtn);
            } else {
                // For columns and other elements: insert after delete button
                $copyBtn.insertAfter($referenceBtn);
                $pasteBtn.insertAfter($copyBtn);
            }

            $copyBtn.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                copySettings(model, $copyBtn);
            });

            $pasteBtn.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (!$pasteBtn.hasClass('vc_btn-disabled')) {
                    pasteSettings(model, $pasteBtn);
                }
            });
        }

        // Backend editor initialization
        // Use window.parent.vc for consistency with edit panel events
        var vcRef = (typeof window.parent !== 'undefined' && window.parent.vc) ? window.parent.vc : window.vc;
        if (typeof vcRef !== 'undefined') {
            vcRef.events.on('shortcodeView:ready', function(e) {
                var model = e.model;
                if (!model) return;
                if (!model.view || !model.view.$el) return;

                setTimeout(function() {
                    injectSettingsButtons(model.view.$el, model);
                }, 150);
            });
        }
    })();
}(window.jQuery);
