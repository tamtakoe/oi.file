'use strict';

/* App Module */

angular.module('uploaderApp', ['ngResource', 'oi.list', 'oi.file', 'ui.sortable', 'ui.filters', 'ui.focusblur', 'ui.fancybox'])

    .factory('Files', function ($resource) {
        return $resource('action.php/files/:fileId', {fileId:'@id'}, {
            add: {method: 'PUT'}
        })
    })

    .controller('MyCtrl', ['$scope', 'Files', 'oiList', function ($scope, Files, oiList) {
        
        var url = 'action.php/files/';
        
        oiList($scope, url, Files, {fields: {thumb: 'files_thumb/preloader.gif'}})
        
        $scope.uploadoptions = {
            change: function (file) {
              //Создаем пустой элемент для будущего файла
              $scope.add('after', function (i, data) {
              
                file.$preview($scope.items[i]).then(
                    function (data) {
                      console.log('preview success', data)
                    },
                    function (data) {
                      console.log('preview error', data);
                    });
                
                file.$upload(url + data.id, $scope.items[i], data.settings).then(
                    function (data) {
                      console.log('upload success', data)
                    },
                    function (data) {
                      console.log('upload error', data);
                      $scope.errors = angular.isArray($scope.errors) ? $scope.errors.concat(data.response) : [].concat(data.response);
                      $scope.del($scope.getIndexById(data.item.id));
                    },
                    function (data) {
                      console.log('upload notify', data)
                    })
              })
            }
        }
    }])
