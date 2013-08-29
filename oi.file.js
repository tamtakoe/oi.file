'use strict';

/** 
* oi.file v.1.0
* https://github.com/tamtakoe/oi.file
* Oleg Istomin 2013
*
* Licensed under the MIT license:
* http://www.opensource.org/licenses/MIT
*
* НАСТРОЙКА
* @change function. Получение объекта файла. Если null — не обрабатывается
*   - file object   - объект файла, содержащий информацию о выбранном файле и методы:
*         $preview: function (item, [field])       //item - модель, field - поле с миниатюрой, которое добавится в модель (если не указано, берется по умолчанию)
*                                                  //Возвращает обещание с колбеками: success, error
*         $upload:  function (url, item, [permit]) //url - скрипт загрузки, item - модель (можно указать {}), permit - объект параметров валидации (см. ниже)
*                                                  //Возвращает обещание с колбеками: success, error, notice
*
*  В колбеки обещания передается xhr (или макет, при загрузке через iframe), дополненный полями:
*  item: {...}           //модель, в которую осуществлялась загрузка
*  response: {...}       //ответ сервера, раскодированный из JSON
*  uploadingItems: [...] //Массив элементов, загружающийся в данный момент
*
* @validate function. Валидация файлов
*   - file object   - объект файла
*   - permit object - параметры для валидации. Пример:
*         allowedType: ["jpeg", "jpg", "png", "gif"], //список разрешенных расширений
*         maxNumberOfFiles: 100, //максимальное количество файлов
*         maxSize: 4194304,      //максимальный размер файла
*         maxSpace: 104857600,   //максимально доступное место на сервере
*         quantity: 3,           //загружено файлов
*         space: 481208,         //занято места
*         errorBadType: "Можно загружать: JPEG, JPG, PNG, GIF", //Фразы ошибок...
*         errorBigSize: "Вес не более 4 МБ",
*         errorMaxQuantity: "Загружено максимальное количество файлов: 100",
*         errorMaxSize: "Осталось 2,3 МБ свободного места"
*   - return object - массив объектов ошибок [{msg: 'текст ошибки', code: 'код'}, {...}, ... ]
*
* @setError function. Обработка ошибок
*   - code string - код ошибки
*   - data object - xhr (или макет, при загрузке через iframe), дополненный полями:
*         item: {...}     //модель, в которую осуществлялась загрузка
*         response: {...} //ответ сервера, раскодированный из JSON
*
* @url string.          Путь по умолчанию до скрипта загрузки
* @fieldName string.    Ключ в массиве $_FILES - 'Files'
* @fileClass string.    Имя класса, если перетаскивается файл - 'dragover-file'
* @notFileClass string. Имя класса, если перетаскивается не файл - 'dragover-plain'
*
* Имена полей, добавляемых в модель
* @fileName string.     Имя файла - 'filename'
* @fileThumb string.    Ссылка на миниатюру - 'thumb',
* @fileSize string.     Размер файла, байт - 'size',
* @fileLoaded string.   Количество загруженный байт - 'loaded'
* @fileProgress string. Процент загрузки (в конце это поле удалится) - 'progress'
*
* Имена полей, добавляемых в область видимости
* @filesLoadedAll string.   Количество загруженный байт в загружаемых файлах - 'loadedAll'
* @filesProgressAll string. Процент загрузки всех загружаемых файлов - 'progressAll'
*/

