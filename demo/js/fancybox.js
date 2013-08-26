'use strict';

/**
 * Lightbox directive
 */
angular.module('ui.fancybox', [])

  .value('uiFancyboxConfig', {
    helpers: {
      title: {
        type: 'inside'
      }
    },
    openEffect	: 'none',
		closeEffect	: 'none',
    fancyboxGroup: 'group'
  })
  .directive('uiFancybox', ['uiFancyboxConfig', function (uiFancyboxConfig) {

    return {
      link: function(scope, element, attrs) {

        //Настройка
        var opts = {};
        
        angular.extend(opts, uiFancyboxConfig);
        
        //Групповой тег (не работает)
        if (opts.fancyboxGroup) element.attr('data-fancybox-group', opts.fancyboxGroup);

        scope.$watch(attrs.oiFile, function (newVal, oldVal) {
          opts = angular.extend({}, uiFancyboxConfig, newVal);
        }, true);
            
        //Привязываем лайтбокс к элементу
        element.fancybox(opts);

      }
    };
  }]);