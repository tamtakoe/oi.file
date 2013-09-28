'use strict';

/** 
* oi.file v.1.2
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
* Имена полей, добавляемых в модель (для каждого файла)
* @fileName string.      Имя файла - 'filename'
* @fileThumb string.     Ссылка на миниатюру - 'thumb',
* @fileSize string.      Размер файла, байт - 'size',
* @fileLoaded string.    Количество загруженный байт - 'loaded'
* @fileProgress string.  Процент загрузки (в конце это поле удалится) - 'progress'
* @fileUploading string. Находится ли файл в процессе загрузки - 'uploading' 
*
* Имена полей, добавляемых в область видимости
* @queue string. Очередь загрузки - 'uploading'. Содержит так же общие параметры:
*                queue.total    - общий вес загружаемых файлов
*                queue.loaded   - общий вес загруженных файлов
*                queue.progress - общий прогресс загружаемых файлов
*                queue.all      - количество загружаемых файлов
*                queue.lenght   - количество загруженных файлов (родное свойство массива, кстати ;)
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
        delete data.item[this.fileUploading];
      }
      return {item: data.item, response: errors};
    },
    
    //Параметры
    url:           'uploader.php',  //Скрипт загрузки
    fieldName:     'Files',         //Ключ в массиве $_FILES
    fileClass:     'dragover-file', //Имя класса, если перетаскивается файл
    notFileClass:  'dragover-plain',//Имя класса, если перетаскивается не файл

    //Поля, добавляемые в модель
    fileName:      'filename',
    fileThumb:     'thumb',
    fileSize:      'size',
    fileLoaded:    'loaded',
    fileProgress:  'progress',
    fileUploading: 'uploading',
    
    //Поля, добавляемые в область видимости
    queue: 'uploading' //Очередь загрузки. Содержит так же общие параметры:
                       // queue.total    - общий вес загружаемых файлов
                       // queue.loaded   - общий вес загруженных файлов
                       // queue.progress - общий прогресс загружаемых файлов
                       // queue.all      - количество загружаемых файлов
                       // queue.lenght   - количество загруженных файлов (родное свойство массива, кстати ;)  
  })
  
  .directive('oiFile', ['oiFileConfig', '$q', '$compile', '$timeout', function (oiFileConfig, $q, $compile, $timeout) {
  
    var queue = []; //Очередь файлов на загрузку. Вынесена отдельно, т.к. упрощает поочередную загрузку фалов и решает проблему циклических ссылок на xhr
    
    return {
      link: function (scope, element, attrs) {
    
        //Настройка загрузчика
        var opts = {};
        
        angular.extend(opts, oiFileConfig);
        
        scope.$watch(attrs.oiFile, function (newVal, oldVal) {
          opts = angular.extend({}, oiFileConfig, newVal);
        }, true);
        
        scope[opts.queue] = queue;

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
          if (typeof opts.change === 'function') {
            // iframe fix for old browsers
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
                  $abort: _abort,
                  _file: files[i]
                };
                file[opts.fileName]      = files[i].name;
                file[opts.fileThumb]     = files[i].thumb;
                file[opts.fileSize]      = files[i].size;
                file[opts.fileLoaded]    = 0;
                file[opts.fileProgress]  = 0;
                file[opts.fileUploading] = true;

                //Передаем каждый файл в функцию, которая отправит его на загрузку
                opts.change(file);
              }
            });
          }
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
            return uploadDeferred.promise;
          }

          //Собираем все необходимые для загрузки данные в один объект и помещаем его в очередь
          var uploadObject = {
            url:      url,
            item:     item,
            deferred: uploadDeferred,
            xhr: undefined //ссылку на xhr храним в очереди, а не в модели файла (item), чтобы избежать циклической ссылки, т.к. в xhr хранится ссылка на item
                           //иначе возникает ошибка (Error: An attempt was made to use an object that is not, or is no longer, usable.)
          }
          queue.push(uploadObject);
          
          //Начинаем загрузку при добавлении первого файла (пока загрузка не завершена остальные элементы будут добавляться в эту же очередь, иначе создастся новая очередь)
          if (queue.length === 1) {
            queue.total    = item[opts.fileSize];
            queue.loaded   = 0;
            queue.progress = 0;
            queue.all      = 1;
            
            _uploadQueue();
            
          } else {
            queue.total += item[opts.fileSize];
            queue.all++;
          }
          
          //Загрузка следующего файла начинается когда предыдущий загружен либо отменен
          function _uploadQueue () {
            if (queue.length) {
            
              queue[0].item._file._form ? _iframeTransport(queue[0]) : _xhrTransport(queue[0]);
              
              queue[0].deferred.promise.all(function () {
                //Удаляем этот и переходим к следующему элементу очереди в случае завершения загрузки или ошибки (в т. ч. из-за отмены)
                queue.shift();
                _uploadQueue();
              })
            } else {
              //Обнуляем очередь когда все файлы загружены
              delete queue.total;
              delete queue.loaded;
              delete queue.all;
              delete queue.progress;
            }
          }
          
          return uploadDeferred.promise;
        }
        
        //Отмена загрузки
        function _abort () {
          //forEach используется для организации замыкания для передачи каждого элемента value в setTimeout
          angular.forEach(queue, function (value, key) {
            if (value.item === this) {
              if (value.xhr) {
                //Если запустить abort напрямую возникает ошибка (Error: apply already in progress)
                setTimeout(function () {
                  value.xhr.abort();
                }, 0)
              } else {
                //Удаляем из очереди элемент, который еще не начал загружаться
                queue.splice(key, 1);
              }
              queue.total -= value.item[opts.fileSize];
              queue.loaded -= value.item[opts.fileLoaded];
              queue.all--;  
            }
          }, this)
        }
        
        //xhr-загрузчик
        function _xhrTransport (uObj) {
      
          var xhr = new XMLHttpRequest(),
              form = new FormData();
              
          xhr.item = uObj.item;
          uObj.xhr = xhr;
          
          form.append(opts.fieldName, uObj.item._file);

          angular.forEach( uObj.item._file.headers, function (value, name) {
            xhr.setRequestHeader(name, value);
          });
              
          xhr.upload.addEventListener('progress', function (e) {
            
            scope.$apply(function () {
              //Вычисляем прогресс загрузки файла
              uObj.item[opts.fileLoaded]   = e.lengthComputable ? e.loaded : undefined;
              uObj.item[opts.fileProgress] = e.lengthComputable ? Math.round(e.loaded * 100 / e.total) : undefined;
              
              //Вычисляем общий прогресс загрузки всех файлов
              queue.loaded += uObj.item[opts.fileLoaded];
              queue.progress = Math.round(queue.loaded * 100 / queue.total);
              xhr.data = e;
            });
          }, false);

          xhr.addEventListener('load', function () {
                  
            var response = xhr.data = _parseJSON(xhr.responseText);

            delete uObj.item._file; //удаляем техническую информацию о загружаемом файле из модели
            delete uObj.item.$abort;
            delete uObj.item[opts.fileProgress];
            delete uObj.item[opts.fileLoaded];
            delete uObj.item[opts.fileUploading];
            
            scope.$apply(function () {
              if (xhr.status === 200 && response) {
                angular.extend(uObj.item, response);
                uObj.deferred.resolve(xhr);
                
              } else {
                uObj.deferred.reject(opts.setError('upload', xhr));
              }
            });
          }, false);

          xhr.addEventListener('error', function () {
            xhr.data = _parseJSON(xhr.responseText);
            
            scope.$apply(function () {
              uObj.deferred.reject(opts.setError('load', xhr));
            });
          }, false);

          xhr.addEventListener('abort', function () {
            xhr.data = _parseJSON(xhr.responseText);
            
            scope.$apply(function () {
              uObj.deferred.reject(opts.setError('abort', xhr));
            });
          }, false);

          xhr.open('POST', uObj.url, true);
          xhr.send(form);
        }

        //iframe-загрузчик
        function _iframeTransport (uObj) {
          
          uObj.xhr = false;
          
          var form = uObj.item._file._form,
              iframe = form.find('iframe'),
              input = form.find('input');

          input.prop('name', opts.fieldName);

          form.prop({
            action: uObj.url,
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
            delete uObj.item._file; //удаляем техническую информацию о загружаемом файле из модели

            scope.$apply(function () {
              if (response && !response.error) { //Нельзя узнать статус загрузки во фрейм, поэтому ошибка определяется наличием параметра error в ответе
                angular.extend(uObj.item, response);
                uObj.deferred.resolve({item: uObj.item, response: response});

              } else {
                uObj.deferred.reject(opts.setError('upload', {responseText: rawResponse, data: response, item: uObj.item, dummy: true}));
              }
            });
          });
          
          form[0].submit();
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