angular.module('oi.file', [])

  //Настройка по умолчанию
  .value('oiFileConfig', {
  
    //Обработка выбранных файлов
    change: function (file) {
        //Загружаем файл сразу после добавления
        file.$upload(this.url, {});
    },
    
    //Валидация
    validate: function (file, permit) {

      var errors = [];
      
      if (typeof permit === 'object') {
      
        if (permit.allowedType === null || permit.allowedType.indexOf(file[this.fileName].toLowerCase().split(".").pop()) === -1) {
            errors.push({msg: permit.errorBadType, code: 'type'});
        }
        if (file[this.fileSize] > (+permit.maxSize ? permit.maxSize : Infinity)) {
            errors.push({msg: permit.errorBigSize, code: 'size'});
        }
        if (file[this.fileSize] > (+permit.maxSpace ? permit.maxSpace: Infinity) - permit.space) {
            errors.push({msg: permit.errorMaxSize, code: 'full'});
        }
        if (permit.maxNumberOfFiles && permit.quantity >= permit.maxNumberOfFiles) {
            errors.push({msg: permit.errorMaxQuantity, code: 'quantity'});
        }
      }
      return errors.length ? errors : false;
    },
    
    //Получение текста ошибки и передача его в обработчик ошибок
    setError: function (code, data) {
      
      var response = data.data;
      var errors = response ? response.error ? [response.error] : response : [];

      if (!errors.length) {
        switch (code) {
          case 'drop'    : errors.push({msg: 'Перетаскивание файлов не поддерживается. Обновите браузер', code: code}); break;
          case 'validate': errors.push({msg: 'Файл не прошел валидацию', code: code});                                  break;
          case 'preview' : errors.push({msg: 'Чтение миниматюр не поддерживается. Обновите браузер', code: code});      break;
          case 'load'    : errors.push({msg: 'Невозможно загрузить файл. Нет соединения с интернетом', code: code});    break;
          case 'upload'  : errors.push({msg: 'Невозможно загрузить файл. Проблемы на сервере', code: code});            break;
          case 'abort'   : errors.push({msg: 'Загрузка прервана', code: code});                                         break;
        }
      }
      if (data.item[this.fileLoaded]) {
        delete data.item[this.fileLoaded]; //Сбрасываем прогресс
        delete data.item[this.fileProgress];
      }
      return {item: data.item, response: errors};
    },
    
    //Параметры
    url:          'uploader.php',  //Скрипт загрузки
    fieldName:    'Files',         //Ключ в массиве $_FILES
    fileClass:    'dragover-file', //Имя класса, если перетаскивается файл
    notFileClass: 'dragover-plain',//Имя класса, если перетаскивается не файл

    //Поля, добавляемые в модель
    fileName:     'filename',
    fileThumb:    'thumb',
    fileSize:     'size',
    fileLoaded:   'loaded',
    fileProgress: 'progress',
    
    //Поля, добавляемые в область видимости
    filesLoadedAll:   'loadedAll',
    filesProgressAll: 'progressAll'
  })
  
  .directive('oiFile', ['oiFileConfig', '$q', '$compile', function (oiFileConfig, $q, $compile) {
    var uploadingItems = [];
    
    return {
      link: function (scope, element, attrs) {
    
        //Настройка загрузчика
        var opts = {};
        
        angular.extend(opts, oiFileConfig);
        
        scope.$watch(attrs.oiFile, function (newVal, oldVal) {
          opts = angular.extend({}, oiFileConfig, newVal);
        }, true);

        //Перетаскивание файлов на поле
        element
          .bind('drop', function(e) {
            var dataTransfer = e.dataTransfer ? e.dataTransfer : e.originalEvent.dataTransfer; // jQuery fix;
            
            e.stopPropagation();
            e.preventDefault();

            dataTransfer.files ? _add(dataTransfer.files) : opts.setError('drop');
            
            element.removeClass(opts.fileClass + ' ' + opts.notFileClass);
          })
          
          .bind('dragover', function(e) {
            var dataTransfer = e.dataTransfer ? e.dataTransfer : e.originalEvent.dataTransfer; // jQuery fix;

            e.stopPropagation();
            e.preventDefault();  
            dataTransfer.dropEffect = 'copy';
            
            //Проверяем, что перетаскиваются именно файлы
            dataTransfer && dataTransfer.types && dataTransfer.types.indexOf('Files') >= 0 ? element.addClass(opts.fileClass) : element.addClass(opts.notFileClass);
          })
          
          .bind('dragleave', function(e) {
            e.stopPropagation();
            e.preventDefault();
            
            element.removeClass(opts.fileClass + ' ' + opts.notFileClass);
          })
        
        //Выбор файлов в диалоге
          .bind('change', function () {
            _add(this.files ? this.files : this);
            //_add(this);
          });
          
        //Добавление файлов в очередь загрузки
        function _add(files) {
          // fix for old browsers
          if (angular.isElement(files)) {
            var input = angular.element(files),
                form = angular.element('<form style="display: none;" />'),
                iframe = angular.element('<iframe src="javascript:false;" name="iframeTransport' + +new Date() + '">');
            var clone = $compile(input.clone())(scope),
                value = input.val();
            
            files = [{
              lastModifiedDate: null,
              size: null,
              type: 'like/' + value.replace( /^.+\.(?!\.)|.*/, '' ),
              name: value.match( /[^\\]+$/ )[0],
              _form: form
            }];
            
            input.after(clone).after(form);
            form.append(input).append(iframe);
          }
          
          scope.$apply(function (scope) {
            for (var i = 0, n = files.length; i < n; i++) {
              // Создаем объект файла для модели
              var file = {
                $upload: _upload,
                $preview: _preview,
                _file: files[i]
              };
              
              file[opts.fileName]     = files[i].name;
              file[opts.fileThumb]    = files[i].thumb;
              file[opts.fileSize]     = files[i].size;

              //Передаем каждый файл в функцию, которая отправит его на загрузку
              if (typeof opts.change === 'function') opts.change(file);
            }
          });
        }
        
        //Предпросмотр файлов
        function _preview (item, thumb) {
          var previewDeferred = $q.defer(),
              data = {item: item, response: {}};
              
          thumb = thumb ? thumb : opts.fileThumb;

          if (window.FileReader !== null) {
            var reader = new FileReader();
            
            reader.onload = (function (image) {
              return function (event) {
                if (event.target.result.indexOf('data:image') !== -1) {
                  scope.$apply(function(){
                    //Файл прочитан
                    item[thumb] = reader.result;
                    data.response[thumb] = reader.result;
                    
                    previewDeferred.resolve(data);
                  });
                }
              };
            })(this);
            reader.readAsDataURL(this._file);
            
          } else if (typeof opts.preview === 'function') {
            //Чтение файлов не поддерживается
            previewDeferred.reject(opts.setError('preview', {item: item, response: null}))
          }
          
          return previewDeferred.promise;
        }
                   
        //Загрузка файлов         
        function _upload (url, item, permit) {
        
          var uploadDeferred = $q.defer();
          
          item = angular.extend(item, this);
          delete item.$upload;
          delete item.$preview;

          var errors = opts.validate(item, permit);
          
          if (errors) {
            uploadDeferred.reject(opts.setError('validate', {item: item, data: errors}));
            return uploadDeferred.promise
          }
          item._file._form ? _iframeTransport(url, item, uploadDeferred) : _xhrTransport(url, item, uploadDeferred);
          
          return uploadDeferred.promise
        }
        
        //xhr-загрузчик
        function _xhrTransport (url, item, uploadDeferred) {
      
          var xhr = new XMLHttpRequest(),
              form = new FormData();

          form.append(opts.fieldName, item._file);

          angular.forEach( item._file.headers, function (value, name) {
            xhr.setRequestHeader(name, value);
          });
          xhr.uploadingItems = uploadingItems;
          uploadingItems.push(item);         
              
          xhr.upload.addEventListener('progress', function (e) {

            scope.$apply(function () {
              //Вычисляем прогресс загрузки файла
              item[opts.fileLoaded]   = e.lengthComputable ? e.loaded : undefined;
              item[opts.fileProgress] = e.lengthComputable ? Math.round(e.loaded * 100 / e.total) : undefined;
              
              //Вычисляем общий прогресс загрузки всех файлов
              for (var i = 0, n = uploadingItems.length, totalAll = 0, loadedAll = 0; i < n; i++) {
                totalAll  = totalAll  + !!uploadingItems[i][opts.fileSize];
                loadedAll = loadedAll + !!uploadingItems[i][opts.fileLoaded];
              }
              scope[opts.filesLoadedAll]   = loadedAll;
              scope[opts.filesProgressAll] = Math.round(loadedAll * 100 / totalAll);

              xhr.data = e;
              xhr.data.totalAll  = totalAll;
              xhr.data.loadedAll = loadedAll;
              
              if (uploadDeferred.notify) uploadDeferred.notify(xhr)
            });
          }, false);

          xhr.addEventListener('load', function () {
                  
            var response = xhr.data = _parseJSON(xhr.responseText);

            delete item._file; //удаляем техническую информацию о загружаемом файле из модели
            delete item[opts.fileProgress];
            delete item[opts.fileLoaded];

            scope.$apply(function () {
              updateProgressAll(item, uploadingItems);

              if (xhr.status === 200 && response) {
                angular.extend(item, response);
                uploadDeferred.resolve(xhr);
                
              } else {
                uploadDeferred.reject(opts.setError('upload', xhr));
              }
            });
          }, false);

          xhr.addEventListener('error', function () {
            xhr.data = _parseJSON(xhr.responseText);
            
            scope.$apply(function () {
              updateProgressAll(item, uploadingItems);
              uploadDeferred.reject(opts.setError('load', xhr));
            });
          }, false);

          xhr.addEventListener('abort', function () {
            xhr.data = _parseJSON(xhr.responseText);
            
            scope.$apply(function () {
              updateProgressAll(item, uploadingItems);
              uploadDeferred.reject(opts.setError('abort', xhr));
            });
          }, false);
          
          xhr.item = item;
          xhr.open('POST', url, true);
          xhr.send(form);
        }

        //iframe-загрузчик
        function _iframeTransport (url, item, uploadDeferred) {

          var form = item._file._form,
              iframe = form.find('iframe'),
              input = form.find('input');

          input.prop('name', opts.fieldName);

          form.prop({
            action: url,
            method: 'post',
            target: iframe.prop('name'),
            enctype: 'multipart/form-data',
            encoding: 'multipart/form-data' // old IE
          });

          iframe.bind('load', function () {
            var response, rawResponse;
            // Wrap in a try/catch block to catch exceptions thrown
            // when trying to access cross-domain iframe contents:
            try {
              response = iframe.contents();
              // Google Chrome and Firefox do not throw an
              // exception when calling iframe.contents() on
              // cross-domain requests, so we unify the response:
              if (!response.length || !response[0].firstChild) throw new Error();
              
              rawResponse = angular.element(response[0].body).text();
              response = _parseJSON(rawResponse);
            } catch (e) {}
            
            form.remove(); //Удаляем скрытую форму
            delete item._file //удаляем техническую информацию о загружаемом файле из модели

            scope.$apply(function () {
              if (response && !response.error) { //Нельзя узнать статус загрузки во фрейм, поэтому ошибка определяется наличием параметра error в ответе
                angular.extend(item, response);
                uploadDeferred.resolve({item: item, response: response});

              } else {
                uploadDeferred.reject(opts.setError('upload', {responseText: rawResponse, data: response, item: item, dummy: true}));
              }
            });
          });
          
          form[0].submit();
        }
        
        //Удаляем загрузившиеся элементы из списка загружаемых
        function updateProgressAll (item, uploadingItems) {
        
          for (var i = 0, n = uploadingItems.length; i < n; i++) {
            if (item === uploadingItems[i]) uploadingItems.splice(i);
          }
          if (!uploadingItems.length) {
            scope[opts.filesLoadedAll]   = undefined;
            scope[opts.filesProgressAll] = undefined;
          }
        }
        
        //Парсим JSON
        function _parseJSON (data) {
        
          if (typeof data !== 'object') {
            try {
              return angular.fromJson(data);
            } catch (e) {
              return false;
            }
          }
          return data;
        }
      }
    };
  }]);